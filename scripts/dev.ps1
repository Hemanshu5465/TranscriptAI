<#
  Starts the backend API and the frontend dev server in two PowerShell windows.
  Run from the repo root:  ./scripts/dev.ps1
  (No separate worker needed: JOB_QUEUE=thread runs jobs in-process.)
#>
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

$py = Join-Path $root "backend/.venv/Scripts/python.exe"
if (-not (Test-Path $py)) { $py = "python" }

$apiPort = 8899   # matches frontend/vite.config.ts proxy default

Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "cd '$root/backend'; & '$py' -m uvicorn app.main:app --reload --port $apiPort"
)

Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "cd '$root/frontend'; npm run dev"
)

Write-Host "API on :$apiPort. Frontend prints its own URL (usually :5173)."
Write-Host "If you change the API port, set VITE_API_PROXY before 'npm run dev'."
