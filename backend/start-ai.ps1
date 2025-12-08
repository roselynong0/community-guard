# Start Lean AI Server on Windows PowerShell
# Requires: Python 3.11+, Ollama running on localhost:11434

Write-Host "🚀 Starting Community Guard Lean AI Server" -ForegroundColor Cyan
Write-Host "📦 Python: $(python --version)" -ForegroundColor Yellow
Write-Host "📍 Port: 8000" -ForegroundColor Yellow
Write-Host ""

# Verify venv
if (!(Test-Path ".\.venv")) {
    Write-Host "❌ Virtual environment not found." -ForegroundColor Red
    Write-Host "   Create with: python -m venv .venv" -ForegroundColor Yellow
    exit 1
}

# Activate venv
& ".\`.venv\Scripts\Activate.ps1"

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
pip install -q -r requirements.txt

# Check Ollama
Write-Host "🔍 Checking Ollama..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -Method Get -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✅ Ollama is running" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Ollama not responding." -ForegroundColor Yellow
    Write-Host "   Start with: ollama serve" -ForegroundColor Yellow
    Write-Host "   Models needed: phi4-mini, nomic-embed-text" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎯 Starting FastAPI server..." -ForegroundColor Cyan
Write-Host "📍 http://127.0.0.1:8000" -ForegroundColor Yellow
Write-Host "📖 Docs: http://127.0.0.1:8000/docs" -ForegroundColor Yellow
Write-Host ""

python ai_app_lean.py
