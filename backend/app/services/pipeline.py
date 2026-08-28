"""End-to-end transcript pipeline. Runs inside a background job."""
from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import session_scope
from app.models import (
    STAGES,
    STATUS_COMPLETED,
    STATUS_FAILED,
    STATUS_PROCESSING,
    Transcript,
    TranscriptSegment,
    TranscriptWord,
    Video,
)
from app.services.ai import get_formatter
from app.services.stats_service import compute_stats
from app.services.transcription import (
    ProviderUnavailable,
    TranscriptionRequest,
    TranscriptSourceNotFound,
    transcribe,
)
from app.services.transcription.base import Segment as ProviderSegment
from app.services.youtube_service import VideoUnavailable, get_video_metadata
from app.utils.youtube_url import InvalidYouTubeURL, parse_youtube_url

logger = logging.getLogger(__name__)

_STAGE_PROGRESS = {
    "validate_url": 5,
    "fetch_metadata": 15,
    "retrieve_transcript": 45,
    "speech_recognition": 60,
    "detect_language": 70,
    "build_segments": 85,
    "format_transcript": 95,
    "complete": 100,
}


class PipelineError(RuntimeError):
    """Carries a user-facing message for a failed pipeline."""


def _set_stage(db: Session, tr: Transcript, stage: str) -> None:
    tr.stage = stage
    tr.progress = _STAGE_PROGRESS.get(stage, tr.progress)
    if stage != "complete":
        tr.status = STATUS_PROCESSING
    db.add(tr)
    db.commit()
    logger.info("transcript %s -> %s (%s%%)", tr.id, stage, tr.progress)


def run_pipeline(transcript_id: str) -> None:
    try:
        with session_scope() as db:
            tr = db.get(Transcript, transcript_id)
            if tr is None:
                logger.error("run_pipeline: transcript %s not found", transcript_id)
                return
            _execute(db, tr)
    except PipelineError as exc:
        _fail(transcript_id, str(exc))
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unhandled pipeline error for %s", transcript_id)
        _fail(transcript_id, "We couldn't generate the transcript. Please try again.")


def _fail(transcript_id: str, message: str) -> None:
    with session_scope() as db:
        tr = db.get(Transcript, transcript_id)
        if tr is not None:
            tr.status = STATUS_FAILED
            tr.error_message = message
            db.add(tr)


def _execute(db: Session, tr: Transcript) -> None:
    video = db.get(Video, tr.video_id)
    if video is None:
        raise PipelineError("Internal error: video record missing.")

    # 1. validate
    _set_stage(db, tr, "validate_url")
    try:
        parsed = parse_youtube_url(video.url)
    except InvalidYouTubeURL:
        raise PipelineError("Please enter a valid YouTube URL.")

    # 2. metadata
    _set_stage(db, tr, "fetch_metadata")
    try:
        meta = get_video_metadata(video.url)
        video.title = meta.title or video.title
        video.channel = meta.channel or video.channel
        video.thumbnail_url = meta.thumbnail_url or video.thumbnail_url
        video.duration_seconds = meta.duration_seconds or video.duration_seconds
        video.published_at = meta.published_at or video.published_at
        video.description = meta.description or video.description
        db.add(video)
        db.commit()
    except VideoUnavailable as exc:
        raise PipelineError(str(exc))

    # 3 + 4. retrieve transcript / speech recognition
    _set_stage(db, tr, "retrieve_transcript")
    req = TranscriptionRequest(
        video_id=parsed.video_id,
        canonical_url=parsed.canonical_url,
        preferred_languages=[tr.language] if tr.language else ["en"],
        duration_seconds=video.duration_seconds,
    )
    try:
        result = transcribe(req)
    except TranscriptSourceNotFound as exc:
        raise PipelineError(str(exc))
    except ProviderUnavailable as exc:
        raise PipelineError(str(exc))

    if result.source == "audio_whisper":
        _set_stage(db, tr, "speech_recognition")

    # 5. language
    _set_stage(db, tr, "detect_language")
    tr.language = result.language or tr.language
    tr.language_confidence = result.language_confidence
    tr.provider = result.provider
    tr.source = result.source
    tr.has_word_timestamps = result.has_word_timestamps
    tr.has_speaker_labels = result.has_speaker_labels
    video.language = tr.language
    db.add_all([tr, video])
    db.commit()

    # 6. build segments (+ raw text)
    _set_stage(db, tr, "build_segments")
    raw_segments: list[ProviderSegment] = result.segments
    tr.raw_text = _raw_text(raw_segments)

    # 7. AI / rule-based formatting
    _set_stage(db, tr, "format_transcript")
    formatter = get_formatter()
    formatted = formatter.format(raw_segments, mode=tr.accuracy_mode, language=tr.language)
    tr.clean_text = formatted.full_text

    _persist_segments(db, tr, formatted.segments, raw_segments)

    duration = video.duration_seconds or (raw_segments[-1].end if raw_segments else None)
    tr.stats = compute_stats(formatted.segments, formatted.full_text, duration)

    # 8. done
    tr.status = STATUS_COMPLETED
    tr.error_message = None
    _set_stage(db, tr, "complete")
    db.add(tr)
    db.commit()
    assert tr.stage == STAGES[-1]


def _raw_text(segments: list[ProviderSegment]) -> str:
    return "\n\n".join(s.text.strip() for s in segments if s.text.strip())


def _persist_segments(
    db: Session,
    tr: Transcript,
    formatted: list[ProviderSegment],
    raw: list[ProviderSegment],
) -> None:
    db.execute(
        TranscriptSegment.__table__.delete().where(TranscriptSegment.transcript_id == tr.id)
    )
    db.flush()
    for idx, seg in enumerate(formatted):
        raw_text = seg.raw_text
        if raw_text is None and idx < len(raw):
            raw_text = raw[idx].text
        row = TranscriptSegment(
            transcript_id=tr.id,
            order_index=idx,
            speaker=seg.speaker,
            start_time=float(seg.start),
            end_time=float(max(seg.end, seg.start + 0.2)),
            text=seg.text,
            raw_text=raw_text,
            confidence=seg.confidence,
        )
        db.add(row)
        db.flush()
        for w in seg.words:
            db.add(
                TranscriptWord(
                    segment_id=row.id,
                    word=w.text,
                    start_time=float(w.start),
                    end_time=float(w.end),
                    confidence=w.confidence,
                )
            )
    db.commit()
