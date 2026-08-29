from __future__ import annotations

from sqlalchemy import (
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class Transcript(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "transcripts"

    video_id: Mapped[str] = mapped_column(ForeignKey("videos.id", ondelete="CASCADE"), index=True)
    owner_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    # Job lifecycle
    status: Mapped[str] = mapped_column(String(16), default="queued", nullable=False, index=True)
    stage: Mapped[str] = mapped_column(String(40), default="validate_url", nullable=False)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text)

    # Result
    accuracy_mode: Mapped[str] = mapped_column(String(16), default="clean", nullable=False)
    provider: Mapped[str | None] = mapped_column(String(40))
    # Set while an async provider job is running (finalised via /status polling).
    provider_job_id: Mapped[str | None] = mapped_column(String(80))
    source: Mapped[str | None] = mapped_column(String(40))  # e.g. "youtube_captions"
    language: Mapped[str | None] = mapped_column(String(16))
    language_confidence: Mapped[float | None] = mapped_column(Float)
    has_word_timestamps: Mapped[bool] = mapped_column(default=False, nullable=False)
    has_speaker_labels: Mapped[bool] = mapped_column(default=False, nullable=False)

    raw_text: Mapped[str | None] = mapped_column(Text)
    clean_text: Mapped[str | None] = mapped_column(Text)

    # Cached statistics (see services.stats_service)
    stats: Mapped[dict | None] = mapped_column(JSON)

    video: Mapped["Video"] = relationship(back_populates="transcripts")  # noqa: F821
    owner: Mapped["User | None"] = relationship(back_populates="transcripts")  # noqa: F821
    segments: Mapped[list["TranscriptSegment"]] = relationship(
        back_populates="transcript",
        cascade="all, delete-orphan",
        order_by="TranscriptSegment.order_index",
    )
    edits: Mapped[list["TranscriptEdit"]] = relationship(
        back_populates="transcript", cascade="all, delete-orphan", order_by="TranscriptEdit.created_at"
    )


class TranscriptSegment(UUIDMixin, Base):
    __tablename__ = "transcript_segments"
    __table_args__ = (UniqueConstraint("transcript_id", "order_index", name="uq_segment_order"),)

    transcript_id: Mapped[str] = mapped_column(
        ForeignKey("transcripts.id", ondelete="CASCADE"), index=True
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    speaker: Mapped[str | None] = mapped_column(String(40))
    start_time: Mapped[float] = mapped_column(Float, nullable=False)
    end_time: Mapped[float] = mapped_column(Float, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)  # clean/current text
    raw_text: Mapped[str | None] = mapped_column(Text)
    confidence: Mapped[float | None] = mapped_column(Float)

    transcript: Mapped["Transcript"] = relationship(back_populates="segments")
    words: Mapped[list["TranscriptWord"]] = relationship(
        back_populates="segment",
        cascade="all, delete-orphan",
        order_by="TranscriptWord.start_time",
    )


class TranscriptWord(UUIDMixin, Base):
    __tablename__ = "transcript_words"

    segment_id: Mapped[str] = mapped_column(
        ForeignKey("transcript_segments.id", ondelete="CASCADE"), index=True
    )
    word: Mapped[str] = mapped_column(String(120), nullable=False)
    start_time: Mapped[float] = mapped_column(Float, nullable=False)
    end_time: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float)

    segment: Mapped["TranscriptSegment"] = relationship(back_populates="words")


class TranscriptEdit(UUIDMixin, TimestampMixin, Base):
    """A saved snapshot of the user-edited transcript (segment list as JSON)."""

    __tablename__ = "transcript_edits"

    transcript_id: Mapped[str] = mapped_column(
        ForeignKey("transcripts.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    content: Mapped[list] = mapped_column(JSON, nullable=False)

    transcript: Mapped["Transcript"] = relationship(back_populates="edits")
