"""
Premium AI Routes: Community Patrol
Full access to analytics, risk prediction, system insights
Port 8000 (alongside Community Helper on 5000)
"""

from fastapi import APIRouter, HTTPException
from starlette.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

from premium_ai_core import get_premium_ai_core

router = APIRouter(prefix="/api/ai/premium", tags=["Premium AI"])
logger = logging.getLogger(__name__)


# ============================================================================
# REQUEST MODELS
# ============================================================================

class IncidentRequest(BaseModel):
    text: str
    location: Optional[str] = ""
    user_id: Optional[str] = ""


class AnalyticsRequest(BaseModel):
    days: Optional[int] = 7


class SeverityFilterRequest(BaseModel):
    role: str  # responder, admin, barangay_captain
    min_severity: Optional[str] = "medium"
    barangay: Optional[str] = ""


# ============================================================================
# ENDPOINTS: COMMUNITY PATROL (Premium)
# ============================================================================

@router.get("/health")
async def premium_health():
    """Premium AI health check."""
    return {
        "service": "Community Patrol (Premium)",
        "status": "active",
        "features": [
            "Full incident analysis",
            "Risk prediction",
            "Trend analysis",
            "User analytics",
            "System insights",
            "Severity-based filtering",
            "Real-time hotspot detection"
        ],
        "timestamp": datetime.now().isoformat()
    }


@router.post("/process")
async def process_incident_premium(request: IncidentRequest):
    """
    Full incident processing with contextual intelligence.
    - Categorization
    - Risk assessment (with historical data)
    - Hotspot detection
    - Emergency guidance
    - System insights
    """
    if not request.text or len(request.text) < 5:
        raise HTTPException(status_code=400, detail="Incident text too short")
    
    try:
        premium_ai = get_premium_ai_core()
        result = premium_ai.process_incident_premium(request.text, request.location, request.user_id)
        
        if result.get("success"):
            return JSONResponse(status_code=200, content=result)
        else:
            logger.error(f"Premium processing failed: {result.get('error')}")
            return JSONResponse(
                status_code=200,
                content={
                    "success": False,
                    "error": result.get("error", "Processing failed"),
                    "timestamp": datetime.now().isoformat()
                }
            )
    except Exception as e:
        logger.error(f"Premium endpoint error: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
        )


@router.get("/risk-trends")
async def get_risk_trends(days: int = 7):
    """
    Predict risk trends and identify patterns.
    - Category trends
    - Hotspot analysis
    - Risk scoring
    - LLM-generated insights
    """
    try:
        premium_ai = get_premium_ai_core()
        result = premium_ai.predict_risk_trends(days)
        
        if result.get("success"):
            return result
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "Trend analysis failed"))
    except Exception as e:
        logger.error(f"Risk trends failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/system")
async def get_system_analytics():
    """
    Get comprehensive system analytics.
    - User breakdown (verified, by barangay)
    - Report distribution
    - Peak times
    - Category trends
    - Barangay breakdown
    """
    try:
        premium_ai = get_premium_ai_core()
        result = premium_ai.get_system_analytics()
        
        if result.get("success"):
            return result
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "Analytics failed"))
    except Exception as e:
        logger.error(f"System analytics failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reports/severity-filtered")
async def get_severity_filtered(request: SeverityFilterRequest):
    """
    Get reports filtered by severity per role.
    - Responder: Critical/High only
    - Admin: All reports with stats
    - Barangay Captain: Barangay-specific, prioritized
    
    Reports are highlighted by severity on frontend.
    """
    try:
        premium_ai = get_premium_ai_core()
        result = premium_ai.get_severity_filtered_reports(request.role, request.min_severity)
        
        if result.get("success"):
            return result
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "Filtering failed"))
    except Exception as e:
        logger.error(f"Severity filtering failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/user-breakdown")
async def get_user_analytics():
    """
    Get detailed user analytics.
    - Total users
    - Verified vs unverified
    - Email verified
    - Breakdown by barangay
    """
    try:
        premium_ai = get_premium_ai_core()
        result = premium_ai.data_bridge.get_users_stats()
        
        return {
            "success": True,
            "users": result,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"User analytics failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/peak-times")
