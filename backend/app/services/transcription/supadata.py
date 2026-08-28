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
    TranscriptionProvider,
    TranscriptionRequest,
    TranscriptionResult,
    TranscriptSourceNotFound,
)

logger = logging.getLogger(__name__)

_BASE = "https://api.supadata.ai/v1"
_POLL_TIMEOUT = 50  # seconds — stay under the serverless function limit
_POLL_INTERVAL = 2.5


class SupadataProvider(TranscriptionProvider):
    name = "supadata"

    def is_available(self) -> bool:
        return bool(settings.supadata_api_key)

    def transcribe(self, request: TranscriptionRequest) -> TranscriptionResult:
        if not settings.supadata_api_key:
            raise ProviderUnavailable("SUPADATA_API_KEY is not configured.")

        headers = {"x-api-key": settings.supadata_api_key}
        params = {"url": request.canonical_url, "mode": "auto"}
        if request.preferred_languages:
            params["lang"] = request.preferred_languages[0]

        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.get(f"{_BASE}/transcript", params=params, headers=headers)
                data = self._handle(resp)
                if data is None:  # async job
                    data = self._poll(client, resp.json()["jobId"], headers)
        except httpx.HTTPError as exc:
            logger.warning("Supadata request failed: %s", exc)
            raise ProviderUnavailable("The transcript service is unreachable right now.")

        return self._to_result(data)

    # --- internals --------------------------------------------------------

    def _handle(self, resp: httpx.Response) -> dict | None:
        if resp.status_code == 202:
            return None
        if resp.status_code == 200:
            return resp.json()
        if resp.status_code in (206, 416):
            raise TranscriptSourceNotFound(
                "No transcript is available for this video."
            )
        if resp.status_code == 404:
            raise ProviderUnavailable("This video is unavailable or cannot be accessed.")
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

    def _poll(self, client: httpx.Client, job_id: str, headers: dict) -> dict:
        deadline = time.monotonic() + _POLL_TIMEOUT
        while time.monotonic() < deadline:
            time.sleep(_POLL_INTERVAL)
            r = client.get(f"{_BASE}/transcript/{job_id}", headers=headers)
            if r.status_code != 200:
                raise ProviderUnavailable(_msg(r) or "Transcript job failed.")
            body = r.json()
            status = body.get("status")
            if status == "completed":
                # completed job nests the transcript under the same keys
                return body.get("result") or body
            if status == "failed":
                raise TranscriptSourceNotFound(
                    body.get("error") or "The transcript could not be generated."
                )
        raise ProviderUnavailable("The transcript is taking too long. Please try again.")

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
            raise TranscriptSourceNotFound("No transcript is available for this video.")

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
