"""
AI/ML Endpoints
Routes for AI-powered features including incident categorization
"""

from flask import Blueprint, request, jsonify
from functools import wraps
from middleware.auth import token_required
import logging

# Import ML service
from services.ml_categorizer import categorize_incident, get_categorizer

logger = logging.getLogger(__name__)

# Create blueprint (url_prefix is set when registering in app.py)
ai_bp = Blueprint('ai', __name__)


## use centralized token_required from middleware.auth


@ai_bp.route('/categorize', methods=['POST'])
@token_required
def categorize():
    """
    AI-powered incident categorization endpoint
    
    Request JSON:
    {
        "description": "string - incident description",
        "images": "int - number of images attached (optional)"
    }
    
    Response:
    {
        "category": "string - categorized incident type",
        "confidence": "float - confidence score (0-1)",
        "alternative_categories": "list - alternative suggestions",
        "method": "string - categorization method (ml/keyword)",
        "reason": "string - explanation of categorization"
    }
    """
    try:
        data = request.get_json()

        # Validate input
        if not data or 'description' not in data:
            return jsonify({
                'error': 'Missing required field: description'
            }), 400

        description = data.get('description', '').strip()
        num_images = data.get('images', 0)

        if not description or len(description) < 5:
            return jsonify({
                'error': 'Description must be at least 5 characters',
                'category': 'other',
                'confidence': 0.0
            }), 400

        # Categorize the incident
        result = categorize_incident(description, num_images)

        logger.info(f"Categorized incident: {result['category']} (confidence: {result['confidence']:.2%})")

        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Categorization error: {str(e)}")
        return jsonify({
            'error': 'Error processing categorization',
            'category': 'other',
            'confidence': 0.0
        }), 500


@ai_bp.route('/categorize/suggestions', methods=['POST'])
def get_suggestions():
    """
    Real-time category suggestions as user types (No auth required for better UX)
    
    Request JSON:
    {
        "text": "string - partial incident description"
    }
    
    Response:
    {
        "suggestions": [
            {
                "category": "string",
                "confidence": "float"
            }
        ]
    }
    """
    try:
        data = request.get_json()

        if not data or 'text' not in data:
            return jsonify({'suggestions': []}), 200

        text = data.get('text', '').strip()

        if len(text) < 3:
            return jsonify({'suggestions': []}), 200

        # Get categorizer and suggestions
        categorizer = get_categorizer()
        suggestions = categorizer.get_category_suggestions(text)

        return jsonify({'suggestions': suggestions}), 200

    except Exception as e:
        logger.error(f"Suggestion error: {str(e)}")
        return jsonify({'suggestions': []}), 200


@ai_bp.route('/categories', methods=['GET'])
def get_categories():
    """
    Get list of available incident categories (No auth required)
    
    Response:
    {
        "categories": [
            {
                "id": "string",
                "label": "string",
                "icon": "string",
                "color": "string",
                "description": "string"
            }
        ]
    }
    """
    categories = [
        {
            'id': 'theft',
            'label': 'Theft/Robbery',
            'icon': '🏪',
            'color': '#e74c3c',
            'description': 'Theft, robbery, burglary, or shoplifting incidents'
        },
        {
            'id': 'fire',
            'label': 'Fire/Explosion',
            'icon': '🔥',
            'color': '#e67e22',
            'description': 'Fire, explosion, or combustion incidents'
        },
        {
            'id': 'flood',
            'label': 'Flood/Water',
            'icon': '💧',
            'color': '#3498db',
            'description': 'Flooding, water damage, or overflow incidents'
        },
        {
            'id': 'accident',
            'label': 'Accident',
            'icon': '🚗',
            'color': '#f39c12',
            'description': 'Vehicle or pedestrian accidents'
        },
        {
            'id': 'violence',
            'label': 'Violence/Assault',
            'icon': '⚠️',
            'color': '#c0392b',
            'description': 'Violence, assault, or physical harm'
        },
        {
            'id': 'harassment',
            'label': 'Harassment',
            'icon': '📢',
            'color': '#8e44ad',
            'description': 'Harassment, bullying, or threats'
        },
        {
            'id': 'vandalism',
            'label': 'Vandalism',
            'icon': '🖼️',
            'color': '#95a5a6',
            'description': 'Property damage, graffiti, or defacement'
        },
        {
            'id': 'suspicious',
            'label': 'Suspicious Activity',
            'icon': '👁️',
            'color': '#34495e',
            'description': 'Suspicious behavior or unknown persons'
        },
        {
            'id': 'lostfound',
            'label': 'Lost & Found',
            'icon': '🔎',
            'color': '#2ecc71',
            'description': 'Lost items found or reported (wallets, phones, keys)'
        },
        {
            'id': 'hazard',
            'label': 'Hazard/Infrastructure',
            'icon': '⚠️',
            'color': '#d35400',
            'description': 'Infrastructure hazards, potholes, broken utilities'
        },
        {
            'id': 'other',
            'label': 'Other',
            'icon': '❓',
            'color': '#95a5a6',
            'description': 'Other incident types not listed above'
        }
    ]

    return jsonify({'categories': categories}), 200


