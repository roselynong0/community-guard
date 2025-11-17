# 🚀 Ollama Integration - Quick Start (5 Minutes)

## Prerequisites Check

You already have:
- ✅ Python 3.11.6
- ✅ Community Guard backend code
- ✅ 8GB+ RAM
- ✅ 6GB+ VRAM (for phi4:mini-q4_0)

## Step 1: Install Ollama (3 minutes)

### Windows
1. Visit https://ollama.ai
2. Download and run the installer
3. Click through installation
4. Ollama will start automatically

### macOS
```bash
brew install ollama
```

### Linux
```bash
curl https://ollama.ai/install.sh | sh
```

## Step 2: Start Ollama Server (1 minute)

**Windows**: Ollama already running in background (check system tray)

**macOS/Linux**:
```bash
ollama serve
```

You should see:
```
Listening on 127.0.0.1:11434
```

## Step 3: Pull Models (5-10 minutes)

Open a **new** terminal (keep Ollama running) and run:

```bash
# Main LLM (~5GB, takes 5-10 min)
ollama pull phi4:mini-q4_0

# Embedding model (~600MB, takes 1-2 min)
ollama pull bge-m3

# Optional: Advanced reasoning
ollama pull deepseek-r1:1.5b-q4
```

**Verify**: Run this in terminal:
```bash
ollama list
```

You should see:
```
NAME                    ID              SIZE
phi4:mini-q4_0         ...             5.6 GB
bge-m3                 ...             685 MB
```

## Step 4: Install Python Dependencies (2 minutes)

In your `backend` directory:

```bash
cd backend
pip install -r requirements.txt
```

Or just the new ones:
```bash
pip install langchain==0.1.0 langchain-community==0.0.10 langchain-ollama==0.1.0 chromadb==0.4.22 pandas==2.1.3 matplotlib==3.8.2 requests==2.31.0
```

## Step 5: Verify Installation (1 minute)

```bash
cd backend
python verify_ollama.py
```

Expected output:
```
✅ Python version OK
✅ All dependencies installed
✅ Ollama server connected
✅ Required models installed
✅ All services initialized
🎉 ALL CHECKS PASSED!
```

## Step 6: Start Backend (1 minute)

```bash
# Make sure Ollama is still running!
python run.py
```

Expected output:
```
✓ Ollama Service initialized
✓ Ollama server connected successfully
✓ ChromaDB initialized
✓ LangChain LLM initialized
✅ Registered: chatbot_ollama_bp at /api/chat (Ollama-enhanced)
Running on http://0.0.0.0:5000
```

## Step 7: Test (1 minute)

Open a **third** terminal:

```bash
# Test basic connectivity
curl http://localhost:5000/api/chat/health

# Test chat endpoint (replace TOKEN with your actual token)
curl -X POST http://localhost:5000/api/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I report an incident?"}'
```

Expected response:
```json
{
  "status": "success",
  "response": "To report an incident in Community Guard...",
  "type": "information",
  "sources": []
}
```

## ✅ Done! You now have:

- ✅ Local LLM (phi4:mini-q4_0)
- ✅ Semantic search with embeddings (bge-m3)
- ✅ Vector database (ChromaDB)
- ✅ Advanced analytics (scikit-learn + pandas)
- ✅ 8 new API endpoints for AI features
- ✅ Emergency guidance system
- ✅ Anomaly detection

## 🎯 Try These Features

### 1. Chat with Emergency Detection
```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "There is a fire in my building!"}'
```

### 2. Categorize an Incident
```bash
curl -X POST http://localhost:5000/api/categorize \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": "Someone stole my bicycle from the parking lot"}'
```

### 3. Get Emergency Guidance
```bash
curl -X POST http://localhost:5000/api/emergency-guidance \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"incident_type": "earthquake"}'
```

### 4. Check System Health
```bash
curl http://localhost:5000/api/chat/health
```

## ⚙️ Troubleshooting Quick Fixes

| Problem | Solution |
|---------|----------|
| "Cannot connect to Ollama" | Make sure `ollama serve` is running |
| "Model not found" | Run `ollama pull phi4:mini-q4_0` and `ollama pull bge-m3` |
| "Out of memory" | Close other apps, reduce other VRAM usage |
| "Import error" | Run `pip install -r requirements.txt` |
| "Slow responses" | Normal! First request takes 3-5s (model loading). Subsequent: 1-3s |

## 📚 Full Documentation

For detailed setup, configuration, and API reference, see:
- **OLLAMA_SETUP.md** - Complete setup guide
- **OLLAMA_IMPLEMENTATION.md** - Technical details
- **verify_ollama.py** - Automated verification

## 🎉 Next: Test in Frontend

Update your ChatBot.jsx to use new endpoints (no changes needed - it already does!)

The chatbot will automatically use:
- `/api/chat` - For AI responses with RAG context
- `/api/categorize` - For incident classification
- `/api/emergency-guidance` - For safety guidance

## 🔄 System Architecture

```
                    Your Device
    ┌────────────────────────────────────┐
    │                                    │
    │  ┌──────────────┐                  │
    │  │  Ollama      │ (models)         │
    │  │  localhost   │                  │
    │  │  :11434      │                  │
    │  └────────┬─────┘                  │
    │           │                        │
    │  ┌────────▼─────────────────────┐  │
    │  │  Flask Backend (port 5000)   │  │
    │  ├────────────────────────────┤  │
    │  │ - ollama_service.py        │  │
    │  │ - rag_service.py           │  │
    │  │ - langchain_service.py     │  │
    │  │ - analytics_service.py     │  │
    │  └────────┬────────────────────┘  │
    │           │                        │
    │  ┌────────▼─────────────────────┐  │
    │  │ ChromaDB (Vector Store)      │  │
    │  │ chroma_db/                   │  │
    │  └──────────────────────────────┘  │
    │                                    │
    └────────────────────────────────────┘
```

---

**Time to Full Setup**: ~15-20 minutes
**Status**: Ready to Deploy 🚀
