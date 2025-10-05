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
            "firstname": user.get("firstname", ""),
            "lastname": user.get("lastname", ""),
            "email": user.get("email", ""),
            "isverified": user.get("isverified", False),
            "label": "Verified" if user.get("isverified", False) else "Unverified",
            "avatar_url": user.get("avatar_url", "/default-avatar.png"),
            "bio": info.get("bio", ""),
            "phone": info.get("phone", ""),
            "address": info.get("address", ""),
            "address_street": info.get("address_street", ""),
            "address_barangay": info.get("address_barangay") or user.get("address_barangay", "Barretto"),
            "address_province": info.get("address_province") or user.get("address_province", "Zambales"),
            "address_city": info.get("address_city") or user.get("address_city", "Olongapo"),
            "birthdate": info.get("birthdate", "")
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

    # ----------------- PREPARE UPDATES -----------------
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
        # Update users table if needed
        if user_update:
            supabase.table("users").update(user_update).eq("id", user_id).execute()

        # Upsert info table
        supabase.table("info").upsert(info_update, on_conflict=["user_id"]).execute()

        # Fetch updated data
        user_resp = supabase.table("users").select("*").eq("id", user_id).execute()
        info_resp = supabase.table("info").select("*").eq("user_id", user_id).execute()
        user = user_resp.data[0] if user_resp.data else {}
        info = info_resp.data[0] if info_resp.data else {}

        profile = {
            "id": user.get("id"),
            "firstname": user.get("firstname"),
            "lastname": user.get("lastname"),
            "email": user.get("email"),
            "isverified": user.get("isverified", False),
            "avatar_url": user.get("avatar_url") or "/default-avatar.png",
            "bio": info.get("bio", ""),
            "phone": info.get("phone", ""),
            "address": info.get("address", ""),
            "address_barangay": info.get("address_barangay") or user.get("address_barangay", "Barretto"),
            "address_province": info.get("address_province") or user.get("address_province", "Zambales"),
            "address_city": info.get("address_city") or user.get("address_city", "Olongapo")
        }

        return jsonify({"status": "success", "profile": profile}), 200

    except Exception as e:
        print("Update error:", str(e))
        return jsonify({"status": "error", "message": str(e)}), 500

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
@app.route("/api/profile/upload-avatar", methods=["POST"])
@token_required
def upload_avatar():
    user_id = request.user_id

    # Default avatar if no file is uploaded
    avatar_url = "/default-avatar.png"

    if "avatar" in request.files:
        file = request.files["avatar"]

        # Validate file type
        if file.mimetype not in ["image/jpeg", "image/png"]:
            return jsonify({"status": "error", "message": "Invalid file type"}), 400

        try:
            # Process image
            img = Image.open(file.stream).convert("RGB")
            img.thumbnail((512, 512))

            # Save file
            os.makedirs("uploads", exist_ok=True)
            filename = f"profile_{user_id}_{uuid.uuid4().hex}.jpg"
            save_path = os.path.join("uploads", filename)
            img.save(save_path, format="JPEG")
            avatar_url = f"/uploads/{filename}"

        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500

    # Update avatar URL in users table
    supabase.table("users").update({"avatar_url": avatar_url}).eq("id", user_id).execute()

    return jsonify({"status": "success", "url": avatar_url}), 200

# ----------------- DASHBOARD STATS -----------------
DEFAULT_REPORTER = {"id": 0, "firstname": "Unknown", "lastname": "", "avatar_url": "/default-avatar.png"}

def fetch_global_reports(limit=10, sort="desc"):
    try:
        resp = supabase.table("reports") \
            .select("*") \
            .order("created_at", desc=(sort=="desc")) \
            .limit(limit) \
            .execute()
        reports = resp.data if resp.data else []

        for report in reports:
            user_id = report.get("user_id")
            reporter = None
            if user_id:
                try:
                    user_resp = supabase.table("users").select("id, firstname, lastname, avatar_url").eq("id", user_id).execute()
                    reporter = user_resp.data[0] if user_resp.data else None
                except Exception:
                    reporter = None
            report["reporter"] = reporter or DEFAULT_REPORTER

        return reports
    except Exception as e:
        print("fetch_global_reports error:", e)
        return []

