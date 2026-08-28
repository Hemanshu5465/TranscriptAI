# Deploying TranscriptAI to Vercel

Frontend **and** backend deploy as a single Vercel project:

- `frontend/` → static build, served at the root
- `api/index.py` → the FastAPI app, served at `/api/*` as a Python serverless function
- Database → **Neon** Postgres (SQLite has no persistent disk on Vercel)

Everything the app does locally still works, with three differences on serverless
(see [Known differences](#known-differences-on-vercel)).

---

## 1. Create the database (Neon)

1. Sign up at **https://neon.tech** (free tier is enough) → **Create project**.
2. Copy the connection string. It looks like:
   ```
   postgresql://user:pass@ep-xxx-123.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
3. **Add the driver prefix** so SQLAlchemy uses psycopg 3 — change `postgresql://`
   to `postgresql+psycopg://`:
   ```
   postgresql+psycopg://user:pass@ep-xxx-123.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
   Keep this — it's your `DATABASE_URL`.

## 2. Create the tables

The app auto-creates the schema on first request (`AUTO_MIGRATE=true`, the default),
so you can skip this. To do it explicitly from your machine:

```powershell
cd backend
$env:DATABASE_URL="postgresql+psycopg://...neon.tech/neondb?sslmode=require"
.\.venv\Scripts\alembic.exe upgrade head
# optional demo account:
.\.venv\Scripts\python.exe ..\database\seed\seed.py
```

## 3. Push to GitHub

```powershell
cd "e:\claude-workshop\video to script"
git add -A
git commit -m "TranscriptAI"
git remote add origin https://github.com/<you>/<repo>.git
git branch -M main
git push -u origin main
```

## 4. Import into Vercel

1. **https://vercel.com/new** → import the GitHub repo.
2. Framework preset: **Other** (the repo's `vercel.json` configures the build).
3. Leave Root Directory as `/` (repo root).
4. Add **Environment Variables** (Project → Settings → Environment Variables):

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | your `postgresql+psycopg://…neon.tech/…` string |
   | `JWT_SECRET` | run `python -c "import secrets;print(secrets.token_urlsafe(48))"` |
   | `JOB_QUEUE` | `inline` |
   | `AUTO_MIGRATE` | `true` |
   | `AI_API_KEY` | *(optional)* Anthropic key for LLM formatting |
   | `AI_PROVIDER` | `claude` *(only if you set `AI_API_KEY`)* |
   | `YOUTUBE_API_KEY` | *(optional)* richer video metadata |
   | `WEBSHARE_PROXY_USERNAME` / `WEBSHARE_PROXY_PASSWORD` | *(recommended — see step 6)* |

5. **Deploy.**

## 5. Verify

- `https://<your-app>.vercel.app/api/v1/healthz` → `{"status":"ok","database":"ok",...}`
- Open the site, paste a YouTube URL, generate a transcript.
- `https://<your-app>.vercel.app/docs` → interactive API docs.

## 6. Make YouTube transcription reliable (recommended)

YouTube blocks caption requests from datacenter IPs — which is every cloud host,
Vercel included. Without a proxy, transcription **works intermittently** and
otherwise returns *"YouTube declined the transcript request from this network."*

Fix: a residential proxy. `youtube-transcript-api` has built-in **Webshare** support.

1. https://www.webshare.io → buy the **"Residential"** proxy plan (starts ~$1–6/mo;
   the free/"Proxy Server" plan is datacenter and will NOT help).
2. Dashboard → **Proxy Settings** → copy **Proxy Username** and **Proxy Password**.
3. In Vercel add `WEBSHARE_PROXY_USERNAME` and `WEBSHARE_PROXY_PASSWORD`, redeploy.
4. `healthz` should now show `"youtube_proxy": true`.

(Any generic HTTP proxy also works — set `HTTP_PROXY_URL` instead.)

---

## Known differences on Vercel

| Local | On Vercel |
| --- | --- |
| Processing page streams stages (validate → metadata → …) | Transcription runs synchronously inside the request; the processing page completes in one step (~3–8s). Same result. |
| YouTube captions fetched from your home IP — reliable | Datacenter IP — add a Webshare proxy (step 6) for reliability. |
| Whisper audio fallback available (`ENABLE_AUDIO_FALLBACK`) | Not available (no ffmpeg, read-only FS, time limit). Leave it off. |
| Background thread queue | `JOB_QUEUE=inline` (set in step 4). |

## Local development is unchanged

```powershell
cd backend  && .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8899
cd frontend && npm run dev
```
SQLite, background worker, everything as before. See [README.md](README.md).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `healthz` shows `"database":"unreachable"` | `DATABASE_URL` wrong or missing `+psycopg` prefix or `?sslmode=require`. |
| First transcript 500s, later ones work | Cold-start schema setup raced; retry. Or run step 2 manually and set `AUTO_MIGRATE=false`. |
| `FUNCTION_INVOCATION_TIMEOUT` | A very long video exceeded 60s. Retry, or raise `maxDuration` in `vercel.json` (needs a paid Vercel plan above 60s). |
| Build fails on `npm ci` | Commit `frontend/package-lock.json` (it should already be tracked). |
| API routes 404 but the site loads | `vercel.json` rewrites not applied — make sure it's at the repo root and Root Directory is `/`. |
