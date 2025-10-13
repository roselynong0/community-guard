# ----------------- APP SETUP -----------------
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from supabase import create_client
import os
from dotenv import load_dotenv
from datetime import datetime, timezone, timedelta
import jwt
from bcrypt import hashpw, gensalt, checkpw
from functools import wraps
from PIL import Image
import io
from flask import make_response
import uuid
import secrets
from werkzeug.utils import secure_filename
from mailjet_rest import Client
import random
import traceback
from werkzeug.exceptions import HTTPException
from flask_caching import Cache
from flask_compress import Compress
import base64

# ----------------- LOAD ENV -----------------
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
EMAIL_SECRET_KEY = os.getenv("EMAIL_SECRET_KEY")
MAILJET_API_KEY = os.getenv("MAILJET_API_KEY")
MAILJET_API_SECRET = os.getenv("MAILJET_API_SECRET")
EMAIL_CODE_EXPIRY = int(os.getenv("EMAIL_CODE_EXPIRY_MINUTES", 10))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# ----------------- CLIENT -----------------
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ----------------- APP -----------------
app = Flask(__name__)
CORS(app, supports_credentials=True)
cache = Cache(app, config={'CACHE_TYPE': 'SimpleCache', 'CACHE_DEFAULT_TIMEOUT': 300})
Compress(app)

# ----------------- RETRY UTILITY -----------------
import time
import httpx

def supabase_retry(func, max_retries=3, delay=0.5):
    """
    Retry wrapper for Supabase operations to handle network issues
    """
    for attempt in range(max_retries):
        try:
            return func()
        except (httpx.ReadError, httpx.ConnectError, httpx.TimeoutException, Exception) as e:
            error_str = str(e).lower()
            # Check if it's a network-related error that we should retry
            if any(keyword in error_str for keyword in [
                'non-blocking socket operation', 'connection', 'timeout', 
                'read error', 'network', 'winerror 10035'
            ]):
                if attempt < max_retries - 1:
                    print(f"🔄 Supabase operation failed (attempt {attempt + 1}/{max_retries}): {e}")
                    print(f"   Retrying in {delay}s...")
                    time.sleep(delay)
                    delay *= 2  # Exponential backoff
                    continue
                else:
                    print(f"❌ Supabase operation failed after {max_retries} attempts: {e}")
                    raise e
            else:
                # Non-network error, don't retry
                raise e
    
    return None  # Should never reach here

@app.route("/api/data")
def get_data():
    try:
        response = supabase.table("destinations").select("*").execute()
        data = getattr(response, "data", []) or []
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

cache = Cache(app, config={'CACHE_TYPE': 'SimpleCache', 'CACHE_DEFAULT_TIMEOUT': 300})

# ----------------- SESSION -----------------
def verification_token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization") or request.headers.get("X-Verification-Token")
        if token and token.startswith("Bearer "):
            token = token[7:]  # Remove "Bearer " prefix
        
        if not token:
            return jsonify({"status": "error", "message": "Verification token required"}), 401

        try:
            # Check verification session
            now = datetime.now(timezone.utc)
            resp = (
                supabase.table("verification_sessions")
                .select("*")
                .eq("token", token)
                .gt("expires_at", now.isoformat())
                .execute()
            )
            sessions = getattr(resp, "data", []) or []
            
            if not sessions:
                return jsonify({"status": "error", "message": "Invalid or expired verification token"}), 401
            
            session = sessions[0]
            request.user_id = session["user_id"]
            request.verification_session = session
            
            return f(*args, **kwargs)
        except Exception as e:
            print("Verification token validation error:", e)
            return jsonify({"status": "error", "message": "Invalid verification token"}), 401
    
    return decorated

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header:
            return jsonify({"status": "unauthorized", "message": "Missing Authorization header"}), 401

        parts = auth_header.split(" ")
        if len(parts) != 2 or parts[0] != "Bearer":
            return jsonify({"status": "unauthorized", "message": "Invalid Authorization format"}), 401

        token = parts[1]

        try:
            # Look up session in Supabase with retry mechanism
            def fetch_session():
                return supabase.table("sessions").select("*").eq("token", token).execute()
            
            session_resp = supabase_retry(fetch_session)
            sessions = getattr(session_resp, "data", []) or []
            if not sessions:
                return jsonify({"status": "invalid_token", "message": "Session not found"}), 401
        except Exception as e:
            print(f"Session lookup failed: {e}")
            return jsonify({"status": "error", "message": "Database connection error"}), 500

        session = sessions[0]
        now = datetime.now(timezone.utc)
        expires_at = datetime.fromisoformat(session["expires_at"])

        # ------------------ Check expiry ------------------
        if now > expires_at:
            print(f"⚠️ Expired session detected for user_id={session['user_id']}, token={token[:8]}...")

            # Delete expired session
            try:
                supabase.table("sessions").delete().eq("token", token).execute()
            except Exception as e:
                print(f"Failed to clean up expired session: {e}")

            return jsonify({
                "status": "expired_token",
                "message": "Your session has expired. Please log in again."
            }), 401

        # ------------------ Auto-refresh (optional) ------------------
        remaining_time = (expires_at - now).total_seconds()
        if remaining_time < 900:  # <15 minutes left
            new_expiry = now + timedelta(hours=1)
            try:
                supabase.table("sessions").update({"expires_at": new_expiry.isoformat()}).eq("token", token).execute()
                print(f"🔄 Session refreshed for user_id={session['user_id']} (new expiry: {new_expiry})")
                session["expires_at"] = new_expiry.isoformat()
            except Exception as e:
                print(f"Failed to auto-refresh session: {e}")

        # Attach user_id and session
        request.user_id = session["user_id"]
        request.session = session

        return f(*args, **kwargs)
    return decorated

# ----------------- LIST USER SESSIONS -----------------
@app.route("/api/sessions", methods=["GET"])
@token_required
def list_sessions():
    user_id = request.user_id
    now = datetime.now(timezone.utc)

    try:
        # Get user data first for the current session
        user_resp = supabase.table("users").select("*").eq("id", user_id).is_("deleted_at", None).single().execute()
        user_data = user_resp.data if user_resp.data else None

        if not user_data:
            return jsonify({
                "status": "error",
                "message": "User not found",
                "sessions": []
            }), 404

        # Get all sessions
        resp = (
            supabase.table("sessions")
            .select("id, token, expires_at, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )

        all_sessions = resp.data or []

        # Filter out expired sessions and enhance with user data
        active_sessions = []
        for s in all_sessions:
            if datetime.fromisoformat(s["expires_at"]) < now:
                # Auto-delete expired sessions
                supabase.table("sessions").delete().eq("id", s["id"]).execute()
                print(f"🧹 Removed expired session {s['id']} for user {user_id}")
            else:
                # Add user data to each session for frontend compatibility
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

        return jsonify({
            "status": "success",
            "sessions": active_sessions
        }), 200

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e),
            "sessions": []
        }), 500

