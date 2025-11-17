# Ollama Integration Setup Guide

## Overview

Community Guard now features a fully integrated local AI system using:
- **Ollama**: Local LLM engine (phi4:mini-q4_0)
- **LangChain**: AI chains for categorization, summarization, and Q&A
- **ChromaDB**: Vector database for semantic search and retrieval
- **scikit-learn + pandas**: Advanced analytics and anomaly detection

## Prerequisites

### System Requirements
- **RAM**: 8GB minimum (12GB+ recommended)
- **VRAM**: 6GB+ for phi4:mini-q4_0 model
- **Disk**: 20GB free space (for models and ChromaDB)
- **OS**: Windows, macOS, or Linux

### Python Environment
```powershell
# Python 3.11.6 (already set in runtime.txt)
python --version
# Should output: Python 3.11.6
```

## Installation Steps

### 1. Install Ollama

Download from: https://ollama.ai

**Windows**: Download installer and run
**macOS**: `brew install ollama`
**Linux**: `curl https://ollama.ai/install.sh | sh`

### 2. Start Ollama Server

Open a terminal and run:
```bash
ollama serve
```

You should see:
```
Listening on 127.0.0.1:11434
```

### 3. Pull Required Models

In a **new terminal** (keep Ollama running), execute:

```bash
# Main LLM (~5-6GB) - takes 5-10 minutes
ollama pull phi4:mini-q4_0

# Embedding model (~600MB) - takes 2-3 minutes
ollama pull bge-m3

# Optional: Deepseek reasoning model
ollama pull deepseek-r1:1.5b-q4
```

### 4. Verify Model Installation

```bash
# List all installed models
curl http://localhost:11434/api/tags

# Test LLM
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"phi4:mini-q4_0","prompt":"Hello, who are you?"}'

# Test embeddings
curl -X POST http://localhost:11434/api/embed \
  -H "Content-Type: application/json" \
  -d '{"model":"bge-m3","input":"Community Guard incident reporting system"}'
```

### 5. Update Backend Dependencies

```bash
cd backend

# Install new AI dependencies
pip install -r requirements.txt

# Or install individually:
pip install langchain==0.1.0
pip install langchain-community==0.0.10
pip install langchain-ollama==0.1.0
pip install chromadb==0.4.22
pip install pandas==2.1.3
pip install matplotlib==3.8.2
```

### 6. Configure Environment

Copy `.env.ollama` to `.env` and update with your Ollama URL:

```bash
# Backend directory
cd backend

# Copy configuration (Windows)
copy .env.ollama .env

# Or create .env manually with:
OLLAMA_BASE_URL=http://localhost:11434
LLM_MODEL=phi4:mini-q4_0
EMBED_MODEL=bge-m3
```

### 7. Start Backend Application

```bash
cd backend

# With Ollama running in another terminal
python run.py
```

You should see:
```
✓ Ollama Service initialized with LLM: phi4:mini-q4_0, Embed: bge-m3
✓ Ollama server connected successfully
✓ ChromaDB initialized with persistence at backend/chroma_db
✓ LangChain LLM initialized with phi4:mini-q4_0
✅ Registered: chatbot_ollama_bp at /api/chat (Ollama-enhanced)
```

## API Endpoints

### Chat with AI (Enhanced)
```
POST /api/chat
Authorization: Bearer {token}
Content-Type: application/json

{
  "message": "How do I report theft?"
}

Response:
{
  "status": "success",
  "response": "To report theft...",
  "type": "information",
  "sources": [...],
  "timestamp": "2025-11-17T..."
}
```

### Categorize Incident
```
POST /api/categorize
Authorization: Bearer {token}
Content-Type: application/json

{
  "description": "Someone stole my bicycle from the parking area"
}

Response:
{
  "status": "success",
  "category": "Theft/Robbery",
  "confidence": 0.92,
  "reasoning": "Clear theft incident with specific item",
  "priority": "high",
  "guidance": "..."
}
```

### Summarize Report
```
POST /api/summarize
Authorization: Bearer {token}
Content-Type: application/json

{
  "description": "Long incident description..."
}

Response:
{
  "status": "success",
  "summary": "Concise 1-2 sentence summary",
  "original_length": 500,
  "summary_length": 50
}
```

### Get Emergency Guidance
```
POST /api/emergency-guidance
Authorization: Bearer {token}
Content-Type: application/json

{
  "incident_type": "fire",
  "context": "building fire"
}

Response:
{
  "status": "success",
  "guidance": "IMMEDIATE ACTIONS:\n1. Evacuate...",
  "incident_type": "fire",
  "priority": "critical"
}
```

### Analytics (Advanced)
```
POST /api/analytics
Authorization: Bearer {token}
Content-Type: application/json

{
  "reports": [...],
  "include_charts": true
}

Response:
{
  "status": "success",
  "total_reports": 145,
  "category_distribution": {...},
  "priority_breakdown": {...},
  "top_hotspots": [...],
  "anomalies": [...],
  "charts": {
    "category_chart": "data:image/png;base64,...",
    "timeline_chart": "data:image/png;base64,..."
  }
}
```

### Detect Hotspots
```
POST /api/analytics/hotspots
Authorization: Bearer {token}
Content-Type: application/json

{
  "reports": [...],
  "top_n": 5
}

Response:
{
  "status": "success",
  "hotspots": [
    {"location": "Olongapo City", "count": 34},
    ...
  ]
}
```

