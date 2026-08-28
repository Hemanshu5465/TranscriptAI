import pytest

from app.services.transcription import TranscriptionRequest
from app.services.transcription.youtube_captions import YouTubeCaptionsProvider


@pytest.mark.network
def test_real_youtube_caption_fetch():
    provider = YouTubeCaptionsProvider()
    assert provider.is_available()
    result = provider.transcribe(
        TranscriptionRequest(
            video_id="dQw4w9WgXcQ",
            canonical_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        )
    )
    assert len(result.segments) > 10
    assert result.language
    assert result.source == "youtube_captions"
