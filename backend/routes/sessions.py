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
        # Prefer the user row attached by token_required middleware, if available
        user_data = getattr(request, 'user_record', None)
        if not user_data:
            # Fallback to querying the users table
            def fetch_user():
                return supabase.table("users").select("*").eq("id", user_id).is_("deleted_at", "null").single().execute()

            user_resp = supabase_retry(fetch_user)
            user_data = user_resp.data if user_resp.data else None

        if not user_data:
            return jsonify({
                "status": "error",
                "message": "User not found",
                "sessions": []
            }), 404

        # Get all sessions (include ended_at for tracking closed sessions)
        def fetch_sessions():
            return (supabase.table("sessions")
                .select("id, token, expires_at, created_at, ended_at")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .execute())

        resp = supabase_retry(fetch_sessions)
        all_sessions = resp.data or []

        # Build active (not ended, not expired) and ended sessions
        active_sessions = []
        ended_sessions = []
        for s in all_sessions:
            expires_at_str = s.get("expires_at")
            ended_at_str = s.get("ended_at")
            if not expires_at_str:
                continue

            expires_at = datetime.fromisoformat(expires_at_str)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)

            # If there is an explicit ended_at timestamp or the session is past expiry, treat as ended
            ended_at = None
            if ended_at_str:
                try:
                    ended_at = datetime.fromisoformat(ended_at_str)
                    if ended_at.tzinfo is None:
                        ended_at = ended_at.replace(tzinfo=timezone.utc)
                except Exception:
                    ended_at = None

            if expires_at < now and not ended_at:
                # Session is expired and has no ended_at; set ended_at to expires_at for consistency
                ended_at = expires_at

            if ended_at:
                # Ended/expired session — include in ended list
                ended_sessions.append({
                    "id": s["id"],
                    "token": s["token"],
                    "created_at": s["created_at"],
                    "expires_at": s["expires_at"],
                    "ended_at": ended_at.isoformat(),
                    "user": {
                        "id": user_data["id"],
                        "firstname": user_data.get("firstname", ""),
                        "lastname": user_data.get("lastname", ""),
                        "email": user_data.get("email", ""),
                        "role": user_data.get("role", "Resident"),
                        "isverified": user_data.get("isverified", False),
                        "avatar_url": user_data.get("avatar_url", "/default-avatar.png"),
                        "onpremium": user_data.get("onpremium", False)
                    }
                })
            else:
                # Active session
                active_sessions.append({
                    "id": s["id"],
                    "token": s["token"],
                    "created_at": s["created_at"],
                    "expires_at": s["expires_at"],
                    "ended_at": None,
                    "user": {
                        "id": user_data["id"],
                        "firstname": user_data.get("firstname", ""),
                        "lastname": user_data.get("lastname", ""),
                        "email": user_data.get("email", ""),
                        "role": user_data.get("role", "Resident"),
                        "isverified": user_data.get("isverified", False),
                        "avatar_url": user_data.get("avatar_url", "/default-avatar.png"),
                        "onpremium": user_data.get("onpremium", False)
                    }
                })

        # Keep only the current (most recent active) and the most recent ended session
        response_sessions = []
        # Sort active_sessions by created_at desc to get current
        active_sessions_sorted = sorted(active_sessions, key=lambda x: x.get('created_at', ''), reverse=True)
        ended_sessions_sorted = sorted(ended_sessions, key=lambda x: x.get('ended_at', ''), reverse=True)

        if active_sessions_sorted:
            response_sessions.append(active_sessions_sorted[0])

        if ended_sessions_sorted:
            response_sessions.append(ended_sessions_sorted[0])

        # PRUNE older sessions: keep only two latest sessions
        try:
            all_ids = [s['id'] for s in all_sessions]
            # Keep response_ids
            keep_ids = set([s['id'] for s in response_sessions])
            to_delete = [i for i in all_ids if i not in keep_ids]
            if to_delete:
                supabase.table('sessions').delete().in_('id', to_delete).execute()
                print(f"🧹 Cleaned old sessions for user {user_id}, deleted: {len(to_delete)}")
        except Exception as e:
            print(f"⚠️ Failed to prune old sessions for user {user_id}: {e}")

        return jsonify({
            "status": "success",
            "sessions": response_sessions
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
        # Mark session as ended by setting ended_at to now(). Do not overwrite expires_at (expiry still valid).
        now = datetime.now(timezone.utc).isoformat()
        result = supabase.table("sessions").update({"ended_at": now}).eq("token", token).eq("user_id", user_id).execute()
        # Generalized success message (no user/session details exposed)
        print("✅ Logout recorded successfully")

        # Prune older sessions if there are more than 2 sessions for the user
        try:
            all_resp = supabase.table('sessions').select('id, created_at, ended_at').eq('user_id', user_id).order('created_at', desc=True).execute()
            rows = all_resp.data or []
            # Keep only newest 2 rows
            keep = 2
            to_delete_ids = [r['id'] for r in rows[keep:]] if len(rows) > keep else []
            if to_delete_ids:
                supabase.table('sessions').delete().in_('id', to_delete_ids).execute()
                print(f"🧹 Pruned {len(to_delete_ids)} old session(s) for user {user_id}")
        except Exception as e:
            print(f"⚠️ Failed to prune old sessions after logout for user {user_id}: {e}")

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
