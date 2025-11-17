"""
Enhanced AI Chatbot Routes with Ollama Integration
Conversational AI endpoints using Ollama LLM, RAG, and analytics
"""

from flask import Blueprint, request, jsonify
from middleware.auth import token_required
from utils import supabase
import logging
from datetime import datetime, timedelta
from collections import defaultdict, Counter

# Import new AI services
try:
    from services.ollama_service import get_ollama_service
    from services.rag_service import get_rag_service
    from services.langchain_service import get_langchain_service
    from services.analytics_service import get_analytics_service
    OLLAMA_AVAILABLE = True
except ImportError as e:
    OLLAMA_AVAILABLE = False
    logging.warning(f"Ollama services not fully available: {e}")

logger = logging.getLogger(__name__)

# Create blueprint
chatbot_bp = Blueprint('chatbot', __name__)


# ============================================================================
# CHAT ENDPOINTS WITH OLLAMA
# ============================================================================

@chatbot_bp.route('/chat', methods=['POST'])
@token_required
def chat_with_ollama():
    """
    Enhanced chat endpoint using Ollama LLM with RAG
    
    Request JSON:
    {
        "message": "string - user message",
        "search_emergency": "bool - whether to search emergency guidance (optional)"
    }
    
    Response:
    {
        "status": "success|error",
        "response": "string - AI response",
        "type": "information|greeting|emergency|general",
        "sources": ["string - source documents if using RAG"]
    }
    """
    try:
        if not OLLAMA_AVAILABLE:
            return jsonify({
                "status": "error",
                "response": "Ollama AI services are not available. Please ensure Ollama is running.",
                "type": "error"
            }), 503
        
        data = request.get_json()
        message = data.get("message", "").strip()
        
        if not message:
            return jsonify({
                "status": "error",
                "response": "Please provide a message"
            }), 400
        
        # Get services
        ollama = get_ollama_service()
        rag = get_rag_service()
        langchain = get_langchain_service()
        
        # Determine response type
        response_type = "general"
        sources = []
        
        # Check if it's an emergency query
        emergency_keywords = ["emergency", "urgent", "help", "sos", "danger", 
                            "earthquake", "flood", "fire", "assault", "medical"]
        is_emergency = any(keyword in message.lower() for keyword in emergency_keywords)
        
        if is_emergency:
            response_type = "emergency"
            # Search emergency collection
            rag_results = rag.search_emergency(message, num_results=3)
            sources = [r["document"][:100] for r in rag_results]
            
            # Get emergency guidance
            response = langchain.answer_question(message, search_emergency=True)
        
        elif "hello" in message.lower() or "hi" in message.lower():
            response_type = "greeting"
            response = "👋 Hello! I'm the Community Helper, your AI assistant for Community Guard. I can help you understand our system, answer questions about reporting incidents, and provide safety guidance. What would you like to know?"
        
        elif "help" in message.lower() or "how" in message.lower():
            response_type = "information"
            response = langchain.answer_question(message)
        
        else:
            response_type = "general"
            response = langchain.answer_question(message)
        
        # Add memory
        langchain.add_to_memory("user", message)
        langchain.add_to_memory("assistant", response)
        
        return jsonify({
            "status": "success",
            "response": response,
            "type": response_type,
            "sources": sources,
            "timestamp": datetime.now().isoformat()
        }), 200
    
    except Exception as e:
        logger.error(f"Chat error: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "response": f"An error occurred: {str(e)}",
            "type": "error"
        }), 500


@chatbot_bp.route('/categorize', methods=['POST'])
@token_required
def categorize_incident():
    """
    Categorize an incident using Ollama with LangChain
    
    Request JSON:
    {
        "description": "string - incident description",
        "context": "string - additional context (optional)"
    }
    
    Response:
    {
        "category": "string",
        "confidence": "float",
        "reasoning": "string",
        "priority": "string",
        "guidance": "string"
    }
    """
    try:
        if not OLLAMA_AVAILABLE:
            return jsonify({
                "status": "error",
                "response": "Ollama AI services not available"
            }), 503
        
        data = request.get_json()
        description = data.get("description", "").strip()
        
        if not description or len(description) < 5:
            return jsonify({
                "status": "error",
                "error": "Description must be at least 5 characters"
            }), 400
        
        langchain = get_langchain_service()
        result = langchain.categorize_incident(description)
        
        return jsonify({
            "status": "success",
            **result
        }), 200
    
    except Exception as e:
        logger.error(f"Categorization error: {str(e)}")
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


