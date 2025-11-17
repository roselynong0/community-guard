"""
Conversational AI Routes
Integrates knowledge base, analytics, and natural conversation
Used by both Community Helper and Community Patrol
"""

from fastapi import APIRouter, HTTPException
from starlette.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import logging

from conversational_ai_core import get_conversational_ai

router = APIRouter(prefix="/api/ai/chat", tags=["Conversational AI"])
logger = logging.getLogger(__name__)


class ConversationRequest(BaseModel):
    text: str
    user_role: Optional[str] = "Resident"  # Resident, Responder, Barangay Official, Admin
    user_id: Optional[str] = ""
    include_analytics: Optional[bool] = False
    barangay: Optional[str] = ""


@router.post("/converse")
async def converse(request: ConversationRequest):
    """
    Natural conversation endpoint with system knowledge and analytics
    Works for all user roles with role-based responses
    """
    if not request.text or len(request.text) < 2:
        raise HTTPException(status_code=400, detail="Message too short")
    
    try:
        conv_ai = get_conversational_ai()
        
        # Set user context
        conv_ai.set_user_context(request.user_id, request.user_role, request.barangay)
        
        # Process conversation
        response = conv_ai.process_conversation(
            request.text,
            user_role=request.user_role,
            include_analytics=request.include_analytics
        )
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": response,
                "user_role": request.user_role,
                "timestamp": datetime.now().isoformat()
            }
        )
    
    except Exception as e:
        logger.error(f"Conversation error: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
        )


@router.get("/system-info")
async def get_system_info(user_role: str = "Resident"):
    """
    Get system information and current status
    Role-based content delivery
    """
    try:
        conv_ai = get_conversational_ai()
        
        analytics = conv_ai.get_system_analytics()
        kb = conv_ai.system_knowledge
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "system_name": kb["name"],
                "system_purpose": kb["purpose"],
                "analytics": analytics,
                "user_role": user_role,
                "timestamp": datetime.now().isoformat()
            }
        )
    
    except Exception as e:
        logger.error(f"System info error: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )


@router.get("/insights/{user_role}")
async def get_insights(user_role: str):
    """
    Get role-based insights and analytics
    Personalized for: Resident, Responder, Barangay Official, Admin
    """
    valid_roles = ["Resident", "Responder", "Barangay Official", "Admin"]
    if user_role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}")
    
    try:
        conv_ai = get_conversational_ai()
        insights = conv_ai.get_role_based_insights(user_role)
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "role": user_role,
                "insights": insights,
                "timestamp": datetime.now().isoformat()
            }
        )
    
    except Exception as e:
        logger.error(f"Insights error: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )


@router.get("/peak-times")
async def get_peak_times():
    """
    Get peak times analysis for incident reporting
    Shows when most incidents occur
    """
    try:
        conv_ai = get_conversational_ai()
        analysis = conv_ai.get_peak_times_analysis()
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "analysis": analysis,
                "timestamp": datetime.now().isoformat()
            }
        )
    
    except Exception as e:
        logger.error(f"Peak times error: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )


@router.get("/emergency-contacts")
async def get_emergency_contacts():
    """
    Get emergency contact information
    Available to all users, any time
    """
    try:
        conv_ai = get_conversational_ai()
        contacts_kb = conv_ai.search_knowledge_base("emergency contacts")
        
        if not contacts_kb:
            contacts_kb = conv_ai.ai_core.kb.EMERGENCY_CONTACTS.get("PH_HOTLINES", {})
            contacts_text = "🚨 **Emergency Contacts**\n\n"
            for service, number in contacts_kb.items():
                contacts_text += f"• **{service}**: {number}\n"
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "contacts": contacts_text or contacts_kb,
                "timestamp": datetime.now().isoformat()
            }
        )
    
    except Exception as e:
        logger.error(f"Emergency contacts error: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )


@router.get("/knowledge/{topic}")
async def search_knowledge(topic: str):
    """
    Search system knowledge base for specific topics
    Topics: features, categories, roles, emergency, purpose, name
    """
    try:
        conv_ai = get_conversational_ai()
        result = conv_ai.search_knowledge_base(topic)
        
        if not result:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "message": f"No information found for topic: {topic}",
                    "suggested_topics": ["features", "categories", "roles", "emergency", "purpose"]
                }
            )
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "topic": topic,
                "information": result,
                "timestamp": datetime.now().isoformat()
            }
        )
    
    except Exception as e:
        logger.error(f"Knowledge search error: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )


@router.get("/health")
async def chat_health():
    """Conversational AI health check"""
    return JSONResponse(
        status_code=200,
        content={
            "service": "Conversational AI",
            "status": "active",
            "features": [
                "Natural conversation",
                "System knowledge base",
                "Role-based analytics",
                "Emergency contacts",
                "Peak times analysis",
                "Incident guidance"
            ],
            "timestamp": datetime.now().isoformat()
        }
    )
