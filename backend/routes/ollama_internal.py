"""
Internal Flask Endpoints for Ollama AI
Used by Premium AI (Community Patrol) to access system data
No authentication required (internal service-to-service calls)
"""

from flask import Blueprint, request, jsonify
from utils import supabase
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

# Create blueprint
ollama_internal_bp = Blueprint('ollama_internal', __name__)


# ============================================================================
# USERS ENDPOINTS
# ============================================================================

@ollama_internal_bp.route('/users/stats', methods=['GET'])
def get_user_stats():
    """
    Get user statistics (for Ollama AI analytics).
    - Total users
    - Verified users
    - Email verified count
    - Breakdown by barangay
    """
    try:
        # Get all users
        users = supabase.table('users').select('*').execute().data or []
        
        total_users = len(users)
        verified_users = len([u for u in users if u.get('verified', False)])
        email_verified = len([u for u in users if u.get('email_verified', False)])
        
        # Breakdown by barangay
        barangay_breakdown = {}
        for user in users:
            barangay = user.get('barangay', 'Unknown')
            barangay_breakdown[barangay] = barangay_breakdown.get(barangay, 0) + 1
        
        return jsonify({
            "total_users": total_users,
            "verified_users": verified_users,
            "email_verified": email_verified,
            "unverified_users": total_users - verified_users,
            "by_barangay": barangay_breakdown,
            "timestamp": datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"User stats error: {e}")
        return jsonify({"error": str(e)}), 500


# ============================================================================
# REPORTS ENDPOINTS
# ============================================================================

@ollama_internal_bp.route('/reports', methods=['GET'])
def get_reports_for_ai():
    """
    Get all reports (for Ollama AI analysis).
    Query parameters:
    - barangay: Filter by barangay
    - category: Filter by category
    - days: Filter by last N days (default: 30)
    - min_priority: Filter by minimum priority (low, medium, high, critical)
    """
    try:
        # Get query parameters
        barangay = request.args.get('barangay', None)
        category = request.args.get('category', None)
        days = int(request.args.get('days', 30))
        min_priority = request.args.get('min_priority', None)
        
        # Base query
        query = supabase.table('reports').select('*')
        
        # Filter by date
        cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
        query = query.gte('created_at', cutoff_date)
        
        # Get data
        reports = query.execute().data or []
        
        # Post-filtering (since Supabase has limited filtering)
        if barangay:
            reports = [r for r in reports if r.get('barangay', '').lower() == barangay.lower()]
        if category:
            reports = [r for r in reports if r.get('category', '').lower() == category.lower()]
        if min_priority:
            priority_score = {"low": 1, "medium": 2, "high": 3, "critical": 4}
            min_score = priority_score.get(min_priority, 1)
            reports = [r for r in reports if priority_score.get(r.get('priority', 'low'), 1) >= min_score]
        
        return jsonify({
            "data": reports,
            "count": len(reports),
            "filters": {
                "days": days,
                "barangay": barangay,
                "category": category,
                "min_priority": min_priority
            },
            "timestamp": datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Reports for AI error: {e}")
        return jsonify({"error": str(e)}), 500


@ollama_internal_bp.route('/reports/by-category', methods=['GET'])
def get_reports_by_category():
    """Get report count by category."""
    try:
        days = int(request.args.get('days', 7))
        
        cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
        reports = supabase.table('reports').select('*').gte('created_at', cutoff_date).execute().data or []
        
        # Count by category
        category_counts = {}
        for report in reports:
            cat = report.get('category', 'unknown')
            category_counts[cat] = category_counts.get(cat, 0) + 1
        
        return jsonify({
            "data": category_counts,
            "total": len(reports),
            "days": days,
            "timestamp": datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Category breakdown error: {e}")
        return jsonify({"error": str(e)}), 500


@ollama_internal_bp.route('/reports/by-severity', methods=['GET'])
def get_reports_by_severity():
    """Get report count by priority/severity."""
    try:
        days = int(request.args.get('days', 7))
        
        cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
        reports = supabase.table('reports').select('*').gte('created_at', cutoff_date).execute().data or []
        
        # Count by priority
        priority_counts = {}
        for report in reports:
            priority = report.get('priority', 'low')
            priority_counts[priority] = priority_counts.get(priority, 0) + 1
        
        return jsonify({
            "data": priority_counts,
            "total": len(reports),
            "days": days,
            "critical_count": priority_counts.get('critical', 0),
            "high_count": priority_counts.get('high', 0),
            "timestamp": datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Severity breakdown error: {e}")
        return jsonify({"error": str(e)}), 500


@ollama_internal_bp.route('/reports/hotspots', methods=['GET'])
def get_hotspots():
    """Identify incident hotspots by location."""
    try:
        days = int(request.args.get('days', 30))
        top_n = int(request.args.get('top_n', 5))
        
        cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
        reports = supabase.table('reports').select('*').gte('created_at', cutoff_date).execute().data or []
        
        # Count by location
        location_counts = {}
        for report in reports:
            location = report.get('location', 'Unknown')
            location_counts[location] = location_counts.get(location, 0) + 1
        
        # Sort by count
        hotspots = sorted(location_counts.items(), key=lambda x: x[1], reverse=True)[:top_n]
        
        return jsonify({
            "hotspots": [{"location": loc, "count": count} for loc, count in hotspots],
            "total_locations": len(location_counts),
            "days": days,
            "timestamp": datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Hotspots error: {e}")
        return jsonify({"error": str(e)}), 500


# ============================================================================
# ANALYTICS ENDPOINTS
# ============================================================================

@ollama_internal_bp.route('/analytics/daily', methods=['GET'])
def get_daily_analytics():
    """Get daily report counts."""
    try:
        days = int(request.args.get('days', 7))
        
        cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
        reports = supabase.table('reports').select('*').gte('created_at', cutoff_date).execute().data or []
        
        # Group by date
        daily_counts = {}
        for report in reports:
            date = report.get('created_at', datetime.now().isoformat())[:10]
            daily_counts[date] = daily_counts.get(date, 0) + 1
        
        return jsonify({
            "data": daily_counts,
            "total": len(reports),
            "average_per_day": len(reports) / max(days, 1),
            "days": days,
            "timestamp": datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Daily analytics error: {e}")
        return jsonify({"error": str(e)}), 500


@ollama_internal_bp.route('/analytics/peak-hours', methods=['GET'])
def get_peak_hours():
    """Get peak reporting hours."""
    try:
        days = int(request.args.get('days', 7))
        
        cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
        reports = supabase.table('reports').select('*').gte('created_at', cutoff_date).execute().data or []
        
        # Extract hours
        hourly_counts = {}
        for report in reports:
            timestamp = report.get('created_at', datetime.now().isoformat())
            try:
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                hour = dt.hour
                hourly_counts[hour] = hourly_counts.get(hour, 0) + 1
            except:
                pass
        
        # Find peak hour
        peak_hour = max(hourly_counts.items(), key=lambda x: x[1])[0] if hourly_counts else 12
        
        return jsonify({
            "hourly_data": hourly_counts,
            "peak_hour": peak_hour,
            "peak_count": hourly_counts.get(peak_hour, 0),
            "days": days,
            "timestamp": datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Peak hours error: {e}")
        return jsonify({"error": str(e)}), 500


# ============================================================================
# BARANGAYS ENDPOINTS
# ============================================================================

@ollama_internal_bp.route('/barangays', methods=['GET'])
def get_barangays():
    """Get list of all barangays."""
    try:
        barangays = supabase.table('barangays').select('*').execute().data or []
        
        return jsonify({
            "data": barangays,
            "count": len(barangays),
            "timestamp": datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Barangays error: {e}")
        # Return sample barangays if error
        return jsonify({
            "data": [
                {"id": 1, "name": "Barangay 1"},
                {"id": 2, "name": "Barangay 2"},
                {"id": 3, "name": "Barangay 3"},
            ],
            "timestamp": datetime.now().isoformat()
        }), 200


# ============================================================================
# SYSTEM HEALTH
# ============================================================================

@ollama_internal_bp.route('/health', methods=['GET'])
def health_check():
    """Health check for internal API."""
    return jsonify({
        "status": "healthy",
        "service": "Ollama Internal API",
        "timestamp": datetime.now().isoformat()
    }), 200
