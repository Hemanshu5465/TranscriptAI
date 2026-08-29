"""Long media: provider returns an async job that /status polling finalises."""
import pytest

from app.services.transcription.base import (
    Segment,
    TranscriptionPending,
    TranscriptionResult,
)

BLOB_URL = "https://abc.public.blob.vercel-storage.com/long-lecture-x1.mp4"


@pytest.fixture
def parked_job(client, monkeypatch):
    from app.workers.tasks import process_transcript_job

    monkeypatch.setattr(
        "app.services.transcript_service.enqueue_transcript", process_transcript_job
    )

    # transcribe() raises TranscriptionPending — mimics Supadata's 202 + slow job
    def pending(req):
        raise TranscriptionPending("job-abc-123", provider="supadata")

    monkeypatch.setattr("app.services.pipeline.transcribe", pending)

    r = client.post(
        "/api/v1/transcripts",
        json={"file_url": BLOB_URL, "filename": "long-lecture-x1.mp4"},
    )
    assert r.status_code == 202
    return r.json()["job_id"]


def test_job_parks_then_finalises(client, parked_job, monkeypatch):
    # right after creation: still processing, not failed
    s = client.get(f"/api/v1/transcripts/{parked_job}/status").json()
    assert s["status"] == "processing"
    assert s["stage"] == "speech_recognition"

    calls = {"n": 0}

    def check_job(self, job_id):
        assert job_id == "job-abc-123"
        calls["n"] += 1
        if calls["n"] < 2:
            return None  # still running
        return TranscriptionResult(
            segments=[Segment(0.0, 3.0, "welcome to the lecture"),
                      Segment(3.0, 7.0, "today we cover async jobs")],
            language="en",
            provider="supadata",
            source="supadata",
        )

    monkeypatch.setattr(
        "app.services.transcription.supadata.SupadataProvider.check_job", check_job
    )

    # first poll: job still running
    assert client.get(f"/api/v1/transcripts/{parked_job}/status").json()["status"] == "processing"
    # second poll: job done → finalised
    s2 = client.get(f"/api/v1/transcripts/{parked_job}/status").json()
    assert s2["status"] == "completed"

    detail = client.get(f"/api/v1/transcripts/{parked_job}").json()
    assert len(detail["segments"]) == 2
    assert detail["video"]["source_type"] == "upload"


def test_job_marked_failed_when_provider_fails(client, parked_job, monkeypatch):
    from app.services.transcription.base import TranscriptSourceNotFound

    def check_job(self, job_id):
        raise TranscriptSourceNotFound("The transcript could not be generated.")

    monkeypatch.setattr(
        "app.services.transcription.supadata.SupadataProvider.check_job", check_job
    )
    s = client.get(f"/api/v1/transcripts/{parked_job}/status").json()
    assert s["status"] == "failed"
    assert "could not be generated" in s["error"]
