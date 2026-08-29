"""Select a transcription provider (with an ordered fallback chain)."""
from __future__ import annotations

import logging

from app.config.settings import settings
from app.services.transcription.base import (
    ProviderUnavailable,
    TranscriptionProvider,
    TranscriptionRequest,
    TranscriptionResult,
    TranscriptSourceNotFound,
)
from app.services.transcription.deepgram_provider import DeepgramProvider
from app.services.transcription.faster_whisper_provider import FasterWhisperProvider
from app.services.transcription.supadata import SupadataProvider
from app.services.transcription.youtube_captions import YouTubeCaptionsProvider

logger = logging.getLogger(__name__)

_REGISTRY: dict[str, type[TranscriptionProvider]] = {
    "supadata": SupadataProvider,
    "youtube_captions": YouTubeCaptionsProvider,
    "faster_whisper": FasterWhisperProvider,
    "deepgram": DeepgramProvider,
}

# Fallback order when the primary provider yields nothing usable.
_CHAIN = ["supadata", "youtube_captions", "faster_whisper", "deepgram"]

# Providers that can transcribe an arbitrary media URL (not just YouTube).
_FILE_CAPABLE = ["supadata", "deepgram"]


def get_provider(name: str) -> TranscriptionProvider:
    try:
        return _REGISTRY[name]()
    except KeyError as exc:
        raise ValueError(f"Unknown transcription provider: {name!r}") from exc


def resolve_provider_order(source_kind: str = "youtube") -> list[str]:
    if source_kind == "file":
        return list(_FILE_CAPABLE)
    primary = settings.transcription_provider
    # A Supadata key present + the default provider selected → prefer Supadata.
    # It fetches captions server-side, so it works from datacenter IPs (Vercel)
    # where youtube-transcript-api gets blocked.
    if settings.supadata_api_key and primary == "youtube_captions":
        primary = "supadata"
    if not settings.transcription_fallback:
        return [primary]
    return [primary, *[p for p in _CHAIN if p != primary]]


def transcribe(request: TranscriptionRequest) -> TranscriptionResult:
    """Try providers in order; raise the most meaningful error if all fail."""
    last_error: Exception | None = None
    tried: list[str] = []

    for name in resolve_provider_order(request.source_kind):
        provider = get_provider(name)
        if not provider.is_available():
            continue
        tried.append(name)
        try:
            logger.info("Transcribing %s with provider %s", request.video_id, name)
            return provider.transcribe(request)
        except TranscriptSourceNotFound as exc:
            last_error = exc
            logger.info("Provider %s found no source: %s", name, exc)
        except ProviderUnavailable as exc:
            last_error = exc
            logger.warning("Provider %s unavailable: %s", name, exc)

    if last_error is not None:
        raise last_error
    if request.source_kind == "file":
        raise ProviderUnavailable(
            "File transcription is not configured (needs SUPADATA_API_KEY)."
        )
    raise TranscriptSourceNotFound(
        "We couldn't access a permitted transcript or media source for this video."
        + (f" (providers tried: {', '.join(tried)})" if tried else "")
    )
