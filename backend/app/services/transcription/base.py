"""Transcription provider abstraction.

Every provider maps an authorized media/caption source to a normalized
:class:`TranscriptionResult`. Swapping vendors must not touch pipeline code.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


class ProviderUnavailable(RuntimeError):
    """Provider cannot service this request (no key, no captions, blocked, ...)."""


class TranscriptSourceNotFound(ProviderUnavailable):
    """No permitted transcript or media source exists for this video."""


class TranscriptionPending(Exception):
    """The provider accepted the job but it is still running (long media).

    The pipeline stores ``job_id`` and finalises later via polling, rather than
    blocking the request past the serverless time limit.
    """

    def __init__(self, job_id: str, provider: str = "supadata") -> None:
        super().__init__(f"{provider} job {job_id} is still processing")
        self.job_id = job_id
        self.provider = provider


@dataclass
class Word:
    text: str
    start: float
    end: float
    confidence: float | None = None


@dataclass
class Segment:
    start: float
    end: float
    text: str
    speaker: str | None = None
    confidence: float | None = None
    words: list[Word] = field(default_factory=list)
    raw_text: str | None = None


@dataclass
class TranscriptionResult:
    segments: list[Segment]
    language: str | None = None
    language_confidence: float | None = None
    provider: str = "unknown"
    source: str = "unknown"  # "youtube_captions" | "audio_whisper" | "deepgram" | ...
    has_word_timestamps: bool = False
    has_speaker_labels: bool = False

    @property
    def plain_text(self) -> str:
        return " ".join(s.text.strip() for s in self.segments if s.text.strip())


@dataclass
class TranscriptionRequest:
    video_id: str
    canonical_url: str
    preferred_languages: list[str] = field(default_factory=lambda: ["en"])
    duration_seconds: int | None = None
    source_kind: str = "youtube"  # "youtube" | "file"


class TranscriptionProvider(ABC):
    name: str = "base"

    @abstractmethod
    def is_available(self) -> bool:
        """Cheap check: is this provider configured/usable at all?"""

    @abstractmethod
    def transcribe(self, request: TranscriptionRequest) -> TranscriptionResult:
        """Produce a transcript or raise :class:`ProviderUnavailable`."""
