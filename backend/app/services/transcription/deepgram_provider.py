"""Provider: Deepgram (cloud STT).

Best fit for uploaded files: URL-based (no download / size limit on our side),
handles video containers, returns paragraph + word timestamps. Generous free
credit. Set ``DEEPGRAM_API_KEY``.
"""
from __future__ import annotations

import logging

import httpx

from app.config.settings import settings
from app.services.transcription.base import (
    ProviderUnavailable,
    Segment,
    TranscriptionProvider,
    TranscriptionRequest,
    TranscriptionResult,
    TranscriptSourceNotFound,
    Word,
)

logger = logging.getLogger(__name__)

_URL = "https://api.deepgram.com/v1/listen"
_PARAMS = {
    "model": "nova-2",
    "smart_format": "true",
    "punctuate": "true",
    "paragraphs": "true",
    "detect_language": "true",
}


class DeepgramProvider(TranscriptionProvider):
    name = "deepgram"

    def is_available(self) -> bool:
        return bool(settings.deepgram_api_key)

    def transcribe(self, request: TranscriptionRequest) -> TranscriptionResult:
        if not settings.deepgram_api_key:
            raise ProviderUnavailable("DEEPGRAM_API_KEY is not configured.")
        if request.source_kind != "file":
            # YouTube audio isn't fetchable from datacenter IPs — leave that to
            # the caption providers.
            raise ProviderUnavailable("Deepgram is only used for uploaded files here.")

        headers = {
            "Authorization": f"Token {settings.deepgram_api_key}",
            "Content-Type": "application/json",
        }
        try:
            # Stay under the serverless function limit; a longer file falls
            # through to Supadata's async job handling.
            with httpx.Client(timeout=httpx.Timeout(52.0, connect=15.0)) as client:
                resp = client.post(
                    _URL,
                    params=_PARAMS,
                    headers=headers,
                    json={"url": request.canonical_url},
                )
        except httpx.TimeoutException:
            raise ProviderUnavailable(
                "This file is long — direct transcription timed out."
            )
        except httpx.HTTPError as exc:
            logger.warning("Deepgram request failed: %s", exc)
            raise ProviderUnavailable("The transcription service is unreachable right now.")

        if resp.status_code in (401, 403):
            raise ProviderUnavailable("The transcription service rejected the API key.")
        if resp.status_code == 402:
            raise ProviderUnavailable("The Deepgram credit balance is exhausted.")
        if resp.status_code == 400:
            raise TranscriptSourceNotFound(
                "This file couldn't be transcribed. Use MP4, WebM, MP3, M4A or WAV."
            )
        if resp.status_code >= 500:
            raise ProviderUnavailable("The transcription service had an error. Try again.")
        resp.raise_for_status()

        return self._to_result(resp.json())

    @staticmethod
    def _to_result(data: dict) -> TranscriptionResult:
        channels = (data.get("results") or {}).get("channels") or []
        alt = (channels[0].get("alternatives") or [{}])[0] if channels else {}

        language = None
        for ch in channels:
            language = ch.get("detected_language") or language

        segments: list[Segment] = []
        para_block = (alt.get("paragraphs") or {}).get("paragraphs") or []
        for para in para_block:
            for sent in para.get("sentences") or []:
                text = (sent.get("text") or "").strip()
                if not text:
                    continue
                start = float(sent.get("start", 0.0))
                end = float(sent.get("end", start + 1.0))
                segments.append(Segment(start=start, end=max(end, start + 0.3), text=text))

        if not segments:
            # fall back to word-grouping if paragraphs weren't returned
            words = alt.get("words") or []
            buf: list[Word] = []
            for w in words:
                buf.append(
                    Word(
                        text=w.get("punctuated_word") or w.get("word", ""),
                        start=float(w.get("start", 0.0)),
                        end=float(w.get("end", 0.0)),
                        confidence=w.get("confidence"),
                    )
                )
                if (w.get("punctuated_word") or "").endswith((".", "!", "?")) or len(buf) >= 25:
                    segments.append(
                        Segment(
                            start=buf[0].start,
                            end=buf[-1].end,
                            text=" ".join(x.text for x in buf).strip(),
                            words=buf,
                        )
                    )
                    buf = []
            if buf:
                segments.append(
                    Segment(start=buf[0].start, end=buf[-1].end,
                            text=" ".join(x.text for x in buf).strip(), words=buf)
                )

        if not segments:
            raise TranscriptSourceNotFound(
                "No speech was found in this file (it may be silent or music-only)."
            )

        return TranscriptionResult(
            segments=segments,
            language=language,
            language_confidence=float(alt.get("confidence") or 0.0) or None,
            provider="deepgram",
            source="deepgram",
            has_word_timestamps=bool(alt.get("words")),
            has_speaker_labels=False,
        )
