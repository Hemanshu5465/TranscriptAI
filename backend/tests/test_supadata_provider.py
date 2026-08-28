import httpx
import pytest

from app.services.transcription.base import (
    TranscriptionRequest,
    TranscriptSourceNotFound,
)
from app.services.transcription.supadata import SupadataProvider

REQ = TranscriptionRequest(
    video_id="dQw4w9WgXcQ",
    canonical_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
)


def _resp(status, json_body):
    return httpx.Response(status, json=json_body, request=httpx.Request("GET", "https://x"))


def test_to_result_maps_offsets_ms_to_seconds():
    data = {
        "lang": "en",
        "content": [
            {"text": "Hello everyone.", "offset": 1360, "duration": 1680, "lang": "en"},
            {"text": "We discuss AI.", "offset": 3040, "duration": 2000, "lang": "en"},
        ],
    }
    result = SupadataProvider._to_result(data)
    assert result.provider == "supadata"
    assert result.language == "en"
    assert len(result.segments) == 2
    assert result.segments[0].start == pytest.approx(1.36)
    assert result.segments[0].end == pytest.approx(1.36 + 1.68)
    assert result.segments[1].text == "We discuss AI."


def test_to_result_empty_raises_not_found():
    with pytest.raises(TranscriptSourceNotFound):
        SupadataProvider._to_result({"content": [], "lang": "en"})


def test_handle_206_is_source_not_found():
    p = SupadataProvider()
    with pytest.raises(TranscriptSourceNotFound):
        p._handle(_resp(206, {"message": "no transcript"}))


def test_handle_202_signals_async_job():
    p = SupadataProvider()
    assert p._handle(_resp(202, {"jobId": "abc"})) is None


def test_provider_unavailable_without_key(monkeypatch):
    monkeypatch.setattr("app.config.settings.settings.supadata_api_key", "")
    assert SupadataProvider().is_available() is False
