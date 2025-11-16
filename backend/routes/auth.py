"""
Authentication Routes
Handles login, register, logout, and password reset
"""
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone, timedelta
from bcrypt import hashpw, gensalt, checkpw
import secrets
import traceback

from utils import supabase, generate_verification_code, send_verification_email, send_reset_code_email
from middleware import token_required
from config import Config

auth_bp = Blueprint('auth', __name__)


# Import notification helper (will be defined later)
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


@auth_bp.route("/register", methods=["POST"])
def register():
    """User registration endpoint"""
    data = request.json
    email = data.get("email")
    firstname = data.get("firstname")
    lastname = data.get("lastname")
    password = data.get("password")
    role = data.get("role", "Resident")
    address_barangay = data.get("address_barangay") or None
    address_city = data.get("address_city") or "Olongapo"

    if not email or not firstname or not lastname or not password:
        return jsonify({"status": "error", "message": "Missing required fields"}), 400

    try:
        # Check if email already exists
        existing_resp = supabase.table("users").select("*").eq("email", email).execute()
        existing_users = getattr(existing_resp, "data", []) or []
        if existing_users:
            return jsonify({"status": "duplicate", "message": "Email already registered"}), 200

        # Hash password
        hashed_pw = hashpw(password.encode(), gensalt()).decode()

        # Insert user
        user_insert = supabase.table("users").insert({
            "firstname": firstname,
            "lastname": lastname,
            "email": email,
            "password": hashed_pw,
            "role": role,
            "isverified": False,
            "avatar_url": "/default-avatar.png",
        }).execute()

        user_data = getattr(user_insert, "data", []) or []
        if not user_data:
            return jsonify({"status": "error", "message": "Failed to create user"}), 500

        new_user_id = user_data[0]["id"]

        # Insert info
        info_insert = supabase.table("info").insert({
            "user_id": new_user_id,
            "address_barangay": address_barangay,
            "address_city": address_city
        }).execute()

        info_data = getattr(info_insert, "data", []) or []
        if not info_data:
            # Rollback user if info fails
            supabase.table("users").delete().eq("id", new_user_id).execute()
            return jsonify({"status": "error", "message": "Failed to insert user info. Registration rolled back."}), 500

        # Automatically send verification code
        email_sent = False
        try:
            code = generate_verification_code()
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=Config.EMAIL_CODE_EXPIRY)

            supabase.table("email_verifications").upsert({
                "user_id": new_user_id,
                "email": email,
                "code": code,
                "expires_at": expires_at.isoformat(),
                "is_used": False
            }, on_conflict="user_id").execute()

            email_sent = send_verification_email(email, code)
            if email_sent:
                print(f"📧 Verification email sent to {email}")
            else:
                print(f"❌ Email send failed for {email} - check Mailjet credentials (MJ_APIKEY_PUBLIC, MJ_APIKEY_SECRET)")
        except Exception as e:
            print(f"❌ Email error: {e}")
            email_sent = False

        # Create welcome notification for self-registered user
        try:
            from utils import create_notification
            create_notification(
                user_id=new_user_id,
                title="Welcome!",
                message=f"Welcome {firstname}! Thank you for registering with Community Guard. Please verify your email and complete your profile to get started.",
                notif_type="Welcome"
            )
        except Exception as e:
            print(f"⚠️ Failed to create welcome notification for new user: {e}")

        # Create admin notification
        try:
            admin_title = f"New user registration: {firstname} {lastname}"
            admin_message = f"{firstname} {lastname} registered and requires full verification."
            create_admin_notification(actor_id=new_user_id, user_id=new_user_id, title=admin_title, type_label="Account Created", message=admin_message)
        except Exception as e:
            print(f"⚠️ Failed to create admin notification for new user: {e}")

        return jsonify({
            "status": "success",
            "user_id": new_user_id,
            "email": email,
            "email_sent": email_sent
        }), 201

    except Exception as e:
        print("\n=== ERROR in /api/register ===")
        print("ERROR:", e)
        print(traceback.format_exc())
        return jsonify({"status": "error", "message": "Internal server error"}), 500