# ----------------- REVOKE SINGLE SESSION -----------------
@app.route("/api/sessions/<session_id>", methods=["DELETE"])
@token_required
def revoke_session(session_id):
    user_id = request.user_id
    try:
        supabase.table("sessions").delete().eq("id", session_id).eq("user_id", user_id).execute()
        return jsonify({"status": "success", "message": "Session revoked"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# ----------------- REVOKE ALL SESSIONS -----------------
@app.route("/api/sessions/revoke_all", methods=["DELETE"])
@token_required
def revoke_all_sessions():
    user_id = request.user_id
    try:
        supabase.table("sessions").delete().eq("user_id", user_id).execute()
        return jsonify({
            "status": "success",
            "message": "All sessions revoked",
            "sessions": []
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e),
            "sessions": []
        }), 500

# ----------------- REGISTRATION -----------------
@app.route("/api/register", methods=["POST"])
def register():
    data = request.json
    email = data.get("email")
    firstname = data.get("firstname")
    lastname = data.get("lastname")
    password = data.get("password")
    role = data.get("role", "Resident")  # Default to Resident if not specified
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

        # ----------------- Automatically send verification code -----------------
        email_sent = False
        try:
            code = generate_verification_code()
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=EMAIL_CODE_EXPIRY)

            # Save code to email_verifications table
            supabase.table("email_verifications").upsert({
                "user_id": new_user_id,
                "email": email,
                "code": code,
                "expires_at": expires_at.isoformat(),
                "is_used": False
            }, on_conflict="user_id").execute()

            # Send email
            email_sent = send_verification_email(email, code)

            # <<< ADD THIS FOR DEBUGGING >>>
            if email_sent:
                print(f"Verification code [{code}] was sent to {email} (user_id: {new_user_id})")
            else:
                print(f"Failed to send verification code [{code}] to {email} (user_id: {new_user_id})")

        except Exception as e:
            print("Failed to send verification email:", e)


        except Exception as e:
            print("Failed to send verification email:", e)

        # ✅ Return success with user_id and email_sent flag
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
        print("Request Body:", request.json)
        return jsonify({"status": "error", "message": "Internal server error"}), 500

@app.errorhandler(Exception)
def handle_global_exception(e):
    if isinstance(e, HTTPException):
        return jsonify({
            "status": "error",
            "message": e.description
        }), e.code

    print("\n=== Global exception ===")
    print(traceback.format_exc())
    return jsonify({"status": "error", "message": "Unexpected error occurred"}), 500

# ----------------- EMAIL VERIFICATION -----------------
mailjet_client = Client(auth=(MAILJET_API_KEY, MAILJET_API_SECRET), version='v3.1')
# ----------------- UTILITIES -----------------
def generate_verification_code():
    return f"{random.randint(0, 999999):06}"

def send_verification_email(to_email, code):
    data = {
        'Messages': [{
            "From": {"Email": "roselynong0@gmail.com", "Name": "Team CodeWise"},
            "To": [{"Email": to_email}],
            "Subject": "Verify Your Email",
            "HTMLPart": f"""
            <div style='font-family:Segoe UI;padding:1rem;text-align:center;'>
                <h2>Get Verified on Community Guard </h2>
                <p>Use the code below:</p>
                <h1>{code}</h1>
                <p>Expires in {EMAIL_CODE_EXPIRY} minutes.</p>
            </div>
            """
        }]
    }
    try:
        result = mailjet_client.send.create(data=data)
        return result.status_code == 200
    except Exception:
        return False

