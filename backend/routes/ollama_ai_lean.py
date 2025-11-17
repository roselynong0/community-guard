"""
FastAPI Routes: 11 Endpoints for Lean AI
Port 8000 (separate from Flask chatbot on 5000)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

from ai_core_lean import get_ai_core

router = APIRouter(prefix="/api/ai", tags=["AI"])
logger = logging.getLogger(__name__)


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class IncidentRequest(BaseModel):
    text: str
    location: Optional[str] = ""


class AnalyticsRequest(BaseModel):
    incidents: List[Dict[str, Any]]
    days: Optional[int] = 7


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/health")
async def health_check():
    """Health check: all AI components."""
    ai = get_ai_core()
    health = ai.health_check()
    return {
        "status": "healthy" if health.get("ollama") else "ollama_offline",
        "components": health,
        "timestamp": datetime.now().isoformat()
    }


@router.get("/status")
async def get_status():
    """Detailed AI system status."""
    ai = get_ai_core()
    health = ai.health_check()
    return {
        "ollama_connected": health.get("ollama", False),
        "chromadb_ready": health.get("chromadb", False),
        "embedder_loaded": health.get("embedder", False),
        "model": "phi4-mini (Ollama)",
        "embeddings": "all-MiniLM-L6-v2",
        "rag_system": "ChromaDB + sentence-transformers",
        "features": [
            "LLM incident categorization",
            "Emergency guidance retrieval",
            "ML trend analysis",
            "Risk scoring",
            "Hotspot prediction",
            "Natural language insights"
        ]
    }


@router.post("/process")
async def process_incident(request: IncidentRequest):
    """
    Full incident processing.
    Input: incident text + location
    Output: category, priority, guidance, contacts
    """
    if not request.text or len(request.text) < 5:
        raise HTTPException(status_code=400, detail="Incident text too short")
    
    try:
        ai = get_ai_core()
        result = ai.process_incident(request.text, request.location)
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        logger.error(f"Process incident failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/categorize")
async def categorize_incident(request: IncidentRequest):
    """
    LLM categorization only.
    Returns: category, priority, confidence, summary
    """
    try:
        ai = get_ai_core()
        result = ai.categorizer.categorize(request.text, request.location)
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/guidance/{category}")
async def get_guidance(category: str):
    """
    Get emergency guidance for category.
    Categories: crime, fire, medical, natural_disaster, traffic
    """
    valid_categories = ["crime", "fire", "medical", "natural_disaster", "traffic"]
    if category.lower() not in valid_categories:
        raise HTTPException(status_code=400, detail=f"Invalid category. Valid: {valid_categories}")
    
    try:
        ai = get_ai_core()
        guidance_text = ai.kb.EMERGENCY_CONTACTS["GUIDANCE"].get(
            category.lower(),
            "Stay safe, call emergency services"
        )
        return {
            "category": category,
            "guidance": guidance_text,
            "contacts": ai.kb.EMERGENCY_CONTACTS["PH_HOTLINES"],
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/contacts")
async def get_emergency_contacts():
    """Get all PH emergency contacts."""
    try:
        ai = get_ai_core()
        return {
            "hotlines": ai.kb.EMERGENCY_CONTACTS["PH_HOTLINES"],
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trends")
async def analyze_trends(request: AnalyticsRequest):
    """
    Trend analysis: incident counts by category, daily breakdown.
    Input: list of incidents, days window
    Output: trends, category breakdown, daily averages
    """
    if not request.incidents:
        raise HTTPException(status_code=400, detail="No incidents provided")
    
    try:
        ai = get_ai_core()
        trends = ai.analytics.analyze_trends(request.incidents, request.days)
        return {
            "success": True,
            "trends": trends,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Trends analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/risk-assessment")
async def assess_risk(request: AnalyticsRequest):
    """
    ML risk assessment: risk scores, anomaly detection.
    Input: list of incidents
    Output: avg risk, critical count, anomalies, recommendation
    """
    if not request.incidents:
        raise HTTPException(status_code=400, detail="No incidents provided")
    
    try:
        ai = get_ai_core()
        risk = ai.analytics.predict_risk_level(request.incidents)
        return {
            "success": True,
            "risk_assessment": risk,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Risk assessment failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/hotspots")
async def identify_hotspots(request: AnalyticsRequest):
    """
    Hotspot prediction by location.
    Input: list of incidents with location field
    Output: riskiest locations, incident counts
    """
    if not request.incidents:
        raise HTTPException(status_code=400, detail="No incidents provided")
    
    try:
        ai = get_ai_core()
        hotspots = ai.analytics.identify_hotspots(request.incidents)
        return {
            "success": True,
            "hotspots": hotspots,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Hotspot analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/full-analytics")
async def full_analytics(request: AnalyticsRequest):
    """
    Complete analytics: trends + risk + hotspots.
    """
    if not request.incidents:
        raise HTTPException(status_code=400, detail="No incidents provided")
    
    try:
        ai = get_ai_core()
        analytics = ai.get_analytics(request.incidents, request.days)
        return {
            "success": True,
            "analytics": analytics,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Full analytics failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat")
async def chat_with_ai(request: IncidentRequest):
    """
    AI chat: process incident + provide guidance.
    Real-world usage: user describes incident → get instant advice.
    """
    try:
        ai = get_ai_core()
        result = ai.process_incident(request.text, request.location)
        
        # Format as conversational response
        response_text = f"""
**{result['category'].upper()}** (Priority: {result['priority']})

📍 Location: {result['location'] or 'Not specified'}

**What to do:**
{result['guidance']}

**Emergency Contacts:**
"""
        for name, number in result['contacts'].items():
            response_text += f"\n• {name}: {number}"
        
        return {
            "success": True,
            "message": response_text,
            "metadata": {
                "category": result['category'],
                "priority": result['priority'],
                "confidence": result['confidence'],
                "timestamp": result['timestamp']
            }
        }
    except Exception as e:
        logger.error(f"Chat failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models")
async def get_available_models():
    """List available AI models."""
    return {
        "llm": {
            "primary": "phi4-mini (Ollama)",
            "description": "Lightweight LLM for categorization & insights",
            "size": "2.3GB",
            "parameters": "3.8B"
        },
        "embeddings": {
            "primary": "all-MiniLM-L6-v2 (sentence-transformers)",
            "description": "Fast embeddings for RAG retrieval",
            "size": "22MB",
            "dimensions": 384
        },
        "vector_store": "ChromaDB (persistent)",
        "ml_engine": "scikit-learn (clustering, anomaly detection)",
        "timestamp": datetime.now().isoformat()
    }
