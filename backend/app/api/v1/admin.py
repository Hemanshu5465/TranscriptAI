from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.core.deps import AdminUser, DbSession
from app.models import (
    STATUS_FAILED,
    STATUS_PROCESSING,
    STATUS_QUEUED,
    Transcript,
    User,
    Video,
)
from app.workers import enqueue_transcript, queue_health

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
def admin_stats(db: DbSession, _: AdminUser) -> dict:
    def count(model, *where):
        return db.scalar(select(func.count()).select_from(model).where(*where)) or 0

    return {
        "users": count(User),
        "videos": count(Video),
        "transcripts": count(Transcript),
        "jobs_queued": count(Transcript, Transcript.status == STATUS_QUEUED),
        "jobs_processing": count(Transcript, Transcript.status == STATUS_PROCESSING),
        "jobs_failed": count(Transcript, Transcript.status == STATUS_FAILED),
        "queue": queue_health(),
    }


@router.get("/jobs")
def admin_jobs(
    db: DbSession,
    _: AdminUser,
    status_filter: Annotated[
        Literal["all", "queued", "processing", "completed", "failed"], Query(alias="status")
    ] = "all",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[dict]:
    stmt = select(Transcript).order_by(Transcript.created_at.desc()).limit(limit)
    if status_filter != "all":
        stmt = stmt.where(Transcript.status == status_filter)
    rows = db.scalars(stmt).all()
    return [
        {
            "id": t.id,
            "status": t.status,
            "stage": t.stage,
            "progress": t.progress,
            "error": t.error_message,
            "provider": t.provider,
            "video_id": t.video.youtube_video_id if t.video else None,
            "title": t.video.title if t.video else None,
            "owner_id": t.owner_id,
            "created_at": t.created_at,
        }
        for t in rows
    ]


@router.post("/jobs/{transcript_id}/retry")
def retry_job(transcript_id: str, db: DbSession, _: AdminUser) -> dict:
    tr = db.get(Transcript, transcript_id)
    if tr is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found.")
    tr.status = STATUS_QUEUED
    tr.stage = "validate_url"
    tr.progress = 0
    tr.error_message = None
    db.add(tr)
    db.commit()
    enqueue_transcript(tr.id)
    return {"id": tr.id, "status": tr.status}


@router.delete("/jobs/{transcript_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(transcript_id: str, db: DbSession, _: AdminUser) -> None:
    tr = db.get(Transcript, transcript_id)
    if tr is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found.")
    db.delete(tr)
    db.commit()