@auth_bp.route("/login", methods=["POST"])
def login():
    """User login endpoint"""
    data = request.json
    email = data.get("email")
    password = data.get("password")
    requested_role = data.get("role", "Resident")

    # Find user
    resp = supabase.table("users").select("*").eq("email", email).is_("deleted_at", None).execute()
    users = getattr(resp, "data", []) or []
    if not users:
        return jsonify({"status": "not_found"}), 404

    user = users[0]
    if not checkpw(password.encode(), user["password"].encode()):
        return jsonify({"status": "invalid_credentials"}), 401

    # Check role-based authentication
    user_role = user.get("role", "Resident")
    
    # Allow Admin tab sign-in for Admins, Barangay Officials, and Responders
    if requested_role == "Admin" and user_role not in ("Admin", "Barangay Official", "Responder"):
        return jsonify({
            "status": "role_mismatch",
            "message": "This account is not authorized for admin access. Please use the Resident login tab.",
            "suggested_role": "Resident"
        }), 403
    elif requested_role == "Resident" and user_role in ("Admin", "Barangay Official", "Responder"):
        return jsonify({
            "status": "role_mismatch",
            "message": "Administrative accounts must use the Admin login tab. Please switch to Admin login.",
            "suggested_role": "Admin"
        }), 403

    # Check for existing valid session
    now = datetime.now(timezone.utc)
    session_resp = (
        supabase.table("sessions")
        .select("*")
        .eq("user_id", user["id"])
        .gt("expires_at", now.isoformat())
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    existing_sessions = getattr(session_resp, "data", []) or []

    # Check if account is verified
    if not user.get("isverified", False):
        verification_resp = (
            supabase.table("email_verifications")
            .select("*")
            .eq("user_id", user["id"])
            .eq("is_used", False)
            .gt("expires_at", now.isoformat())
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        active_verification_codes = getattr(verification_resp, "data", []) or []

        if active_verification_codes:
            verification_token = secrets.token_urlsafe(32)
            verification_expires = (now + timedelta(minutes=30)).isoformat()

            supabase.table("verification_sessions").upsert({
                "user_id": user["id"],
                "token": verification_token,
                "expires_at": verification_expires,
                "email": user["email"]
            }, on_conflict="user_id").execute()

            return jsonify({
                "status": "verification_redirect_required",
                "message": "Your email is not verified. We've detected an active verification code. Please check your email and complete verification.",
                "email": user["email"],
                "user_id": user["id"],
                "verification_token": verification_token
            }), 403
        else:
            return jsonify({
                "status": "verification_renewal_required",
                "message": "Your account is not verified and no active verification code found. Please renew your verification.",
                "email": user["email"],
                "user_id": user["id"]
            }), 403

    if existing_sessions:
        session = existing_sessions[0]
        token = session["token"]
        expires_at = session["expires_at"]
    else:
        token = secrets.token_urlsafe(64)
        expires_at = (now + timedelta(hours=24)).isoformat()

        supabase.table("sessions").insert({
            "user_id": user["id"],
            "token": token,
            "expires_at": expires_at
        }).execute()

    session_data = {
        "user": {
            "id": user["id"],
            "firstname": user["firstname"],
            "lastname": user["lastname"],
            "email": user["email"],
            "role": user.get("role", "Resident"),
            "isverified": user.get("isverified", False),
            "avatar_url": user.get("avatar_url", "/default-avatar.png"),
        },
        "token": token,
        "expires_at": expires_at
    }

    return jsonify({"status": "success", "session": session_data}), 200


@auth_bp.route("/sessions", methods=["GET"])
@token_required
def get_sessions():
    """Get all active sessions for the current user"""
    try:
        user_id = request.user_id
        now = datetime.now(timezone.utc)
        
        # Get user data first
        user_resp = supabase.table("users").select("*").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        
        if not user_data:
            return jsonify({"status": "error", "message": "User not found", "sessions": []}), 404
        
        # Fetch all sessions for this user
        resp = supabase.table("sessions").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        all_sessions = getattr(resp, "data", []) or []
        
        # Filter out expired sessions and enhance with user data
        active_sessions = []
        for s in all_sessions:
            if datetime.fromisoformat(s["expires_at"]) < now:
                # Auto-delete expired sessions
                try:
                    supabase.table("sessions").delete().eq("id", s["id"]).execute()
                    print(f"🧹 Removed expired session {s['id']} for user {user_id}")
                except Exception as e:
                    print(f"⚠️ Failed to delete expired session: {e}")
            else:
                # Add user data to each session
                enhanced_session = {
                    **s,
                    "user": {
                        "id": user_data["id"],
                        "firstname": user_data["firstname"],
                        "lastname": user_data["lastname"],
                        "email": user_data["email"],
                        "role": user_data.get("role", "Resident"),
                        "isverified": user_data.get("isverified", False),
                        "avatar_url": user_data.get("avatar_url", "/default-avatar.png"),
                    }
                }
                active_sessions.append(enhanced_session)
        
        return jsonify({"status": "success", "sessions": active_sessions}), 200
        
    except Exception as e:
        print(f"❌ Error fetching sessions: {e}")
        return jsonify({"status": "error", "message": str(e), "sessions": []}), 500


@auth_bp.route("/sessions/<session_id>", methods=["DELETE"])
@token_required
def revoke_session(session_id):
    """Revoke a single session"""
    try:
        user_id = request.user_id
        supabase.table("sessions").delete().eq("id", session_id).eq("user_id", user_id).execute()
        return jsonify({"status": "success", "message": "Session revoked"}), 200
    except Exception as e:
        print(f"❌ Error revoking session: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@auth_bp.route("/sessions/revoke-all", methods=["DELETE"])
@token_required
def revoke_all_sessions():
    """Revoke all sessions for the current user"""
    try:
        user_id = request.user_id
        supabase.table("sessions").delete().eq("user_id", user_id).execute()
        return jsonify({"status": "success", "message": "All sessions revoked", "sessions": []}), 200
    except Exception as e:
        print(f"❌ Error revoking all sessions: {e}")
        return jsonify({"status": "error", "message": str(e), "sessions": []}), 500


@auth_bp.route("/logout", methods=["POST"])
@token_required
def logout():
    """User logout endpoint"""
    try:
        user_id = request.user_id
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.split(" ")[1] if " " in auth_header else None

        if not token:
            return jsonify({"status": "error", "message": "Missing token"}), 400

        # Delete session
        supabase.table("sessions").delete().eq("token", token).eq("user_id", user_id).execute()

        # Fetch remaining sessions
        resp = (
            supabase.table("sessions")
            .select("id, token, expires_at, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        sessions = resp.data if resp.data else []

        response = jsonify({
            "status": "success",
            "message": "Logged out successfully",
            "sessions": sessions
        })
        response.set_cookie("token", "", expires=0)
        return response, 200

    except Exception as e:
        print(f"Logout error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@auth_bp.route("/password/forgot", methods=["POST", "OPTIONS"])
def forgot_password():
    """Forgot password endpoint"""
    if request.method == "OPTIONS":
        return '', 200

    data = request.json
    email = data.get("email")

    if not email:
        return jsonify({"status": "error", "message": "Email required"}), 400

    try:
        user_resp = supabase.table("users").select("*").eq("email", email).execute()
        user = getattr(user_resp, "data", [None])[0]
        if not user:
            return jsonify({"status": "not_found", "message": "User not found"}), 404

        reset_code = "{:06}".format(secrets.randbelow(1000000))
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=Config.EMAIL_CODE_EXPIRY)

        supabase.table("password_resets").upsert({
            "user_id": user["id"],
            "email": email,
            "code": reset_code,
            "expires_at": expires_at.isoformat(),
            "used": False
        }, on_conflict="user_id").execute()

        mail_sent = send_reset_code_email(email, reset_code)
        if mail_sent:
            print(f"📧 Password reset code sent to {email}")
            return jsonify({"status": "success", "message": "Reset code sent!"}), 200
        else:
            print(f"❌ Password reset email failed for {email}")
            return jsonify({"status": "error", "message": "Failed to send email"}), 500

    except Exception as e:
        print("Forgot password exception:", e, traceback.format_exc())
        return jsonify({"status": "error", "message": str(e)}), 500


@auth_bp.route("/password/reset", methods=["POST", "OPTIONS"])
def reset_password():
    """Reset password endpoint"""
    if request.method == "OPTIONS":
        return '', 200

    data = request.json
    email = data.get("email")
    code = data.get("code")
    new_password = data.get("new_password")

    if not email or not code or not new_password:
        return jsonify({"status": "error", "message": "Email, code, and new password required"}), 400

    try:
        resp = supabase.table("password_resets") \
            .select("*") \
            .eq("email", email) \
            .eq("code", code) \
            .eq("used", False).execute()

        if not resp.data:
            return jsonify({"status": "invalid", "message": "Invalid or expired code"}), 400

        record = resp.data[0]
        expires_at = datetime.fromisoformat(record["expires_at"])

        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if datetime.now(timezone.utc) > expires_at:
            return jsonify({"status": "expired", "message": "Code expired"}), 400

        hashed_pw = hashpw(new_password.encode(), gensalt()).decode()
        supabase.table("users").update({"password": hashed_pw}).eq("id", record["user_id"]).execute()
        supabase.table("password_resets").update({"used": True}).eq("id", record["id"]).execute()

        return jsonify({"status": "success", "message": "Password reset successful"}), 200

    except Exception as e:
        print("Reset password exception:", e, traceback.format_exc())
        return jsonify({"status": "error", "message": str(e)}), 500
