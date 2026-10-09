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


@router.get("/users")
def admin_users(
    db: DbSession,
    _: AdminUser,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> dict:
    total = db.scalar(select(func.count()).select_from(User)) or 0
    rows = db.scalars(select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)).all()
    transcript_counts = {
        r[0]: r[1]
        for r in db.execute(
            select(Transcript.owner_id, func.count(Transcript.id))
            .group_by(Transcript.owner_id)
        ).all()
    }
    return {
        "total": total,
        "items": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "is_active": u.is_active,
                "is_admin": u.is_admin,
                "created_at": u.created_at,
                "transcript_count": transcript_counts.get(u.id, 0),
            }
            for u in rows
        ],
    }


@router.get("/users/{user_id}/transcripts")
def admin_user_transcripts(
    user_id: str,
    db: DbSession,
    _: AdminUser,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[dict]:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    stmt = (
        select(Transcript)
        .where(Transcript.owner_id == user_id)
        .order_by(Transcript.created_at.desc())
        .limit(limit)
    )
    rows = db.scalars(stmt).all()
    return [
        {
            "id": t.id,
            "status": t.status,
            "stage": t.stage,
            "progress": t.progress,
            "error": t.error_message,
            "provider": t.provider,
            "source_type": t.video.source_type if t.video else None,
            "video_id": t.video.youtube_video_id if t.video else None,
            "video_url": t.video.url if t.video else None,
            "title": t.video.title if t.video else None,
            "channel": t.video.channel if t.video else None,
            "thumbnail_url": t.video.thumbnail_url if t.video else None,
            "duration_seconds": t.video.duration_seconds if t.video else None,
            "original_filename": t.video.original_filename if t.video else None,
            "language": t.language,
            "accuracy_mode": t.accuracy_mode,
            "has_word_timestamps": t.has_word_timestamps,
            "has_speaker_labels": t.has_speaker_labels,
            "word_count": (t.stats or {}).get("words", 0),
            "text_preview": (t.clean_text or t.raw_text or "")[:300].strip() or None,
            "edit_count": len(t.edits),
            "created_at": t.created_at,
            "updated_at": t.updated_at,
        }
        for t in rows
    ]


@router.get("/users/{user_id}/activity")
def admin_user_activity(user_id: str, db: DbSession, _: AdminUser) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")

    transcripts = db.scalars(
        select(Transcript).where(Transcript.owner_id == user_id)
    ).all()

    total = len(transcripts)
    completed = [t for t in transcripts if t.status == "completed"]
    failed    = [t for t in transcripts if t.status == "failed"]
    queued    = [t for t in transcripts if t.status == "queued"]

    languages = {}
    for t in completed:
        lang = t.language or "unknown"
        languages[lang] = languages.get(lang, 0) + 1

    accuracy_modes = {}
    for t in transcripts:
        m = t.accuracy_mode or "clean"
        accuracy_modes[m] = accuracy_modes.get(m, 0) + 1

    total_words = sum((t.stats or {}).get("words", 0) for t in completed)
    total_edits = sum(len(t.edits) for t in completed)

    providers = {}
    for t in completed:
        p = t.provider or "unknown"
        providers[p] = providers.get(p, 0) + 1

    return {
        "user_id": user_id,
        "email": user.email,
        "full_name": user.full_name,
        "is_active": user.is_active,
        "is_admin": user.is_admin,
        "joined_at": user.created_at,
        "total_transcripts": total,
        "completed": len(completed),
        "failed": len(failed),
        "queued": len(queued),
        "total_words_transcribed": total_words,
        "total_edits_made": total_edits,
        "languages_used": languages,
        "accuracy_modes_used": accuracy_modes,
        "providers_used": providers,
    }


@router.patch("/users/{user_id}/toggle-active")
def toggle_user_active(user_id: str, db: DbSession, current_admin: AdminUser) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    if str(user.id) == str(current_admin.id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot deactivate yourself.")
    user.is_active = not user.is_active
    db.add(user)
    db.commit()
    return {"id": user.id, "is_active": user.is_active}


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
