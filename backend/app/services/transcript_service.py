"""Application-service layer for transcripts: creation, serialisation, edits, export."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.config.settings import settings
from app.models import (
    STATUS_COMPLETED,
    STATUS_QUEUED,
    Transcript,
    TranscriptEdit,
    TranscriptSegment,
    User,
    Video,
)
from app.schemas.transcript import SegmentIn
from app.services.export_service import (
    ExportBundle,
    ExportSegment,
    ExportWord,
)
from app.services.stats_service import count_words
from app.utils.youtube_url import parse_youtube_url
from app.workers import enqueue_transcript

logger = logging.getLogger("app.transcript")

_CONTENT_TYPES = {
    "mp4": "video/mp4", "webm": "video/webm", "mov": "video/quicktime", "mkv": "video/x-matroska",
    "mpeg": "video/mpeg", "mpg": "video/mpeg",
    "mp3": "audio/mpeg", "m4a": "audio/mp4", "wav": "audio/wav", "flac": "audio/flac",
    "ogg": "audio/ogg", "oga": "audio/ogg", "aac": "audio/aac",
}


def _month_start() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _clean_title(filename: str | None) -> str:
    if not filename:
        return "Uploaded file"
    stem = filename.rsplit("/", 1)[-1].rsplit(".", 1)[0]
    return stem.replace("_", " ").replace("-", " ").strip() or "Uploaded file"


def _guess_content_type(filename: str | None, file_url: str) -> str | None:
    name = (filename or file_url).lower()
    ext = name.rsplit(".", 1)[-1] if "." in name else ""
    return _CONTENT_TYPES.get(ext)


def create_transcript_job(
    db: Session,
    *,
    youtube_url: str | None = None,
    file_url: str | None = None,
    filename: str | None = None,
    accuracy_mode: str,
    language: str | None,
    owner: User | None,
) -> Transcript:
    from app.db.bootstrap import ensure_schema

    ensure_schema()  # cheap no-op after the first call

    if owner is not None:
        used = db.scalar(
            select(func.count())
            .select_from(Transcript)
            .where(Transcript.owner_id == owner.id, Transcript.created_at >= _month_start())
        )
        if used is not None and used >= settings.max_jobs_per_user_per_month:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "You've reached the current processing limit. Please try again later.",
            )

    if file_url:
        video = Video(
            source_type="upload",
            youtube_video_id=None,
            url=file_url,
            source_url=file_url,
            original_filename=filename,
            content_type=_guess_content_type(filename, file_url),
            title=_clean_title(filename),
        )
        db.add(video)
        db.flush()
    else:
        parsed = parse_youtube_url(youtube_url or "")
        video = db.scalar(select(Video).where(Video.youtube_video_id == parsed.video_id))
        if video is None:
            video = Video(
                source_type="youtube",
                youtube_video_id=parsed.video_id,
                url=parsed.canonical_url,
            )
            db.add(video)
            db.flush()

    transcript = Transcript(
        video_id=video.id,
        owner_id=owner.id if owner else None,
        status=STATUS_QUEUED,
        stage="validate_url",
        progress=0,
        accuracy_mode=accuracy_mode,
        language=language,
    )
    db.add(transcript)
    db.commit()
    db.refresh(transcript)

    enqueue_transcript(transcript.id)
    if settings.job_queue == "inline":
        # inline mode ran the pipeline synchronously (separate session) — pull the
        # fresh status/stage so the response reflects it.
        db.expire(transcript)
        db.refresh(transcript)
    return transcript


def finalize_if_pending(db: Session, tr: Transcript) -> None:
    """If a long provider job is running, poll it once and finalise when ready.

    Called on every /status poll — cheap when there's nothing to do.
    """
    from app.models import STATUS_FAILED, STATUS_PROCESSING

    if tr.status != STATUS_PROCESSING or not tr.provider_job_id:
        return

    from app.services.pipeline import finalize_transcription
    from app.services.transcription import TranscriptSourceNotFound
    from app.services.transcription.supadata import SupadataProvider

    try:
        result = SupadataProvider().check_job(tr.provider_job_id)
    except TranscriptSourceNotFound as exc:
        tr.status = STATUS_FAILED
        tr.error_message = str(exc)
        tr.provider_job_id = None
        db.add(tr)
        db.commit()
        return
    except Exception:  # noqa: BLE001 - transient; try again on the next poll
        logger.exception("job poll failed for transcript %s", tr.id)
        return

    if result is None:
        return  # still transcribing

    video = db.get(Video, tr.video_id)
    try:
        finalize_transcription(db, tr, video, result)
    except Exception:  # noqa: BLE001
        logger.exception("finalisation failed for transcript %s", tr.id)
        tr.status = STATUS_FAILED
        tr.error_message = "We couldn't finish the transcript. Please try again."
        tr.provider_job_id = None
        db.add(tr)
        db.commit()


def get_transcript_or_404(db: Session, transcript_id: str, *, with_segments: bool = False) -> Transcript:
    stmt = select(Transcript).where(Transcript.id == transcript_id)
    stmt = stmt.options(selectinload(Transcript.video))
    if with_segments:
        stmt = stmt.options(
            selectinload(Transcript.segments).selectinload(TranscriptSegment.words)
        )
    tr = db.scalar(stmt)
    if tr is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transcript not found.")
    return tr


def assert_can_access(tr: Transcript, user: User | None) -> None:
    """Anonymous transcripts are public by id; owned ones require the owner/admin."""
    if tr.owner_id is None:
        return
    if user is None or (user.id != tr.owner_id and not user.is_admin):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't have access to this transcript.")


def assert_can_delete(tr: Transcript, user: User | None) -> None:
    """Deletion needs the authenticated owner (or an admin)."""
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in to delete transcripts.")
    if tr.owner_id != user.id and not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can't delete this transcript.")


def delete_transcript(db: Session, tr: Transcript) -> None:
    """Delete a transcript (segments/words/edits cascade). If it owns an uploaded
    file that nothing else uses, drop the Video row and its Blob object too."""
    video = tr.video
    remove_video = False
    if video is not None and video.source_type == "upload":
        others = db.scalar(
            select(func.count())
            .select_from(Transcript)
            .where(Transcript.video_id == video.id, Transcript.id != tr.id)
        )
        remove_video = not others

    blob_url = video.source_url if (remove_video and video) else None

    db.delete(tr)
    if remove_video:
        db.delete(video)
    db.commit()

    if blob_url:
        from app.services.blob_service import delete_blob

        delete_blob(blob_url)


def latest_edit(db: Session, transcript_id: str) -> TranscriptEdit | None:
    return db.scalar(
        select(TranscriptEdit)
        .where(TranscriptEdit.transcript_id == transcript_id)
        .order_by(TranscriptEdit.created_at.desc())
        .limit(1)
    )


def apply_edit(
    db: Session, tr: Transcript, segments: list[SegmentIn], user: User | None
) -> TranscriptEdit:
    content = [
        {
            "order_index": s.order_index,
            "speaker": s.speaker,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "text": s.text,
        }
        for s in sorted(segments, key=lambda s: s.order_index)
    ]
    edit = TranscriptEdit(
        transcript_id=tr.id, user_id=user.id if user else None, content=content
    )
    db.add(edit)
    db.commit()
    db.refresh(edit)
    return edit


# --- serialisation ----------------------------------------------------------

def serialize_detail(db: Session, tr: Transcript) -> dict:
    edit = latest_edit(db, tr.id)
    edited_text = None
    if edit:
        edited_text = "\n\n".join(seg["text"] for seg in edit.content if seg.get("text"))

    return {
        "id": tr.id,
        "status": tr.status,
        "stage": tr.stage,
        "progress": tr.progress,
        "error": tr.error_message,
        "accuracy_mode": tr.accuracy_mode,
        "provider": tr.provider,
        "source": tr.source,
        "language": tr.language,
        "language_confidence": tr.language_confidence,
        "has_word_timestamps": tr.has_word_timestamps,
        "has_speaker_labels": tr.has_speaker_labels,
        "raw_text": tr.raw_text,
        "clean_text": tr.clean_text,
        "edited_text": edited_text,
        "stats": tr.stats,
        "video": tr.video,
        "segments": [
            {
                "id": s.id,
                "order_index": s.order_index,
                "speaker": s.speaker,
                "start_time": s.start_time,
                "end_time": s.end_time,
                "text": s.text,
                "raw_text": s.raw_text,
                "confidence": s.confidence,
                "words": [
                    {
                        "word": w.word,
                        "start_time": w.start_time,
                        "end_time": w.end_time,
                        "confidence": w.confidence,
                    }
                    for w in s.words
                ],
            }
            for s in tr.segments
        ],
        "created_at": tr.created_at,
        "updated_at": tr.updated_at,
    }


def serialize_list_item(tr: Transcript) -> dict:
    stats = tr.stats or {}
    return {
        "id": tr.id,
        "status": tr.status,
        "language": tr.language,
        "accuracy_mode": tr.accuracy_mode,
        "created_at": tr.created_at,
        "source_type": tr.video.source_type if tr.video else "youtube",
        "title": tr.video.title if tr.video else None,
        "channel": tr.video.channel if tr.video else None,
        "thumbnail_url": tr.video.thumbnail_url if tr.video else None,
        "duration_seconds": tr.video.duration_seconds if tr.video else None,
        "word_count": stats.get("words", 0),
    }


def build_export_bundle(db: Session, tr: Transcript, *, variant: str) -> ExportBundle:
    """variant: clean | raw | edited."""
    if tr.status != STATUS_COMPLETED:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Transcript is not ready to export yet."
        )

    edit = latest_edit(db, tr.id) if variant == "edited" else None
    edited_by_index = {c["order_index"]: c for c in (edit.content if edit else [])}

    segments: list[ExportSegment] = []
    for s in tr.segments:
        if variant == "raw":
            text = s.raw_text or s.text
        elif variant == "edited" and s.order_index in edited_by_index:
            text = edited_by_index[s.order_index]["text"]
        else:
            text = s.text
        segments.append(
            ExportSegment(
                index=s.order_index,
                start=s.start_time,
                end=s.end_time,
                text=text,
                speaker=s.speaker,
                confidence=s.confidence,
                words=[
                    ExportWord(w.word, w.start_time, w.end_time, w.confidence) for w in s.words
                ],
            )
        )

    if variant == "raw":
        full_text = tr.raw_text or "\n\n".join(s.text for s in segments)
    elif variant == "edited" and edit:
        full_text = "\n\n".join(s.text for s in segments)
    else:
        full_text = tr.clean_text or "\n\n".join(s.text for s in segments)

    video = tr.video
    return ExportBundle(
        title=(video.title if video else None) or "Transcript",
        video_id=(video.youtube_video_id if video else None) or "",
        url=video.url if video else "",
        channel=video.channel if video else None,
        language=tr.language,
        duration_seconds=(video.duration_seconds if video else None),
        segments=segments,
        full_text=full_text,
        stats=tr.stats or {},
    )
