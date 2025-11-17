#!/bin/bash
# Start Lean AI Server on Linux/macOS
# Requires: Python 3.11+, Ollama running on localhost:11434

set -e

echo "🚀 Starting Community Guard Lean AI Server"
echo "📦 Python: $(python --version)"
echo "📍 Port: 8000"
echo ""

# Verify venv
if [ ! -d ".venv" ]; then
    echo "❌ Virtual environment not found. Create with: python -m venv .venv"
    exit 1
fi

source .venv/bin/activate

# Install dependencies
echo "📦 Installing dependencies..."
pip install -q -r requirements.txt

# Check Ollama
echo "🔍 Checking Ollama..."
if curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "✅ Ollama is running"
else
    echo "⚠️  Ollama not responding. Start with: ollama serve"
    echo "   Models needed: phi4-mini, nomic-embed-text"
fi

echo ""
echo "🎯 Starting FastAPI server..."
echo "📍 http://127.0.0.1:8000"
echo "📖 Docs: http://127.0.0.1:8000/docs"
echo ""

python ai_app_lean.py
