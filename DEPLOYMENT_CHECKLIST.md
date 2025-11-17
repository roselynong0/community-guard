# Deployment Checklist

## Pre-Deployment Verification

### System Requirements
- [ ] Python 3.11.6 installed (`python --version`)
- [ ] 8GB+ RAM available
- [ ] 6GB+ VRAM (for phi4:mini-q4_0)
- [ ] 20GB disk space free

### Ollama Installation
- [ ] Ollama installed from https://ollama.ai
- [ ] `ollama serve` can be started without errors
- [ ] `ollama pull phi4:mini-q4_0` completed successfully
- [ ] `ollama pull bge-m3` completed successfully
- [ ] `ollama list` shows both models installed

### Python Setup
- [ ] `pip install -r requirements.txt` completed
- [ ] All dependencies installed without errors
- [ ] Virtual environment activated (if using one)

### Verification
- [ ] `python verify_ollama.py` shows all ✅ checks
- [ ] Health check passes: `GET /api/chat/health`
- [ ] Can reach Ollama: `curl http://localhost:11434/api/tags`

---

## Local Development Testing

### Service Initialization
- [ ] Ollama service initializes without errors
- [ ] RAG service initializes ChromaDB
- [ ] LangChain service loads LLM
- [ ] Analytics service loads successfully

### API Endpoints Testing
- [ ] `POST /api/chat` - Chat endpoint works
- [ ] `POST /api/categorize` - Categorization works
- [ ] `POST /api/summarize` - Summarization works
- [ ] `POST /api/emergency-guidance` - Guidance works
- [ ] `POST /api/analytics` - Analytics works
- [ ] `GET /api/chat/health` - Health check works
- [ ] `GET /api/suggestions` - Suggestions load

### Feature Testing
- [ ] Emergency detection triggers on fire/flood/earthquake keywords
- [ ] Incident categorization returns confidence scores
- [ ] RAG retrieval returns relevant documents
- [ ] Analytics generates charts (base64 images)
- [ ] Anomaly detection identifies unusual incidents

### Error Handling
- [ ] Invalid token returns 401
- [ ] Missing fields return 400
- [ ] Ollama disconnection handled gracefully
- [ ] Timeout handled with error message
- [ ] Empty response handled correctly

---

## Database Setup

### ChromaDB
- [ ] `backend/chroma_db/` directory exists
- [ ] Collections created:
  - [ ] `emergency_guidance` (12+ documents)
  - [ ] `general_knowledge` (4+ documents)
  - [ ] `incident_data` (ready for user data)
- [ ] `POST /api/initialize-rag` succeeds (admin only)

### Data Persistence
- [ ] ChromaDB persists across app restarts
- [ ] Embeddings cached and reused
- [ ] No data loss on service restart

---

## Frontend Integration

### ChatBot Component
- [ ] ChatBot.jsx uses `/api/chat` endpoint
- [ ] Bearer token passed correctly
- [ ] Emergency responses display properly
- [ ] Source documents shown when available
- [ ] Error states handled gracefully

### UI/UX Testing
- [ ] Chat messages display correctly
- [ ] Loading state shown while waiting for response
- [ ] Emergency guidance highlighted (if applicable)
- [ ] Sources/references displayed
- [ ] Mobile responsive design maintained

---

## Production Deployment (Render)

