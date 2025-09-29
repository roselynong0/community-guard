# ----------------- APP SETUP -----------------
from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client
import os
from dotenv import load_dotenv
from datetime import datetime, timezone, timedelta
import jwt
from bcrypt import hashpw, gensalt, checkpw
from functools import wraps

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
CORS(app)

# ----------------- JWT DECORATOR -----------------
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if "Authorization" in request.headers:
            auth_header = request.headers["Authorization"]
            token = auth_header.split(" ")[1] if len(auth_header.split()) > 1 else None

        if not token:
            return jsonify({"status": "unauthorized"}), 401

        try:
            payload = jwt.decode(token, EMAIL_SECRET_KEY, algorithms=["HS256"])
            request.user_id = payload["user_id"]
        except Exception as e:
            return jsonify({"status": "invalid_token", "message": str(e)}), 401

        return f(*args, **kwargs)
    return decorated

# ----------------- REGISTER -----------------
@app.route("/api/register", methods=["POST"])
def register():
    data = request.json
    email = data.get("email")
    firstname = data.get("firstname")
    lastname = data.get("lastname")
    password = data.get("password")
    address_barangay = data.get("address_barangay") or "Unspecified"

    try:
        existing_resp = supabase.table("users").select("*").eq("email", email).execute()
        existing_users = existing_resp.data if hasattr(existing_resp, "data") else []

        if existing_users:
            return jsonify({"status": "duplicate"}), 400

        hashed_pw = hashpw(password.encode(), gensalt()).decode()

        supabase.table("users").insert({
            "firstname": firstname,
            "lastname": lastname,
            "email": email,
            "password": hashed_pw,
            "isverified": False,
            "avatar_url": "/default-avatar.png",
            "address_barangay": address_barangay,
            "address_province": "Zambales"
        }).execute()

        return jsonify({"status": "success"}), 201

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ----------------- LOGIN -----------------
@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    try:
        resp = supabase.table("users").select("*").eq("email", email).execute()
        users = resp.data if hasattr(resp, "data") else []

        if not users:
            return jsonify({"status": "not_found"}), 404

        user = users[0]
        if not checkpw(password.encode(), user["password"].encode()):
            return jsonify({"status": "invalid_credentials"}), 401

        token_payload = {
            "user_id": user["id"],
            "email": user["email"],
            "exp": datetime.now(timezone.utc) + timedelta(hours=24)
        }
        token = jwt.encode(token_payload, EMAIL_SECRET_KEY, algorithm="HS256")

        session = {
            "user": {
                "id": user["id"],
                "firstname": user["firstname"],
                "lastname": user["lastname"],
                "email": user["email"],
                "isverified": user.get("isverified", False),
                "avatar_url": user.get("avatar_url", "/default-avatar.png"),
                "label": "Verified" if user.get("isverified", False) else "Unverified"
            },
            "token": token
        }

        return jsonify({"status": "success", "session": session}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ----------------- GET PROFILE -----------------
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
            "id": user["id"],
            "firstname": user["firstname"],
            "lastname": user["lastname"],
            "email": user["email"],
            "isverified": user.get("isverified", False),
            "label": "Verified" if user.get("isverified", False) else "Unverified",
            "avatar_url": user.get("avatar_url", "/default-avatar.png"),
            "birthdate": info.get("birthdate"),
            "phone": info.get("phone"),
            "address": info.get("address"),
            "barangay": info.get("address_barangay") or user.get("address_barangay"),
            "province": info.get("address_province") or user.get("address_province", "Zambales"),
            "bio": info.get("bio")
        }

        return jsonify({"status": "success", "profile": profile}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ----------------- UPDATE PROFILE -----------------
@app.route("/api/profile", methods=["PUT"])
@token_required
def update_profile():
    user_id = request.user_id
    data = request.json or {}

    # Only update users table fields
    user_update = {k: data[k] for k in ["firstname", "lastname"] if k in data}

    # Only update info table fields (excluding full address)
    info_update = {k: data[k] for k in ["bio", "phone", "address_barangay", "address_province"] if k in data}

    try:
        # Update users
        if user_update:
            print("Updating users:", user_update)
            supabase.table("users").update(user_update).eq("id", user_id).execute()

        # Update info (only if row exists)
        info_resp = supabase.table("info").select("*").eq("user_id", user_id).execute()
        if info_resp.data:
            print("Updating info:", info_update)
            supabase.table("info").update(info_update).eq("user_id", user_id).execute()
        else:
            # Insert new info row if none exists
            print("Inserting new info:", info_update)
            supabase.table("info").insert({**info_update, "user_id": user_id}).execute()

        # Return updated profile using join logic
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
            "avatar_url": user.get("avatar_url", "/default-avatar.png"),
            "bio": info.get("bio", ""),
            "phone": info.get("phone", ""),
            "address_barangay": info.get("address_barangay") or user.get("address_barangay", "Barretto"),
            "address_province": info.get("address_province") or user.get("address_province", "Zambales")
        }

        return jsonify({"status": "success", "profile": profile}), 200

    except Exception as e:
        print("Update error:", str(e))
        return jsonify({"status": "error", "message": str(e)}), 500

    user_id = request.user_id
    data = request.json

    # Only fields we want to update in users
    user_update = {k: data[k] for k in ["firstname", "lastname"] if k in data}

    # Fields for the info table (excluding address)
    info_update = {k: data[k] for k in ["bio", "phone", "address_barangay", "address_province"] if k in data}

    try:
        # Update users table
        if user_update:
            supabase.table("users").update(user_update).eq("id", user_id).execute()
            print("Updating users:", user_update)

        # Update info table
        if info_update:
            update_resp = supabase.table("info").update(info_update).eq("user_id", user_id).execute()
            print("Updating info:", info_update, "Update response:", update_resp)

            # If no row was updated, insert a new one
            if update_resp.count == 0:
                supabase.table("info").insert({**info_update, "user_id": user_id}).execute()
                print("Inserted new info row for user:", user_id)

        # Return updated profile
        user_resp = supabase.table("users").select("*").eq("id", user_id).execute()
        info_resp = supabase.table("info").select("*").eq("user_id", user_id).execute()

        user = user_resp.data[0]
        info = info_resp.data[0] if info_resp.data else {}

        profile = {
            "id": user["id"],
            "firstname": user["firstname"],
            "lastname": user["lastname"],
            "email": user["email"],
            "isverified": user.get("isverified", False),
            "avatar_url": user.get("avatar_url", "/default-avatar.png"),
            "bio": info.get("bio"),
            "phone": info.get("phone"),
            "address": info.get("address"),
            "address_barangay": info.get("address_barangay") or user.get("address_barangay"),
            "address_province": info.get("address_province") or user.get("address_province", "Zambales")
        }

        return jsonify({"status": "success", "profile": profile}), 200

    except Exception as e:
        print("Update error:", e)
        return jsonify({"status": "error", "message": str(e)}), 500

    user_id = request.user_id
    data = request.json

    # Only update firstname and lastname in users table
    user_update = {k: data[k] for k in ["firstname", "lastname"] if k in data}

    # Only update bio, phone, address_barangay, address_province in info table
    info_update = {k: data[k] for k in ["bio", "phone", "address_barangay", "address_province"] if k in data}

    try:
        if user_update:
            print("Updating users:", user_update)
            supabase.table("users").update(user_update).eq("id", user_id).execute()

        if info_update:
            print("Upserting info:", {**info_update, "user_id": user_id})
            supabase.table("info").upsert({**info_update, "user_id": user_id}, on_conflict=["user_id"]).execute()

        # Return updated profile
        user_resp = supabase.table("users").select("*").eq("id", user_id).execute()
        info_resp = supabase.table("info").select("*").eq("user_id", user_id).execute()

        user = user_resp.data[0]
        info = info_resp.data[0] if info_resp.data else {}

        profile = {
            "id": user["id"],
            "firstname": user["firstname"],
            "lastname": user["lastname"],
            "email": user["email"],
            "isverified": user.get("isverified", False),
            "avatar_url": user.get("avatar_url", "/default-avatar.png"),
            "bio": info.get("bio"),
            "phone": info.get("phone"),
            "address_barangay": info.get("address_barangay") or user.get("address_barangay"),
            "address_province": info.get("address_province") or user.get("address_province", "Zambales")
        }

        return jsonify({"status": "success", "profile": profile}), 200

    except Exception as e:
        print("Update error:", e)
        return jsonify({"status": "error", "message": str(e)}), 500

    user_id = request.user_id
    data = request.json or {}

    # ----------------- PREPARE UPDATES -----------------
    # Only include fields if they exist, else set defaults to avoid NOT NULL errors
    user_update = {}
    info_update = {}

    if "firstname" in data:
        user_update["firstname"] = data["firstname"] or ""
    if "lastname" in data:
        user_update["lastname"] = data["lastname"] or ""

    info_update["user_id"] = user_id
    info_update["bio"] = data.get("bio") or ""
    info_update["phone"] = data.get("phone") or ""
    info_update["address"] = data.get("address") or ""
    info_update["address_barangay"] = data.get("address_barangay") or "Barretto"
    info_update["address_province"] = data.get("address_province") or "Zambales"

    try:
        # ----------------- UPDATE USERS TABLE -----------------
        if user_update:
            print("Updating users:", user_update)
            supabase.table("users").update(user_update).eq("id", user_id).execute()

        # ----------------- UPSERT INFO TABLE -----------------
        print("Upserting info:", info_update)
        supabase.table("info").upsert(
            info_update,
            on_conflict=["user_id"]  # ensure 'user_id' is UNIQUE in the 'info' table
        ).execute()

        # ----------------- RETURN UPDATED PROFILE -----------------
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
            "avatar_url": user.get("avatar_url", "/default-avatar.png"),
            "bio": info.get("bio", ""),
            "phone": info.get("phone", ""),
            "address": info.get("address", ""),
            "address_barangay": info.get("address_barangay") or user.get("address_barangay", "Barretto"),
            "address_province": info.get("address_province") or user.get("address_province", "Zambales")
        }

        return jsonify({"status": "success", "profile": profile}), 200

    except Exception as e:
        # Catch Supabase errors and return details for easier debugging
        print("Update error:", str(e))
        return jsonify({"status": "error", "message": str(e)}), 500

    user_id = request.user_id
    data = request.json

    try:
        # Update users table
        supabase.table("users").update({
            "firstname": data.get("firstname"),
            "lastname": data.get("lastname")
        }).eq("id", user_id).execute()

        # Prepare info table update
        info_update = {
            "user_id": user_id,
            "bio": data.get("bio") or "",
            "phone": data.get("phone") or "",
            "address": data.get("address") or "",
            "address_barangay": data.get("address_barangay") or "Barretto",
            "address_province": data.get("address_province") or "Zambales"
        }

        supabase.table("info").upsert(info_update, on_conflict=["user_id"]).execute()

        # Return updated profile
        user_resp = supabase.table("users").select("*").eq("id", user_id).execute()
        info_resp = supabase.table("info").select("*").eq("user_id", user_id).execute()
        user = user_resp.data[0]
        info = info_resp.data[0]

        profile = {
            "id": user["id"],
            "firstname": user["firstname"],
            "lastname": user["lastname"],
            "email": user["email"],
            "avatar_url": user.get("avatar_url", "/default-avatar.png"),
            "bio": info.get("bio"),
            "phone": info.get("phone"),
            "address": info.get("address"),
            "address_barangay": info.get("address_barangay"),
            "address_province": info.get("address_province")
        }

        return jsonify({"status": "success", "profile": profile}), 200

    except Exception as e:
        print("Error updating profile:", e)
        return jsonify({"status": "error", "message": str(e)}), 500

    user_id = request.user_id
    data = request.json

    user_update = {k: data[k] for k in ["firstname", "lastname"] if k in data}
    info_update = {k: data[k] for k in ["bio", "phone", "address", "address_barangay", "address_province"] if k in data}

    try:
        if user_update:
            supabase.table("users").update(user_update).eq("id", user_id).execute()

        if info_update:
            supabase.table("info").upsert({**info_update, "user_id": user_id}, on_conflict=["user_id"]).execute()

        # Return updated profile
        user_resp = supabase.table("users").select("*").eq("id", user_id).execute()
        info_resp = supabase.table("info").select("*").eq("user_id", user_id).execute()
        user = user_resp.data[0]
        info = info_resp.data[0] if info_resp.data else {}

        profile = {
            "id": user["id"],
            "firstname": user["firstname"],
            "lastname": user["lastname"],
            "email": user["email"],
            "isverified": user.get("isverified", False),
            "avatar_url": user.get("avatar_url", "/default-avatar.png"),
            "bio": info.get("bio"),
            "phone": info.get("phone"),
            "address": info.get("address"),
            "address_barangay": info.get("address_barangay") or user.get("address_barangay"),
            "address_province": info.get("address_province") or user.get("address_province", "Zambales")
        }

        return jsonify({"status": "success", "profile": profile}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ----------------- DELETE PROFILE -----------------
@app.route("/api/profile", methods=["DELETE"])
@token_required
def delete_profile():
    user_id = request.user_id
    try:
        supabase.table("reports").delete().eq("user_id", user_id).execute()
        supabase.table("info").delete().eq("user_id", user_id).execute()
        supabase.table("users").delete().eq("id", user_id).execute()
        return jsonify({"status": "success", "message": "Profile deleted"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ----------------- UPLOAD AVATAR -----------------
@app.route("/api/profile/upload-avatar", methods=["POST"])
@token_required
def upload_avatar():
    if "avatar" not in request.files:
        return jsonify({"status": "error", "message": "No file uploaded"}), 400
    file = request.files["avatar"]
    user_id = request.user_id
    filename = f"profile_{user_id}.png"
    save_path = os.path.join("uploads", filename)
    os.makedirs("uploads", exist_ok=True)
    file.save(save_path)
    avatar_url = f"/uploads/{filename}"
    supabase.table("users").update({"avatar_url": avatar_url}).eq("id", user_id).execute()
    return jsonify({"status": "success", "url": avatar_url}), 200

# ----------------- DASHBOARD STATS -----------------
@app.route("/api/stats", methods=["GET"])
@token_required
def get_stats():
    try:
        total_resp = supabase.table("reports").select("*", count="exact").execute()
        total_reports = total_resp.count or 0

        ongoing_resp = supabase.table("reports").select("*", count="exact").eq("status", "Ongoing").execute()
        resolved_resp = supabase.table("reports").select("*", count="exact").eq("status", "Resolved").execute()
        pending_resp = supabase.table("reports").select("*", count="exact").eq("status", "Pending").execute()

        stats = {
            "totalReports": total_reports,
            "ongoing": ongoing_resp.count or 0,
            "resolved": resolved_resp.count or 0,
            "pending": pending_resp.count or 0
        }

        return jsonify({"status": "success", **stats}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ----------------- RUN APP -----------------
if __name__ == "__main__":
    app.run(debug=True)
