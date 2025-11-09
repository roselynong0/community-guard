"""
Notifications Blueprint
Handles user notifications and admin notification management
"""
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
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
        # Verify admin role
        current_user_resp = supabase.table("users").select("role").eq("id", request.user_id).single().execute()
        current_user = current_user_resp.data if current_user_resp.data else {}
        if current_user.get("role") != "Admin":
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
        current_user_resp = supabase.table("users").select("role, barangay").eq("id", user_id).single().execute()
        current_user = current_user_resp.data if current_user_resp.data else {}
        
        if current_user.get("role") != "Barangay Official":
            return jsonify({"status": "error", "message": "Barangay Official access required"}), 403
        
        user_barangay = current_user.get("barangay")
        
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
