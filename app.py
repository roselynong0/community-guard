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

# ----------------- LOAD ENV -----------------
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
EMAIL_SECRET_KEY = os.getenv("EMAIL_SECRET_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# ----------------- CLIENT -----------------
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ----------------- APP -----------------
app = Flask(__name__)
CORS(app, supports_credentials=True)

# ----------------- SESSION -----------------
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header:
            return jsonify({"status": "unauthorized"}), 401

        parts = auth_header.split(" ")
        if len(parts) != 2 or parts[0] != "Bearer":
            return jsonify({"status": "unauthorized"}), 401

        token = parts[1]

        # Look up session in Supabase
        session_resp = supabase.table("sessions").select("*").eq("token", token).execute()
        sessions = getattr(session_resp, "data", []) or []
        if not sessions:
            return jsonify({"status": "invalid_token"}), 401

        session = sessions[0]

        # Check expiry
        now = datetime.now(timezone.utc)
        if now > datetime.fromisoformat(session["expires_at"]):
            print(f"⚠️ Expired session detected for user_id={session['user_id']}, token={token[:8]}...")  
            return jsonify({"status": "expired_token"}), 401

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
    try:
        resp = (
            supabase.table("sessions")
            .select("id, token, expires_at, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )

        sessions = resp.data if resp.data else []

        return jsonify({"status": "success", "sessions": sessions}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "sessions": []}), 500


# ----------------- REVOKE SINGLE SESSION -----------------
@app.route("/api/sessions/<session_id>", methods=["DELETE"])
@token_required
def revoke_session(session_id):
    user_id = request.user_id
    try:
        # Only delete session if it belongs to this user
        supabase.table("sessions").delete().eq("id", session_id).eq("user_id", user_id).execute()
        return jsonify({"status": "success", "message": "Session revoked"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ----------------- REVOKE ALL SESSIONS -----------------
@app.route("/api/sessions/revoke_all", methods=["DELETE"])
@token_required
def revoke_all_sessions():
    try:
        user_id = request.user_id

        # Delete all sessions for this user
        supabase.table("sessions").delete().eq("user_id", user_id).execute()

        # Fetch updated session list (should be empty after delete)
        resp = (
            supabase.table("sessions")
            .select("id, token, expires_at, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        sessions = resp.data if resp.data else []

        return jsonify({
            "status": "success",
            "message": "All sessions revoked",
            "sessions": sessions
        }), 200

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e),
            "sessions": []
        }), 500

# ----------------- REGISTER -----------------
@app.route("/api/register", methods=["POST"])
def register():
    data = request.json
    email = data.get("email")
    firstname = data.get("firstname")
    lastname = data.get("lastname")
    password = data.get("password")
    address_barangay = data.get("address_barangay") or "Unspecified"
    address_city = data.get("address_city") or "Olongapo"

    try:
        # Check existing user
        existing_resp = supabase.table("users").select("*").eq("email", email).execute()
        existing_users = getattr(existing_resp, "data", []) or []

        if existing_users:
            return jsonify({"status": "duplicate", "message": "Email already registered"}), 400

        # Hash password
        hashed_pw = hashpw(password.encode(), gensalt()).decode()

        # Insert user
        user_insert = supabase.table("users").insert({
            "firstname": firstname,
            "lastname": lastname,
            "email": email,
            "password": hashed_pw,
            "isverified": False,
            "avatar_url": "/default-avatar.png",
        }).execute()

        user_data = getattr(user_insert, "data", []) or []
        if not user_data:
            return jsonify({"status": "error", "message": "Failed to create user"}), 500

        new_user_id = user_data[0]["id"]

        # Insert into info
        info_insert = supabase.table("info").insert({
            "user_id": new_user_id,
            "address_barangay": address_barangay,
            "address_city": address_city
        }).execute()

        info_data = getattr(info_insert, "data", []) or []
        if not info_data:
            # Rollback user
            supabase.table("users").delete().eq("id", new_user_id).execute()
            return jsonify({"status": "error", "message": "Failed to insert user info. Registration rolled back."}), 500

        return jsonify({"status": "success"}), 201

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ----------------- LOGIN -----------------
@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    # Find user
    resp = supabase.table("users").select("*").eq("email", email).is_("deleted_at", None).execute()
    users = getattr(resp, "data", []) or []
    if not users:
        return jsonify({"status": "not_found"}), 404

    user = users[0]
    if not checkpw(password.encode(), user["password"].encode()):
        return jsonify({"status": "invalid_credentials"}), 401

    # 1. Look for existing valid session
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
        user_resp = supabase.table("users").select("*").eq("id", user_id).execute()
        info_resp = supabase.table("info").select("*").eq("user_id", user_id).execute()

        if not user_resp.data:
            return jsonify({"status": "not_found"}), 404

        user = user_resp.data[0]
        info = info_resp.data[0] if info_resp.data else {}

        profile = {
            "id": user.get("id"),
            "firstname": with_default(user.get("firstname"), "No name added yet"),
            "lastname": with_default(user.get("lastname"), ""),
            "email": with_default(user.get("email"), "No email added yet"),
            "isverified": user.get("isverified", False),
            "label": "Verified" if user.get("isverified", False) else "Unverified",
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

    # Prepare updates
    user_update = {k: data[k] for k in ["firstname", "lastname"] if k in data}
    info_update = {
        "user_id": user_id,
        "bio": data.get("bio", ""),
        "phone": data.get("phone", ""),
        "address": data.get("address", ""),
        "address_barangay": data.get("address_barangay", "Barretto"),
        "address_province": data.get("address_province", "Zambales"),
        "address_city": data.get("address_city", "Olongapo")
    }

    try:
        if user_update:
            supabase.table("users").update(user_update).eq("id", user_id).execute()

        supabase.table("info").upsert(info_update, on_conflict=["user_id"]).execute()

        # Fetch updated data
        user_resp = supabase.table("users").select("*").eq("id", user_id).execute()
        info_resp = supabase.table("info").select("*").eq("user_id", user_id).execute()
        user = user_resp.data[0] if user_resp.data else {}
        info = info_resp.data[0] if info_resp.data else {}

        profile = {
            "isverified": user.get("isverified", False),
            "avatar_url": with_default(user.get("avatar_url"), "/default-avatar.png"),
            "bio": with_default(info.get("bio"), "No information added yet"),
            "phone": with_default(info.get("phone"), "No contact info yet"),
            "address": with_default(info.get("address"), ""),
            "address_barangay": with_default(info.get("address_barangay"), user.get("address_barangay") or "No barangay selected"),
            "address_province": with_default(info.get("address_province"), user.get("address_province") or "Zambales"),
            "address_city": with_default(info.get("address_city"), user.get("address_city") or "Olongapo")
        }

        return jsonify({"status": "success", "profile": profile}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

def with_default(value, default):
    return default if value is None or value == "" else value


# ----------------- DELETE PROFILE -----------------
@app.route("/api/profile", methods=["DELETE"])
@token_required
def delete_profile():
    user_id = request.user_id
    try:
        # Soft delete: set deleted_at to now
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        supabase.table("users").update({"deleted_at": now}).eq("id", user_id).execute()
        return jsonify({"status": "success", "message": "Profile flagged as deleted"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ----------------- UPLOAD AVATAR -----------------
# Example: upload avatar to Supabase Storage
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
        # Upload to Supabase Storage
        filename = f"profile_{user_id}_{uuid.uuid4().hex}.jpg"
        bucket_name = "avatars"  # make sure you have this bucket in Supabase
        file_contents = file.read()

        supabase.storage.from_(bucket_name).upload(filename, file_contents, {"content-type": file.mimetype})

        # Get public URL
        avatar_url = supabase.storage.from_(bucket_name).get_public_url(filename)["publicUrl"]

        # Update users table
        supabase.table("users").update({"avatar_url": avatar_url}).eq("id", user_id).execute()

        return jsonify({"status": "success", "url": avatar_url}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ----------------- DASHBOARD / REPORTS -----------------
DEFAULT_REPORTER = {"id": 0, "firstname": "Unknown", "lastname": "", "avatar_url": "/default-avatar.png"}

def fetch_reports(limit=10, sort="desc", user_only=False, user_id=None):
    """Fetch reports (including incidents) with optional user filter and their images."""
    try:
        query = supabase.table("reports").select("*").is_("deleted_at", None)
        if user_only and user_id:
            query = query.eq("user_id", user_id)
        query = query.order("created_at", desc=(sort=="desc")).limit(limit)
        resp = query.execute()
        reports = getattr(resp, "data", []) or []

        # Attach reporter info and images
        for report in reports:
            author_id = report.get("user_id")
            user_resp = supabase.table("users").select("id, firstname, lastname, avatar_url, email").eq("id", author_id).execute()
            reporter = getattr(user_resp, "data", [None])[0] or DEFAULT_REPORTER
            report["reporter"] = reporter
            report["user_email"] = reporter.get("email")

            # Fetch all images for this report
            images_resp = supabase.table("report_images").select("image_url").eq("report_id", report["id"]).execute()
            report["images"] = [{"url": img["image_url"]} for img in getattr(images_resp, "data", [])] if images_resp.data else []

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
        user_only = request.args.get("user_only", "false").lower() == "true"

        reports = fetch_reports(limit, sort, user_only, request.user_id)
        return jsonify({"status": "success", "reports": reports}), 200
    except Exception as e:
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

        # Only allow the owner to update
        report_resp = supabase.table("reports").select("user_id").eq("id", report_id).execute()
        report = getattr(report_resp, "data", [None])[0]
        if not report or report["user_id"] != request.user_id:
            return jsonify({"status": "error", "message": "Not authorized"}), 403

        # Update report data
        update_data = {
            "title": data.get("title"),
            "description": data.get("description"),
            "category": data.get("category"),
            "address_street": data.get("addressStreet"),
            "address_barangay": data.get("barangay"),
            "latitude": float(data.get("lat")) if data.get("lat") else None,
            "longitude": float(data.get("lng")) if data.get("lng") else None,
        }

        supabase.table("reports").update(update_data).eq("id", report_id).execute()

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
        reports_resp = supabase.table("reports").select("status").is_("deleted_at", None).execute()
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
        resp = supabase.table("reports").select("category").is_("deleted_at", None).execute()
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

# ----------------- SERVE UPLOADED FILES -----------------
UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")

@app.route("/api/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

# ----------------- RUN APP -----------------
if __name__ == "__main__":
    os.makedirs("uploads", exist_ok=True)
    app.run(debug=True, port=5000)