@ai_bp.route('/log-usage', methods=['POST'])
@token_required
def log_ai_usage(current_user):
    """
    Log AI Smart Filter usage interaction for barangay official.
    Calls database function log_ai_interaction() to track and aggregate usage.
    
    Request JSON:
    {
        "interaction_type": "string - e.g., 'smart_filter_toggle' or 'smart_filter_use'",
        "duration_seconds": "int - optional, seconds of active usage (default: 0)"
    }
    
    Response:
    {
        "status": "success" or "error",
        "data": {
            "user_id": "UUID",
            "week_start": "DATE",
            "total_seconds": "BIGINT",
            "usage_percent": "0-100",
            "interaction_count": "int",
            "is_premium": "boolean",
            "hours_remaining": "float - calculated from usage_percent"
        },
        "message": "string - status message"
    }
    """
    try:
        data = request.get_json()
        
        # Validate input
        if not data or 'interaction_type' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Missing required field: interaction_type'
            }), 400
        
        interaction_type = data.get('interaction_type', 'smart_filter_toggle')
        duration_seconds = data.get('duration_seconds', 0)
        metadata = data.get('metadata', {})
        
        # Get user ID from token (current_user dict has 'id' from token_required)
        user_id = current_user.get('id')
        if not user_id:
            return jsonify({
                'status': 'error',
                'message': 'User ID not found in token'
            }), 401
        
        # Import supabase client
        from config import supabase
        
        # Call the PL/pgSQL function via Supabase
        # log_ai_interaction returns a table with one row
        response = supabase.rpc('log_ai_interaction', {
            'p_user_id': user_id,
            'p_interaction_type': interaction_type,
            'p_duration_seconds': duration_seconds,
            'p_metadata': metadata
        }).execute()
        
        if not response.data or len(response.data) == 0:
            return jsonify({
                'status': 'error',
                'message': 'Failed to log AI usage'
            }), 500
        
        # Extract result from first row
        result = response.data[0]
        
        # Calculate hours remaining
        hours_remaining = max(0, (172800 - result['total_seconds']) / 3600.0)
        
        return jsonify({
            'status': 'success',
            'data': {
                'user_id': result['user_id'],
                'week_start': result['week_start'],
                'total_seconds': result['total_seconds'],
                'usage_percent': result['usage_percent'],
                'interaction_count': result['interaction_count'],
                'is_premium': result['is_premium'],
                'hours_remaining': round(hours_remaining, 2)
            },
            'message': f'Usage tracked: {result["usage_percent"]}% of weekly limit used'
        }), 200
    
    except Exception as e:
        logger.error(f"Error logging AI usage: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': f'Internal server error: {str(e)}'
        }), 500


@ai_bp.route('/current-usage', methods=['GET'])
@token_required
def get_current_usage(current_user):
    """
    Get current week's AI usage for authenticated user.
    Queries the vw_ai_current_week_usage view.
    
    Response:
    {
        "status": "success" or "error",
        "data": {
            "user_id": "UUID",
            "week_start": "DATE",
            "total_seconds": "BIGINT",
            "usage_percent": "0-100",
            "interaction_count": "int",
            "is_premium": "boolean",
            "hours_remaining": "float"
        }
    }
    """
    try:
        user_id = current_user.get('id')
        if not user_id:
            return jsonify({
                'status': 'error',
                'message': 'User ID not found in token'
            }), 401
        
        from config import supabase
        
        # Query the view
        response = supabase.table('vw_ai_current_week_usage').select('*').eq('user_id', user_id).execute()
        
        if not response.data or len(response.data) == 0:
            # No usage data yet; return defaults
            return jsonify({
                'status': 'success',
                'data': {
                    'user_id': user_id,
                    'week_start': None,
                    'total_seconds': 0,
                    'usage_percent': 0,
                    'interaction_count': 0,
                    'is_premium': False,
                    'hours_remaining': 48.0
                },
                'message': 'No usage data for this week'
            }), 200
        
        result = response.data[0]
        
        return jsonify({
            'status': 'success',
            'data': result,
            'message': 'Current week usage retrieved'
        }), 200
    
    except Exception as e:
        logger.error(f"Error fetching current usage: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': f'Internal server error: {str(e)}'
        }), 500


@ai_bp.route('/health', methods=['GET'])
def ai_health_check():
    """Health check for AI service (No auth required)"""
    categorizer = get_categorizer()
    return jsonify({
        'status': 'ok',
        'service': 'AI Categorization Service',
        'model_loaded': categorizer.model is not None,
        'method': 'ml' if categorizer.model else 'keyword'
    }), 200

