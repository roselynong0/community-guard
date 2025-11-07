"""
Authentication Middleware
Token validation decorators
"""
from flask import request, jsonify
from functools import wraps
from datetime import datetime, timezone, timedelta
from utils import supabase


def verification_token_required(f):
    """Decorator for routes requiring verification token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization") or request.headers.get("X-Verification-Token")
        if token and token.startswith("Bearer "):
            token = token[7:]  # Remove "Bearer " prefix
        
        if not token:
            return jsonify({"status": "error", "message": "Verification token required"}), 401

        try:
            # Check verification_sessions table
            now = datetime.now(timezone.utc)
            resp = supabase.table("verification_sessions").select("*").eq("token", token).gt("expires_at", now.isoformat()).execute()
            sessions = getattr(resp, "data", []) or []
            
            if not sessions:
                return jsonify({"status": "error", "message": "Invalid or expired verification token"}), 401

            session = sessions[0]
            
            # Fetch user to verify they exist
            user_resp = supabase.table("users").select("id, email, isverified").eq("id", session["user_id"]).execute()
            users = getattr(user_resp, "data", []) or []
            
            if not users:
                return jsonify({"status": "error", "message": "User not found"}), 404

            user = users[0]
            
            # Attach user info to request
            request.user_id = user["id"]
            request.user_email = user["email"]
            request.verification_session = session
            
            return f(*args, **kwargs)
            
        except Exception as e:
            print(f"Verification token error: {e}")
            return jsonify({"status": "error", "message": "Authentication failed"}), 401
    
    return decorated


def token_required(f):
    """Decorator for routes requiring session token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header:
            return jsonify({"status": "error", "message": "Authorization header required"}), 401

        parts = auth_header.split(" ")
        if len(parts) != 2 or parts[0] != "Bearer":
            return jsonify({"status": "error", "message": "Invalid authorization format"}), 401

        token = parts[1]

        try:
            # Find session by token with retry logic
            max_retries = 3
            retry_count = 0
            sessions = []
            
            while retry_count < max_retries:
                try:
                    resp = supabase.table("sessions").select("*").eq("token", token).execute()
                    sessions = getattr(resp, "data", []) or []
                    break  # Success, exit retry loop
                except Exception as retry_err:
                    retry_count += 1
                    if retry_count >= max_retries:
                        raise retry_err
                    print(f"Session lookup retry {retry_count}/{max_retries}: {retry_err}")
                    import time
                    time.sleep(0.1)  # Brief delay before retry
            
            if not sessions:
                return jsonify({"status": "error", "message": "Invalid session token"}), 401
        except Exception as e:
            print(f"Session lookup error after retries: {e}")
            # Return 401 instead of 500 to prevent logout cascade
            return jsonify({"status": "error", "message": "Session validation temporarily unavailable. Please try again."}), 401

        session = sessions[0]
        now = datetime.now(timezone.utc)
        expires_at = datetime.fromisoformat(session["expires_at"])

        # Check expiry
        if now > expires_at:
            try:
                supabase.table("sessions").delete().eq("id", session["id"]).execute()
            except Exception as e:
                print(f"Session deletion error: {e}")
            
            return jsonify({
                "status": "error",
                "message": "Session expired",
                "code": "SESSION_EXPIRED"
            }), 401

        # Auto-refresh (optional)
        remaining_time = (expires_at - now).total_seconds()
        if remaining_time < 900:  # Less than 15 minutes
            new_expires = now + timedelta(hours=24)
            try:
                supabase.table("sessions").update({"expires_at": new_expires.isoformat()}).eq("id", session["id"]).execute()
                session["expires_at"] = new_expires.isoformat()
            except Exception as e:
                print(f"Session refresh error: {e}")

        # Attach user_id and session
        request.user_id = session["user_id"]
        request.session = session

        return f(*args, **kwargs)
    return decorated
