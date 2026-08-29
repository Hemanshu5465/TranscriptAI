import pytest

from app.services.transcription.base import (
    ProviderUnavailable,
    Segment,
    TranscriptionRequest,
    TranscriptionResult,
)

BLOB_URL = "https://abc123.public.blob.vercel-storage.com/my-clip-x9.mp4"


@pytest.fixture
def fake_file_pipeline(monkeypatch):
    from app.workers.tasks import process_transcript_job

    monkeypatch.setattr(
        "app.services.transcript_service.enqueue_transcript", process_transcript_job
    )

    def fake_transcribe(req: TranscriptionRequest):
        assert req.source_kind == "file"
        assert req.canonical_url == BLOB_URL
        return TranscriptionResult(
            segments=[
                Segment(0.0, 2.0, "hello from an uploaded file"),
                Segment(2.0, 5.0, "this is the second line"),
            ],
            language="en",
            provider="supadata",
            source="supadata",
        )

    monkeypatch.setattr("app.services.pipeline.transcribe", fake_transcribe)


def test_upload_creates_transcript(client, fake_file_pipeline):
    r = client.post(
        "/api/v1/transcripts",
        json={"file_url": BLOB_URL, "filename": "my-clip-x9.mp4"},
    )
    assert r.status_code == 202, r.text
    jid = r.json()["job_id"]

    detail = client.get(f"/api/v1/transcripts/{jid}").json()
    assert detail["status"] == "completed"
    assert detail["video"]["source_type"] == "upload"
    assert detail["video"]["source_url"] == BLOB_URL
    assert detail["video"]["original_filename"] == "my-clip-x9.mp4"
    assert detail["video"]["content_type"] == "video/mp4"
    assert detail["video"]["title"] == "my clip x9"
    assert detail["video"]["youtube_video_id"] is None
    assert len(detail["segments"]) == 2

    txt = client.get(f"/api/v1/transcripts/{jid}/export", params={"format": "txt"})
    assert txt.status_code == 200
    assert b"from an uploaded file" in txt.content.lower()


def test_rejects_both_sources(client):
    r = client.post(
        "/api/v1/transcripts",
        json={"youtube_url": "https://youtu.be/dQw4w9WgXcQ", "file_url": BLOB_URL},
    )
    assert r.status_code == 422


def test_rejects_neither_source(client):
    assert client.post("/api/v1/transcripts", json={}).status_code == 422


def test_rejects_non_blob_file_url(client):
    r = client.post(
        "/api/v1/transcripts",
        json={"file_url": "https://evil.example.com/a.mp4", "filename": "a.mp4"},
    )
    assert r.status_code == 422


def test_factory_file_kind_without_supadata(monkeypatch):
    from app.services.transcription.factory import transcribe

    monkeypatch.setattr("app.config.settings.settings.supadata_api_key", "")
    monkeypatch.setattr("app.config.settings.settings.deepgram_api_key", "")
    with pytest.raises(ProviderUnavailable):
        transcribe(
            TranscriptionRequest(
                video_id="upload", canonical_url=BLOB_URL, source_kind="file"
            )
        )
