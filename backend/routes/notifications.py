"""
Notifications Blueprint
Handles user notifications and admin notification management
"""
from flask import Blueprint, request, jsonify, stream_with_context, Response
from datetime import datetime, timezone
import time
import json
from middleware.auth import token_required
from utils import supabase

notifications_bp = Blueprint("notifications", __name__)


# User Notifications
@notifications_bp.route("/notifications", methods=["GET"])
@token_required
def get_notifications():
    """Get all notifications for the current user"""
    user_id = request.user_id
    try:
        resp = supabase.table("notifications").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        notifications = getattr(resp, "data", []) or []

        normalized = []
        for n in notifications:
            item = dict(n)
            # Ensure consistent field names for React
            item["read"] = bool(item.get("is_read") or item.get("read"))
            ca = item.get("created_at")
            if hasattr(ca, "isoformat"):
                item["created_at"] = ca.isoformat()
            elif ca is not None:
                item["created_at"] = str(ca)
            normalized.append(item)

        notifications = normalized
    except Exception as e:
        print("Error fetching notifications:", e)
        notifications = []

    return jsonify({
        "status": "success",
        "notifications": notifications
    }), 200


@notifications_bp.route("/notifications/<int:notif_id>/read", methods=["POST"])
@token_required
def mark_notification_read(notif_id):
    """Mark a notification as read"""
    user_id = request.user_id
    try:
        resp = supabase.table("notifications").update({"is_read": True}).eq("id", notif_id).eq("user_id", user_id).execute()
        updated = getattr(resp, "data", []) or []
        updated_row = updated[0] if updated else None
        return jsonify({"status": "success", "notification": updated_row}), 200
    except Exception as e:
        print(f"Error marking notification read: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@notifications_bp.route("/notifications/<int:notif_id>", methods=["DELETE"])
@token_required
def delete_notification(notif_id):
    """Delete a notification"""
    user_id = request.user_id
    try:
        resp = supabase.table("notifications").delete().eq("id", notif_id).eq("user_id", user_id).execute()
        deleted = getattr(resp, "data", []) or []
        return jsonify({"status": "success", "deleted": deleted}), 200
    except Exception as e:
        print(f"Error deleting notification: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@notifications_bp.route("/notifications/read_all", methods=["POST"])
@token_required
def mark_all_notifications_read():
    """Mark all notifications as read for current user"""
    user_id = request.user_id
    try:
        resp = supabase.table("notifications").update({"is_read": True}).eq("user_id", user_id).execute()
        updated = getattr(resp, "data", []) or []
        return jsonify({"status": "success", "updated_count": len(updated)}), 200
    except Exception as e:
        print(f"Error marking all notifications read: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# Admin Notifications
@notifications_bp.route("/admin/notifications", methods=["GET"])
@token_required
def admin_get_all_notifications():
    """
    Admin-only endpoint: return all notifications across the system
    enriched with recipient (user) basic info for display in the admin UI
    """
    # Check admin role
    try:
        current_user_resp = supabase.table("users").select("role").eq("id", request.user_id).single().execute()
        current_user = current_user_resp.data if current_user_resp.data else {}
        if current_user.get("role") != "Admin":
            return jsonify({"status": "error", "message": "Admin access required"}), 403

        # Fetch user-facing notifications
        resp = supabase.table("notifications").select("*").order("created_at", desc=True).execute()
        notifications = getattr(resp, "data", []) or []

        # Fetch admin-only notifications (may not exist if migration not applied)
        admin_notifications = []
        try:
            resp_admin = supabase.table("admin_notifications").select("*").order("created_at", desc=True).execute()
            admin_notifications = getattr(resp_admin, "data", []) or []
        except Exception as e:
            print(f"⚠️ admin_notifications table may not exist or query failed: {e}")

        # Collect user_ids and actor_ids to batch fetch user info
        user_ids = set()
        actor_ids = set()
        for n in notifications:
            if n.get("user_id"):
                user_ids.add(n.get("user_id"))
        for a in admin_notifications:
            if a.get("user_id"):
                user_ids.add(a.get("user_id"))
            if a.get("actor_id"):
                actor_ids.add(a.get("actor_id"))

        all_user_ids = list({str(x) for x in list(user_ids | actor_ids) if x})
        users_map = {}
        if all_user_ids:
            users_resp = supabase.table("users").select("id, firstname, lastname, email, role").in_("id", all_user_ids).execute()
            users = getattr(users_resp, "data", []) or []
            for u in users:
                users_map[str(u.get("id"))] = {
                    "id": u.get("id"),
                    "firstname": u.get("firstname"),
                    "lastname": u.get("lastname"),
                    "email": u.get("email"),
                    "role": u.get("role"),
                }

        enriched = []
        for n in notifications:
            item = dict(n)
            recipient = users_map.get(str(item.get("user_id"))) if item.get("user_id") else None
            item["recipient"] = recipient
            # normalize created_at to ISO if needed
            ca = item.get("created_at")
            if hasattr(ca, "isoformat"):
                item["created_at"] = ca.isoformat()
            elif ca is not None:
                item["created_at"] = str(ca)
            enriched.append(item)

        enriched_admin = []
        for a in admin_notifications:
            item = dict(a)
            # Attach recipient and actor info if available
            recipient = users_map.get(str(item.get("user_id"))) if item.get("user_id") else None
            actor = users_map.get(str(item.get("actor_id"))) if item.get("actor_id") else None
            item["recipient"] = recipient
            item["actor"] = actor
            # normalize created_at
            ca = item.get("created_at")
            if hasattr(ca, "isoformat"):
                item["created_at"] = ca.isoformat()
            elif ca is not None:
                item["created_at"] = str(ca)
            enriched_admin.append(item)

        return jsonify({"status": "success", "notifications": enriched, "admin_notifications": enriched_admin}), 200
    except Exception as e:
        print(f"Error in admin_get_all_notifications: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@notifications_bp.route("/admin/admin_notifications", methods=["GET"])
@token_required
def admin_get_admin_notifications():
    """
    Admin-only endpoint returning only admin_notifications enriched with actor and recipient info
    """
    try:
        # Verify admin-type role (Admin, Barangay Official, or Responder)
        current_user_resp = supabase.table("users").select("role").eq("id", request.user_id).single().execute()
        current_user = current_user_resp.data if current_user_resp.data else {}
        allowed_roles = ("Admin", "Barangay Official", "Responder")
        if current_user.get("role") not in allowed_roles:
            return jsonify({"status": "error", "message": "Admin access required"}), 403

        # Fetch admin notifications (gracefully handle if table doesn't exist)
        admin_notifications = []
        try:
            resp_admin = supabase.table("admin_notifications").select("*").order("created_at", desc=True).execute()
            admin_notifications = getattr(resp_admin, "data", []) or []
        except Exception as table_e:
            print(f"⚠️ admin_notifications table may not exist: {table_e}")
            return jsonify({"status": "success", "admin_notifications": []}), 200

        # Collect user_ids and actor_ids for batch fetch
        user_ids = set()
        actor_ids = set()
        for a in admin_notifications:
            if a.get("user_id"):
                user_ids.add(a.get("user_id"))
            if a.get("actor_id"):
                actor_ids.add(a.get("actor_id"))

        # Batch fetch user info
        all_user_ids = list({str(x) for x in list(user_ids | actor_ids) if x})
        users_map = {}
        if all_user_ids:
            users_resp = supabase.table("users").select("id, firstname, lastname, email, role").in_("id", all_user_ids).execute()
            users = getattr(users_resp, "data", []) or []
            for u in users:
                users_map[str(u.get("id"))] = {
                    "id": u.get("id"),
                    "firstname": u.get("firstname"),
                    "lastname": u.get("lastname"),
                    "email": u.get("email"),
                    "role": u.get("role"),
                }

        # Enrich notifications with user info
        enriched_admin = []
        for a in admin_notifications:
            item = dict(a)
            recipient = users_map.get(str(item.get("user_id"))) if item.get("user_id") else None
            actor = users_map.get(str(item.get("actor_id"))) if item.get("actor_id") else None
            item["recipient"] = recipient
            item["actor"] = actor
            # Normalize created_at to ISO format
            ca = item.get("created_at")
            if hasattr(ca, "isoformat"):
                item["created_at"] = ca.isoformat()
            elif ca is not None:
                item["created_at"] = str(ca)
            enriched_admin.append(item)

        return jsonify({"status": "success", "admin_notifications": enriched_admin}), 200
    except Exception as e:
        print(f"Error in admin_get_admin_notifications: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@notifications_bp.route("/admin/admin_notifications/<int:notif_id>/read", methods=["POST"])
@token_required
def admin_mark_notification_read(notif_id):
    """
    Mark a single admin notification as read (admin-only)
    """
    try:
        # Verify admin role
        current_user_resp = supabase.table("users").select("role").eq("id", request.user_id).single().execute()
        current_user = current_user_resp.data if current_user_resp.data else {}
        if current_user.get("role") != "Admin":
            return jsonify({"status": "error", "message": "Admin access required"}), 403

        # Update admin notification
        resp = supabase.table("admin_notifications").update({"is_read": True}).eq("id", notif_id).execute()
        updated = getattr(resp, "data", []) or []
        updated_row = updated[0] if updated else None

        if updated_row:
            return jsonify({"status": "success", "notification": updated_row}), 200
        else:
            return jsonify({"status": "error", "message": "Notification not found"}), 404
    except Exception as e:
        print(f"Error marking admin notification read: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@notifications_bp.route("/admin/admin_notifications/read_all", methods=["POST"])
@token_required
def admin_mark_all_notifications_read():
    """
    Mark all admin notifications as read (admin-only)
    """
    try:
        # Verify admin role
        current_user_resp = supabase.table("users").select("role").eq("id", request.user_id).single().execute()
        current_user = current_user_resp.data if current_user_resp.data else {}
        if current_user.get("role") != "Admin":
            return jsonify({"status": "error", "message": "Admin access required"}), 403

        # Mark all unread admin notifications as read
        resp = supabase.table("admin_notifications").update({"is_read": True}).eq("is_read", False).execute()
        updated = getattr(resp, "data", []) or []

        return jsonify({"status": "success", "updated_count": len(updated)}), 200
    except Exception as e:
        print(f"Error marking all admin notifications read: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@notifications_bp.route("/admin/admin_notifications/<int:notif_id>", methods=["DELETE"])
@token_required
def admin_delete_notification(notif_id):
    """
    Delete an admin notification (admin-only)
    """
    try:
        # Verify admin role
        current_user_resp = supabase.table("users").select("role").eq("id", request.user_id).single().execute()
        current_user = current_user_resp.data if current_user_resp.data else {}
        if current_user.get("role") != "Admin":
            return jsonify({"status": "error", "message": "Admin access required"}), 403

        # Delete the notification
        resp = supabase.table("admin_notifications").delete().eq("id", notif_id).execute()
        deleted = getattr(resp, "data", []) or []

        return jsonify({"status": "success", "deleted_count": len(deleted), "deleted": deleted[0] if deleted else None}), 200
    except Exception as e:
        print(f"Error deleting admin notification: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# Barangay Official Notifications
@notifications_bp.route("/barangay/notifications", methods=["GET"])
@token_required
def barangay_get_notifications():
    """
    Barangay Official-only endpoint: Get notifications related to their barangay
    Filters notifications for the current user about reports in their barangay
    """
    user_id = request.user_id
    
    try:
        # Verify that the user is a Barangay Official
        current_user_resp = supabase.table("users").select("role, id").eq("id", user_id).single().execute()
        current_user = current_user_resp.data if current_user_resp.data else {}
        
        if current_user.get("role") != "Barangay Official":
            return jsonify({"status": "error", "message": "Barangay Official access required"}), 403
        
        # Fetch barangay from info table
        info_resp = supabase.table("info").select("address_barangay").eq("user_id", user_id).single().execute()
        info_data = info_resp.data if info_resp.data else {}
        user_barangay = info_data.get("address_barangay")
        
        # Fetch all notifications for this user
        resp = supabase.table("notifications").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        notifications = getattr(resp, "data", []) or []
        
        # If we have a barangay, filter to show only relevant notifications
        # (notifications about reports in their barangay)
        if user_barangay:
            # Get report IDs from notifications
            report_ids = [n.get("report_id") for n in notifications if n.get("report_id")]
            
            barangay_reports = []
            if report_ids:
                # Fetch reports to check their barangay
                reports_resp = supabase.table("reports").select("id, address_barangay").in_("id", report_ids).execute()
                reports = getattr(reports_resp, "data", []) or []
                barangay_reports = [r.get("id") for r in reports if r.get("address_barangay") == user_barangay]
            
            # Filter notifications to only those related to their barangay reports
            notifications = [n for n in notifications if n.get("report_id") in barangay_reports or not n.get("report_id")]
        
        # Normalize created_at timestamps
        normalized = []
        for n in notifications:
            item = dict(n)
            item["read"] = bool(item.get("is_read") or item.get("read"))
            ca = item.get("created_at")
            if hasattr(ca, "isoformat"):
                item["created_at"] = ca.isoformat()
            elif ca is not None:
                item["created_at"] = str(ca)
            normalized.append(item)
        
        return jsonify({
            "status": "success",
            "notifications": normalized,
            "barangay": user_barangay
        }), 200
    
    except Exception as e:
        print(f"Error in barangay_get_notifications: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@notifications_bp.route("/barangay/notifications/<int:notif_id>/read", methods=["POST"])
@token_required
def barangay_mark_notification_read(notif_id):
    """
    Mark a barangay notification as read (barangay official only)
    """
    user_id = request.user_id
    
    try:
        # Verify barangay official role
        current_user_resp = supabase.table("users").select("role").eq("id", user_id).single().execute()
        current_user = current_user_resp.data if current_user_resp.data else {}
        
        if current_user.get("role") != "Barangay Official":
            return jsonify({"status": "error", "message": "Barangay Official access required"}), 403
        
        # Update notification (verify it belongs to this user)
        resp = supabase.table("notifications").update({"is_read": True}).eq("id", notif_id).eq("user_id", user_id).execute()
        updated = getattr(resp, "data", []) or []
        updated_row = updated[0] if updated else None
        
        if updated_row:
            return jsonify({"status": "success", "notification": updated_row}), 200
        else:
            return jsonify({"status": "error", "message": "Notification not found"}), 404
    
    except Exception as e:
        print(f"Error marking barangay notification read: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@notifications_bp.route("/barangay/notifications/read_all", methods=["POST"])
@token_required
def barangay_mark_all_notifications_read():
    """
    Mark all barangay notifications as read (barangay official only)
    """
    user_id = request.user_id
    
    try:
        # Verify barangay official role
        current_user_resp = supabase.table("users").select("role").eq("id", user_id).single().execute()
        current_user = current_user_resp.data if current_user_resp.data else {}
        
        if current_user.get("role") != "Barangay Official":
            return jsonify({"status": "error", "message": "Barangay Official access required"}), 403
        
        # Mark all notifications for this user as read
        resp = supabase.table("notifications").update({"is_read": True}).eq("user_id", user_id).eq("is_read", False).execute()
        updated = getattr(resp, "data", []) or []
        
        return jsonify({"status": "success", "updated_count": len(updated)}), 200
    
    except Exception as e:
        print(f"Error marking all barangay notifications read: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@notifications_bp.route("/barangay/notifications/<int:notif_id>", methods=["DELETE"])
@token_required
def barangay_delete_notification(notif_id):
    """
    Delete a barangay notification (barangay official only)
    """
    user_id = request.user_id
    
    try:
        # Verify barangay official role
        current_user_resp = supabase.table("users").select("role").eq("id", user_id).single().execute()
        current_user = current_user_resp.data if current_user_resp.data else {}
        
        if current_user.get("role") != "Barangay Official":
            return jsonify({"status": "error", "message": "Barangay Official access required"}), 403
        
        # Delete the notification (verify it belongs to this user)
        resp = supabase.table("notifications").delete().eq("id", notif_id).eq("user_id", user_id).execute()
        deleted = getattr(resp, "data", []) or []
        
        return jsonify({"status": "success", "deleted_count": len(deleted), "deleted": deleted[0] if deleted else None}), 200
    
    except Exception as e:
        print(f"Error deleting barangay notification: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ========== SERVER-SENT EVENTS (SSE) ENDPOINTS ==========

def get_user_notifications(user_id, role):
    """Helper function to fetch notifications based on role"""
    try:
        if role == "Admin":
            resp = supabase.table("admin_notifications").select("*").eq("admin_id", user_id).order("created_at", desc=True).execute()
            notifications = getattr(resp, "data", []) or []
            # Normalize field names
            for n in notifications:
                n["is_read"] = bool(n.get("is_read", False))
                n["id"] = n.get("id") or n.get("notification_id")
        else:
            resp = supabase.table("notifications").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
            notifications = getattr(resp, "data", []) or []
            for n in notifications:
                n["is_read"] = bool(n.get("is_read", False))
        
        return notifications
    except Exception as e:
        print(f"Error fetching notifications for SSE: {e}")
        return []




# Responder Notifications
@notifications_bp.route("/responder/notifications", methods=["GET"])
@token_required
def responder_get_notifications():
    """
    Responder-only endpoint: Get notifications for responder
    Fetches all notifications for the current responder user
    """
    user_id = request.user_id
    
    try:
        # Verify that the user is a Responder
        current_user_resp = supabase.table("users").select("role, id").eq("id", user_id).single().execute()
        current_user = current_user_resp.data if current_user_resp.data else {}
        
        if current_user.get("role") != "Responder":
            return jsonify({"status": "error", "message": "Responder access required"}), 403
        
        # Fetch all notifications for this responder
        resp = supabase.table("notifications").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        notifications = getattr(resp, "data", []) or []
        
        # Normalize created_at timestamps
        normalized = []
        for n in notifications:
            item = dict(n)
            item["read"] = bool(item.get("is_read") or item.get("read"))
            ca = item.get("created_at")
            if hasattr(ca, "isoformat"):
                item["created_at"] = ca.isoformat()
            elif ca is not None:
                item["created_at"] = str(ca)
            normalized.append(item)
        
        return jsonify({
            "status": "success",
            "notifications": normalized
        }), 200
    
    except Exception as e:
        print(f"Error in responder_get_notifications: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@notifications_bp.route("/responder/notifications/<int:notif_id>/read", methods=["POST"])
@token_required
def responder_mark_notification_read(notif_id):
    """
    Mark a responder notification as read (responder only)
    """
    user_id = request.user_id
    
    try:
        # Verify responder role
        current_user_resp = supabase.table("users").select("role").eq("id", user_id).single().execute()
        current_user = current_user_resp.data if current_user_resp.data else {}
        
        if current_user.get("role") != "Responder":
            return jsonify({"status": "error", "message": "Responder access required"}), 403
        
        # Update notification
        updated = supabase.table("notifications").update({"is_read": True}).eq("id", notif_id).execute()
        
        if updated.data:
            return jsonify({
                "status": "success",
                "notification": updated.data[0] if updated.data else {}
            }), 200
        else:
            return jsonify({"status": "error", "message": "Notification not found"}), 404
    
    except Exception as e:
        print(f"Error in responder_mark_notification_read: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@notifications_bp.route("/responder/notifications/read_all", methods=["POST"])
@token_required
def responder_mark_all_read():
    """
    Mark all responder notifications as read (responder only)
    """
    user_id = request.user_id
    
    try:
        # Verify responder role
        current_user_resp = supabase.table("users").select("role").eq("id", user_id).single().execute()
        current_user = current_user_resp.data if current_user_resp.data else {}
        
        if current_user.get("role") != "Responder":
            return jsonify({"status": "error", "message": "Responder access required"}), 403
        
        # Get unread notifications for this responder
        resp = supabase.table("notifications").select("id").eq("user_id", user_id).eq("is_read", False).execute()
        unread_ids = [n["id"] for n in (getattr(resp, "data", []) or [])]
        
        if unread_ids:
            updated = supabase.table("notifications").update({"is_read": True}).in_("id", unread_ids).execute()
            count = len(updated.data) if updated.data else 0
        else:
            count = 0
        
        return jsonify({
            "status": "success",
            "updated_count": count
        }), 200
    
    except Exception as e:
        print(f"Error in responder_mark_all_read: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@notifications_bp.route("/responder/notifications/<int:notif_id>", methods=["DELETE"])
@token_required
def responder_delete_notification(notif_id):
    """
    Delete a responder notification (responder only)
    """
    user_id = request.user_id
    
    try:
        # Verify responder role
        current_user_resp = supabase.table("users").select("role").eq("id", user_id).single().execute()
        current_user = current_user_resp.data if current_user_resp.data else {}
        
        if current_user.get("role") != "Responder":
            return jsonify({"status": "error", "message": "Responder access required"}), 403
        
        # Delete notification
        supabase.table("notifications").delete().eq("id", notif_id).eq("user_id", user_id).execute()
        
        return jsonify({
            "status": "success",
            "message": "Notification deleted successfully"
        }), 200
    
    except Exception as e:
        print(f"Error in responder_delete_notification: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@notifications_bp.route("/notifications/stream", methods=["GET"])
@token_required
def notifications_stream():
    """
    Server-Sent Events (SSE) endpoint for real-time notifications
    Streams notification updates to client without repeated polling
    """
    user_id = request.user_id
    role = request.headers.get("X-User-Role", "")  # Client sends role in header
    
    # Get initial notifications
    initial_notifications = get_user_notifications(user_id, role)
    last_count = len(initial_notifications)
    last_unread_count = len([n for n in initial_notifications if not n.get("is_read", False)])
    
    def event_stream():
        try:
            # Send initial data
            yield f"data: {json.dumps({'type': 'initial', 'notifications': initial_notifications, 'unread_count': last_unread_count})}\n\n"
            
            # Keep connection open and check for new notifications every 5 seconds
            while True:
                time.sleep(5)
                
                # Fetch current notifications
                current_notifications = get_user_notifications(user_id, role)
                current_count = len(current_notifications)
                current_unread_count = len([n for n in current_notifications if not n.get("is_read", False)])
                
                # Only send update if count changed
                if current_count != last_count or current_unread_count != last_unread_count:
                    yield f"data: {json.dumps({'type': 'update', 'notifications': current_notifications, 'unread_count': current_unread_count})}\n\n"
                    last_count = current_count
                    last_unread_count = current_unread_count
                else:
                    # Send heartbeat to keep connection alive (no data, just connection check)
                    yield f": heartbeat\n\n"
                    
        except GeneratorExit:
            print(f"Client {user_id} disconnected from SSE stream")
        except Exception as e:
            print(f"SSE Error for user {user_id}: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    
    return Response(
        stream_with_context(event_stream()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive"
        }
    )


# =============================================================================
# EMERGENCY ALERT SYSTEM
# =============================================================================

def create_emergency_alert_for_barangay(report_data, barangay):
    """
    Create emergency alert notifications for all users in a specific barangay.
    
    Args:
        report_data: dict containing report info (id, title, category, description, priority)
        barangay: The barangay to notify (address_barangay)
    
    Returns:
        dict: Result with count of users notified
    """
    if not barangay or barangay == "No barangay selected":
        return {"status": "skipped", "message": "No valid barangay provided", "notified_count": 0}
    
    try:
        # Find all users in this barangay
        info_resp = supabase.table("info").select("user_id").eq("address_barangay", barangay).execute()
        barangay_users = getattr(info_resp, "data", []) or []
        
        if not barangay_users:
            return {"status": "success", "message": "No users in barangay", "notified_count": 0}
        
        user_ids = [u.get("user_id") for u in barangay_users if u.get("user_id")]
        
        # Get the reporter's user_id to exclude them from notifications
        reporter_id = report_data.get("user_id") or report_data.get("reporter_id")
        
        # Filter out the reporter
        user_ids = [uid for uid in user_ids if str(uid) != str(reporter_id)]
        
        if not user_ids:
            return {"status": "success", "message": "No other users to notify", "notified_count": 0}
        
        # Determine alert level and message based on category/priority
        category = report_data.get("category", "Others")
        priority = report_data.get("priority", "Medium")
        title = report_data.get("title", "Untitled Report")
        
        # Emergency alert styling based on priority
        alert_type = "emergency_alert"
        if priority in ["Critical", "High"] or category in ["Crime", "Hazard", "Fire", "Accident"]:
            alert_type = "urgent_emergency"
            alert_title = f"🚨 EMERGENCY ALERT: {category}"
            alert_message = f"A {priority} priority {category} incident has been reported in {barangay}: '{title}'. Stay alert and take necessary precautions."
        else:
            alert_title = f"📢 Community Alert: {category}"
            alert_message = f"A new {category} report has been submitted in {barangay}: '{title}'. Stay informed about your community."
        
        # Create notifications for all users in the barangay
        notifications_to_insert = []
        for uid in user_ids:
            notifications_to_insert.append({
                "user_id": uid,
                "title": alert_title,
                "message": alert_message,
                "type": alert_type,
                "report_id": report_data.get("id"),
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        # Batch insert notifications
        if notifications_to_insert:
            supabase.table("notifications").insert(notifications_to_insert).execute()
        
        print(f"🚨 Emergency Alert: Notified {len(notifications_to_insert)} users in {barangay}")
        
        return {
            "status": "success",
            "message": f"Emergency alert sent to {len(notifications_to_insert)} users",
            "notified_count": len(notifications_to_insert),
            "barangay": barangay,
            "alert_type": alert_type
        }
        
    except Exception as e:
        print(f"❌ Error creating emergency alerts: {e}")
        return {"status": "error", "message": str(e), "notified_count": 0}


def create_admin_emergency_alert(report_data):
    """
    Create emergency alert for all admins (no barangay filtering).
    Admins receive all emergency alerts regardless of location.
    
    Args:
        report_data: dict containing report info
    
    Returns:
        dict: Result with count of admins notified
    """
    try:
        # Find all admins
        admin_resp = supabase.table("users").select("id").eq("role", "Admin").execute()
        admins = getattr(admin_resp, "data", []) or []
        
        if not admins:
            return {"status": "success", "message": "No admins to notify", "notified_count": 0}
        
        admin_ids = [a.get("id") for a in admins if a.get("id")]
        
        category = report_data.get("category", "Others")
        priority = report_data.get("priority", "Medium")
        title = report_data.get("title", "Untitled Report")
        barangay = report_data.get("address_barangay") or report_data.get("barangay") or "Unknown"
        
        # All admin alerts are treated as high priority
        alert_title = f"🚨 NEW REPORT: {category} in {barangay}"
        alert_message = f"Priority: {priority} | '{title}' reported in {barangay}. Immediate review recommended."
        
        # Create admin notifications
        admin_notifications = []
        for admin_id in admin_ids:
            admin_notifications.append({
                "user_id": admin_id,
                "actor_id": report_data.get("user_id"),
                "report_id": report_data.get("id"),
                "title": alert_title,
                "message": alert_message,
                "type": "emergency_report",
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        # Insert into admin_notifications table
        if admin_notifications:
            try:
                supabase.table("admin_notifications").insert(admin_notifications).execute()
            except Exception as e:
                print(f"⚠️ admin_notifications insert failed, trying notifications table: {e}")
                # Fallback to regular notifications table
                for notif in admin_notifications:
                    del notif["actor_id"]  # Remove actor_id for regular notifications table
                supabase.table("notifications").insert(admin_notifications).execute()
        
        print(f"🚨 Admin Alert: Notified {len(admin_notifications)} admins about report in {barangay}")
        
        return {
            "status": "success",
            "message": f"Admin alert sent to {len(admin_notifications)} admins",
            "notified_count": len(admin_notifications)
        }
        
    except Exception as e:
        print(f"❌ Error creating admin emergency alerts: {e}")
        return {"status": "error", "message": str(e), "notified_count": 0}


def trigger_emergency_alerts(report_data):
    """
    Main function to trigger emergency alerts for a new report.
    
    1. Notifies all users in the same barangay as the report
    2. Notifies all admins (regardless of barangay)
    
    Args:
        report_data: dict containing report info
    
    Returns:
        dict: Combined result of all notifications
    """
    barangay = report_data.get("address_barangay") or report_data.get("barangay")
    
    results = {
        "barangay_alerts": None,
        "admin_alerts": None,
        "total_notified": 0
    }
    
    # 1. Notify users in the same barangay
    if barangay and barangay != "No barangay selected":
        results["barangay_alerts"] = create_emergency_alert_for_barangay(report_data, barangay)
        results["total_notified"] += results["barangay_alerts"].get("notified_count", 0)
    
    # 2. Notify all admins (no barangay filtering)
    results["admin_alerts"] = create_admin_emergency_alert(report_data)
    results["total_notified"] += results["admin_alerts"].get("notified_count", 0)
    
    print(f"🔔 Emergency Alerts Complete: {results['total_notified']} total notifications sent")
    
    return results


@notifications_bp.route("/emergency-alerts/trigger", methods=["POST"])
@token_required
def trigger_emergency_alert_endpoint():
    """
    Manual endpoint to trigger emergency alerts for a report.
    Only accessible by Admin, Barangay Official, or the report creator.
    """
    user_id = request.user_id
    
    try:
        data = request.get_json() or {}
        report_id = data.get("report_id")
        
        if not report_id:
            return jsonify({"status": "error", "message": "report_id is required"}), 400
        
        # Fetch the report
        report_resp = supabase.table("reports").select("*").eq("id", report_id).single().execute()
        report = getattr(report_resp, "data", None)
        
        if not report:
            return jsonify({"status": "error", "message": "Report not found"}), 404
        
        # Check authorization
        user_resp = supabase.table("users").select("role").eq("id", user_id).single().execute()
        user_role = getattr(user_resp, "data", {}).get("role", "Resident")
        
        # Allow report creator, admins, or barangay officials
        if str(report.get("user_id")) != str(user_id) and user_role not in ["Admin", "Barangay Official"]:
            return jsonify({"status": "error", "message": "Unauthorized"}), 403
        
        # Trigger emergency alerts
        results = trigger_emergency_alerts(report)
        
        return jsonify({
            "status": "success",
            "message": f"Emergency alerts sent to {results['total_notified']} users",
            "results": results
        }), 200
        
    except Exception as e:
        print(f"Error in trigger_emergency_alert_endpoint: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