### Environment Setup
- [ ] All environment variables configured in Render dashboard:
  - [ ] `OLLAMA_BASE_URL`
  - [ ] `LLM_MODEL`
  - [ ] `EMBED_MODEL`
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_KEY`
  - [ ] All other existing variables

### Deployment Options
Choose one:

#### Option A: Local Ollama (Recommended for testing)
- [ ] Ollama installed on deployment machine
- [ ] `ollama serve` running before Flask app
- [ ] Models pre-pulled (`phi4:mini-q4_0`, `bge-m3`)
- [ ] Flask app starts after Ollama
- [ ] Health check succeeds: `GET /api/chat/health`

#### Option B: Ollama in Docker Container
- [ ] Dockerfile configured for Ollama
- [ ] Docker Compose setup for Flask + Ollama
- [ ] Port mapping correct (11434 for Ollama, 5000 for Flask)
- [ ] Volume persistence for ChromaDB

#### Option C: Remote Ollama Server
- [ ] Ollama running on separate server
- [ ] `OLLAMA_BASE_URL` points to remote server
- [ ] Network connectivity verified
- [ ] Firewall allows access to port 11434

### Database Persistence
- [ ] ChromaDB directory persisted:
  - [ ] `/backend/chroma_db/` in Render storage
  - [ ] Or custom path via `CHROMA_DB_PATH`
- [ ] RAG collections preserved across deployments

---

## Performance Validation

### Response Times (Acceptable Ranges)
- [ ] First chat response: 3-5 seconds ✓
- [ ] Subsequent responses: 1-3 seconds ✓
- [ ] Categorization: 2-4 seconds ✓
- [ ] Embedding creation: 50-200ms ✓
- [ ] Analytics query: 500ms-1s ✓

### Resource Usage
- [ ] Ollama VRAM: ~6GB for phi4
- [ ] Flask app memory: ~200-300MB
- [ ] ChromaDB size: <500MB (for 1000s of docs)
- [ ] CPU usage: Moderate under load

### Concurrency Testing
- [ ] Can handle 5+ concurrent requests
- [ ] No timeouts under normal load
- [ ] Graceful degradation under heavy load
- [ ] Memory doesn't leak after extended use

---

## Security Checklist

### Authentication
- [ ] Bearer token required for all AI endpoints
- [ ] Invalid tokens return 401 Unauthorized
- [ ] Token validation on every request
- [ ] User info passed through `token_required` decorator

### Authorization
- [ ] Only admins can access `/api/initialize-rag`
- [ ] User role checking implemented
- [ ] No data leakage across users

### Data Protection
- [ ] Ollama runs locally (no external API calls)
- [ ] All data stays on server
- [ ] HTTPS in production (Render SSL)
- [ ] CORS properly configured

### Input Validation
- [ ] Message content validated
- [ ] Description length checked (min 5 chars)
- [ ] Special characters handled
- [ ] SQL injection prevention in place

---

## Monitoring & Logging

### Logs Setup
- [ ] Flask logging configured
- [ ] Service logs visible in Render dashboard
- [ ] Error logs captured and accessible
- [ ] Request/response logging enabled

### Metrics to Monitor
- [ ] Response times trending
- [ ] Error rates
- [ ] Ollama model loading times
- [ ] RAG search performance
- [ ] Analytics computation time
- [ ] User engagement patterns

### Alerts Setup (Optional)
- [ ] High error rate alert (>5%)
- [ ] Slow response alert (>10s)
- [ ] Service unavailable alert
- [ ] Disk space alert

---

## Rollback Plan

### If Deployment Fails
1. [ ] Keep previous version running
2. [ ] Identify error in logs
3. [ ] Fix issue locally
4. [ ] Re-deploy to staging first
5. [ ] Verify all checks pass
6. [ ] Deploy to production

### Data Recovery
- [ ] ChromaDB backups taken before deployment
- [ ] Can restore if database corrupted
- [ ] Version control setup for code rollback

---

## Post-Deployment Verification

### Day 1 Checks
- [ ] Health check endpoint responding: `GET /api/chat/health`
- [ ] Sample chat query succeeds
- [ ] Categorization works with test data
- [ ] Emergency guidance retrieves correctly
- [ ] Analytics endpoint operational
- [ ] No errors in logs

### Week 1 Monitoring
- [ ] Response times stable
- [ ] No memory leaks
- [ ] Error rates acceptable (<1%)
- [ ] User feedback collected
- [ ] Performance metrics analyzed

### Ongoing (Monthly)
- [ ] Review logs for errors
- [ ] Check storage usage
- [ ] Verify backup integrity
- [ ] Update knowledge base as needed
- [ ] Monitor emerging trends in incident data

---

## Documentation Checklist

### Internal Documentation
- [ ] QUICK_START.md accessible to team
- [ ] OLLAMA_SETUP.md included in deployment
- [ ] OLLAMA_IMPLEMENTATION.md archived
- [ ] API documentation up-to-date
- [ ] Configuration documented

### User Documentation
- [ ] API endpoint docs provided
- [ ] Example requests documented
- [ ] Error messages clear and helpful
- [ ] Emergency guidance content reviewed

---

## Final Go/No-Go Decision

### Go Criteria Met?
- [ ] All checks passed ✓
- [ ] Performance acceptable ✓
- [ ] Security verified ✓
- [ ] Rollback plan ready ✓
- [ ] Team trained ✓
- [ ] Documentation complete ✓

### Deployment Status
- [ ] Ready for Production Deployment: **[ ] YES  [ ] NO**
- [ ] Approved By: _________________
- [ ] Date: _________________
- [ ] Version: _________________

---

## Contact & Support

For issues:
1. Check QUICK_START.md for common solutions
2. Review logs: `Render Dashboard → Logs`
3. Verify health check: `/api/chat/health`
4. Run local verification: `python verify_ollama.py`
5. Reach out to development team

---

**Last Updated**: November 17, 2025
**Status**: Ready for Review
