from __future__ import annotations

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class Video(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "videos"

    # "youtube" | "upload"
    source_type: Mapped[str] = mapped_column(String(16), default="youtube", nullable=False)
    # Set for YouTube sources only. Unique index still allows many NULLs.
    youtube_video_id: Mapped[str | None] = mapped_column(String(20), unique=True, index=True)
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    # Playable media URL for uploads (Vercel Blob).
    source_url: Mapped[str | None] = mapped_column(String(1000))
    original_filename: Mapped[str | None] = mapped_column(String(255))
    content_type: Mapped[str | None] = mapped_column(String(100))

    title: Mapped[str | None] = mapped_column(String(500))
    channel: Mapped[str | None] = mapped_column(String(255))
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    language: Mapped[str | None] = mapped_column(String(16))
    thumbnail_url: Mapped[str | None] = mapped_column(String(500))
    published_at: Mapped[str | None] = mapped_column(String(40))
    description: Mapped[str | None] = mapped_column(Text)

    transcripts: Mapped[list["Transcript"]] = relationship(  # noqa: F821
        back_populates="video", cascade="all, delete-orphan"
    )