### Detect Anomalies
```
POST /api/analytics/anomalies
Authorization: Bearer {token}
Content-Type: application/json

{
  "reports": [...]
}

Response:
{
  "status": "success",
  "anomalies": [
    {
      "report": {...},
      "anomaly_score": 3.45
    },
    ...
  ]
}
```

### Health Check
```
GET /api/chat/health

Response:
{
  "status": "healthy",
  "ollama": {
    "llm": true,
    "embed": true,
    "available_models": ["phi4:mini-q4_0", "bge-m3"]
  },
  "rag": {
    "emergency_guidance": 12,
    "general_knowledge": 4,
    "incident_data": 0
  },
  "langchain": {
    "llm_ready": true,
    "memory_size": 450
  }
}
```

### Initialize RAG (Admin Only)
```
POST /api/initialize-rag
Authorization: Bearer {admin_token}

Response:
{
  "status": "success",
  "message": "RAG collections initialized",
  "stats": {
    "emergency_guidance": 12,
    "general_knowledge": 4,
    "incident_data": 0
  }
}
```

## Testing

### 1. Test Ollama Connection
```bash
curl http://localhost:11434/api/tags
```

### 2. Test Flask Backend
```bash
# Start in separate terminal
python run.py
```

### 3. Test Chat Endpoint
```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I report an incident?"}'
```

### 4. Test Categorization
```bash
curl -X POST http://localhost:5000/api/categorize \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": "Someone threw rocks at my window during the night"}'
```

### 5. Initialize Emergency Guidance
```bash
curl -X POST http://localhost:5000/api/initialize-rag \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

## Architecture

### Service Layer

```
┌─────────────────────────────────────────┐
│  Flask Routes (chatbot_ollama.py)       │
└────────────┬────────────────────────────┘
             │
      ┌──────┴────────┬──────────┬──────────┐
      │               │          │          │
┌─────▼────┐    ┌────▼───┐ ┌──▼───┐   ┌──▼──────┐
│ Ollama    │    │ RAG    │ │Lang  │   │Analytics│
│ Service   │    │Service │ │Chain │   │Service  │
└─────┬────┘    └────┬───┘ └──┬───┘   └──┬──────┘
      │              │        │           │
      └──────────┬───┴────┬───┴───────┬──┘
                 │        │           │
            ┌────▼─┐ ┌───▼──┐  ┌────▼──┐
            │Ollama│ │Chroma│  │Scikit │
            │ API  │ │  DB  │  │ Learn │
            └──────┘ └──────┘  └───────┘
```

### Data Flow

```
User Query
    ↓
Flask Route
    ↓
LangChain (Question → Chains)
    ↓
RAG Search (ChromaDB)
    ↓
Ollama LLM (Generate Response)
    ↓
Response + Sources
```

## Troubleshooting

### Issue: "Cannot connect to Ollama"
**Solution**: 
- Ensure Ollama is running: `ollama serve`
- Check URL: http://localhost:11434
- Run: `curl http://localhost:11434/api/tags`

### Issue: "Model not found"
**Solution**:
- Pull models again: `ollama pull phi4:mini-q4_0`
- Verify: `ollama list`

### Issue: "Out of memory" errors
**Solution**:
- Reduce context length in config (num_ctx parameter)
- Close other applications
- Use a smaller model: phi:q4_0

### Issue: Slow responses
**Solution**:
- Check available VRAM: `nvidia-smi` (NVIDIA)
- First response is slower (model loading)
- Increase timeout: Update `self.timeout` in `ollama_service.py`

### Issue: ChromaDB errors
**Solution**:
- Delete existing ChromaDB: `rm -rf backend/chroma_db`
- Reinitialize: `curl -X POST http://localhost:5000/api/initialize-rag`

## Performance Tips

### Optimize Ollama
```bash
# Increase GPU memory usage
export OLLAMA_GPU=all

# Set specific GPU index
export OLLAMA_GPU=0

# Disable GPU (CPU only, slower)
export OLLAMA_GPU=false
```

### Batch Requests
- Use async endpoints for bulk processing
- Implement request queuing for high volume

### Cache Responses
- RAG results are cached in ChromaDB
- Repeated queries are faster
- Clear cache periodically: Delete `chroma_db` directory

## Integration with Frontend

Update `ChatBot.jsx` to use new endpoints:

```javascript
// Enhanced chat with streaming
const sendMessage = async (message) => {
  const response = await fetch('http://localhost:5000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      message: message,
      search_emergency: message.toLowerCase().includes('emergency')
    })
  });
  
  const data = await response.json();
  return {
    response: data.response,
    type: data.type,
    sources: data.sources
  };
};
```

## Next Steps

1. **Test locally** with sample incidents
2. **Deploy to production** (Render supports Ollama)
3. **Monitor performance** with analytics endpoint
4. **Collect feedback** from users
5. **Fine-tune** models based on usage

## Support

For issues:
- Check Ollama logs: `ollama list`
- Review Flask logs in terminal
- Inspect ChromaDB: Check `backend/chroma_db` directory
- Test endpoints with curl/Postman

---

**Last Updated**: November 17, 2025
**Ollama Version**: Latest
**Python**: 3.11.6
