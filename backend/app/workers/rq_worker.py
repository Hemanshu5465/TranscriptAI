"""Entrypoint for an RQ worker process.

    python -m app.workers.rq_worker

Requires JOB_QUEUE=redis and a reachable REDIS_URL. On Windows, RQ needs
SimpleWorker (no fork): this module picks the right worker class automatically.
"""
from __future__ import annotations

import sys

from redis import Redis
from rq import Queue

from app.config.settings import settings


def main() -> None:
    connection = Redis.from_url(settings.redis_url)
    queue = Queue("transcripts", connection=connection)

    if sys.platform.startswith("win"):
        from rq import SimpleWorker

        worker_cls = SimpleWorker
    else:
        from rq import Worker

        worker_cls = Worker

    worker = worker_cls([queue], connection=connection)
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
