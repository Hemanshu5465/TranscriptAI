"""Background job dispatch.

``JOB_QUEUE=thread`` (default) runs the pipeline in an in-process thread pool —
no external services. ``JOB_QUEUE=redis`` enqueues to an RQ worker.
"""
from __future__ import annotations

import atexit
import logging
from concurrent.futures import ThreadPoolExecutor

from app.config.settings import settings
from app.workers.tasks import process_transcript_job

logger = logging.getLogger(__name__)

_executor: ThreadPoolExecutor | None = None


def _get_executor() -> ThreadPoolExecutor:
    global _executor
    if _executor is None:
        _executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="pipeline")
        atexit.register(_executor.shutdown, wait=False)
    return _executor


def _redis_queue():
    from redis import Redis
    from rq import Queue

    return Queue("transcripts", connection=Redis.from_url(settings.redis_url))


def enqueue_transcript(transcript_id: str) -> None:
    if settings.job_queue == "inline":
        process_transcript_job(transcript_id)
        return

    if settings.job_queue == "redis":
        try:
            _redis_queue().enqueue(
                process_transcript_job,
                transcript_id,
                job_timeout=settings.job_timeout_seconds,
            )
            return
        except Exception:  # noqa: BLE001
            logger.exception("Redis enqueue failed; running job in-process instead")

    _get_executor().submit(process_transcript_job, transcript_id)


def queue_health() -> dict:
    info = {"mode": settings.job_queue}
    if settings.job_queue == "redis":
        try:
            _redis_queue().connection.ping()
            info["redis"] = "ok"
        except Exception as exc:  # noqa: BLE001
            info["redis"] = f"unreachable: {exc}"
    return info
