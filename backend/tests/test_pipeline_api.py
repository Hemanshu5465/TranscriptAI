import pytest

from app.services.transcription.base import (
    Segment,
    TranscriptionResult,
    TranscriptSourceNotFound,
    Word,
)
from app.services.youtube_service import VideoMetadata

VIDEO_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


@pytest.fixture
def fake_pipeline(monkeypatch):
    """Run the job inline with stubbed external calls."""
    from app.workers.tasks import process_transcript_job

    monkeypatch.setattr(
        "app.services.transcript_service.enqueue_transcript", process_transcript_job
    )
    monkeypatch.setattr(
        "app.services.pipeline.get_video_metadata",
        lambda url: VideoMetadata(
            video_id="dQw4w9WgXcQ",
            url=url,
            title="Never Gonna Give You Up",
            channel="Rick Astley",
            thumbnail_url="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            duration_seconds=213,
        ),
    )

    def fake_transcribe(req):
        return TranscriptionResult(
            segments=[
                Segment(0.0, 3.0, "we're no strangers to love", words=[
                    Word("we're", 0.0, 0.4), Word("no", 0.4, 0.6),
                ]),
                Segment(3.0, 6.0, "you know the rules and so do i"),
            ],
            language="en",
            language_confidence=0.98,
            provider="fake",
            source="youtube_captions",
            has_word_timestamps=True,
        )

    monkeypatch.setattr("app.services.pipeline.transcribe", fake_transcribe)
    return fake_transcribe


def test_create_and_fetch_transcript(client, fake_pipeline):
    r = client.post("/api/v1/transcripts", json={"youtube_url": VIDEO_URL})
    assert r.status_code == 202, r.text
    job_id = r.json()["job_id"]

    status = client.get(f"/api/v1/transcripts/{job_id}/status")
    assert status.json()["status"] == "completed"

    detail = client.get(f"/api/v1/transcripts/{job_id}").json()
    assert detail["language"] == "en"
    assert detail["video"]["title"] == "Never Gonna Give You Up"
    assert len(detail["segments"]) == 2
    assert detail["segments"][0]["text"][0].isupper()          # clean formatting
    assert detail["raw_text"].startswith("we're no strangers")  # raw preserved
    assert detail["stats"]["words"] > 0


def test_invalid_url_rejected(client):
    r = client.post("/api/v1/transcripts", json={"youtube_url": "https://vimeo.com/1"})
    assert r.status_code == 422


def test_no_transcript_source_marks_failed(client, monkeypatch):
    from app.workers.tasks import process_transcript_job

    monkeypatch.setattr(
        "app.services.transcript_service.enqueue_transcript", process_transcript_job
    )
    monkeypatch.setattr(
        "app.services.pipeline.get_video_metadata",
        lambda url: VideoMetadata(video_id="dQw4w9WgXcQ", url=url, title="x"),
    )

    def boom(req):
        raise TranscriptSourceNotFound("No permitted transcript or media source is available.")

    monkeypatch.setattr("app.services.pipeline.transcribe", boom)

    r = client.post("/api/v1/transcripts", json={"youtube_url": VIDEO_URL})
    job_id = r.json()["job_id"]
    status = client.get(f"/api/v1/transcripts/{job_id}/status").json()
    assert status["status"] == "failed"
    assert "permitted transcript" in status["error"]


def test_edit_and_export(client, fake_pipeline):
    job_id = client.post("/api/v1/transcripts", json={"youtube_url": VIDEO_URL}).json()["job_id"]
    detail = client.get(f"/api/v1/transcripts/{job_id}").json()

    segs = detail["segments"]
    segs[0]["text"] = "EDITED FIRST LINE."
    payload = {"segments": [
        {"order_index": s["order_index"], "start_time": s["start_time"],
         "end_time": s["end_time"], "text": s["text"], "speaker": s["speaker"]}
        for s in segs
    ]}
    upd = client.put(f"/api/v1/transcripts/{job_id}", json=payload)
    assert upd.status_code == 200
    assert upd.json()["edited_text"].startswith("EDITED FIRST LINE.")
    # The saved edit is surfaced per-segment so the workspace can render it.
    assert upd.json()["segments"][0]["edited_text"] == "EDITED FIRST LINE."

    # …and it survives a fresh fetch.
    refetched = client.get(f"/api/v1/transcripts/{job_id}").json()
    assert refetched["segments"][0]["edited_text"] == "EDITED FIRST LINE."

    for fmt in ["txt", "srt", "vtt", "json", "csv", "docx", "pdf"]:
        resp = client.get(f"/api/v1/transcripts/{job_id}/export", params={"format": fmt})
        assert resp.status_code == 200, fmt
        assert len(resp.content) > 0

    edited_txt = client.get(
        f"/api/v1/transcripts/{job_id}/export", params={"format": "txt", "variant": "edited"}
    )
    assert b"EDITED FIRST LINE." in edited_txt.content


def test_export_owned_transcript_via_query_token(auth_client, client, fake_pipeline):
    token = auth_client.headers["Authorization"].split()[1]
    job_id = auth_client.post(
        "/api/v1/transcripts", json={"youtube_url": VIDEO_URL}
    ).json()["job_id"]

    # A plain browser navigation carries no Authorization header — the JWT rides
    # in the query string instead.
    del client.headers["Authorization"]

    forbidden = client.get(f"/api/v1/transcripts/{job_id}/export", params={"format": "txt"})
    assert forbidden.status_code == 403

    ok = client.get(
        f"/api/v1/transcripts/{job_id}/export",
        params={"format": "txt", "access_token": token},
    )
    assert ok.status_code == 200
    assert len(ok.content) > 0
    assert ok.headers["content-disposition"].startswith("attachment;")

    bad = client.get(
        f"/api/v1/transcripts/{job_id}/export",
        params={"format": "txt", "access_token": "not-a-jwt"},
    )
    assert bad.status_code == 403
