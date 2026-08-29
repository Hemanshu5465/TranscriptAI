import pytest

from app.services.transcription.base import (
    ProviderUnavailable,
    TranscriptionRequest,
    TranscriptSourceNotFound,
)
from app.services.transcription.deepgram_provider import DeepgramProvider

FILE_REQ = TranscriptionRequest(
    video_id="upload",
    canonical_url="https://x.public.blob.vercel-storage.com/a.mp4",
    source_kind="file",
)

DG_RESPONSE = {
    "results": {
        "channels": [
            {
                "detected_language": "en",
                "alternatives": [
                    {
                        "confidence": 0.98,
                        "words": [{"word": "hello", "start": 0.1, "end": 0.4}],
                        "paragraphs": {
                            "paragraphs": [
                                {
                                    "sentences": [
                                        {"text": "Hello there.", "start": 0.1, "end": 1.2},
                                        {"text": "This is Deepgram.", "start": 1.2, "end": 3.0},
                                    ]
                                }
                            ]
                        },
                    }
                ],
            }
        ]
    }
}


def test_maps_paragraphs_to_segments():
    r = DeepgramProvider._to_result(DG_RESPONSE)
    assert r.provider == "deepgram"
    assert r.language == "en"
    assert [s.text for s in r.segments] == ["Hello there.", "This is Deepgram."]
    assert r.segments[0].start == pytest.approx(0.1)


def test_empty_result_raises():
    with pytest.raises(TranscriptSourceNotFound):
        DeepgramProvider._to_result({"results": {"channels": []}})


def test_not_available_without_key(monkeypatch):
    monkeypatch.setattr("app.config.settings.settings.deepgram_api_key", "")
    assert DeepgramProvider().is_available() is False


def test_rejects_youtube_source(monkeypatch):
    monkeypatch.setattr("app.config.settings.settings.deepgram_api_key", "dg-test")
    yt_req = TranscriptionRequest(
        video_id="abc", canonical_url="https://youtu.be/abc", source_kind="youtube"
    )
    with pytest.raises(ProviderUnavailable):
        DeepgramProvider().transcribe(yt_req)
