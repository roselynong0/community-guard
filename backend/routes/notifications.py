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


@notifications_bp.route("/notifications/new-reports", methods=["GET"])
@token_required
def get_new_approved_reports():
    """Get new approved reports posted in the user's barangay (for polling)"""
    user_id = request.user_id
    try:
        # Get user's barangay from info table
        user_info_resp = supabase.table("info").select("address_barangay").eq("user_id", user_id).single().execute()
        user_info = getattr(user_info_resp, "data", None)
        
        if not user_info or not user_info.get("address_barangay"):
            print(f"⚠️ User {user_id} has no barangay info")
            return jsonify({
                "status": "success",
                "new_reports": []
            }), 200
        
        user_barangay = user_info.get("address_barangay")
        
        # Get the user's last check timestamp from query params (optional)
        last_check = request.args.get("last_check")
        
        # Fetch approved reports in the user's barangay
        query = supabase.table("reports").select(
            "id, title, created_at, user_id, address_barangay, is_approved"
        ).eq("address_barangay", user_barangay).eq("is_approved", True).is_("deleted_at", None).order("created_at", desc=True)
        
        if last_check:
            # Only get reports created after the last check time
            query = query.gt("created_at", last_check)
        
        # Limit to last 10 new reports
        reports_resp = query.execute()
        new_reports = getattr(reports_resp, "data", []) or []
        
        # Filter out reports created by the current user
        new_reports = [r for r in new_reports if str(r.get("user_id")) != str(user_id)]
        
        # Check if there are corresponding notifications marked as read
        for report in new_reports:
            report_id = report.get("id")
            try:
                notif_resp = supabase.table("notifications").select("id, is_read").eq("report_id", report_id).eq("user_id", user_id).execute()
                notif_data = getattr(notif_resp, "data", []) or []
                # If there's a notification and it's marked as read, flag the report
                if notif_data and notif_data[0].get("is_read"):
                    report["is_read"] = True
                else:
                    report["is_read"] = False
            except Exception as e:
                print(f"⚠️ Error checking notification status for report {report_id}: {e}")
                report["is_read"] = False
        
        print(f"✅ Found {len(new_reports)} new approved reports in {user_barangay}")
        
        return jsonify({
            "status": "success",
            "new_reports": new_reports
        }), 200
        
    except Exception as e:
        print(f"Error fetching new reports: {e}")
        return jsonify({
            "status": "error",
            "message": str(e),
            "new_reports": []
        }), 500

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
