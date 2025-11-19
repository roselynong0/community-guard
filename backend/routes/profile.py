"""
Profile Routes
Handles user profile operations (GET, UPDATE, DELETE, avatar upload)
"""
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
import traceback
import base64

from utils import supabase, supabase_retry, with_default
from middleware import token_required

profile_bp = Blueprint('profile', __name__)


# Import notification helper (will be defined in notifications routes)
def create_admin_notification(actor_id, user_id=None, report_id=None, title=None, type_label="Admin Alert", message=None, notification_id=None):
    """Helper function to create admin notifications"""
    try:
        payload = {
            "actor_id": actor_id,
            "user_id": user_id,
            "notification_id": notification_id,
            "report_id": report_id,
            "type": type_label,
            "title": title,
            "message": message or "",
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        res = supabase.table("admin_notifications").insert(payload).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        print(f"❌ create_admin_notification error: {e}")
        return None


@profile_bp.route("/profile", methods=["GET", "OPTIONS"])
@token_required
def get_profile():
    """Get user profile"""
    user_id = request.user_id
    if request.method == "OPTIONS":
        return jsonify({}), 200
    try:
        # Prefer the user row attached by token_required middleware, if available
        user = getattr(request, 'user_record', None)
        if not user:
            # Fallback to querying the users table
            def fetch_user():
                return supabase.table("users").select(
                    "id, firstname, lastname, email, isverified, avatar_url, role, deleted_at"
                ).eq("id", user_id).is_("deleted_at", "null").execute()

            user_resp = supabase_retry(fetch_user)
            if not getattr(user_resp, 'data', None):
                return jsonify({"status": "not_found", "message": "User not found or deleted"}), 404

            user = user_resp.data[0]

        # Fetch user info as before
        def fetch_info():
            return supabase.table("info").select(
                "user_id, verified, bio, phone, address_street, "
                "address_barangay, address_province, address_city, birthdate"
            ).eq("user_id", user_id).execute()

        info_resp = supabase_retry(fetch_info)
        info = info_resp.data[0] if info_resp.data else {}

        profile = {
            "id": user.get("id"),
            "firstname": with_default(user.get("firstname"), "No name added yet"),
            "lastname": with_default(user.get("lastname"), ""),
            "email": with_default(user.get("email"), "No email added yet"),
            "isverified": user.get("isverified", False),
            "verified": info.get("verified", False),
            "label": "Verified" if user.get("isverified", False) else "Unverified",
            "role": with_default(user.get("role"), "Resident"),
            "avatar_url": with_default(user.get("avatar_url"), "/default-avatar.png"),
            "bio": with_default(info.get("bio"), "No information added yet"),
            "phone": with_default(info.get("phone"), "No contact info yet"),
            "address_street": with_default(info.get("address_street"), "No location"),
            "address_barangay": with_default(info.get("address_barangay"), "No barangay selected"),
            "address_province": with_default(info.get("address_province"), "Zambales"),
            "address_city": with_default(info.get("address_city"), "Olongapo"),
            "birthdate": with_default(info.get("birthdate"), "")
        }

        return jsonify({"status": "success", "profile": profile}), 200

    except Exception as e:
        print(f"❌ Error in /api/profile for user {user_id}: {e}")
        print(f"Error type: {type(e).__name__}")
        return jsonify({"status": "error", "message": "Failed to fetch profile"}), 500


@profile_bp.route("/profile", methods=["PUT", "OPTIONS"])
@token_required
def update_profile():
    """Update user profile"""
    user_id = request.user_id
    data = request.json or {}

    try:
        updated_user = {}
        updated_info = {}

        # Header modal updates
        if any(k in data for k in ["firstname", "lastname", "address_barangay", "address_city"]):
            if "firstname" in data:
                updated_user["firstname"] = data["firstname"]
            if "lastname" in data:
                updated_user["lastname"] = data["lastname"]
            if "address_barangay" in data:
                updated_info["address_barangay"] = data["address_barangay"]
            if "address_city" in data:
                updated_info["address_city"] = data["address_city"]

        # About modal
        if "bio" in data:
            updated_info["bio"] = data["bio"]

        # Personal modal
        if "email" in data:
            updated_user["email"] = data["email"]
        if "phone" in data:
            phone = data["phone"]
            updated_info["phone"] = phone if phone and phone.isdigit() and len(phone) == 11 else None
        if "address_street" in data:
            updated_info["address_street"] = data["address_street"]
        if "birthdate" in data:
            updated_info["birthdate"] = data["birthdate"]

        # Execute updates with retry
        if updated_user:
            def update_user():
                return supabase.table("users").update(updated_user).eq("id", user_id).execute()
            supabase_retry(update_user)

        if updated_info:
            updated_info["user_id"] = user_id
            def update_info():
                return supabase.table("info").upsert(updated_info, on_conflict=["user_id"]).execute()
            supabase_retry(update_info)

        # Fetch updated profile
        def fetch_updated_user():
            return supabase.table("users").select("*").eq("id", user_id).execute()

        def fetch_updated_info():
            return supabase.table("info").select(
                "user_id, verified, bio, phone, address_street, "
                "address_barangay, address_province, address_city, birthdate"
            ).eq("user_id", user_id).execute()

        user_resp = supabase_retry(fetch_updated_user)
        info_resp = supabase_retry(fetch_updated_info)
        user = user_resp.data[0] if user_resp.data else {}
        info = info_resp.data[0] if info_resp.data else {}

        profile = {
            "id": user.get("id"),
            "firstname": user.get("firstname") or "No name added yet",
            "lastname": user.get("lastname") or "",
            "email": user.get("email") or "No email added yet",
            "isverified": user.get("isverified", False),
            "label": "Verified" if user.get("isverified", False) else "Unverified",
            "avatar_url": user.get("avatar_url") or "/default-avatar.png",
            "bio": info.get("bio") or "No information added yet",
            "phone": info.get("phone") or "No contact info yet",
            "address_street": info.get("address_street") or "No location",
            "address_barangay": info.get("address_barangay") or "No barangay selected",
            "address_city": info.get("address_city") or "Olongapo",
            "address_province": info.get("address_province") or "Zambales",
            "birthdate": info.get("birthdate") or ""
        }

        return jsonify({"status": "success", "profile": profile}), 200

    except Exception as e:
        print("update_profile error:", traceback.format_exc())
        return jsonify({"status": "error", "message": str(e)}), 500


@profile_bp.route("/profile", methods=["DELETE", "OPTIONS"])
@token_required
def delete_profile():
    """Soft delete user profile"""
    user_id = request.user_id
    try:
        now = datetime.now(timezone.utc).isoformat()

        # Helper to create notification
        def create_notification(user_id, title, message, notif_type="Alert"):
            try:
                supabase.table("notifications").insert({
                    "user_id": user_id,
                    "title": title,
                    "message": message,
                    "type": notif_type,
                    "is_read": False,
                    "created_at": now
                }).execute()
            except Exception as e:
                print("Failed to create notification:", e)

        # Fetch user info
        try:
            user_resp = supabase.table("users").select("firstname,lastname,email").eq("id", user_id).execute()
            user_rows = getattr(user_resp, "data", []) or []
            user_info = user_rows[0] if user_rows else {}
        except Exception:
            user_info = {}

        # Perform soft-delete
        try:
            supabase.table("users").update({"deleted_at": now}).eq("id", user_id).execute()
        except Exception as e:
            print(f"⚠️ Failed to soft-delete user {user_id}: {e}")
        try:
            supabase.table("posts").delete().eq("user_id", user_id).execute()
        except Exception as e:
            print(f"⚠️ Failed to delete posts for user {user_id}: {e}")

        create_notification(
            user_id=user_id,
            title="Profile Deleted",
            message="Your profile has been deleted and your posts were removed.",
            notif_type="Alert"
        )

        # Create admin notification
        try:
            display_name = (f"{user_info.get('firstname','').strip()} {user_info.get('lastname','').strip()}".strip()) or None
            email = user_info.get('email') if user_info.get('email') else None
            if display_name and email:
                who = f"{display_name} <{email}>"
            elif display_name:
                who = display_name
            elif email:
                who = email
            else:
                who = f"user ({user_id})"

            admin_title = "User account deleted"
            admin_message = f"{who} deleted their account. Posts were removed. Please review associated content if needed."
            create_admin_notification(actor_id=request.user_id, user_id=user_id, title=admin_title, type_label="User Deleted", message=admin_message)
        except Exception as e:
            print(f"⚠️ Failed to create admin notification for deleted profile: {e}")

        return jsonify({
            "status": "success",
            "message": "Profile flagged as deleted, posts permanently removed, and notification sent"
        }), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@profile_bp.route("/profile/upload-avatar", methods=["POST", "OPTIONS"])
@token_required
def upload_avatar():
    """Upload user avatar"""
    user_id = request.user_id

    if "avatar" not in request.files:
        return jsonify({"status": "error", "message": "No file uploaded"}), 400

    file = request.files["avatar"]
    if file.mimetype not in ["image/jpeg", "image/png"]:
        return jsonify({"status": "error", "message": "Invalid file type"}), 400

    try:
        # Read and encode file
        file_contents = file.read()
        encoded_string = f"data:{file.mimetype};base64," + base64.b64encode(file_contents).decode("utf-8")

        # Update avatar with retry
        def update_avatar():
            return supabase.table("users").update({"avatar_url": encoded_string}).eq("id", user_id).execute()
        supabase_retry(update_avatar)

        return jsonify({"status": "success", "url": encoded_string}), 200
    except Exception as e:
        print("upload_avatar error:", traceback.format_exc())
        return jsonify({"status": "error", "message": str(e)}), 500