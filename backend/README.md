# TranscriptAI — backend

FastAPI + SQLAlchemy 2 (sync) + Alembic. See the [root README](../README.md) for
the full picture; this file is the backend cheat-sheet.

## Layout

```
app/
├── main.py                 app factory, CORS, rate-limit + exception handlers
├── config/settings.py      pydantic-settings (.env)
├── db/                     engine, session, declarative base + mixins
├── models/                 User, Video, Transcript, Segment, Word, Edit
├── schemas/                Pydantic request/response models
├── core/                   security (bcrypt+JWT), deps, rate_limit
├── api/v1/                  health, auth, videos, transcripts, admin
├── services/
│   ├── youtube_service.py       validate / extract id / metadata (oEmbed + Data API)
│   ├── transcription/           TranscriptionProvider ABC + youtube_captions,
│   │                            faster_whisper, deepgram(stub), factory (fallback chain)
│   ├── ai/                      TranscriptFormatter ABC + rule_based, claude
│   ├── stats_service.py         word/char/sentence/paragraph/reading-time
│   ├── export_service.py        txt · docx · pdf · srt · vtt · json · csv
│   ├── pipeline.py              orchestrates a job end-to-end
│   └── transcript_service.py    create / serialise / edit / export-bundle
└── workers/
    ├── queue.py            enqueue → thread pool | RQ | inline
    ├── tasks.py            process_transcript_job(transcript_id)
    └── rq_worker.py        `python -m app.workers.rq_worker`
```

## Commands

```bash
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8899
.venv/Scripts/alembic upgrade head
.venv/Scripts/alembic revision --autogenerate -m "message"
.venv/Scripts/python -m pytest                 # -m network for the live YouTube test
.venv/Scripts/python -m app.workers.rq_worker   # only with JOB_QUEUE=redis
```

## Adding a transcription provider

1. Create `app/services/transcription/<vendor>.py` with a class extending
   `TranscriptionProvider` (`is_available()` + `transcribe(req) -> TranscriptionResult`).
2. Register it in `factory._REGISTRY` (and `_CHAIN` if it should be a fallback).
3. Set `TRANSCRIPTION_PROVIDER=<vendor>` in `.env`.

Nothing else changes — the pipeline only knows `TranscriptionResult`.

## Notes

- **Python 3.14**: `passlib` is incompatible, so `core/security.py` uses `bcrypt`
  directly. All runtime deps in `requirements.txt` have wheels for 3.11–3.14.
- SQLite relative paths in `DATABASE_URL` resolve against the `backend/` dir, not
  the CWD, so migrations/seed work from anywhere.