@chatbot_bp.route('/summarize', methods=['POST'])
@token_required
def summarize_incident():
    """
    Summarize an incident report using Ollama
    
    Request JSON:
    {
        "description": "string - incident description to summarize"
    }
    
    Response:
    {
        "summary": "string",
        "original_length": "int",
        "summary_length": "int"
    }
    """
    try:
        if not OLLAMA_AVAILABLE:
            return jsonify({"error": "Ollama services not available"}), 503
        
        data = request.get_json()
        description = data.get("description", "").strip()
        
        if not description:
            return jsonify({"error": "Description required"}), 400
        
        langchain = get_langchain_service()
        summary = langchain.summarize_incident(description)
        
        return jsonify({
            "status": "success",
            "summary": summary,
            "original_length": len(description),
            "summary_length": len(summary)
        }), 200
    
    except Exception as e:
        logger.error(f"Summarization error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@chatbot_bp.route('/emergency-guidance', methods=['POST'])
@token_required
def get_emergency_guidance():
    """
    Get emergency guidance for incident type
    
    Request JSON:
    {
        "incident_type": "string - e.g., fire, flood, assault",
        "context": "string - additional context (optional)"
    }
    
    Response:
    {
        "guidance": "string - formatted emergency guidance",
        "incident_type": "string",
        "priority": "string"
    }
    """
    try:
        if not OLLAMA_AVAILABLE:
            return jsonify({"error": "Ollama services not available"}), 503
        
        data = request.get_json()
        incident_type = data.get("incident_type", "").strip().lower()
        context = data.get("context", "")
        
        if not incident_type:
            return jsonify({"error": "Incident type required"}), 400
        
        langchain = get_langchain_service()
        guidance = langchain.get_emergency_guidance(incident_type, context)
        
        # Determine priority
        priority_map = {
            "fire": "critical",
            "medical": "critical",
            "flood": "high",
            "assault": "high",
            "earthquake": "critical",
        }
        priority = priority_map.get(incident_type, "medium")
        
        return jsonify({
            "status": "success",
            "guidance": guidance,
            "incident_type": incident_type,
            "priority": priority
        }), 200
    
    except Exception as e:
        logger.error(f"Emergency guidance error: {str(e)}")
        return jsonify({"error": str(e)}), 500


# ============================================================================
# ANALYTICS ENDPOINTS WITH SCIKIT-LEARN
# ============================================================================

@chatbot_bp.route('/analytics', methods=['POST'])
@token_required
def get_analytics():
    """
    Get comprehensive analytics using scikit-learn and pandas
    
    Request JSON:
    {
        "reports": [list of report objects],
        "include_charts": "bool - whether to include chart images"
    }
    
    Response:
    {
        "total_reports": int,
        "category_distribution": dict,
        "priority_breakdown": dict,
        "top_hotspots": list,
        "anomalies": list,
        "charts": dict (optional)
    }
    """
    try:
        if not OLLAMA_AVAILABLE:
            return jsonify({"error": "Analytics service not available"}), 503
        
        data = request.get_json()
        reports = data.get("reports", [])
        include_charts = data.get("include_charts", True)
        
        if not reports:
            return jsonify({"error": "No reports provided"}), 400
        
        analytics = get_analytics_service()
        report = analytics.get_comprehensive_report(reports)
        
        if not include_charts:
            # Remove charts from response
            if "charts" in report:
                del report["charts"]
        
        return jsonify({
            "status": "success",
            **report
        }), 200
    
    except Exception as e:
        logger.error(f"Analytics error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@chatbot_bp.route('/analytics/hotspots', methods=['POST'])
@token_required
def get_hotspots():
    """
    Identify incident hotspots using geospatial analysis
    
    Request JSON:
    {
        "reports": [list of reports with location],
        "top_n": int - number of top hotspots (default 5)
    }
    
    Response:
    {
        "hotspots": [list of location dicts with coordinates and counts]
    }
    """
    try:
        data = request.get_json()
        reports = data.get("reports", [])
        top_n = data.get("top_n", 5)
        
        analytics = get_analytics_service()
        hotspots = analytics.get_hotspots(reports, top_n)
        
        return jsonify({
            "status": "success",
            "hotspots": hotspots
        }), 200
    
    except Exception as e:
        logger.error(f"Hotspot error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@chatbot_bp.route('/analytics/anomalies', methods=['POST'])
@token_required
def detect_anomalies():
    """
    Detect anomalous incidents using machine learning clustering
    
    Request JSON:
    {
        "reports": [list of reports]
    }
    
    Response:
    {
        "anomalies": [list of unusual incidents with scores]
    }
    """
    try:
        data = request.get_json()
        reports = data.get("reports", [])
        
        analytics = get_analytics_service()
        anomalies = analytics.detect_anomalies(reports)
        
        return jsonify({
            "status": "success",
            "anomalies": anomalies
        }), 200
    
    except Exception as e:
        logger.error(f"Anomaly detection error: {str(e)}")
        return jsonify({"error": str(e)}), 500


# ============================================================================
# OLLAMA HEALTH & STATUS ENDPOINTS
# ============================================================================

@chatbot_bp.route('/health', methods=['GET'])
def health_check():
    """
    Check Ollama and AI services health
    
    Response:
    {
        "status": "healthy|degraded|error",
        "ollama": {"connected": bool, "models": dict},
        "rag": {"initialized": bool, "collections": dict},
        "langchain": {"llm_ready": bool}
    }
    """
    try:
        health = {
            "status": "healthy",
            "timestamp": datetime.now().isoformat()
        }
        
        if OLLAMA_AVAILABLE:
            ollama = get_ollama_service()
            models = ollama.verify_models()
            health["ollama"] = models
            
            rag = get_rag_service()
            health["rag"] = rag.get_collection_stats()
            
            langchain = get_langchain_service()
            health["langchain"] = {
                "llm_ready": langchain.llm is not None,
                "memory_size": len(langchain.memory.buffer) if hasattr(langchain.memory, 'buffer') else 0
            }
            
            # Check if models are available
            if not models.get("llm") or not models.get("embed"):
                health["status"] = "degraded"
        else:
            health["status"] = "error"
            health["error"] = "Ollama services not available"
        
        return jsonify(health), 200
    
    except Exception as e:
        logger.error(f"Health check error: {str(e)}")
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


@chatbot_bp.route('/initialize-rag', methods=['POST'])
@token_required
def initialize_rag():
    """
    Initialize RAG collections with default content
    
    Admin only endpoint
    
    Response:
    {
        "status": "success|error",
        "message": "string"
    }
    """
    try:
        if not OLLAMA_AVAILABLE:
            return jsonify({
                "status": "error",
                "error": "Ollama services not available"
            }), 503
        
        # Check admin permission
        if user_info.get("role") != "admin":
            return jsonify({
                "status": "error",
                "error": "Admin access required"
            }), 403
        
        rag = get_rag_service()
        
        # Initialize collections
        rag.initialize_emergency_guidance()
        rag.initialize_knowledge_base()
        
        stats = rag.get_collection_stats()
        
        return jsonify({
            "status": "success",
            "message": "RAG collections initialized",
            "stats": stats
        }), 200
    
    except Exception as e:
        logger.error(f"RAG initialization error: {str(e)}")
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


@chatbot_bp.route('/suggestions', methods=['GET'])
def get_chat_suggestions():
    """
    Get pre-defined chat suggestions
    
    Response:
    {
        "suggestions": [list of suggested questions]
    }
    """
    suggestions = [
        "How do I report an incident?",
        "What categories of incidents can I report?",
        "Emergency contacts in Olongapo",
        "Fire safety tips",
        "Crime prevention advice",
        "Health emergency guidance",
        "Earthquake safety",
        "Flood preparation",
    ]
    
    return jsonify({"suggestions": suggestions}), 200
