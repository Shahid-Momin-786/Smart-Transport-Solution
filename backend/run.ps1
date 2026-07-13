# SMTS Backend Helper Script
# Usage: .\run.ps1 [command]
# Examples:
#   .\run.ps1 runserver
#   .\run.ps1 migrate
#   .\run.ps1 seed_all
#   .\run.ps1 makemigrations authentication

param(
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Args
)

$VENV_PYTHON = "$PSScriptRoot\venv\Scripts\python.exe"

if (-not (Test-Path $VENV_PYTHON)) {
    Write-Host "ERROR: venv not found at $VENV_PYTHON" -ForegroundColor Red
    Write-Host "Run: python -m venv venv  then  .\venv\Scripts\pip install -r requirements.txt" -ForegroundColor Yellow
    exit 1
}

Write-Host "Using: $VENV_PYTHON" -ForegroundColor Cyan

if ($Args.Count -eq 0) {
    # Default: start the server
    & $VENV_PYTHON manage.py runserver
} else {
    & $VENV_PYTHON manage.py @Args
}
