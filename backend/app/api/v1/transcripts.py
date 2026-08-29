from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select

from app.core.deps import CurrentUser, DbSession, OptionalUser
from app.core.rate_limit import limiter
from app.config.settings import settings
from app.models import Transcript, Video
from app.schemas.transcript import (
    JobStatusOut,
    TranscriptCreate,
    TranscriptDetailOut,
    TranscriptListOut,
    TranscriptUpdate,
)
from app.services.export_service import SUPPORTED_FORMATS, export
from app.services.transcript_service import (
    apply_edit,
    assert_can_access,
    build_export_bundle,
    create_transcript_job,
    finalize_if_pending,
    get_transcript_or_404,
    serialize_detail,
    serialize_list_item,
)

router = APIRouter(prefix="/transcripts", tags=["transcripts"])


@router.post("", response_model=JobStatusOut, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit(settings.rate_limit_create)
def create_transcript(
    request: Request,
    payload: TranscriptCreate,
    db: DbSession,
    user: OptionalUser,
) -> JobStatusOut:
    tr = create_transcript_job(
        db,
        youtube_url=payload.youtube_url,
        file_url=payload.file_url,
        filename=payload.filename,
        accuracy_mode=payload.accuracy_mode,
        language=payload.language,
        owner=user,
    )
    return JobStatusOut(
        job_id=tr.id, transcript_id=tr.id, status=tr.status, stage=tr.stage, progress=tr.progress
    )


@router.get("", response_model=TranscriptListOut)
def list_transcripts(
    db: DbSession,
    user: CurrentUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    q: Annotated[str | None, Query(max_length=200)] = None,
    language: Annotated[str | None, Query(max_length=16)] = None,
    filter: Annotated[Literal["all", "recent"], Query()] = "all",
) -> TranscriptListOut:
    stmt = (
        select(Transcript)
        .join(Video, Transcript.video_id == Video.id)
        .where(Transcript.owner_id == user.id)
    )
    if language:
        stmt = stmt.where(func.lower(Transcript.language) == language.lower())
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Video.title).like(like),
                func.lower(Video.channel).like(like),
                func.lower(Transcript.clean_text).like(like),
            )
        )

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    stmt = stmt.order_by(Transcript.created_at.desc())
    if filter == "recent":
        stmt = stmt.limit(min(page_size, 10))
    else:
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    rows = db.scalars(stmt).all()
    return TranscriptListOut(
        items=[serialize_list_item(t) for t in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{job_id}/status", response_model=JobStatusOut)
def job_status(job_id: str, db: DbSession, user: OptionalUser) -> JobStatusOut:
    tr = get_transcript_or_404(db, job_id)
    assert_can_access(tr, user)
    finalize_if_pending(db, tr)  # advance a long provider job if it's ready
    return JobStatusOut(
        job_id=tr.id,
        transcript_id=tr.id,
        status=tr.status,
        stage=tr.stage,
        progress=tr.progress,
        error=tr.error_message,
    )


@router.get("/{transcript_id}", response_model=TranscriptDetailOut)
def get_transcript(transcript_id: str, db: DbSession, user: OptionalUser) -> TranscriptDetailOut:
    tr = get_transcript_or_404(db, transcript_id, with_segments=True)
    assert_can_access(tr, user)
    if tr.status == "processing" and tr.provider_job_id:
        finalize_if_pending(db, tr)
        db.refresh(tr)
    return serialize_detail(db, tr)


@router.get("/{transcript_id}/segments", response_model=list)
def get_segments(transcript_id: str, db: DbSession, user: OptionalUser):
    tr = get_transcript_or_404(db, transcript_id, with_segments=True)
    assert_can_access(tr, user)
    return serialize_detail(db, tr)["segments"]


@router.put("/{transcript_id}", response_model=TranscriptDetailOut)
def update_transcript(
    transcript_id: str, payload: TranscriptUpdate, db: DbSession, user: OptionalUser
) -> TranscriptDetailOut:
    tr = get_transcript_or_404(db, transcript_id, with_segments=True)
    assert_can_access(tr, user)
    apply_edit(db, tr, payload.segments, user)
    db.refresh(tr)
    return serialize_detail(db, tr)


@router.get("/{transcript_id}/export")
def export_transcript(
    transcript_id: str,
    db: DbSession,
    user: OptionalUser,
    format: Annotated[str, Query()] = "txt",
    timestamps: Annotated[bool, Query()] = True,
    variant: Annotated[Literal["clean", "raw", "edited"], Query()] = "clean",
) -> Response:
    fmt = format.lower()
    if fmt not in SUPPORTED_FORMATS:
        return Response(
            content=f'{{"detail":"Unsupported format. Use one of {list(SUPPORTED_FORMATS)}"}}',
            media_type="application/json",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    tr = get_transcript_or_404(db, transcript_id, with_segments=True)
    assert_can_access(tr, user)
    bundle = build_export_bundle(db, tr, variant=variant)
    result = export(bundle, fmt, include_timestamps=timestamps)
    return StreamingResponse(
        iter([result.content]),
        media_type=result.media_type,
        headers={"Content-Disposition": f'attachment; filename="{result.filename}"'},
    )
