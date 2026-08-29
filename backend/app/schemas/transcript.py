from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models import ACCURACY_CLEAN, ACCURACY_MODES
from app.schemas.video import VideoOut
from app.utils.youtube_url import InvalidYouTubeURL, extract_video_id

_BLOB_HOST = "blob.vercel-storage.com"


class TranscriptCreate(BaseModel):
    """Exactly one of ``youtube_url`` or ``file_url`` must be given."""

    youtube_url: str | None = Field(default=None, max_length=500)
    file_url: str | None = Field(default=None, max_length=1000)
    filename: str | None = Field(default=None, max_length=255)
    accuracy_mode: str = ACCURACY_CLEAN
    language: str | None = Field(default=None, max_length=16)

    @field_validator("accuracy_mode")
    @classmethod
    def _valid_mode(cls, v: str) -> str:
        if v not in ACCURACY_MODES:
            raise ValueError(f"accuracy_mode must be one of {sorted(ACCURACY_MODES)}")
        return v

    @model_validator(mode="after")
    def _one_source(self) -> "TranscriptCreate":
        yt = (self.youtube_url or "").strip()
        fu = (self.file_url or "").strip()
        if bool(yt) == bool(fu):
            raise ValueError("Provide either a YouTube URL or an uploaded file, not both.")
        if yt:
            try:
                extract_video_id(yt)
            except InvalidYouTubeURL as exc:
                raise ValueError(f"Not a valid YouTube URL ({exc}).") from exc
            self.youtube_url = yt
        else:
            if not (fu.startswith("https://") and _BLOB_HOST in fu):
                raise ValueError("file_url must be an uploaded file URL.")
            self.file_url = fu
        return self


class WordOut(BaseModel):
    word: str
    start_time: float
    end_time: float
    confidence: float | None = None

    model_config = {"from_attributes": True}


class SegmentOut(BaseModel):
    id: str
    order_index: int
    speaker: str | None = None
    start_time: float
    end_time: float
    text: str
    raw_text: str | None = None
    edited_text: str | None = None
    confidence: float | None = None
    words: list[WordOut] = []

    model_config = {"from_attributes": True}


class SegmentIn(BaseModel):
    id: str | None = None
    order_index: int
    speaker: str | None = Field(default=None, max_length=40)
    start_time: float = Field(ge=0)
    end_time: float = Field(ge=0)
    text: str = Field(max_length=20000)


class TranscriptUpdate(BaseModel):
    segments: list[SegmentIn] = Field(min_length=1)


class JobStatusOut(BaseModel):
    job_id: str
    transcript_id: str
    status: str
    stage: str
    progress: int
    error: str | None = None


class TranscriptStats(BaseModel):
    words: int = 0
    characters: int = 0
    sentences: int = 0
    paragraphs: int = 0
    segments: int = 0
    duration_seconds: float | None = None
    speaking_time_seconds: float | None = None
    speaking_pace_wpm: float | None = None
    reading_time_minutes: float | None = None
    speaker_count: int = 0


class TranscriptDetailOut(BaseModel):
    id: str
    status: str
    stage: str
    progress: int
    error: str | None = None
    accuracy_mode: str
    provider: str | None = None
    source: str | None = None
    language: str | None = None
    language_confidence: float | None = None
    has_word_timestamps: bool
    has_speaker_labels: bool
    raw_text: str | None = None
    clean_text: str | None = None
    edited_text: str | None = None
    stats: TranscriptStats | None = None
    video: VideoOut
    segments: list[SegmentOut] = []
    created_at: datetime
    updated_at: datetime


class TranscriptListItem(BaseModel):
    id: str
    status: str
    language: str | None = None
    accuracy_mode: str
    created_at: datetime
    source_type: str = "youtube"
    title: str | None = None
    channel: str | None = None
    thumbnail_url: str | None = None
    duration_seconds: int | None = None
    word_count: int = 0


class TranscriptListOut(BaseModel):
    items: list[TranscriptListItem]
    total: int
    page: int
    page_size: int
