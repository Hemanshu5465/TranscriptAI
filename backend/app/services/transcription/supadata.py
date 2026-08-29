"""Provider: Supadata (https://supadata.ai).

A hosted transcript API that fetches YouTube captions server-side (so it works
from datacenter IPs like Vercel, where youtube-transcript-api gets blocked) and
falls back to AI generation for videos without captions. Free tier: 100/month,
no card. Set ``SUPADATA_API_KEY``.
"""
from __future__ import annotations

import logging
import time

import httpx

from app.config.settings import settings
from app.services.transcription.base import (
    ProviderUnavailable,
    Segment,
    TranscriptionPending,
    TranscriptionProvider,
    TranscriptionRequest,
    TranscriptionResult,
    TranscriptSourceNotFound,
)

logger = logging.getLogger(__name__)

_BASE = "https://api.supadata.ai/v1"
# Short synchronous wait — most jobs finish fast. Longer ones become a pending
# job the pipeline finalises via /status polling (see transcript_service).
_QUICK_POLL_ATTEMPTS = 3
_QUICK_POLL_INTERVAL = 3.0


class SupadataProvider(TranscriptionProvider):
    name = "supadata"

    def is_available(self) -> bool:
        return bool(settings.supadata_api_key)

    def transcribe(self, request: TranscriptionRequest) -> TranscriptionResult:
        if not settings.supadata_api_key:
            raise ProviderUnavailable("SUPADATA_API_KEY is not configured.")

        is_file = request.source_kind == "file"
        headers = {"x-api-key": settings.supadata_api_key}
        params = {"url": request.canonical_url, "mode": "generate" if is_file else "auto"}
        if request.preferred_languages and not is_file:
            params["lang"] = request.preferred_languages[0]

        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.get(f"{_BASE}/transcript", params=params, headers=headers)
                data = self._handle(resp, is_file=is_file)
                if data is None:  # async job
                    job_id = str(resp.json().get("jobId"))
                    data = self._quick_poll(client, job_id, headers)
                    if data is None:
                        raise TranscriptionPending(job_id, provider=self.name)
        except httpx.HTTPError as exc:
            logger.warning("Supadata request failed: %s", exc)
            raise ProviderUnavailable("The transcript service is unreachable right now.")

        return self._to_result(data)

    def check_job(self, job_id: str) -> TranscriptionResult | None:
        """Poll a pending Supadata job once. None = still running; raises on failure."""
        headers = {"x-api-key": settings.supadata_api_key}
        try:
            with httpx.Client(timeout=30.0) as client:
                r = client.get(f"{_BASE}/transcript/{job_id}", headers=headers)
        except httpx.HTTPError as exc:
            logger.warning("Supadata job poll failed: %s", exc)
            return None
        data = self._job_body(r)
        return self._to_result(data) if data is not None else None

    # --- internals --------------------------------------------------------

    def _handle(self, resp: httpx.Response, *, is_file: bool = False) -> dict | None:
        if resp.status_code == 202:
            return None
        if resp.status_code == 200:
            return resp.json()
        if resp.status_code == 400:
            if is_file:
                raise TranscriptSourceNotFound(
                    "This file couldn't be transcribed. Use MP4, WebM, MP3, M4A or "
                    "WAV — MOV/MKV/AVI aren't supported. Max 750 MB / 12 hours."
                )
            raise ProviderUnavailable(_msg(resp) or "That URL couldn't be processed.")
        if resp.status_code == 402:
            raise ProviderUnavailable(
                "This exceeds the transcript service's free allowance. "
                "Try a shorter file or add credits."
            )
        if resp.status_code in (206, 416):
            raise TranscriptSourceNotFound(
                "No speech was found in this file." if is_file
                else "No transcript is available for this video."
            )
        if resp.status_code == 404:
            raise ProviderUnavailable(
                "The uploaded file could not be reached." if is_file
                else "This video is unavailable or cannot be accessed."
            )
        if resp.status_code in (401, 403):
            detail = _msg(resp)
            if resp.status_code == 401:
                raise ProviderUnavailable(
                    "The transcript service rejected the API key (SUPADATA_API_KEY)."
                )
            raise ProviderUnavailable(detail or "This video is restricted.")
        if resp.status_code == 429:
            raise ProviderUnavailable(
                "Monthly transcript quota reached. Add credits or try again next month."
            )
        raise ProviderUnavailable(_msg(resp) or f"Transcript service error {resp.status_code}.")

    def _quick_poll(self, client: httpx.Client, job_id: str, headers: dict) -> dict | None:
        for _ in range(_QUICK_POLL_ATTEMPTS):
            time.sleep(_QUICK_POLL_INTERVAL)
            r = client.get(f"{_BASE}/transcript/{job_id}", headers=headers)
            data = self._job_body(r)
            if data is not None:
                return data
        return None  # still running — caller raises TranscriptionPending

    @staticmethod
    def _job_body(r: httpx.Response) -> dict | None:
        """Parse a job-poll response. None = still queued/active; raises on failure."""
        if r.status_code != 200:
            raise ProviderUnavailable(_msg(r) or "Transcript job failed.")
        body = r.json()
        status = body.get("status")
        if status == "failed":
            raise TranscriptSourceNotFound(
                body.get("error") or "The transcript could not be generated."
            )
        if status in ("queued", "active"):
            return None
        # completed (or no status field on a finished job) → the transcript payload
        return body.get("result") or body

    @staticmethod
    def _to_result(data: dict) -> TranscriptionResult:
        content = data.get("content")
        language = data.get("lang")

        segments: list[Segment] = []
        if isinstance(content, list):
            for item in content:
                text = (item.get("text") or "").strip()
                if not text:
                    continue
                start = float(item.get("offset", 0)) / 1000.0
                dur = float(item.get("duration", 0)) / 1000.0
                segments.append(Segment(start=start, end=start + max(dur, 0.5), text=text))
        elif isinstance(content, str) and content.strip():
            # text=true style response — one block, no timing
            segments.append(Segment(start=0.0, end=1.0, text=content.strip()))

        if not segments:
            raise TranscriptSourceNotFound(
                "No transcript could be generated — the audio may be silent, "
                "music-only, or in a format the service can't read."
            )

        return TranscriptionResult(
            segments=segments,
            language=language,
            language_confidence=0.95,
            provider="supadata",
            source="supadata",
            has_word_timestamps=False,
            has_speaker_labels=False,
        )


def _msg(resp: httpx.Response) -> str:
    try:
        body = resp.json()
        return body.get("message") or body.get("error") or ""
    except Exception:  # noqa: BLE001
        return ""