# ----------------- SEND VERIFICATION CODE -----------------
@app.route("/api/email/send-code", methods=["POST"])
def send_email_code():
    data = request.json
    email = data.get("email")
    user_id = data.get("user_id")  # <- now comes from registration response

    if not email or not user_id:
        return jsonify({"status": "error", "message": "Email and user_id required"}), 400

    code = generate_verification_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=EMAIL_CODE_EXPIRY)

    try:
        supabase.table("email_verifications").upsert({
            "user_id": user_id,
            "email": email,
            "code": code,
            "expires_at": expires_at.isoformat(),
            "is_used": False
        }, on_conflict="user_id").execute()


        if send_verification_email(email, code):
            print(f"Resent verification code [{code}] to {email} (user_id: {user_id})")
            return jsonify({"status": "success", "message": "Verification code sent!"}), 200
        else:
            print(f"FAILED to resend verification code [{code}] to {email} (user_id: {user_id})")
            return jsonify({"status": "error", "message": "Failed to send email"}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ----------------- VERIFY ACCESS -----------------
@app.route("/api/verification/validate-access", methods=["POST"])
def validate_verification_access():
    """Validate if user can access verification form"""
    data = request.json or {}
    verification_token = data.get("verification_token")
    user_id = data.get("user_id")
    email = data.get("email")
    
    if not verification_token and not (user_id and email):
        return jsonify({"status": "error", "message": "Verification token or user credentials required"}), 400
    
    try:
        now = datetime.now(timezone.utc)
        
        if verification_token:
            # Validate verification session token
            resp = (
                supabase.table("verification_sessions")
                .select("*")
                .eq("token", verification_token)
                .gt("expires_at", now.isoformat())
                .execute()
            )
            sessions = getattr(resp, "data", []) or []
            
            if sessions:
                session = sessions[0]
                return jsonify({
                    "status": "success",
                    "user_id": session["user_id"],
                    "email": session["email"]
                }), 200
        
        # Fallback: check if user has active verification codes
        if user_id and email:
            verification_resp = (
                supabase.table("email_verifications")
                .select("*")
                .eq("user_id", user_id)
                .eq("email", email)
                .eq("is_used", False)
                .gt("expires_at", now.isoformat())
                .execute()
            )
            active_codes = getattr(verification_resp, "data", []) or []
            
            if active_codes:
                return jsonify({
                    "status": "success",
                    "user_id": user_id,
                    "email": email
                }), 200
        
        return jsonify({"status": "error", "message": "No valid verification access found"}), 403
        
    except Exception as e:
        print("Validate verification access error:", e)
        return jsonify({"status": "error", "message": "Server error"}), 500

# ----------------- VERIFY CODE -----------------
@app.route("/api/email/verify-code", methods=["POST"])
def verify_email_code():
    data = request.json or {}
    email = data.get("email")
    code = data.get("code")
    user_id = data.get("user_id")  # required in our flow

    # 1) Validate inputs
    if not user_id or not code:
        print("[verify] missing user_id or code:", data)
        return jsonify({"status": "error", "message": "user_id and code required"}), 400

    try:
        # 2) Fetch latest unused record for this user+code
        resp = (
            supabase.table("email_verifications")
            .select("*")
            .eq("user_id", user_id)
            .eq("code", code)
            .eq("is_used", False)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        records = getattr(resp, "data", []) or []
        print("[verify] supabase resp:", records)

        if not records:
            print("[verify] no matching unused record for user_id:", user_id, "code:", code)
            return jsonify({"status": "invalid_code", "message": "Invalid or expired code"}), 400

        code_record = records[0]
        print("[verify] code_record:", code_record)

        # 3) Parse expiry robustly (handle naive, 'Z', or offset-aware strings)
        raw_expires = code_record.get("expires_at")
        if isinstance(raw_expires, str):
            # Normalize 'Z' to '+00:00' for fromisoformat
            iso = raw_expires.replace("Z", "+00:00")
            try:
                expires_at = datetime.fromisoformat(iso)
            except Exception as pe:
                print("[verify] bad expires_at string:", raw_expires, "parse_err:", pe)
                return jsonify({"status": "error", "message": "Invalid expiry format"}), 500
        elif isinstance(raw_expires, datetime):
            expires_at = raw_expires
        else:
            print("[verify] unknown expires_at type:", type(raw_expires), raw_expires)
            return jsonify({"status": "error", "message": "Invalid expiry type"}), 500

        # If expires_at is naive (no tz), assume UTC
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        now_utc = datetime.now(timezone.utc)
        if now_utc > expires_at:
            print("[verify] code expired. now:", now_utc, "expires_at:", expires_at)
            return jsonify({"status": "expired", "message": "Verification code expired"}), 400

        # 4) Mark code as used
        upd = supabase.table("email_verifications").update({"is_used": True}).eq("id", code_record["id"]).execute()
        print("[verify] marked used result:", getattr(upd, "data", None))

        # 5) Mark user verified
        uupd = supabase.table("users").update({"isverified": True}).eq("id", user_id).execute()
        print("[verify] user updated result:", getattr(uupd, "data", None))

        # 6) Clean up verification session if exists
        try:
            supabase.table("verification_sessions").delete().eq("user_id", user_id).execute()
            print("[verify] cleaned up verification session")
        except Exception as cleanup_err:
            print("[verify] cleanup error (non-critical):", cleanup_err)

        print(f"[verify] SUCCESS for user_id={user_id}")
        return jsonify({"status": "success", "message": "Email verified!"}), 200

    except Exception as e:
        print("\n=== ERROR in /api/email/verify-code ===")
        print("Error:", e)
        print(traceback.format_exc())
        return jsonify({"status": "error", "message": "Unexpected error occurred"}), 500
    
# ----------------- PASSWORD RESET ROUTES -----------------
from flask_cors import cross_origin

@app.route("/api/password/forgot", methods=["POST", "OPTIONS"])
@cross_origin()  # ensures CORS for this endpoint
def forgot_password():
    if request.method == "OPTIONS":
        return '', 200  # handle preflight

    data = request.json
    email = data.get("email")

    if not email:
        return jsonify({"status": "error", "message": "Email required"}), 400

    try:
        # Get user
        user_resp = supabase.table("users").select("*").eq("email", email).execute()
        user = getattr(user_resp, "data", [None])[0]
        if not user:
            return jsonify({"status": "not_found", "message": "User not found"}), 404

        # Generate 6-digit reset code
        reset_code = "{:06}".format(secrets.randbelow(1000000))
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=EMAIL_CODE_EXPIRY)

        # Upsert to avoid duplicate user_id
        supabase.table("password_resets").upsert({
            "user_id": user["id"],
            "email": email,
            "code": reset_code,
            "expires_at": expires_at.isoformat(),
            "used": False
        }, on_conflict="user_id").execute()

        mail_sent = send_reset_code_email(email, reset_code)
        if mail_sent:
            return jsonify({"status": "success", "message": "Reset code sent!"}), 200
        else:
            return jsonify({"status": "error", "message": "Failed to send email"}), 500

    except Exception as e:
        print("Forgot password exception:", e, traceback.format_exc())
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/password/reset", methods=["POST", "OPTIONS"])
@cross_origin()
def reset_password():
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

        # inside reset_password()
        record = resp.data[0]
        expires_at = datetime.fromisoformat(record["expires_at"])

        # Make it UTC-aware if it's naive
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if datetime.now(timezone.utc) > expires_at:
            return jsonify({"status": "expired", "message": "Code expired"}), 400

        # Hash new password
        hashed_pw = hashpw(new_password.encode(), gensalt()).decode()
        supabase.table("users").update({"password": hashed_pw}).eq("id", record["user_id"]).execute()
        supabase.table("password_resets").update({"used": True}).eq("id", record["id"]).execute()

        return jsonify({"status": "success", "message": "Password reset successful"}), 200

    except Exception as e:
        print("Reset password exception:", e, traceback.format_exc())
        return jsonify({"status": "error", "message": str(e)}), 500

# ----------------- EMAIL SENDER -----------------
def send_reset_code_email(to_email, code):
    data = {
        'Messages': [{
            "From": {"Email": "roselynong0@gmail.com", "Name": "Team CodeWise"},
            "To": [{"Email": to_email}],
            "Subject": "Password Reset Code",
            "HTMLPart": f"""
                <div style='font-family:Segoe UI;padding:1rem;text-align:center;'>
                    <h2>Password Reset</h2>
                    <p>Use the code below to reset your password (expires in {EMAIL_CODE_EXPIRY} mins):</p>
                    <h3 style="font-size:2rem;">{code}</h3>
                </div>
            """
        }]
    }
    try:
        result = mailjet_client.send.create(data=data)
        return result.status_code == 200
    except Exception as e:
        print("Error sending reset code email:", e)
        return False

# ----------------- DATABASE TABLE REQUIREMENTS -----------------
# Make sure to create this table in Supabase:
# CREATE TABLE verification_sessions (
#     id SERIAL PRIMARY KEY,
#     user_id UUID REFERENCES users(id) ON DELETE CASCADE,
#     token VARCHAR(255) UNIQUE NOT NULL,
#     email VARCHAR(255) NOT NULL,
#     expires_at TIMESTAMP NOT NULL,
#     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
# );
# CREATE UNIQUE INDEX idx_verification_sessions_user_id ON verification_sessions(user_id);
# CREATE INDEX idx_verification_sessions_token ON verification_sessions(token);

# ----------------- LOGIN -----------------
@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")
    requested_role = data.get("role", "Resident")  # Default to Resident if not specified

    # Find user
    resp = supabase.table("users").select("*").eq("email", email).is_("deleted_at", None).execute()
    users = getattr(resp, "data", []) or []
    if not users:
        return jsonify({"status": "not_found"}), 404

    user = users[0]
    if not checkpw(password.encode(), user["password"].encode()):
        return jsonify({"status": "invalid_credentials"}), 401

    # Check role-based authentication first
    user_role = user.get("role", "Resident")
    if requested_role == "Admin" and user_role != "Admin":
        return jsonify({
            "status": "role_mismatch", 
            "message": "This account is not authorized for admin access. Please use the Resident login tab.",
            "suggested_role": "Resident"
        }), 403
    elif requested_role == "Resident" and user_role == "Admin":
        return jsonify({
            "status": "role_mismatch", 
            "message": "Admin accounts must use the Admin login tab. Please switch to Admin login.",
            "suggested_role": "Admin"
        }), 403

    # Check for existing valid session
    now = datetime.now(timezone.utc)
    session_resp = (
        supabase.table("sessions")
        .select("*")
        .eq("user_id", user["id"])
        .gt("expires_at", now.isoformat())  # still valid
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    existing_sessions = getattr(session_resp, "data", []) or []

    # Check if account is verified and handle different scenarios
    if not user.get("isverified", False):
        # Check for active verification codes in email_verifications table
        verification_resp = (
            supabase.table("email_verifications")
            .select("*")
            .eq("user_id", user["id"])
            .eq("is_used", False)
            .gt("expires_at", now.isoformat())  # still valid
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        active_verification_codes = getattr(verification_resp, "data", []) or []
        
        if active_verification_codes:
            # Active verification code exists - create temporary verification session and redirect
            verification_token = secrets.token_urlsafe(32)
            verification_expires = (now + timedelta(minutes=30)).isoformat()  # 30 min temp session
            
            # Store temporary verification session
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
            # No active verification code - show renewal modal
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
        # 2. Create a new session token
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

# ----------------- LOGOUT -----------------
@app.route("/api/logout", methods=["POST"])
@token_required
def logout():
    try:
        user_id = request.user_id
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.split(" ")[1] if " " in auth_header else None

        if not token:
            return jsonify({"status": "error", "message": "Missing token"}), 400

        # Delete only this session from DB
        supabase.table("sessions").delete().eq("token", token).eq("user_id", user_id).execute()

        # Fetch remaining sessions for this user
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
        response.set_cookie("token", "", expires=0)  # Clear cookie
        return response, 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "sessions": []}), 500


# ----------------- PROFILE -----------------
@app.route("/api/profile", methods=["GET"])
@token_required
def get_profile():
    user_id = request.user_id
    try:
        # ✅ Only fetch user if not soft deleted
        user_resp = supabase.table("users").select("*").eq("id", user_id).is_("deleted_at", None).execute()
        info_resp = supabase.table("info").select("*").eq("user_id", user_id).execute()

        if not user_resp.data:
            return jsonify({"status": "not_found", "message": "User not found or deleted"}), 404

        user = user_resp.data[0]
        info = info_resp.data[0] if info_resp.data else {}

        profile = {
            "id": user.get("id"),
            "firstname": with_default(user.get("firstname"), "No name added yet"),
            "lastname": with_default(user.get("lastname"), ""),
            "email": with_default(user.get("email"), "No email added yet"),
            "isverified": user.get("isverified", False),
            "label": "Verified" if user.get("isverified", False) else "Unverified",
            "role": with_default(user.get("role"), "Resident"),
            "avatar_url": with_default(user.get("avatar_url"), "/default-avatar.png"),
            "bio": with_default(info.get("bio"), "No information added yet"),
            "phone": with_default(info.get("phone"), "No contact info yet"),
            "address": with_default(info.get("address"), ""),
            "address_street": with_default(info.get("address_street"), "No location"),
            "address_barangay": with_default(info.get("address_barangay"), user.get("address_barangay") or "No barangay selected"),
            "address_province": with_default(info.get("address_province"), user.get("address_province") or "Zambales"),
            "address_city": with_default(info.get("address_city"), user.get("address_city") or "Olongapo"),
            "birthdate": with_default(info.get("birthdate"), "")
        }

        return jsonify({"status": "success", "profile": profile}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ----------------- UPDATE -----------------
@app.route("/api/profile", methods=["PUT"])
@token_required
def update_profile():
    user_id = request.user_id
    data = request.json or {}

    try:
        updated_user = {}
        updated_info = {}

        # ----------------- HEADER MODAL -----------------
        # Only update firstname, lastname, and barangay (optional city)
        if any(k in data for k in ["firstname", "lastname", "address_barangay", "address_city"]):
            if "firstname" in data:
                updated_user["firstname"] = data["firstname"]
            if "lastname" in data:
                updated_user["lastname"] = data["lastname"]
            if "address_barangay" in data:
                updated_info["address_barangay"] = data["address_barangay"]
            if "address_city" in data:
                updated_info["address_city"] = data["address_city"]

        # ----------------- ABOUT MODAL -----------------
        # Only update bio
        if "bio" in data:
            updated_info["bio"] = data["bio"]

        # ----------------- PERSONAL MODAL -----------------
        # Only update email, phone, address_street, birthdate
        if "email" in data:
            updated_user["email"] = data["email"]
        if "phone" in data:
            phone = data["phone"]
            updated_info["phone"] = phone if phone and phone.isdigit() and len(phone) == 11 else None
        if "address_street" in data:
            updated_info["address_street"] = data["address_street"]
        if "birthdate" in data:
            updated_info["birthdate"] = data["birthdate"]

        # ----------------- EXECUTE UPDATES -----------------
        if updated_user:
            supabase.table("users").update(updated_user).eq("id", user_id).execute()
        if updated_info:
            # Upsert ensures a row exists in `info`
            updated_info["user_id"] = user_id
            supabase.table("info").upsert(updated_info, on_conflict=["user_id"]).execute()

        # ----------------- FETCH UPDATED PROFILE -----------------
        user_resp = supabase.table("users").select("*").eq("id", user_id).execute()
        info_resp = supabase.table("info").select("*").eq("user_id", user_id).execute()
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
            "address_barangay": info.get("address_barangay") or user.get("address_barangay") or "No barangay selected",
            "address_city": info.get("address_city") or user.get("address_city") or "Olongapo",
            "address_province": info.get("address_province") or user.get("address_province") or "Zambales",
            "birthdate": info.get("birthdate") or ""
        }

        return jsonify({"status": "success", "profile": profile}), 200

    except Exception as e:
        print("update_profile error:", traceback.format_exc())
        return jsonify({"status": "error", "message": str(e)}), 500

def with_default(value, default):
    return default if value is None or value == "" else value


# ----------------- DELETE PROFILE -----------------
@app.route("/api/profile", methods=["DELETE"])
@token_required
def delete_profile():
    user_id = request.user_id
    try:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()

        # ----------------- Helper to create a notification -----------------
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

        supabase.table("users").update({"deleted_at": now}).eq("id", user_id).execute()

        supabase.table("posts").delete().eq("user_id", user_id).execute()

        create_notification(
            user_id=user_id,
            title="Profile Deleted",
            message="Your profile has been flagged as deleted and all your posts have been removed.",
            notif_type="Alert"
        )

        return jsonify({
            "status": "success",
            "message": "Profile flagged as deleted, posts permanently removed, and notification sent"
        }), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ----------------- UPLOAD AVATAR -----------------
@app.route("/api/profile/upload-avatar", methods=["POST"])
@token_required
def upload_avatar():
    user_id = request.user_id

    if "avatar" not in request.files:
        return jsonify({"status": "error", "message": "No file uploaded"}), 400

    file = request.files["avatar"]
    if file.mimetype not in ["image/jpeg", "image/png"]:
        return jsonify({"status": "error", "message": "Invalid file type"}), 400

    try:
        # Read file as bytes
        file_contents = file.read()
        # Encode as Base64 string
        encoded_string = f"data:{file.mimetype};base64," + base64.b64encode(file_contents).decode("utf-8")

        # Update users table
        supabase.table("users").update({"avatar_url": encoded_string}).eq("id", user_id).execute()

        return jsonify({"status": "success", "url": encoded_string}), 200
    except Exception as e:
        print("upload_avatar error:", traceback.format_exc())
        return jsonify({"status": "error", "message": str(e)}), 500

# ----------------- DASHBOARD / REPORTS -----------------
DEFAULT_REPORTER = {"id": 0, "firstname": "Unknown", "lastname": "", "avatar_url": "/default-avatar.png"}

def fetch_reports(limit=10, sort="desc", user_only=False, barangay_filter=False, barangay_param=None, user_id=None):
    try:
        # Use retry mechanism for the main reports query
        def fetch_main_reports():
            query = supabase.table("reports").select("*").is_("deleted_at", None)
            
            if user_only and user_id:
                query = query.eq("user_id", user_id)
            elif barangay_filter and user_id:
                # Get user's barangay first
                def get_user_barangay():
                    return supabase.table("info").select("address_barangay").eq("user_id", user_id).execute()
                
                user_info_resp = supabase_retry(get_user_barangay)
                user_info = getattr(user_info_resp, "data", [])
                
                if user_info and user_info[0].get("address_barangay"):
                    user_barangay = user_info[0]["address_barangay"]
                    # Filter reports by same barangay
                    query = query.eq("address_barangay", user_barangay)
            elif barangay_param and barangay_param != "all":
                # Direct barangay filtering for admin
                query = query.eq("address_barangay", barangay_param)
                    
            query = query.order("created_at", desc=(sort=="desc")).limit(limit)
            return query.execute()
        
        resp = supabase_retry(fetch_main_reports)
        reports = getattr(resp, "data", []) or []

        print("Fetched reports:", reports)  # <<< Add this

        # Attach reporter info and images with retry mechanism
        for report in reports:
            author_id = report.get("user_id")
            
            # Retry for user data
            def fetch_reporter():
                return supabase.table("users").select("id, firstname, lastname, avatar_url, email").eq("id", author_id).execute()
            
            try:
                user_resp = supabase_retry(fetch_reporter)
                reporter = getattr(user_resp, "data", [None])[0] or DEFAULT_REPORTER
            except Exception as e:
                print(f"Failed to fetch reporter for report {report.get('id')}: {e}")
                reporter = DEFAULT_REPORTER
            
            report["reporter"] = reporter
            report["user_email"] = reporter.get("email")

            # Force barangay to string
            report["barangay"] = str(report.get("address_barangay") or "All")

            # Retry for images data
            def fetch_images():
                return supabase.table("report_images").select("image_url").eq("report_id", report["id"]).execute()
            
            try:
                images_resp = supabase_retry(fetch_images)
                report["images"] = [{"url": img["image_url"]} for img in getattr(images_resp, "data", [])] if images_resp.data else []
            except Exception as e:
                print(f"Failed to fetch images for report {report.get('id')}: {e}")
                report["images"] = []

        return reports
    except Exception as e:
        print("fetch_reports error:", e)
        return []

# ----------------- REPORTS / INCIDENTS -----------------
@app.route("/api/reports", methods=["GET"])
@token_required
def get_reports():
    try:
        limit = int(request.args.get("limit", 10))
        sort = request.args.get("sort", "desc").lower()
        filter_type = request.args.get("filter", "all").lower() # 'all', 'my', or 'barangay'
        barangay_filter_param = request.args.get("barangay")
        
        # Determine filtering options
        user_only_filter = filter_type == "my"
        barangay_filter = filter_type == "barangay"
        user_id_to_filter = request.user_id if user_only_filter else None

        # Pass the filtering options to fetch_reports
        reports = fetch_reports(
            limit=limit, 
            sort=sort, 
            user_only=user_only_filter,
            barangay_filter=barangay_filter,
            barangay_param=barangay_filter_param,
            user_id=user_id_to_filter
        ) 
        
        return jsonify({"status": "success", "reports": reports}), 200
    except Exception as e:
        # NOTE: Make sure DEFAULT_REPORTER is defined globally
        return jsonify({"status": "error", "message": str(e), "reports": []}), 500

@app.route("/api/reports", methods=["POST"])
@token_required
def add_report():
    user_id = request.user_id
    try:
        data = request.json if request.is_json else request.form

        report = {
            "user_id": user_id,
            "title": data.get("title"),
            "description": data.get("description"),
            "category": data.get("category", "Uncategorized"),
            "status": data.get("status", "Pending"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "deleted_at": None,
            "address_street": data.get("addressStreet", ""),
            "address_barangay": data.get("barangay", "All"),
            "latitude": float(data.get("lat")) if data.get("lat") else None,
            "longitude": float(data.get("lng")) if data.get("lng") else None
        }

        resp = supabase.table("reports").insert(report).execute()
        report_id = resp.data[0]["id"]

        # Save images if any
        images_urls = []
        if "images" in request.files:
            files = request.files.getlist("images")
            os.makedirs("uploads", exist_ok=True)
            for file in files:
                filename = f"report_{user_id}_{uuid.uuid4().hex}_{file.filename}"
                save_path = os.path.join("uploads", filename)
                file.save(save_path)
                image_url = f"/uploads/{filename}"
                images_urls.append(image_url)
                supabase.table("report_images").insert({
                    "report_id": report_id,
                    "image_url": image_url,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }).execute()

        user_resp = supabase.table("users").select("id, firstname, lastname, avatar_url").eq("id", user_id).execute()
        reporter = getattr(user_resp, "data", [None])[0] or DEFAULT_REPORTER

        report["images"] = [{"url": url} for url in images_urls]
        report["reporter"] = reporter

        return jsonify({"status": "success", "report": report}), 201
    except Exception as e:
        print("add_report error:", e)
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/reports/<report_id>/upload", methods=["POST"])
@token_required
def upload_report_file(report_id):
    if "file" not in request.files:
        return jsonify({"status": "error", "message": "No file uploaded"}), 400
    file = request.files["file"]
    try:
        os.makedirs("uploads", exist_ok=True)
        filename = f"report_{report_id}_{file.filename}"
        save_path = os.path.join("uploads", filename)
        file.save(save_path)
        attachment_url = f"/uploads/{filename}"
        supabase.table("reports").update({"attachment_url": attachment_url}).eq("id", report_id).execute()
        return jsonify({"status": "success", "url": attachment_url}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/reports/<report_id>", methods=["PUT"])
@token_required
def update_report(report_id):
    try:
        data = request.form if request.form else request.json

        # Fetch current report status before updating
        report_resp = supabase.table("reports").select("user_id, status, title").eq("id", report_id).execute()
        report = getattr(report_resp, "data", [None])[0]
        if not report or report["user_id"] != request.user_id:
            return jsonify({"status": "error", "message": "Not authorized"}), 403

        old_status = report.get("status")
        report_title = report.get("title")

        # Update report data
        update_data = {
            "title": data.get("title"),
            "description": data.get("description"),
            "category": data.get("category"),
            "address_street": data.get("addressStreet"),
            "address_barangay": data.get("barangay"),
            "latitude": float(data.get("lat")) if data.get("lat") else None,
            "longitude": float(data.get("lng")) if data.get("lng") else None,
            "status": data.get("status")  # <-- include status
        }
        supabase.table("reports").update(update_data).eq("id", report_id).execute()

        # Only create notification if status changed
        new_status = data.get("status")
        if new_status and new_status != old_status:
            create_report_notification(request.user_id, report_id, report_title, new_status)

        # Handle image replacement
        if "images" in request.files:
            # Delete existing images from backend DB
            existing_images_resp = supabase.table("report_images").select("*").eq("report_id", report_id).execute()
            existing_images = getattr(existing_images_resp, "data", [])
            for img in existing_images:
                # Delete file from filesystem
                file_path = img.get("image_url").lstrip("/")  # adjust if needed
                if os.path.exists(file_path):
                    os.remove(file_path)
                # Delete from DB
                supabase.table("report_images").delete().eq("id", img["id"]).execute()

            # Upload new images
            files = request.files.getlist("images")
            os.makedirs("uploads", exist_ok=True)
            for file in files:
                filename = f"report_{report_id}_{uuid.uuid4().hex}_{file.filename}"
                save_path = os.path.join("uploads", filename)
                file.save(save_path)
                image_url = f"/uploads/{filename}"
                supabase.table("report_images").insert({
                    "report_id": report_id,
                    "image_url": image_url,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }).execute()

        return jsonify({"status": "success", "message": "Report updated"}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/reports/<report_id>", methods=["PATCH"])
@token_required
def soft_delete_report(report_id):
    try:
        # Only allow the owner to delete
        report_resp = supabase.table("reports").select("user_id").eq("id", report_id).execute()
        report = getattr(report_resp, "data", [None])[0]
        if not report or report["user_id"] != request.user_id:
            return jsonify({"status": "error", "message": "Not authorized"}), 403

        # Soft delete by setting deleted_at
        supabase.table("reports").update({"deleted_at": datetime.now(timezone.utc).isoformat()}).eq("id", report_id).execute()

        return jsonify({"status": "success", "message": "Report deleted"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ----------------- REPORT STATS -----------------
@app.route("/api/stats", methods=["GET"])
@token_required
def get_stats():
    try:
        barangay_filter = request.args.get("barangay")
        
        # Use retry mechanism for stats query
        def fetch_stats():
            query = supabase.table("reports").select("status").is_("deleted_at", None)
            if barangay_filter and barangay_filter != "all":
                query = query.eq("address_barangay", barangay_filter)
            return query.execute()
        
        reports_resp = supabase_retry(fetch_stats)
        reports = getattr(reports_resp, "data", []) or []

        stats = {"totalReports": len(reports), "pending": 0, "ongoing": 0, "resolved": 0}

        for report in reports:
            status = (report.get("status") or "").lower()
            if status == "pending":
                stats["pending"] += 1
            elif status == "ongoing":
                stats["ongoing"] += 1
            elif status == "resolved":
                stats["resolved"] += 1

        return jsonify({"status": "success", **stats}), 200

    except Exception as e:
        print("get_stats error:", e)
        return jsonify({"status": "error", "message": str(e), "totalReports": 0, "pending": 0, "ongoing": 0, "resolved": 0}), 500

@app.route("/api/reports/categories", methods=["GET"])
@token_required
def get_report_categories():
    try:
        user_id = request.user_id
        barangay_filter = request.args.get("barangay")
        filter_type = request.args.get("filter", "user")  # "all" or "user"
        
        # Check if user is admin
        def get_user_role():
            return supabase.table("users").select("role").eq("id", user_id).execute()
        
        user_resp = supabase_retry(get_user_role)
        user_data = getattr(user_resp, "data", [])
        is_admin = user_data and user_data[0].get("role") == "Admin"
        
        # Use retry mechanism for Supabase query
        def fetch_categories():
            query = supabase.table("reports").select("category").is_("deleted_at", None)
            
            # Apply filtering logic
            if filter_type == "all":
                # Show all reports - used for regular users and admin "all" view
                if is_admin and barangay_filter and barangay_filter != "all":
                    # Admin with specific barangay filter
                    query = query.eq("address_barangay", barangay_filter)
                # else: show all reports (no additional filtering)
            else:
                # Legacy user filtering (not used anymore but kept for compatibility)
                if not is_admin:
                    # Get user's barangay for filtering
                    def get_user_barangay():
                        return supabase.table("info").select("address_barangay").eq("user_id", user_id).execute()
                    
                    user_info_resp = supabase_retry(get_user_barangay)
                    user_info = getattr(user_info_resp, "data", [])
                    
                    if user_info and user_info[0].get("address_barangay"):
                        user_barangay = user_info[0]["address_barangay"]
                        query = query.eq("address_barangay", user_barangay)
                        
            return query.execute()
        
        resp = supabase_retry(fetch_categories)
        reports = getattr(resp, "data", []) or []

        category_counts = {}
        for report in reports:
            if not report:
                continue
            cat = report.get("category") or "Uncategorized"
            category_counts[cat] = category_counts.get(cat, 0) + 1

        data = [{"name": k, "value": v} for k, v in category_counts.items()] or [{"name": "No Data", "value": 1}]
        return jsonify({"status": "success", "data": data}), 200
    except Exception as e:
        print("get_report_categories error:", e)
        return jsonify({"status": "error", "message": str(e), "data": [{"name": "No Data", "value": 1}]}), 500

# ----------------- BARANGAYS ENDPOINT -----------------
@app.route("/api/barangays", methods=["GET"])
@token_required
def get_barangays():
    try:
        # Get distinct barangays from reports
        def fetch_barangays():
            return supabase.table("reports").select("address_barangay").is_("deleted_at", None).execute()
        
        resp = supabase_retry(fetch_barangays)
        reports = getattr(resp, "data", []) or []
        
        # Get unique barangays
        barangays = set()
        for report in reports:
            barangay = report.get("address_barangay")
            if barangay:
                barangays.add(barangay)
        
        # Format for dropdown
        barangay_options = [{"value": barangay, "label": barangay} for barangay in sorted(barangays)]
        
        return jsonify({"status": "success", "barangays": barangay_options}), 200
    except Exception as e:
        print("get_barangays error:", e)
        return jsonify({"status": "error", "message": str(e), "barangays": []}), 500

# ----------------- REPORT STATS -----------------
@app.route("/api/stats/user", methods=["GET"])
@token_required
def get_user_stats():
    try:
        user_id = request.user_id
        
        # Get user's barangay first
        def get_user_barangay():
            return supabase.table("info").select("address_barangay").eq("user_id", user_id).execute()
        
        user_info_resp = supabase_retry(get_user_barangay)
        user_info = getattr(user_info_resp, "data", [])
        
        if user_info and user_info[0].get("address_barangay"):
            user_barangay = user_info[0]["address_barangay"]
            # Get all reports from same barangay
            reports_resp = supabase.table("reports").select("status").eq("address_barangay", user_barangay).is_("deleted_at", None).execute()
        else:
            # Fallback to user-only reports if no barangay info
            reports_resp = supabase.table("reports").select("status").eq("user_id", user_id).is_("deleted_at", None).execute()
            
        reports = getattr(reports_resp, "data", []) or []

        stats = {
            "totalReports": len(reports),
            "pending": 0,
            "ongoing": 0,
            "resolved": 0
        }

        for report in reports:
            status = (report.get("status") or "").lower()
            if status == "pending":
                stats["pending"] += 1
            elif status == "ongoing":
                stats["ongoing"] += 1
            elif status == "resolved":
                stats["resolved"] += 1

        return jsonify({"status": "success", **stats}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "totalReports": 0, "pending": 0, "ongoing": 0, "resolved": 0}), 500

# ----------------- ADMIN USER MANAGEMENT -----------------
@app.route("/api/users", methods=["GET"])
@token_required
def get_all_users():
    """
    Admin endpoint to get all users with their verification status
    """
    try:
        # Check if user is an admin
        user_resp = supabase.table("users").select("role").eq("id", request.user_id).execute()
        user = getattr(user_resp, "data", [None])[0]
        if not user or user.get("role") != "Admin":
            return jsonify({"status": "error", "message": "Admin access required"}), 403

        # Fetch all users (excluding deleted ones)
        users_resp = supabase.table("users").select("*").is_("deleted_at", None).order("created_at", desc=True).execute()
        users = getattr(users_resp, "data", []) or []

        # Remove password from response for security
        safe_users = []
        for user in users:
            safe_user = {k: v for k, v in user.items() if k != "password"}
            safe_users.append(safe_user)

        return jsonify({
            "status": "success", 
            "users": safe_users
        }), 200

    except Exception as e:
        print(f"Error fetching users: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/users/<user_id>/verification", methods=["PUT"])
@token_required
def update_user_verification(user_id):
    """
    Admin endpoint to update user verification status
    """
    try:
        # Check if user is an admin
        admin_resp = supabase.table("users").select("role").eq("id", request.user_id).execute()
        admin = getattr(admin_resp, "data", [None])[0]
        if not admin or admin.get("role") != "Admin":
            return jsonify({"status": "error", "message": "Admin access required"}), 403

        data = request.json
        isverified = data.get("isverified")
        
        if isverified is None:
            return jsonify({"status": "error", "message": "Verification status is required"}), 400

        # Get user info for notification
        user_resp = supabase.table("users").select("firstname, lastname, email, role").eq("id", user_id).is_("deleted_at", None).execute()
        user = getattr(user_resp, "data", [None])[0]
        if not user:
            return jsonify({"status": "error", "message": "User not found"}), 404

        # Don't allow verification changes on admin users
        if user.get("role") == "Admin":
            return jsonify({"status": "error", "message": "Cannot modify admin user verification"}), 400

        # Update user verification status
        supabase.table("users").update({
            "isverified": isverified,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", user_id).execute()

        # Create notification for the user
        status_message = "verified" if isverified else "unverified"
        notification_message = f"Your account has been {status_message} by the administration."
        
        try:
            supabase.table("notifications").insert({
                "user_id": user_id,
                "type": "Account Status",
                "title": f"Account {status_message.capitalize()}",
                "message": notification_message,
                "is_read": False,
                "created_at": datetime.utcnow().isoformat()
            }).execute()
        except Exception as e:
            print("Failed to create verification notification:", e)

        return jsonify({
            "status": "success", 
            "message": f"User {status_message} successfully"
        }), 200

    except Exception as e:
        print(f"Error updating user verification: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# ----------------- ADMIN USER VERIFICATION MANAGEMENT -----------------
@app.route("/api/users/verification", methods=["GET"])
@token_required
def get_users_for_verification():
    """
    Get all users with verification status for admin verification management
    """
    try:
        # Get user data first to check if admin
        user_id = request.user_id
        current_user_resp = supabase.table("users").select("role").eq("id", user_id).single().execute()
        current_user = current_user_resp.data if current_user_resp.data else {}
        
        if current_user.get("role") != "Admin":
            return jsonify({"status": "error", "message": "Admin access required"}), 403

        # Get all users with their basic info
        users_response = supabase.table("users").select(
            "id, firstname, lastname, email, role, isverified, "
            "avatar_url, created_at"
        ).is_("deleted_at", None).order("created_at", desc=True).execute()
        
        users = getattr(users_response, "data", []) or []
        
        # For each user, get their extended info to check full verification status
        enhanced_users = []
        for user in users:
            # Get user's info record to check full verification
            info_response = supabase.table("info").select("verified, address_barangay").eq("user_id", user["id"]).execute()
            info_data = getattr(info_response, "data", [])
            info = info_data[0] if info_data else {}
            
            # Add full verification status and address info
            enhanced_user = {
                **user,
                "verified": info.get("verified", False),  # Use "verified" for frontend consistency
                "fully_verified": info.get("verified", False),  # Keep both for compatibility
                "address_barangay": info.get("address_barangay")
            }
            enhanced_users.append(enhanced_user)
        
        return jsonify({
            "status": "success",
            "users": enhanced_users
        }), 200

    except Exception as e:
        print(f"Error fetching users for verification: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/users/<user_id>/info", methods=["GET"])
@token_required
def get_user_extended_info(user_id):
    """
    Get extended user information for verification review
    """
    try:
        # Get current user data to check if admin
        current_user_id = request.user_id
        current_user_resp = supabase.table("users").select("role").eq("id", current_user_id).single().execute()
        current_user = current_user_resp.data if current_user_resp.data else {}
        
        if current_user.get("role") != "Admin":
            return jsonify({"status": "error", "message": "Admin access required"}), 403

        # Get user's extended info from info table
        response = supabase.table("info").select(
            "birthdate, phone, address_barangay, address_street, "
            "address_city, address_province, bio"
        ).eq("user_id", user_id).execute()
        
        info_data = getattr(response, "data", [])
        info = info_data[0] if info_data else None
        
        return jsonify({
            "status": "success",
            "info": info
        }), 200

    except Exception as e:
        print(f"Error fetching user extended info: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/users/<user_id>/full-verification", methods=["PUT"])
@token_required
def update_full_verification(user_id):
    """
    Update user's full verification status
    """
    try:
        # Get current user data to check if admin
        current_user_id = request.user_id
        current_user_resp = supabase.table("users").select("role").eq("id", current_user_id).single().execute()
        current_user = current_user_resp.data if current_user_resp.data else {}
        
        if current_user.get("role") != "Admin":
            return jsonify({"status": "error", "message": "Admin access required"}), 403

        data = request.get_json()
        # Accept both field names for compatibility
        fully_verified = data.get("fully_verified", data.get("verified", False))

        # Get user info for notification
        user_resp = supabase.table("users").select(
            "firstname, lastname, email, role"
        ).eq("id", user_id).is_("deleted_at", None).execute()
        
        user = getattr(user_resp, "data", [None])[0]
        if not user:
            return jsonify({"status": "error", "message": "User not found"}), 404

        # Don't allow verification changes on admin users
        if user.get("role") == "Admin":
            return jsonify({"status": "error", "message": "Cannot modify admin user verification"}), 400

        # Update full verification status in the info table (not users table)
        supabase.table("info").update({
            "verified": fully_verified,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("user_id", user_id).execute()

        # Create notification for the user
        status_message = "fully verified" if fully_verified else "verification revoked"
        notification_message = f"Your account has been {status_message} by the administration after review of your complete information."
        
        try:
            supabase.table("notifications").insert({
                "user_id": user_id,
                "type": "Account Verification",
                "title": f"Account {status_message.title()}",
                "message": notification_message,
                "is_read": False,
                "created_at": datetime.utcnow().isoformat()
            }).execute()
        except Exception as e:
            print("Failed to create full verification notification:", e)

        return jsonify({
            "status": "success", 
            "message": f"User {status_message} successfully"
        }), 200

    except Exception as e:
        print(f"Error updating user full verification: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# ----------------- ADMIN STATUS UPDATE -----------------
@app.route("/api/reports/<report_id>/status", methods=["PUT"])
@token_required
def admin_update_report_status(report_id):
    """
    Admin endpoint to update report status and notify the user
    """
    try:
        # Check if user is an admin
        user_resp = supabase.table("users").select("role").eq("id", request.user_id).execute()
        user = getattr(user_resp, "data", [None])[0]
        if not user or user.get("role") != "admin":
            return jsonify({"status": "error", "message": "Admin access required"}), 403

        data = request.json
        new_status = data.get("status")
        
        if not new_status:
            return jsonify({"status": "error", "message": "Status is required"}), 400

        # Validate status value
        valid_statuses = ["Pending", "Ongoing", "Resolved"]
        if new_status not in valid_statuses:
            return jsonify({"status": "error", "message": f"Invalid status. Must be one of: {valid_statuses}"}), 400

        # Fetch current report to get user_id and title
        report_resp = supabase.table("reports").select("user_id, title, status").eq("id", report_id).is_("deleted_at", None).execute()
        report = getattr(report_resp, "data", [None])[0]
        if not report:
            return jsonify({"status": "error", "message": "Report not found"}), 404

        old_status = report.get("status")
        user_id = report.get("user_id")
        report_title = report.get("title")

        # Update report status
        supabase.table("reports").update({
            "status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", report_id).execute()

        # Create notification for the user if status changed
        if new_status != old_status and user_id:
            create_report_notification(user_id, report_id, report_title, new_status)

        return jsonify({
            "status": "success", 
            "message": f"Report status updated to {new_status}",
            "new_status": new_status
        }), 200

    except Exception as e:
        print(f"Error updating report status: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/reports/<report_id>", methods=["DELETE"])
@token_required
def admin_delete_report(report_id):
    """
    Admin endpoint to delete report and notify the user
    """
    try:
        # Check if user is an admin
        user_resp = supabase.table("users").select("role").eq("id", request.user_id).execute()
        user = getattr(user_resp, "data", [None])[0]
        if not user or user.get("role") != "admin":
            return jsonify({"status": "error", "message": "Admin access required"}), 403

        # Fetch current report to get user_id and title
        report_resp = supabase.table("reports").select("user_id, title").eq("id", report_id).is_("deleted_at", None).execute()
        report = getattr(report_resp, "data", [None])[0]
        if not report:
            return jsonify({"status": "error", "message": "Report not found"}), 404

        user_id = report.get("user_id")
        report_title = report.get("title")

        # Soft delete by setting deleted_at
        supabase.table("reports").update({
            "deleted_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", report_id).execute()

        # Create notification for the user
        if user_id:
            try:
                supabase.table("notifications").insert({
                    "user_id": user_id,
                    "report_id": report_id,
                    "type": "Report Deleted",
                    "title": "Report Removed",
                    "message": f'Your report "{report_title}" has been removed by the administration.',
                    "is_read": False,
                    "created_at": datetime.utcnow().isoformat()
                }).execute()
            except Exception as e:
                print("Failed to create deletion notification:", e)

        return jsonify({
            "status": "success", 
            "message": "Report deleted successfully"
        }), 200

    except Exception as e:
        print(f"Error deleting report: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# ----------------- NOTIF -----------------
# Fetch notifications
@app.route("/api/notifications", methods=["GET"])
@token_required
def get_notifications():
    user_id = request.user_id
    try:
        resp = supabase.table("notifications").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        notifications = getattr(resp, "data", []) or []
    except Exception as e:
        print("Error fetching notifications:", e)
        notifications = []
    return jsonify({"status": "success", "notifications": notifications}), 200

def create_report_notification(user_id, report_id, report_title, new_status):
    """
    Create a notification for a report status change.
    """
    status_messages = {
        "pending": f'Your report "{report_title}" is now PENDING.',
        "ongoing": f'Your report "{report_title}" is now ONGOING.',
        "resolved": f'Your report "{report_title}" has been RESOLVED by the authorities.',
    }

    message = status_messages.get(new_status.lower(), f'Your report "{report_title}" was updated.')

    try:
        supabase.table("notifications").insert({
            "user_id": user_id,
            "report_id": report_id,
            "type": "Status Update",
            "title": f'Report Status: {new_status.capitalize()}',
            "message": message,
            "is_read": False,
            "created_at": datetime.utcnow().isoformat()
        }).execute()
    except Exception as e:
        print("Failed to create report notification:", e)


# Mark notification as read
@app.route("/api/notifications/<int:notif_id>/read", methods=["POST"])
@token_required
def mark_notification_read(notif_id):
    user_id = request.user_id
    supabase.table("notifications").update({"is_read": True}).eq("id", notif_id).eq("user_id", user_id).execute()
    return jsonify({"status": "success"}), 200

# Delete notification
@app.route("/api/notifications/<int:notif_id>", methods=["DELETE"])
@token_required
def delete_notification(notif_id):
    user_id = request.user_id
    supabase.table("notifications").delete().eq("id", notif_id).eq("user_id", user_id).execute()
    return jsonify({"status": "success"}), 200

# Mark all notifications as read
@app.route("/api/notifications/read_all", methods=["POST"])
@token_required
def mark_all_notifications_read():
    user_id = request.user_id
    supabase.table("notifications").update({"is_read": True}).eq("user_id", user_id).execute()
    return jsonify({"status": "success"}), 200



# ----------------- SERVE UPLOADED FILES -----------------
UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")

@app.route("/api/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

# ----------------- RUN APP -----------------
if __name__ == "__main__":
    os.makedirs("uploads", exist_ok=True)
    app.run(debug=True, port=5000)
