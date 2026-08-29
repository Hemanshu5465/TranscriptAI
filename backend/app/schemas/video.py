from __future__ import annotations

from pydantic import BaseModel


class VideoValidateOut(BaseModel):
    valid: bool
    video_id: str | None = None
    canonical_url: str | None = None
    reason: str | None = None


class VideoOut(BaseModel):
    id: str
    source_type: str = "youtube"
    youtube_video_id: str | None = None
    url: str
    source_url: str | None = None
    original_filename: str | None = None
    content_type: str | None = None
    title: str | None = None
    channel: str | None = None
    duration_seconds: int | None = None
    language: str | None = None
    thumbnail_url: str | None = None
    published_at: str | None = None

    model_config = {"from_attributes": True}
