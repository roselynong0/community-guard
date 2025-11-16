"""
Session Management Routes
Handles session listing and revocation
"""
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone

from utils import supabase, supabase_retry
from middleware import token_required

sessions_bp = Blueprint('sessions', __name__)


@sessions_bp.route("/sessions", methods=["GET"])
@token_required
def list_sessions():
    """List all active sessions for the current user"""
    user_id = request.user_id
    now = datetime.now(timezone.utc)

    try:
        # Get user data
        def fetch_user():
            return supabase.table("users").select("*").eq("id", user_id).is_("deleted_at", None).single().execute()

        user_resp = supabase_retry(fetch_user)
        user_data = user_resp.data if user_resp.data else None

        if not user_data:
            return jsonify({
                "status": "error",
                "message": "User not found",
                "sessions": []
            }), 404

        # Get all sessions
        def fetch_sessions():
            return (supabase.table("sessions")
                    .select("id, token, expires_at, created_at")
                    .eq("user_id", user_id)
                    .order("created_at", desc=True)
                    .execute())

        resp = supabase_retry(fetch_sessions)
        all_sessions = resp.data or []

        # Filter expired sessions and enhance with user data
        active_sessions = []
        for s in all_sessions:
            expires_at_str = s.get("expires_at")
            if not expires_at_str:
                continue

            expires_at = datetime.fromisoformat(expires_at_str)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)

            if expires_at < now:
                # Auto-delete expired sessions
                try:
                    supabase.table("sessions").delete().eq("id", s["id"]).execute()
                    print(f"🧹 Removed expired session {s['id']} for user {user_id}")
                except Exception as e:
                    print(f"⚠️ Failed to delete expired session {s['id']}: {e}")
            else:
                active_sessions.append({
                    "id": s["id"],
                    "token": s["token"],
                    "created_at": s["created_at"],
                    "expires_at": s["expires_at"],
                    "user": {
                        "id": user_data["id"],
                        "firstname": user_data.get("firstname", ""),
                        "lastname": user_data.get("lastname", ""),
                        "email": user_data.get("email", ""),
                        "role": user_data.get("role", "Resident"),
                        "isverified": user_data.get("isverified", False),
                        "avatar_url": user_data.get("avatar_url", "/default-avatar.png")
                    }
                })

        return jsonify({
            "status": "success",
            "sessions": active_sessions
        }), 200

    except Exception as e:
        print(f"❌ Error in /api/sessions for user {user_id}: {e}")
        print(f"Error type: {type(e).__name__}")
        return jsonify({
            "status": "error",
            "message": str(e),
            "sessions": []
        }), 500


@sessions_bp.route("/sessions/<session_id>", methods=["DELETE"])
@token_required
def revoke_session(session_id):
    """Revoke a single session"""
    user_id = request.user_id
    try:
        supabase.table("sessions").delete().eq("id", session_id).eq("user_id", user_id).execute()
        return jsonify({"status": "success", "message": "Session revoked"}), 200
    except Exception as e:
        print(f"❌ Error revoking session {session_id}: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@sessions_bp.route("/sessions/revoke_all", methods=["DELETE"])
@token_required
def revoke_all_sessions():
    """Revoke all sessions for the current user"""
    user_id = request.user_id
    try:
        supabase.table("sessions").delete().eq("user_id", user_id).execute()
        return jsonify({"status": "success", "message": "All sessions revoked"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@sessions_bp.route("/logout", methods=["POST"])
@token_required
def logout():
    """Logout current session"""
    user_id = request.user_id
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    
    print(f"🚪 Logout requested by user {user_id}, token: {token[:20]}...")
    
    try:
        # Delete the current session from database
        result = supabase.table("sessions").delete().eq("token", token).eq("user_id", user_id).execute()
        print(f"✅ Logout successful for user {user_id}, deleted {len(result.data) if result.data else 0} session(s)")
        
        return jsonify({
            "status": "success",
            "message": "Logged out successfully"
        }), 200
    except Exception as e:
        print(f"❌ Logout error for user {user_id}: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500
