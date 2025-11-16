"""
Email Verification Routes
Handles email verification and validation
"""
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone, timedelta
import traceback

from utils import supabase, generate_verification_code, send_verification_email
from config import Config

verification_bp = Blueprint('verification', __name__)


@verification_bp.route("/email/send-code", methods=["POST"])
def send_email_code():
    """Send verification code to email"""
    data = request.json
    email = data.get("email")
    user_id = data.get("user_id")

    if not email or not user_id:
        return jsonify({"status": "error", "message": "Email and user_id required"}), 400

    code = generate_verification_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=Config.EMAIL_CODE_EXPIRY)

    try:
        supabase.table("email_verifications").upsert({
            "user_id": user_id,
            "email": email,
            "code": code,
            "expires_at": expires_at.isoformat(),
            "is_used": False
        }, on_conflict="user_id").execute()

        if send_verification_email(email, code):
            print(f"📧 Verification code resent to {email}")
            return jsonify({"status": "success", "message": "Verification code sent!"}), 200
        else:
            print(f"❌ Resend failed for {email}")
            return jsonify({"status": "error", "message": "Failed to send email"}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@verification_bp.route("/verification/validate-access", methods=["POST"])
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


@verification_bp.route("/email/verify-code", methods=["POST"])
def verify_email_code():
    """Verify email code"""
    data = request.json or {}
    email = data.get("email")
    code = data.get("code")
    user_id = data.get("user_id")

    if not user_id or not code:
        print("❌ Verification missing user_id or code")
        return jsonify({"status": "error", "message": "user_id and code required"}), 400

    try:
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
            print(f"❌ Invalid verification code for user {user_id}")
            return jsonify({"status": "invalid_code", "message": "Invalid or expired code"}), 400

        code_record = records[0]

        # Parse expiry
        raw_expires = code_record.get("expires_at")
        if isinstance(raw_expires, str):
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

        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        now_utc = datetime.now(timezone.utc)
        if now_utc > expires_at:
            print("❌ Verification code expired")
            return jsonify({"status": "expired", "message": "Verification code expired"}), 400

        # Mark code as used
        supabase.table("email_verifications").update({"is_used": True}).eq("id", code_record["id"]).execute()

        # Mark user verified
        supabase.table("users").update({"isverified": True}).eq("id", user_id).execute()

        # Clean up verification session
        try:
            supabase.table("verification_sessions").delete().eq("user_id", user_id).execute()
        except Exception:
            pass

        print(f"✅ Email verified for user {user_id}")
        return jsonify({"status": "success", "message": "Email verified!"}), 200

    except Exception as e:
        print("\n=== ERROR in /api/email/verify-code ===")
        print("Error:", e)
        print(traceback.format_exc())
        return jsonify({"status": "error", "message": "Unexpected error occurred"}), 500
