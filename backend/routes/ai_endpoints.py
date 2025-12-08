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


@ai_bp.route('/categorize/batch', methods=['POST'])
@token_required
def categorize_batch():
    """
    Batch categorize endpoint. Accepts a JSON body with `items` list:
    {
       "items": [ { "id": "report-id", "description": "...", "images": 1 }, ... ]
    }

    Returns a mapping of id -> { category, confidence, confidence_percent, priority, priority_score, priority_label, severity, method }
    Priority values are capitalized to match frontend filter options: Critical, High, Medium, Low
    """
    try:
        data = request.get_json() or {}
        items = data.get('items', [])

        if not isinstance(items, list) or len(items) == 0:
            return jsonify({'error': 'No items provided', 'results': {}}), 400

        results = {}
        for itm in items:
            rid = itm.get('id') or itm.get('report_id')
            desc = (itm.get('description') or '')
            imgs = int(itm.get('images') or 0)

            if not desc or len(desc.strip()) < 3:
                # return low confidence for empty/short text
                results[rid] = {
                    'category': 'Others', 
                    'confidence': 0.55, 
                    'confidence_percent': 55,
                    'priority': 'Low',  # Capitalized for frontend filter match
                    'priority_score': 1,
                    'priority_label': '⚪ Low',
                    'severity': 'low',  # Backward compatibility
                    'severity_score': 1,
                    'severity_label': '⚪ Low',
                    'method': 'none'
                }
                continue

            try:
                res = categorize_incident(desc, imgs)
                confidence = float(res.get('confidence', 0.55))
                results[rid] = {
                    'category': res.get('frontend_category', res.get('category', 'Others')),
                    'confidence': confidence,
                    'confidence_percent': res.get('confidence_percent', int(round(confidence * 100))),
                    'priority': res.get('priority', 'Low'),  # Capitalized for frontend
                    'priority_score': res.get('priority_score', 1),
                    'priority_label': res.get('priority_label', '⚪ Low'),
                    'severity': res.get('severity', 'low'),  # Backward compatibility
                    'severity_score': res.get('severity_score', 1),
                    'severity_label': res.get('severity_label', '⚪ Low'),
                    'method': res.get('method', 'weighted_keyword'),
                    'reason': res.get('reason', '')
                }
            except Exception as inner:
                logger.error(f"Batch categorize error for id={rid}: {inner}")
                results[rid] = {
                    'category': 'Others', 
                    'confidence': 0.55, 
                    'confidence_percent': 55,
                    'priority': 'Low',
                    'priority_score': 1,
                    'priority_label': '⚪ Low',
                    'severity': 'low',
                    'severity_score': 1,
                    'severity_label': '⚪ Low',
                    'method': 'error'
                }

        return jsonify({'results': results}), 200

    except Exception as e:
        logger.error(f"Batch categorization failed: {e}")
        return jsonify({'error': 'Batch categorization failed', 'results': {}}), 500


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
def log_ai_usage():
    """
    Log AI Smart Filter usage - ONE ROW PER USER PER WEEK.
    If row exists for this user+week, UPDATE and accumulate duration_seconds.
    If not, INSERT a new row.
    
    Request JSON:
    {
        "interaction_type": "string - e.g., 'smart_filter_toggle' or 'smart_filter_use'",
        "duration_seconds": "int - seconds of this session to ADD to total"
    }
    
    Response:
    {
        "status": "success" or "error",
        "data": {
            "user_id": "UUID",
            "week_start": "DATE",
            "total_seconds": "BIGINT - accumulated total",
            "usage_percent": "0-100",
            "interaction_count": "int",
            "hours_remaining": "float",
            "time_remaining_seconds": "int"
        },
        "message": "string"
    }
    """
    from datetime import datetime, timedelta
    import json
    
    WEEK_LIMIT_SECONDS = 172800  # 48 hours = 172800 seconds
    
    try:
        data = request.get_json()
        
        # Validate input
        if not data or 'interaction_type' not in data:
            logger.warning("[AI Usage] ⚠️ Missing interaction_type in request")
            return jsonify({
                'status': 'error',
                'message': 'Missing required field: interaction_type'
            }), 400
        
        interaction_type = data.get('interaction_type', 'smart_filter_toggle')
        session_seconds = int(data.get('duration_seconds', 0))
        metadata = data.get('metadata', {})

        # Get user ID from token
        user_id = getattr(request, 'user_id', None)
        if not user_id:
            logger.error("[AI Usage] ❌ User ID not found in token")
            return jsonify({
                'status': 'error',
                'message': 'User ID not found in token'
            }), 401
        
        logger.info(f"[AI Usage] 📝 Logging usage - Type: {interaction_type}, Duration: {session_seconds}s")
        
        from utils import supabase
        
        # Check if user is premium (Admin role auto-grants premium, or check onpremium field)
        is_premium = False
        try:
            user_resp = supabase.table('users').select('role, onpremium').eq('id', user_id).execute()
            if user_resp.data and len(user_resp.data) > 0:
                user_data = user_resp.data[0]
                user_role = user_data.get('role', '')
                on_premium = user_data.get('onpremium')  # Can be None, True, or False
                
                print(f"[AI Usage] 🔍 User check - Role: '{user_role}', onpremium: {on_premium}")
                
                # Admin role automatically gets premium status
                if user_role == 'Admin':
                    is_premium = True
                    # Auto-update onpremium to true for Admin if not already True
                    if on_premium is not True:
                        try:
                            supabase.table('users').update({'onpremium': True}).eq('id', user_id).execute()
                            print(f"[AI Usage] 👑 Auto-set onpremium=true for Admin user (was: {on_premium})")
                        except Exception as update_err:
                            print(f"[AI Usage] ⚠️ Could not auto-update onpremium: {str(update_err)}")
                    else:
                        print(f"[AI Usage] ✅ Admin already has onpremium=true")
                    print(f"[AI Usage] ✨ PREMIUM USER (Admin) - Unlimited access")
                    logger.info(f"[AI Usage] ✨ Admin detected - Premium status enabled")
                elif on_premium is True:
                    # Non-admin user with onpremium = true
                    is_premium = True
                    print(f"[AI Usage] ✨ PREMIUM USER (onpremium=true) - Unlimited access")
                    logger.info(f"[AI Usage] ✨ Premium subscriber detected")
                else:
                    print(f"[AI Usage] 📊 Regular user - Role: '{user_role}', onpremium: {on_premium}")
        except Exception as role_err:
            print(f"[AI Usage] ⚠️ Could not check user role/premium: {str(role_err)}")
            logger.warning(f"[AI Usage] ⚠️ Could not check user role/premium: {str(role_err)}")
        
        # Premium users bypass usage logging entirely - just return success with unlimited status
        if is_premium:
            print(f"[AI Usage] 👑 Premium user - skipping usage logging (unlimited access)")
            return jsonify({
                'status': 'success',
                'data': {
                    'user_id': user_id,
                    'week_start': datetime.now().date().isoformat(),
                    'total_seconds': 0,
                    'usage_percent': 0,
                    'interaction_count': 0,
                    'hours_remaining': 48.0,
                    'time_remaining_seconds': WEEK_LIMIT_SECONDS,
                    'time_remaining_hms': '48:00:00',
                    'is_premium': True
                },
                'message': 'Premium: Unlimited access - no usage logged'
            }), 200
        
        # Calculate week_start (Monday of current week)
        today = datetime.now().date()
        week_start = today - timedelta(days=today.weekday())
        week_start_str = week_start.isoformat()
        
        # Check if a row already exists for this user + week
        existing_row = None
        try:
            check_response = supabase.table('ai_usage_logs')\
                .select('id, duration_seconds, interaction_count')\
                .eq('user_id', user_id)\
                .eq('week_start', week_start_str)\
                .limit(1)\
                .execute()
            
            if check_response.data and len(check_response.data) > 0:
                existing_row = check_response.data[0]
        except Exception as check_err:
            logger.warning(f"[AI Usage] ⚠️ Could not check existing row: {str(check_err)}")
        
        if existing_row:
            # UPDATE existing row - accumulate duration_seconds
            row_id = existing_row['id']
            old_total = existing_row.get('duration_seconds', 0) or 0
            old_count = existing_row.get('interaction_count', 0) or 0
            
            new_total = old_total + session_seconds
            new_count = old_count + 1
            new_usage_percent = min(100, int(round((new_total / WEEK_LIMIT_SECONDS) * 100)))
            
            try:
                update_response = supabase.table('ai_usage_logs')\
                    .update({
                        'duration_seconds': new_total,
                        'interaction_count': new_count,
                        'usage_after_percent': new_usage_percent,
                        'interaction_type': interaction_type,
                        'metadata': json.dumps(metadata) if metadata else '{}'
                    })\
                    .eq('id', row_id)\
                    .execute()
                print(f"[AI Usage] ✅ SUCCESS - Updated: +{session_seconds}s → Total: {new_total}s ({new_usage_percent}% used)")
                logger.info(f"[AI Usage] ✅ Updated: +{session_seconds}s → Total: {new_total}s")
            except Exception as update_err:
                logger.error(f"[AI Usage] ❌ Update failed: {str(update_err)}", exc_info=True)
                raise
            
            total_seconds = new_total
            interaction_count = new_count
        else:
            # INSERT new row for this user + week
            total_seconds = session_seconds
            interaction_count = 1
            usage_percent = min(100, int(round((total_seconds / WEEK_LIMIT_SECONDS) * 100)))
            
            insert_data = {
                'user_id': user_id,
                'interaction_type': interaction_type,
                'duration_seconds': total_seconds,
                'interaction_count': 1,
                'usage_before_percent': 0,
                'usage_after_percent': usage_percent,
                'week_start': week_start_str,
                'metadata': json.dumps(metadata) if metadata else '{}'
            }
            
            try:
                insert_response = supabase.table('ai_usage_logs').insert(insert_data).execute()
                print(f"[AI Usage] ✅ SUCCESS - New session: {total_seconds}s ({usage_percent}% used)")
                logger.info(f"[AI Usage] ✅ Inserted new row: {total_seconds}s")
            except Exception as insert_err:
                logger.error(f"[AI Usage] ❌ Insert failed: {str(insert_err)}", exc_info=True)
                raise
        
        # Calculate time remaining (48 hours - used time)
        # For premium users (Admin), always show 0% usage and full time
        if is_premium:
            usage_percent = 0
            time_remaining_seconds = WEEK_LIMIT_SECONDS
            hours_remaining = 48.0
            time_hms = "48:00:00"
            logger.info(f"[AI Usage] ✨ Premium user - Showing unlimited access (0% used)")
        else:
            usage_percent = min(100, int(round((total_seconds / WEEK_LIMIT_SECONDS) * 100)))
            time_remaining_seconds = max(0, WEEK_LIMIT_SECONDS - total_seconds)
            hours_remaining = round(time_remaining_seconds / 3600.0, 2)
            # Format as HH:MM:SS
            hrs = time_remaining_seconds // 3600
            mins = (time_remaining_seconds % 3600) // 60
            secs = time_remaining_seconds % 60
            time_hms = f"{int(hrs):02d}:{int(mins):02d}:{int(secs):02d}"
        
        logger.info(f"[AI Usage] ✅ Total: {total_seconds}s, Premium: {is_premium}, Remaining: {hours_remaining}h ({time_hms})")
        
        return jsonify({
            'status': 'success',
            'data': {
                'user_id': user_id,
                'week_start': week_start_str,
                'total_seconds': total_seconds,
                'usage_percent': usage_percent,
                'interaction_count': interaction_count,
                'hours_remaining': hours_remaining,
                'time_remaining_seconds': time_remaining_seconds,
                'time_remaining_hms': time_hms,
                'is_premium': is_premium
            },
            'message': f'Premium: Unlimited access' if is_premium else f'Usage tracked: {usage_percent}% used, {hours_remaining}h remaining'
        }), 200
    
    except Exception as e:
        logger.error(f"[AI Usage] ❌ Error logging AI usage: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': f'Internal server error: {str(e)}'
        }), 500