@app.route("/api/reports", methods=["GET"])
@token_required
def get_global_reports():
    try:
        # Parse query params safely
        try:
            limit = int(request.args.get("limit", 10))
        except ValueError:
            limit = 10
        sort = request.args.get("sort", "desc").lower()
        if sort not in ["asc", "desc"]:
            sort = "desc"

        # Fetch reports
        resp = (
            supabase.table("reports")
            .select("*")
            .is_("deleted_at", None)
            .order("created_at", desc=(sort=="desc"))
            .limit(limit)
            .execute()
        )
        reports = resp.data if resp.data else []

        # Attach reporter info safely
        for report in reports:
            user_id = report.get("user_id")
            reporter = None
            if user_id:
                try:
                    user_resp = supabase.table("users").select("id, firstname, lastname, avatar_url").eq("id", user_id).execute()
                    reporter = user_resp.data[0] if user_resp.data else None
                except Exception:
                    reporter = None
            report["reporter"] = reporter or DEFAULT_REPORTER

        return jsonify({"status": "success", "reports": reports}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "reports": []}), 500

@app.route("/api/stats", methods=["GET"])
def get_stats():
    try:
        limit = int(request.args.get("limit", 10))
        sort = request.args.get("sort", "desc")
        reports = fetch_global_reports(limit, sort)
        return jsonify({"status": "success", "reports": reports}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "reports": []}), 500

@app.route("/api/reports/categories", methods=["GET"])
@token_required
def get_report_categories():
    try:
        resp = supabase.table("reports").select("category").is_("deleted_at", None).execute()
        reports = resp.data if resp.data else []

        category_counts = {}
        for report in reports:
            cat = report.get("category", "Uncategorized")
            category_counts[cat] = category_counts.get(cat, 0) + 1

        # If no categories exist, provide a default placeholder
        if not category_counts:
            data = [{"name": "No Data", "value": 1}]
        else:
            data = [{"name": k, "value": v} for k, v in category_counts.items()]

        return jsonify({"status": "success", "data": data}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "data": [{"name": "No Data", "value": 1}]}), 500



# ----------------- INCIDENTS -----------------
# Create a new incident (similar to reports)
@app.route("/api/incidents", methods=["POST"])
@token_required
def create_incident():
    data = request.json
    user_id = request.user_id

    try:
        incident = {
            "user_id": user_id,
            "title": data.get("title"),
            "description": data.get("description"),
            "status": "Pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "deleted_at": None
        }
        supabase.table("incidents").insert(incident).execute()
        return jsonify({"status": "success", "incident": incident}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# Get incidents (optionally filter by user)
@app.route("/api/incidents", methods=["GET"])
@token_required
def get_incidents():
    user_only = request.args.get("user_only", "false").lower() == "true"
    try:
        query = supabase.table("incidents").select("*").is_("deleted_at", None)
        if user_only:
            query = query.eq("user_id", request.user_id)
        incidents_resp = query.execute()
        incidents = incidents_resp.data if incidents_resp.data else []

        # Attach reporter info
        for inc in incidents:
            user_resp = supabase.table("users").select("firstname, lastname, avatar_url").eq("id", inc["user_id"]).execute()
            if user_resp.data:
                inc["reporter"] = user_resp.data[0]

        return jsonify({"status": "success", "incidents": incidents}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# Update an incident
@app.route("/api/incidents/<incident_id>", methods=["PUT"])
@token_required
def update_incident(incident_id):
    data = request.json
    try:
        update_fields = {k: data[k] for k in ["title", "description", "status"] if k in data}
        supabase.table("incidents").update(update_fields).eq("id", incident_id).execute()
        return jsonify({"status": "success", "updated": update_fields}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# Soft delete an incident
@app.route("/api/incidents/<incident_id>", methods=["DELETE"])
@token_required
def delete_incident(incident_id):
    try:
        now = datetime.now(timezone.utc).isoformat()
        supabase.table("incidents").update({"deleted_at": now}).eq("id", incident_id).execute()
        return jsonify({"status": "success", "message": "Incident flagged as deleted"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# Upload incident attachment
@app.route("/api/incidents/<incident_id>/upload", methods=["POST"])
@token_required
def upload_incident_file(incident_id):
    if "file" not in request.files:
        return jsonify({"status": "error", "message": "No file uploaded"}), 400

    file = request.files["file"]
    try:
        filename = f"incident_{incident_id}_{file.filename}"
        os.makedirs("uploads", exist_ok=True)
        save_path = os.path.join("uploads", filename)
        file.save(save_path)

        attachment_url = f"/uploads/{filename}"
        supabase.table("incidents").update({"attachment_url": attachment_url}).eq("id", incident_id).execute()

        return jsonify({"status": "success", "url": attachment_url}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ----------------- RUN APP -----------------
if __name__ == "__main__":
    os.makedirs("uploads", exist_ok=True)
    app.run(debug=True, port=5000)
