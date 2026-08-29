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

# Fallback order for a YouTube URL. (Deepgram can't fetch YouTube audio from a
# datacenter IP, so it's file-only — see _FILE_CAPABLE.)
_CHAIN = ["supadata", "youtube_captions", "faster_whisper"]

# Providers that can transcribe an arbitrary media URL (uploaded files).
# Deepgram first — URL-based, no size cap on our side, generous free credit.
_FILE_CAPABLE = ["deepgram", "supadata"]


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
    if primary == "deepgram":  # file-only — not usable for a YouTube URL
        primary = "supadata" if settings.supadata_api_key else "youtube_captions"
    if not settings.transcription_fallback:
        return [primary]
    return [primary, *[p for p in _CHAIN if p != primary]]


# Providers whose failure message is more actionable than the fallbacks'
# ("YouTube blocked this datacenter IP" is a dead end for the user).
_PREFERRED_ERROR_FROM = ("supadata", "deepgram")


def transcribe(request: TranscriptionRequest) -> TranscriptionResult:
    """Try providers in order; raise the most meaningful error if all fail."""
    errors: dict[str, Exception] = {}
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
            errors[name] = exc
            logger.info("Provider %s found no source: %s", name, exc)
        except ProviderUnavailable as exc:
            errors[name] = exc
            logger.warning("Provider %s unavailable: %s", name, exc)

    for name in _PREFERRED_ERROR_FROM:
        if name in errors:
            raise errors[name]
    if errors:
        raise next(iter(errors.values()))
    if request.source_kind == "file":
        raise ProviderUnavailable(
            "File transcription is not configured (needs SUPADATA_API_KEY)."
        )
    raise TranscriptSourceNotFound(
        "We couldn't access a permitted transcript or media source for this video."
        + (f" (providers tried: {', '.join(tried)})" if tried else "")
    )