@ai_bp.route('/current-usage', methods=['GET'])
@token_required
def get_current_usage():
    """
    Get current week's AI usage for authenticated user.
    Queries the ai_usage_logs table directly.
    
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
    from datetime import datetime, timedelta
    
    WEEK_LIMIT_SECONDS = 172800  # 48 hours
    
    try:
        user_id = getattr(request, 'user_id', None)
        if not user_id:
            logger.error("[AI Usage] ❌ User ID not found in token for current-usage")
            return jsonify({
                'status': 'error',
                'message': 'User ID not found in token'
            }), 401
        
        logger.info(f"[AI Usage] 📊 Fetching current week usage...")
        
        from utils import supabase
        
        # Check if user is premium (Admin role auto-grants premium, or check onpremium field)
        is_premium = False
        try:
            user_resp = supabase.table('users').select('role, onpremium').eq('id', user_id).execute()
            if user_resp.data and len(user_resp.data) > 0:
                user_data = user_resp.data[0]
                user_role = user_data.get('role', '')
                on_premium = user_data.get('onpremium')  # Can be None, True, or False
                
                print(f"[AI Usage] 🔍 User check - Role: '{user_role}', onpremium: {on_premium}")
                
                # Admin role automatically gets premium status
                if user_role == 'Admin':
                    is_premium = True
                    # Auto-update onpremium to true for Admin if not already True
                    if on_premium is not True:
                        try:
                            supabase.table('users').update({'onpremium': True}).eq('id', user_id).execute()
                            print(f"[AI Usage] 👑 Auto-set onpremium=true for Admin user (was: {on_premium})")
                        except Exception as update_err:
                            print(f"[AI Usage] ⚠️ Could not auto-update onpremium: {str(update_err)}")
                    else:
                        print(f"[AI Usage] ✅ Admin already has onpremium=true")
                    print(f"[AI Usage] ✨ PREMIUM USER (Admin) - Unlimited access")
                    logger.info(f"[AI Usage] ✨ Admin detected - Premium status enabled")
                elif on_premium is True:
                    # Non-admin user with onpremium = true
                    is_premium = True
                    print(f"[AI Usage] ✨ PREMIUM USER (onpremium=true) - Unlimited access")
                    logger.info(f"[AI Usage] ✨ Premium subscriber detected")
                else:
                    print(f"[AI Usage] 📊 Regular user - Role: '{user_role}', onpremium: {on_premium}")
        except Exception as role_err:
            print(f"[AI Usage] ⚠️ Could not check user role/premium: {str(role_err)}")
            logger.warning(f"[AI Usage] ⚠️ Could not check user role/premium: {str(role_err)}")
        
        # Calculate week_start (Monday of current week)
        today = datetime.now().date()
        week_start = today - timedelta(days=today.weekday())
        week_start_str = week_start.isoformat()
        
        # Query ai_usage_logs for this week's data
        try:
            response = supabase.table('ai_usage_logs')\
                .select('duration_seconds')\
                .eq('user_id', user_id)\
                .eq('week_start', week_start_str)\
                .execute()
        except Exception as query_error:
            logger.error(f"[AI Usage] ❌ Query error: {str(query_error)}", exc_info=True)
            raise
        
        if not response.data or len(response.data) == 0:
            # No usage data yet; return defaults (premium users get is_premium=true)
            logger.info(f"[AI Usage] ℹ️ No usage data this week - Premium: {is_premium}")
            time_remaining_seconds = WEEK_LIMIT_SECONDS
            hours_remaining = round(time_remaining_seconds / 3600.0, 2)
            # Format as HH:MM:SS
            hrs = time_remaining_seconds // 3600
            mins = (time_remaining_seconds % 3600) // 60
            secs = time_remaining_seconds % 60
            time_hms = f"{int(hrs):02d}:{int(mins):02d}:{int(secs):02d}"
            return jsonify({
                'status': 'success',
                'data': {
                    'user_id': user_id,
                    'week_start': week_start_str,
                    'total_seconds': 0,
                    'usage_percent': 0,
                    'interaction_count': 0,
                    'hours_remaining': hours_remaining,
                    'time_remaining_seconds': time_remaining_seconds,
                    'time_remaining_hms': time_hms,
                    'is_premium': is_premium
                },
                'message': 'Premium: Unlimited access' if is_premium else 'No usage data for this week'
            }), 200
        
        # Aggregate data
        total_seconds = sum(row.get('duration_seconds', 0) for row in response.data)
        interaction_count = len(response.data)
        
        # For premium users (Admin), always show 0% usage
        if is_premium:
            usage_percent = 0
            time_remaining_seconds = WEEK_LIMIT_SECONDS
            hours_remaining = 48.0
            time_hms = "48:00:00"
        else:
            usage_percent = min(100, round((total_seconds / WEEK_LIMIT_SECONDS) * 100))
            time_remaining_seconds = max(0, WEEK_LIMIT_SECONDS - total_seconds)
            hours_remaining = round(time_remaining_seconds / 3600.0, 2)
            hrs = time_remaining_seconds // 3600
            mins = (time_remaining_seconds % 3600) // 60
            secs = time_remaining_seconds % 60
            time_hms = f"{int(hrs):02d}:{int(mins):02d}:{int(secs):02d}"

        result = {
            'user_id': user_id,
            'week_start': week_start_str,
            'total_seconds': total_seconds,
            'usage_percent': usage_percent,
            'interaction_count': interaction_count,
            'time_remaining_seconds': time_remaining_seconds,
            'time_remaining_hms': time_hms,
            'hours_remaining': hours_remaining,
            'is_premium': is_premium
        }

        logger.info(f"[AI Usage] ✅ Retrieved usage - Premium: {is_premium}, {usage_percent}% ({total_seconds}s), {hours_remaining}h remaining")

        return jsonify({
            'status': 'success',
            'data': result,
            'message': 'Premium: Unlimited access' if is_premium else 'Current week usage retrieved'
        }), 200
    
    except Exception as e:
        logger.error(f"[AI Usage] ❌ Error fetching current usage: {str(e)}", exc_info=True)
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