async def get_peak_times():
    """
    Get system peak times analysis.
    - Peak hour for reports
    - Daily patterns
    - Busiest times
    """
    try:
        premium_ai = get_premium_ai_core()
        analytics = premium_ai.get_system_analytics()
        
        if analytics.get("success"):
            peak_data = analytics.get("reports", {})
            return {
                "success": True,
                "peak_hour": peak_data.get("peak_hour", 0),
                "peak_hour_count": peak_data.get("peak_hour_count", 0),
                "recommendation": f"Peak hour is around {peak_data.get('peak_hour', 12)}:00. Increase readiness.",
                "timestamp": datetime.now().isoformat()
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to analyze peak times")
    except Exception as e:
        logger.error(f"Peak times analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/emergency-guidance/{category}")
async def get_premium_guidance(category: str):
    """
    Get emergency guidance with premium context.
    - Category-specific guidance
    - Recent incidents context
    - PH emergency contacts
    - Severity-based recommendations
    """
    try:
        premium_ai = get_premium_ai_core()
        
        # Get base guidance from core AI
        guidance = premium_ai.ai_core.kb.EMERGENCY_CONTACTS["GUIDANCE"].get(
            category.lower(),
            "Stay safe and call emergency services (911)"
        )
        
        # Get contextual risk
        reports = premium_ai.data_bridge.get_reports()
        
        # Count recent incidents of this category
        relevant_incidents = [r for r in reports if r.get("category", "").lower() == category.lower()]
        recent_incidents = len([r for r in relevant_incidents if 
                               (datetime.fromisoformat(r.get("created_at", datetime.now().isoformat()).replace('Z', '+00:00')) 
                                > (datetime.now() - timedelta(days=7)))])
        
        return {
            "success": True,
            "category": category,
            "guidance": guidance,
            "contacts": premium_ai.ai_core.kb.EMERGENCY_CONTACTS["PH_HOTLINES"],
            "context": {
                "recent_incidents_7d": recent_incidents,
                "status": "HIGH ALERT" if recent_incidents > 5 else "MONITOR" if recent_incidents > 2 else "NORMAL"
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Premium guidance failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/system-status")
async def get_system_status():
    """
    Get overall system status and recommendations.
    - Current threat level
    - Active hotspots
    - User engagement
    - System health
    """
    try:
        premium_ai = get_premium_ai_core()
        
        # Get trends
        trends = premium_ai.predict_risk_trends(days=7)
        
        # Get analytics
        analytics = premium_ai.get_system_analytics()
        
        # Calculate threat level
        if not trends.get("success"):
            threat_level = "UNKNOWN"
        else:
            total_reports = trends.get("total_reports", 0)
            critical_count = len([h for h in trends.get("hotspots", {}).values()])
            
            if total_reports > 50 or critical_count > 3:
                threat_level = "CRITICAL"
            elif total_reports > 20 or critical_count > 1:
                threat_level = "HIGH"
            elif total_reports > 5:
                threat_level = "MEDIUM"
            else:
                threat_level = "LOW"
        
        return {
            "success": True,
            "threat_level": threat_level,
            "total_reports_7d": trends.get("total_reports", 0),
            "daily_average": trends.get("daily_average", 0),
            "active_hotspots": len(trends.get("hotspots", {})),
            "top_incidents": list(trends.get("category_trends", {}).keys())[:3],
            "user_engagement": analytics.get("users", {}).get("total", 0),
            "verified_ratio": f"{(analytics.get('users', {}).get('verified', 0) / max(analytics.get('users', {}).get('total', 1), 1) * 100):.0f}%",
            "llm_insight": trends.get("llm_insights", "System monitoring active"),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"System status failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recommendations")
async def get_ai_recommendations():
    """
    Get AI-generated recommendations for action.
    - High-priority areas
    - Suggested patrol routes
    - Resource allocation
    - Community alerts
    """
    try:
        premium_ai = get_premium_ai_core()
        
        # Get risk trends
        trends = premium_ai.predict_risk_trends(days=7)
        
        if not trends.get("success"):
            return {
                "success": False,
                "error": "Unable to generate recommendations"
            }
        
        # Extract actionable insights
        recommendations = []
        
        # Top hotspots
        hotspots = trends.get("hotspots", {})
        if hotspots:
            top_spot = list(hotspots.keys())[0]
            top_spot_data = hotspots[top_spot]
            recommendations.append({
                "priority": "URGENT",
                "action": "Increase patrols",
                "location": top_spot,
                "reason": f"Hotspot: {top_spot_data.get('count', 0)} incidents detected",
                "risk_level": top_spot_data.get("avg_risk", 0)
            })
        
        # Rising categories
        category_risk = trends.get("category_risk", {})
        for cat, data in category_risk.items():
            if data.get("trend") == "rising":
                recommendations.append({
                    "priority": "HIGH",
                    "action": "Monitor category",
                    "category": cat,
                    "reason": f"Rising trend: {data.get('count', 0)} incidents",
                    "risk_level": data.get("avg_risk", 0)
                })
        
        # Sort by priority and risk
        recommendations.sort(key=lambda x: (x["priority"] == "URGENT", x.get("risk_level", 0)), reverse=True)
        
        return {
            "success": True,
            "recommendations": recommendations[:5],  # Top 5
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Recommendations failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Import timedelta for premium_guidance
from datetime import timedelta
