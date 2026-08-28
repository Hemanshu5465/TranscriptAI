"""Job entrypoints. Importable by both the thread pool and an RQ worker."""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def process_transcript_job(transcript_id: str) -> None:
    """Run the full transcription pipeline for one transcript row."""
    from app.services.pipeline import run_pipeline

    logger.info("Starting transcript job %s", transcript_id)
    run_pipeline(transcript_id)
    logger.info("Finished transcript job %s", transcript_id)
