4# TranscriptAI

**Turn YouTube videos into accurate, editable scripts.**

Paste a YouTube URL → TranscriptAI validates it, retrieves the video's caption
track (or transcribes its audio), lightly formats the text **without changing the
wording**, and gives you a timestamped, searchable, editable transcript you can
export in seven formats.

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Installation](#installation)
- [Environment variables](#environment-variables)
- [Database setup](#database-setup)
- [Running the app](#running-the-app)
- [API documentation](#api-documentation)
- [Testing](#testing)
- [Production deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [How wording is preserved](#how-wording-is-preserved)

---

## Features

| Area | What you get |
| --- | --- |
| **Input** | Paste any `watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`, `/live/` URL — **or upload a video/audio file** (up to 1 GB; browser → Vercel Blob → Supadata). Instant client + server validation. |
| **Pipeline** | Async job with live progress: validate → metadata → retrieve transcript → (speech recognition) → detect language → timestamps → format → done. |
| **Transcript** | Sentence-level timestamps (clickable → seeks the embedded player), optional word-level timestamps, speaker labels when the provider supplies them. |
| **Views** | Raw ⇄ Clean toggle; Exact / Clean / Readable accuracy modes; low-confidence word highlighting with per-word confidence + timestamp. |
| **Search** | Full transcript search with match count and jump-to-result. |
| **Edit** | Inline per-segment editing with undo/redo. Raw, clean and user-edited layers are stored separately — the original is never overwritten. |
| **Copy** | With / without timestamps → clipboard, with toast confirmation. |
| **Export** | TXT, DOCX, PDF, SRT, VTT, JSON, CSV — of the raw, clean, or edited text. |
| **Accounts** | Register / login (JWT), transcript history with search + language filters. |
| **Admin** | `/admin` stats + job list, retry failed jobs, delete jobs (first registered user is admin). |
| **UX** | Light / dark / system themes, responsive down to mobile, keyboard-navigable, virtualized rendering for very long transcripts. |

---

## Architecture

```
┌──────────────┐   POST /transcripts    ┌───────────────┐
│  React SPA   │ ─────────────────────► │  FastAPI API  │
│ (Vite + TS)  │ ◄───── job_id ──────── │               │
│              │                        │  creates row  │
│  polls       │   GET .../status       │  + enqueues   │
│  status ────►│ ◄──────────────────────│               │
└──────────────┘                        └──────┬────────┘
       ▲                                        │ JobQueue (thread | redis/RQ)
       │ GET /transcripts/{id}                  ▼
       │ (+ segments, export)          ┌────────────────────┐
       └──────────────────────────────►│  Pipeline (worker) │
                                       │                    │
      youtube_service ◄────────────────┤ 1 validate url     │
      (oEmbed / Data API)              │ 2 fetch metadata   │
                                       │ 3 TranscriptionProvider
      TranscriptionProvider ◄──────────┤   • youtube_captions (default)
      (swappable interface)            │   • faster_whisper (audio, opt-in)
                                       │   • deepgram (stub)
      TranscriptFormatter ◄────────────┤ 4 format (rule_based | claude)
                                       │ 5 stats + persist  │
                                       └─────────┬──────────┘
                                                 ▼
                                        PostgreSQL / SQLite
```

- **Frontend** — React 19, TypeScript, Vite, Tailwind v4, React Router, TanStack
  Query (polling) + Virtual (long lists), Zustand (auth/theme), Axios.
  `frontend/src/{lib,store,hooks,components,pages,layouts}`.
- **Backend** — FastAPI, SQLAlchemy 2 (sync), Alembic, slowapi rate limiting,
  bcrypt + JWT. `backend/app/{api,services,workers,models,schemas,core}`.
- **Provider abstraction** — `services/transcription/base.py` defines
  `TranscriptionProvider`; `factory.py` picks one and falls back down a chain.
  Adding a vendor = one new file, zero pipeline changes.
- **Formatter abstraction** — `services/ai/formatter.py`; `rule_based.py` is the
  deterministic offline default, `claude.py` uses the Anthropic API when a key is
  set and silently falls back to rule-based on any error.
- **Jobs** — `workers/queue.py` dispatches to an in-process `ThreadPoolExecutor`
  (`JOB_QUEUE=thread`, default), an RQ worker (`JOB_QUEUE=redis`), or runs
  synchronously (`JOB_QUEUE=inline`, used by tests).

---

## Requirements

- **Python 3.11–3.14**
- **Node.js 20+**
- **PostgreSQL 14+** *(optional — SQLite is the zero-setup default)*
- **Redis 6+** *(optional — only for `JOB_QUEUE=redis`)*
- **ffmpeg** *(optional — only for the Whisper audio fallback)*

No API keys are required. With them you get more:

| Key | Enables | Without it |
| --- | --- | --- |
| `AI_API_KEY` (+ `AI_PROVIDER=claude`) | LLM punctuation/formatting | Deterministic rule-based formatter |
| `YOUTUBE_API_KEY` | Duration, channel, publish date, description | Public oEmbed (title + thumbnail + author) |
| `DEEPGRAM_API_KEY` | Cloud STT provider (after implementing the stub) | Provider unavailable |

---

## Installation

### Quick start (Windows PowerShell)

```powershell
git clone <repo> ; cd "video to script"
./scripts/setup.ps1     # venv + deps + migrations + demo user + npm install
./scripts/dev.ps1       # opens API :8899 and frontend :5173
```

### Manual

**Backend**

```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt   # macOS/Linux
cp ../.env.example .env        # then edit JWT_SECRET (+ DATABASE_URL for Postgres)
.venv/Scripts/alembic upgrade head
.venv/Scripts/python ../database/seed/seed.py             # demo@example.com / demopass123
```

**Frontend**

```bash
cd frontend
npm install
```

Optional audio fallback:

```bash
cd backend && .venv/Scripts/python -m pip install -r requirements-optional.txt
# set ENABLE_AUDIO_FALLBACK=true in backend/.env  (needs ffmpeg on PATH)
```

---

## Environment variables

All backend config lives in `backend/.env` (template: `.env.example`). Highlights:

```ini
DATABASE_URL=sqlite:///./.data/transcriptai.db      # or postgresql+psycopg://user:pass@host:5432/transcriptai
JWT_SECRET=<generate: python -c "import secrets;print(secrets.token_urlsafe(48))">
FRONTEND_ORIGIN=http://localhost:5173               # CORS allow-origin (comma-separated ok)

JOB_QUEUE=thread                                    # thread | redis | inline
REDIS_URL=redis://localhost:6379/0
MAX_JOBS_PER_USER_PER_MONTH=50
JOB_TIMEOUT_SECONDS=1800

TRANSCRIPTION_PROVIDER=youtube_captions             # youtube_captions | faster_whisper | deepgram
TRANSCRIPTION_FALLBACK=true
ENABLE_AUDIO_FALLBACK=false                         # yt-dlp + local Whisper; authorized media only
WHISPER_MODEL=base

AI_PROVIDER=rule_based                              # rule_based | claude
AI_API_KEY=
YOUTUBE_API_KEY=
DEEPGRAM_API_KEY=

RATE_LIMIT_DEFAULT=120/minute
RATE_LIMIT_CREATE=10/minute
```

**Frontend:** the dev server proxies `/api` to `http://localhost:8899`. Point it
elsewhere with `VITE_API_PROXY=http://localhost:8123 npm run dev`.

Secrets are read only on the server and are never sent to the browser.

---

## Database setup

**SQLite (default)** — nothing to do; the file is created at
`backend/.data/transcriptai.db` on first migrate.

**PostgreSQL**

```sql
CREATE DATABASE transcriptai;
CREATE USER transcriptai WITH PASSWORD 'transcriptai';
GRANT ALL PRIVILEGES ON DATABASE transcriptai TO transcriptai;
```

```bash
# backend/.env
DATABASE_URL=postgresql+psycopg://transcriptai:transcriptai@localhost:5432/transcriptai
```

```bash
cd backend && .venv/Scripts/alembic upgrade head
```

The bundled migration is dialect-agnostic. New migrations:
`alembic revision --autogenerate -m "..."`.

---

## Running the app

| Process | Command (from `backend/`) |
| --- | --- |
| API | `.venv/Scripts/python -m uvicorn app.main:app --reload --port 8899` |
| Worker | not needed for `JOB_QUEUE=thread`. For redis: `.venv/Scripts/python -m app.workers.rq_worker` |
| Frontend (from `frontend/`) | `npm run dev` → http://localhost:5173 |

Interactive API docs: **http://localhost:8899/docs**.

### Docker (optional)

```bash
docker compose -f docker/docker-compose.yml up --build
# Postgres + Redis + API (:8000) + RQ worker. Run the frontend with npm
# (set VITE_API_PROXY=http://localhost:8000 for the Docker API port).
```

---

## API documentation

Base path `**/api/v1**`. Auth: `Authorization: Bearer <token>` (optional for
transcript endpoints — anonymous transcripts are public by id).

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/transcripts` | `{ youtube_url, accuracy_mode?, language? }` → `{ job_id, status, stage, progress }` (202) |
| `GET` | `/transcripts/{job_id}/status` | Lightweight poll: `{ status, stage, progress, error }` |
| `GET` | `/transcripts/{id}` | Full transcript + video + stats + segments (+ words) |
| `GET` | `/transcripts/{id}/segments` | Timestamped segments only |
| `PUT` | `/transcripts/{id}` | `{ segments: [...] }` — saves a user-edit snapshot; raw/clean untouched |
| `GET` | `/transcripts/{id}/export?format=&timestamps=&variant=` | `format`: txt·docx·pdf·srt·vtt·json·csv · `variant`: clean·raw·edited |
| `GET` | `/transcripts?page=&page_size=&q=&language=&filter=` | Auth user's history |
| `GET` | `/videos/validate?url=` | `{ valid, video_id, canonical_url, reason }` |
| `POST` | `/auth/register` · `/auth/login` | → `{ access_token, user }` |
| `GET` | `/auth/me` | Current user |
| `GET` | `/admin/stats` · `/admin/jobs` · `POST /admin/jobs/{id}/retry` · `DELETE /admin/jobs/{id}` | Admin only |
| `GET` | `/healthz` | DB, queue, providers, AI mode |

---

## Testing

```bash
# Backend — 34 tests (URL parsing, auth, pipeline w/ fake provider, all exporters, stats)
cd backend && .venv/Scripts/python -m pytest

# One live test hitting real YouTube captions:
.venv/Scripts/python -m pytest -m network

# Frontend — 24 tests (URL validation, search, undo/redo, copy/export string builders)
cd frontend && npm test
```

---

## Production deployment

**Vercel (frontend + backend in one project) → see [DEPLOYMENT.md](DEPLOYMENT.md).**
Uses Neon Postgres, `JOB_QUEUE=inline`, and `api/index.py` as a Python serverless function.

**Self-hosted / always-on host:**
1. **Database** — managed Postgres; `alembic upgrade head` on deploy (or `AUTO_MIGRATE=true`).
2. **Queue** — `JOB_QUEUE=thread` (in-process) or `redis` + `python -m app.workers.rq_worker`.
3. **API** — `uvicorn app.main:app` behind a reverse proxy (TLS, gzip). Set
   `FRONTEND_ORIGIN` to your real origin.
4. **Frontend** — `npm run build` → serve `frontend/dist`; proxy `/api` to the API.
5. **Secrets** — inject via the platform's secret store, never commit `.env`.
6. **YouTube** — datacenter IPs get blocked; set `WEBSHARE_PROXY_USERNAME` /
   `WEBSHARE_PROXY_PASSWORD` (or `HTTP_PROXY_URL`) for reliable caption fetching.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `RequestBlocked` / `IpBlocked` from youtube-transcript-api | YouTube throttles some (often datacenter) IPs. Retry later, run from a residential IP, or enable the audio fallback. |
| Transcript fails: *"No permitted transcript or media source"* | The video has no caption track. Enable `ENABLE_AUDIO_FALLBACK=true` (+ `pip install -r requirements-optional.txt` + ffmpeg). |
| Whisper: `ffmpeg not found` | Install ffmpeg and put it on `PATH`. |
| First Whisper run is slow | It downloads the model (~150 MB for `base`) once; cached afterwards. |
| Formatting looks basic | You're on the rule-based formatter. Set `AI_PROVIDER=claude` + `AI_API_KEY`. |
| Duration / publish date missing | Add `YOUTUBE_API_KEY` (oEmbed doesn't expose them). |
| `address already in use` on :8000 | Another process holds the port — pick another and set `VITE_API_PROXY`. |
| Windows + Redis: worker exits on fork | Handled — `rq_worker.py` uses `SimpleWorker` on Windows. |

---

## Security

Input validation (Pydantic) on every request · strict YouTube-URL allowlist ·
per-user + per-IP rate limiting (slowapi) · CORS locked to `FRONTEND_ORIGIN` ·
ORM-only queries (no string SQL) · bcrypt password hashing · signed JWTs ·
monthly per-user job cap · job timeout · Whisper model-size cap · audio download
gated behind an explicit opt-in flag. React escapes all rendered transcript text
(no `dangerouslySetInnerHTML`). API keys stay server-side.

TranscriptAI uses publicly available captions and metadata and **does not attempt
to bypass any platform protection**. Only transcribe content you are authorized
to process.

---

## How wording is preserved Supdata - API for you tube  / deepgram api  - for video  /  vercel  / databse = vercel / database github 


The formatter's contract (enforced in the prompt and the rule-based heuristics):

> Preserve the speaker's original wording as closely as possible. Do not
> summarize, paraphrase, add information, remove meaningful words, invent words,
> fabricate timestamps or speakers, or change the intended meaning.

Every transcript keeps three layers: **raw** (exactly what the STT/caption source
produced), **clean** (formatted), and **edited** (your changes). You can switch
between raw and clean at any time and export any of them. Unclear audio is left
as `[inaudible]` / low-confidence rather than guessed.






 

