"""
Lean AI FastAPI Server
Port 8000 (separate from Flask on 5000)
Minimal dependencies, maximum intelligence.
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from starlette.status import HTTP_404_NOT_FOUND, HTTP_500_INTERNAL_SERVER_ERROR
import logging
import sys
import traceback
from contextlib import asynccontextmanager

# Import routes
from routes.ollama_ai_lean import router as ai_router
from routes.premium_ai_routes import router as premium_router
from routes.conversational_ai_routes import router as chat_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# LIFESPAN MANAGEMENT
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown events."""
    logger.info("🚀 Starting Lean AI Server (Port 8000)")
    logger.info("✅ Ollama integration ready")
    logger.info("✅ ChromaDB ready")
    logger.info("✅ ML analytics ready")
    yield
    logger.info("🛑 Shutting down AI Server")


# ============================================================================
# APP CREATION
# ============================================================================

app = FastAPI(
    title="Community Guard - Lean AI Service",
    description="Ollama + ChromaDB + Scikit-learn (NO LangChain bloat)",
    version="1.0.0",
    lifespan=lifespan
)

# ============================================================================
# MIDDLEWARE
# ============================================================================

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# EXCEPTION HANDLERS (register BEFORE routes)
# ============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions (404, 500, etc)"""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "status_code": exc.status_code}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all other exceptions"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal server error",
            "detail": str(exc),
            "status_code": HTTP_500_INTERNAL_SERVER_ERROR
        }
    )

# ============================================================================
# ROUTES
# ============================================================================

# Community Helper (Free) - Standard AI
app.include_router(ai_router)

# Community Patrol (Premium) - Full AI with Flask data access
app.include_router(premium_router)

# Conversational AI - Natural conversation with system knowledge & analytics
app.include_router(chat_router)

# ============================================================================
# ROOT ENDPOINT
# ============================================================================

@app.get("/")
async def root():
    """API info."""
    return {
        "service": "Community Guard - Lean AI",
        "version": "1.0.0",
        "port": 8000,
        "features": [
            "LLM incident categorization (Ollama)",
            "Emergency guidance retrieval (ChromaDB RAG)",
            "ML trend analysis (pandas + scikit-learn)",
            "Risk scoring & hotspot prediction",
            "PH emergency contacts",
            "Natural language insights"
        ],
        "docs": "/docs",
        "health": "/api/ai/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="info",
        access_log=True
    )
