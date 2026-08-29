import pytest

from app.services.transcription.base import Segment, TranscriptionResult


@pytest.fixture
def a_transcript(auth_client, monkeypatch):
    from app.workers.tasks import process_transcript_job

    monkeypatch.setattr(
        "app.services.transcript_service.enqueue_transcript", process_transcript_job
    )
    monkeypatch.setattr(
        "app.services.pipeline.get_video_metadata",
        lambda url: __import__(
            "app.services.youtube_service", fromlist=["VideoMetadata"]
        ).VideoMetadata(video_id="dQw4w9WgXcQ", url=url, title="Demo"),
    )
    monkeypatch.setattr(
        "app.services.pipeline.transcribe",
        lambda req: TranscriptionResult(
            segments=[Segment(0.0, 2.0, "hello"), Segment(2.0, 4.0, "world")],
            language="en",
            provider="fake",
            source="youtube_captions",
        ),
    )
    jid = auth_client.post(
        "/api/v1/transcripts", json={"youtube_url": "https://youtu.be/dQw4w9WgXcQ"}
    ).json()["job_id"]
    return jid


def test_owner_can_delete(auth_client, a_transcript):
    assert auth_client.get(f"/api/v1/transcripts/{a_transcript}").status_code == 200
    r = auth_client.delete(f"/api/v1/transcripts/{a_transcript}")
    assert r.status_code == 204
    assert auth_client.get(f"/api/v1/transcripts/{a_transcript}").status_code == 404
    # gone from history too
    assert auth_client.get("/api/v1/transcripts").json()["total"] == 0


def test_delete_removes_segments(auth_client, a_transcript):
    from app.db.session import SessionLocal
    from app.models import TranscriptSegment
    from sqlalchemy import func, select

    db = SessionLocal()
    before = db.scalar(
        select(func.count()).select_from(TranscriptSegment).where(
            TranscriptSegment.transcript_id == a_transcript
        )
    )
    assert before == 2
    db.close()

    auth_client.delete(f"/api/v1/transcripts/{a_transcript}")

    db = SessionLocal()
    after = db.scalar(
        select(func.count()).select_from(TranscriptSegment).where(
            TranscriptSegment.transcript_id == a_transcript
        )
    )
    assert after == 0
    db.close()


def test_other_user_cannot_delete(client, auth_client, a_transcript):
    owner_auth = client.headers.get("Authorization")

    # unauthenticated
    del client.headers["Authorization"]
    assert client.delete(f"/api/v1/transcripts/{a_transcript}").status_code == 401

    # a different signed-in user
    import uuid

    email = f"intruder-{uuid.uuid4().hex[:6]}@example.com"
    token = client.post(
        "/api/v1/auth/register", json={"email": email, "password": "password123"}
    ).json()["access_token"]
    resp = client.delete(
        f"/api/v1/transcripts/{a_transcript}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403

    client.headers["Authorization"] = owner_auth
    assert client.get(f"/api/v1/transcripts/{a_transcript}").status_code == 200
