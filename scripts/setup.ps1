<#
  One-time setup: backend venv + deps + migrations + demo user, and frontend deps.
  Run from the repo root:  ./scripts/setup.ps1
#>
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "== Backend ==" -ForegroundColor Cyan
Set-Location "$root/backend"
if (-not (Test-Path ".venv")) { python -m venv .venv }
& ".venv/Scripts/python.exe" -m pip install --upgrade pip
& ".venv/Scripts/python.exe" -m pip install -r requirements.txt

if (-not (Test-Path ".env")) {
  Copy-Item "$root/.env.example" ".env"
  $secret = & ".venv/Scripts/python.exe" -c "import secrets;print(secrets.token_urlsafe(48))"
  (Get-Content ".env") -replace "change-me-to-a-long-random-string", $secret | Set-Content ".env"
  Write-Host "Wrote backend/.env (edit DATABASE_URL if you want Postgres)."
}

& ".venv/Scripts/alembic.exe" upgrade head
& ".venv/Scripts/python.exe" "$root/database/seed/seed.py"

Write-Host "== Frontend ==" -ForegroundColor Cyan
Set-Location "$root/frontend"
npm install

Set-Location $root
Write-Host "Done. Start everything with ./scripts/dev.ps1" -ForegroundColor Green
