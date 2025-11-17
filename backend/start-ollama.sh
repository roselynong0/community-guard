#!/bin/bash

# Community Guard - Ollama AI Setup & Launch Script
# Purpose: Quick setup and launch of Ollama AI server (FastAPI port 8000)
# Note: Separate from Flask chatbot (port 5000)

echo "========================================"
echo "Community Guard - Ollama AI Setup"
echo "========================================"
echo ""

# Check Python installation
echo "Checking Python 3.11+..."
python_version=$(python3 --version 2>&1)
echo "Found: $python_version"

# Check virtual environment
echo ""
echo "Checking virtual environment..."
if [ -d "venv" ]; then
    echo "✓ Virtual environment found"
    source venv/bin/activate
else
    echo "⚠ Virtual environment not found - creating..."
    python3 -m venv venv
    source venv/bin/activate
fi

# Navigate to backend
echo ""
echo "Navigating to backend directory..."
cd backend

# Check Ollama
echo ""
echo "Checking Ollama connection..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✓ Ollama is running"
else
    echo "⚠ Ollama might not be running"
    echo "Start Ollama manually: ollama serve"
    echo ""
fi

# Install dependencies
echo ""
echo "Checking/Installing dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Check .env.ollama
echo ""
echo "Checking configuration..."
if [ -f ".env.ollama" ]; then
    echo "✓ .env.ollama exists"
else
    echo "Creating .env.ollama..."
    cat > .env.ollama << 'EOF'
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_LLM_MODEL=phi4:mini-q4_0
OLLAMA_EMBED_MODEL=bge-m3
OLLAMA_FALLBACK_MODEL=deepseek-r1:1.5b-q4
CHROMA_DB_PATH=./chroma_db
ENVIRONMENT=development
EOF
    echo "✓ Created .env.ollama"
fi

# Check ChromaDB directory
if [ ! -d "chroma_db" ]; then
    echo "Creating chroma_db directory..."
    mkdir -p chroma_db
    echo "✓ Created chroma_db"
fi

# Display startup information
echo ""
echo "========================================"
echo "STARTUP INFORMATION"
echo "========================================"
echo ""
echo "🚀 Starting Ollama AI Server..."
echo "   Port: 8000 (FastAPI)"
echo "   Docs: http://localhost:8000/docs"
echo ""
echo "📋 Running servers:"
echo "   - FastAPI Ollama AI (port 8000) - THIS ONE"
echo "   - Flask Chatbot (port 5000) - Run separately"
echo "   - Ollama service (port 11434) - Must be running"
echo ""
echo "✓ Setup complete! Starting server..."
echo ""

# Start the server
python3 ollama_app.py
