"""Provider stub: Deepgram (cloud STT with diarization + word timestamps).

Implemented as a documented integration point. Wiring the real HTTP call is the
only change needed — the pipeline consumes :class:`TranscriptionResult` unchanged.
"""
from __future__ import annotations

from app.config.settings import settings
from app.services.transcription.base import (
    ProviderUnavailable,
    TranscriptionProvider,
    TranscriptionRequest,
    TranscriptionResult,
)


class DeepgramProvider(TranscriptionProvider):
    name = "deepgram"

    def is_available(self) -> bool:
        return bool(settings.deepgram_api_key)

    def transcribe(self, request: TranscriptionRequest) -> TranscriptionResult:
        if not settings.deepgram_api_key:
            raise ProviderUnavailable("DEEPGRAM_API_KEY is not configured.")
        # Integration point:
        #   1. obtain an authorized audio stream/URL for request.canonical_url
        #   2. POST to https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true
        #      &diarize=true&punctuate=true  with Authorization: Token <key>
        #   3. map response "results.channels[0].alternatives[0].words" -> Segment/Word
        raise ProviderUnavailable(
            "The Deepgram provider is a stub. Implement DeepgramProvider.transcribe "
            "with an authorized audio source to enable cloud transcription."
        )
