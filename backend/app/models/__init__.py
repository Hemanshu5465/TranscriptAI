"""ORM models. Importing this package registers all tables on ``Base.metadata``."""
from app.models.transcript import (
    Transcript,
    TranscriptEdit,
    TranscriptSegment,
    TranscriptWord,
)
from app.models.user import User
from app.models.video import Video

__all__ = [
    "User",
    "Video",
    "Transcript",
    "TranscriptSegment",
    "TranscriptWord",
    "TranscriptEdit",
]

# Job / transcript lifecycle
STATUS_QUEUED = "queued"
STATUS_PROCESSING = "processing"
STATUS_COMPLETED = "completed"
STATUS_FAILED = "failed"

# Pipeline stages (ordered) — surfaced to the UI checklist.
STAGES = [
    "validate_url",
    "fetch_metadata",
    "retrieve_transcript",
    "speech_recognition",
    "detect_language",
    "build_segments",
    "format_transcript",
    "complete",
]

ACCURACY_EXACT = "exact"
ACCURACY_CLEAN = "clean"
ACCURACY_READABLE = "readable"
ACCURACY_MODES = {ACCURACY_EXACT, ACCURACY_CLEAN, ACCURACY_READABLE}
