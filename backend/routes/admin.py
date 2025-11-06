"""
Admin Blueprint
Handles all admin-specific operations including user management and report status updates
"""
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
import time
from middleware.auth import token_required
from utils import supabase, supabase_retry, create_report_notification, create_admin_notification, create_notification

admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/users", methods=["GET"])
@token_required
def get_all_users():
    """Admin endpoint to get all users with their verification status"""
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


@admin_bp.route("/users/<user_id>/verification", methods=["PUT"])
@token_required
def update_user_verification(user_id):
    """Admin endpoint to update user email verification status"""
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
            create_notification(
                user_id=user_id,
                type_label="Account Status",
                title=f"Account {status_message.capitalize()}",
                message=notification_message
            )
        except Exception as e:
            print("Failed to create verification notification:", e)

        return jsonify({
            "status": "success", 
            "message": f"User {status_message} successfully"
        }), 200

    except Exception as e:
        print(f"Error updating user verification: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@admin_bp.route("/users/verification", methods=["GET"])
@token_required
def get_users_for_verification():
    """Get all users with verification status for admin verification management"""
    try:
        # Get user data first to check if admin
        user_id = request.user_id
        print(f"[DEBUG] GET /api/admin/users/verification - Admin User: {user_id}")
        
        current_user_resp = supabase.table("users").select("role").eq("id", user_id).single().execute()
        current_user = current_user_resp.data if current_user_resp.data else {}
        
        if current_user.get("role") != "Admin":
            print(f"[ERROR] Non-admin user {user_id} attempted to access user verification")
            return jsonify({"status": "error", "message": "Admin access required"}), 403

        # Get pagination parameters
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))  # Default 50 users per page
        offset = (page - 1) * limit
        
        start_time = time.time()
        print(f"🔍 Admin fetching users: page={page}, limit={limit}")
        
        # Use optimized PostgreSQL function for maximum performance
        try:
            users_response = supabase.rpc('get_users_with_verification', {
                'limit_count': limit,
                'offset_count': offset
            }).execute()
            
            users = getattr(users_response, "data", []) or []
            
            if users:
                load_time = round((time.time() - start_time) * 1000, 1)
                print(f"✅ PostgreSQL RPC: {len(users)} users in {load_time}ms")
                
                # Transform data to match expected format
                enhanced_users = []
                for user in users:
                    enhanced_user = {
                        "id": user["id"],
                        "firstname": user["firstname"],
                        "lastname": user["lastname"],
                        "email": user["email"],
                        "role": user["role"],
                        "isverified": user["isverified"],
                        "avatar_url": user["avatar_url"],
                        "created_at": user["created_at"],
                        "verified": user["verified"],
                        "fully_verified": user["fully_verified"],
                        "address_barangay": user["address_barangay"]
                    }
                    enhanced_users.append(enhanced_user)
                
                return jsonify({
                    "status": "success",
                    "users": enhanced_users,
                    "page": page,
                    "total_count": len(enhanced_users),
                    "performance": {
                        "load_time_ms": load_time,
                        "method": "postgresql_rpc",
                        "optimized": True
                    }
                }), 200
            
        except Exception as rpc_error:
            print(f"❌ RPC function failed: {rpc_error}")
            print("⚠️ Falling back to standard queries...")
        
        # Fallback: Use optimized batch queries (slower but compatible)
        fallback_start = time.time()
        print("🔄 Using optimized fallback queries...")
        
        # Fetch users with pagination
        users_response = supabase.table("users").select(
            "id, firstname, lastname, email, role, isverified, "
            "avatar_url, created_at"
        ).is_("is_deleted", None).order("created_at", desc=True).limit(limit).offset(offset).execute()
        
        users = getattr(users_response, "data", []) or []
        
        # Batch fetch info data for optimal performance
        enhanced_users = []
        if users:
            user_ids = [user["id"] for user in users]
            info_response = supabase.table("info").select("user_id, verified, address_barangay").in_("user_id", user_ids).execute()
            info_data = getattr(info_response, "data", []) or []
            
            # Create lookup dict for O(1) access
            info_lookup = {info["user_id"]: info for info in info_data}
            
            # Enhance users with verification info
            for user in users:
                info = info_lookup.get(user["id"], {})
                enhanced_user = {
                    **user,
                    "verified": info.get("verified", False),
                    "fully_verified": user.get("isverified", False) and info.get("verified", False),
                    "address_barangay": info.get("address_barangay")
                }
                enhanced_users.append(enhanced_user)
        
        fallback_time = round((time.time() - fallback_start) * 1000, 1)
        print(f"⚠️ Fallback method: {len(enhanced_users)} users in {fallback_time}ms")
            
        return jsonify({
            "status": "success",
            "users": enhanced_users,
            "page": page,
            "total_count": len(enhanced_users),
            "performance": {
                "load_time_ms": fallback_time,
                "method": "batch_queries",
                "optimized": False
            }
        }), 200

    except Exception as e:
        print(f"❌ Admin users fetch failed: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@admin_bp.route("/users/<user_id>/info", methods=["GET"])
@token_required
def get_user_extended_info(user_id):
    """Get extended user information for verification review"""
    try:
        # Get current user data to check if admin
        current_user_id = request.user_id
        print(f"🔍 Admin viewing user info: {user_id}")
        
        current_user_resp = supabase.table("users").select("role").eq("id", current_user_id).single().execute()
        current_user = current_user_resp.data if current_user_resp.data else {}
        
        if current_user.get("role") != "Admin":
            print(f"❌ Unauthorized access attempt by user {current_user_id}")
            return jsonify({"status": "error", "message": "Admin access required"}), 403

        # Get user's extended info from info table
        response = supabase.table("info").select(
            "birthdate, phone, address_barangay, address_street, "
            "address_city, address_province, bio"
        ).eq("user_id", user_id).execute()
        
        info_data = getattr(response, "data", [])
        info = info_data[0] if info_data else None
        
        if info:
            print(f"✅ User info found: {len([k for k, v in info.items() if v])} fields")
        else:
            print(f"⚠️ No extended info for user {user_id}")
        
        return jsonify({
            "status": "success",
            "info": info or {}
        }), 200

    except Exception as e:
        print(f"❌ User info fetch failed: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@admin_bp.route("/users/<user_id>/full-verification", methods=["PUT"])
@token_required
def update_full_verification(user_id):
    """Update user's full verification status (ID verification)"""
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
            create_notification(
                user_id=user_id,
                type_label="Account Verification",
                title=f"Account {status_message.title()}",
                message=notification_message
            )
        except Exception as e:
            print("Failed to create full verification notification:", e)

        return jsonify({
            "status": "success", 
            "message": f"User {status_message} successfully"
        }), 200

    except Exception as e:
        print(f"Error updating user full verification: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@admin_bp.route("/reports/<report_id>/status", methods=["PUT"])
@token_required
def admin_update_report_status(report_id):
    """Admin endpoint to update report status and notify the user"""
    try:
        print(f"🔄 Admin status update request for report {report_id}")
        
        # Check if user is an admin
        user_resp = supabase.table("users").select("role").eq("id", request.user_id).execute()
        user = getattr(user_resp, "data", [None])[0]
        if not user or user.get("role") != "Admin":
            print(f"❌ Non-admin user {request.user_id} attempted status update")
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
            print(f"❌ Report {report_id} not found")
            return jsonify({"status": "error", "message": "Report not found"}), 404

        old_status = report.get("status")
        user_id = report.get("user_id")
        report_title = report.get("title")

        print(f"📝 Updating report '{report_title}': {old_status} → {new_status}")

        # Update report status
        update_resp = supabase.table("reports").update({
            "status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", report_id).execute()

        # Create notification for the user if status changed
        if new_status != old_status and user_id:
            print(f"📧 Creating notification for user {user_id}")
            # Pass the actor (current user) so an admin audit/notification copy can be recorded
            create_report_notification(user_id, report_id, report_title, new_status, actor_id=request.user_id)
        else:
            print(f"⚠️ No notification sent - Status unchanged or no user_id")

        print(f"✅ Report status successfully updated to {new_status}")
        return jsonify({
            "status": "success", 
            "message": f"Report status updated to {new_status}",
            "new_status": new_status,
            "old_status": old_status
        }), 200

    except Exception as e:
        print(f"Error updating report status: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@admin_bp.route("/reports/<report_id>", methods=["DELETE"])
@token_required
def delete_report(report_id):
    """Delete report - allows both admins and report owners to delete reports"""
    try:
        print(f"=== DELETE REPORT CALLED ===")
        print(f"Report ID: {report_id}")
        print(f"User ID: {request.user_id}")
        
        # Get user role
        user_resp = supabase.table("users").select("role").eq("id", request.user_id).execute()
        user = getattr(user_resp, "data", [None])[0]
        user_role = user.get("role") if user else "Resident"
        
        # Fetch current report to get user_id and title
        report_resp = supabase.table("reports").select("user_id, title").eq("id", report_id).is_("deleted_at", None).execute()
        report = getattr(report_resp, "data", [None])[0]
        if not report:
            print(f"❌ Report {report_id} not found")
            return jsonify({"status": "error", "message": "Report not found"}), 404

        report_owner_id = report.get("user_id")
        report_title = report.get("title")
        
        # Check authorization: either admin or report owner
        if user_role != "Admin" and str(request.user_id) != str(report_owner_id):
            print(f"❌ User {request.user_id} not authorized to delete report {report_id}")
            return jsonify({"status": "error", "message": "Not authorized to delete this report"}), 403

        print(f"✅ User authorized to delete report '{report_title}'")
        
        # Accept optional deletion reason provided by the admin UI
        payload = request.json or {}
        reason = (payload.get('reason') or '').strip()
        reason_other = (payload.get('reason_other') or '').strip()
        reason_text = reason_other if reason and reason.lower() == 'other' and reason_other else (reason or 'No reason provided')

        print(f"🗑️ Hard deleting report {report_id}")

        # Find any notifications tied to this report
        try:
            notif_resp = supabase.table('notifications').select('id').eq('report_id', report_id).execute()
            notif_rows = getattr(notif_resp, 'data', []) or []
            notif_ids = [r.get('id') for r in notif_rows if r.get('id')]
        except Exception as e:
            print(f"⚠️ Failed to list notifications for report {report_id}: {e}")
            notif_ids = []

        # Resolve actor display name
        actor_name = str(request.user_id)
        try:
            aresp = supabase.table("users").select("firstname, lastname").eq("id", request.user_id).single().execute()
            adata = getattr(aresp, "data", None) or {}
            if adata:
                actor_name = f"{adata.get('firstname','').strip()} {adata.get('lastname','').strip()}".strip() or actor_name
        except Exception:
            pass

        # Create user-facing notification
        try:
            user_message = f"Your report '{report_title}' was removed by {actor_name}. Reason: {reason_text}"
            create_notification(
                user_id=report_owner_id,
                type_label="Report Deleted",
                title="Report Removed",
                message=user_message
            )
        except Exception as e:
            print(f"⚠️ Failed to create user notification for report deletion: {e}")

        # Create admin audit notification
        try:
            admin_title = "Report deleted"
            admin_message = f"Report '{report_title}' was deleted by {actor_name}. Reason: {reason_text}"
            create_admin_notification(actor_id=request.user_id, user_id=report_owner_id, report_id=None, title=admin_title, type_label="Report Deleted", message=admin_message)
        except Exception as e:
            print(f"⚠️ Failed to create admin notification for report deletion: {e}")

        # Remove admin_notifications that reference notifications for this report
        if notif_ids:
            try:
                supabase.table('admin_notifications').delete().in_('notification_id', notif_ids).execute()
                print(f"🧹 Deleted admin_notifications referencing notifications: {notif_ids}")
            except Exception as e:
                print(f"⚠️ Failed to delete admin_notifications for report {report_id}: {e}")

        # Delete notifications tied to this report
        try:
            supabase.table('notifications').delete().eq('report_id', report_id).execute()
            print(f"🧹 Deleted notifications for report {report_id}")
        except Exception as e:
            print(f"⚠️ Failed to delete notifications for report {report_id}: {e}")

        # Delete associated images
        try:
            supabase.table("report_images").delete().eq("report_id", report_id).execute()
            print(f"🖼️ Deleted images for report {report_id}")
        except Exception as e:
            print(f"⚠️ Failed to delete images for report {report_id}: {e}")

        # Finally delete the report itself
        try:
            supabase.table("reports").delete().eq("id", report_id).execute()
            print(f"📝 Deleted report {report_id}")
        except Exception as e:
            print(f"❌ Error deleting report {report_id}: {e}")
            return jsonify({"status": "error", "message": str(e)}), 500

        print(f"✅ Report {report_id} deleted successfully")
        return jsonify({
            "status": "success",
            "message": "Report deleted successfully"
        }), 200

    except Exception as e:
        print(f"❌ Error deleting report {report_id}: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@admin_bp.route("/users", methods=["POST"])
@token_required
def create_user():
    """Admin-only: create a new user (accepts multipart/form-data)"""
    try:
        # Only admins may create accounts via this endpoint
        user_resp = supabase.table("users").select("role").eq("id", request.user_id).execute()
        user_info = getattr(user_resp, "data", [None])[0]
        if not user_info or user_info.get("role") != "Admin":
            return jsonify({"status": "error", "message": "Admin privileges required"}), 403

        form = request.form or {}
        firstname = form.get("firstname")
        middlename = form.get("middlename") or None
        lastname = form.get("lastname")
        email = form.get("email")
        password = form.get("password") or None
        role = form.get("role") or "Resident"

        if not firstname or not lastname or not email:
            return jsonify({"status": "error", "message": "firstname, lastname and email are required"}), 400

        # Check for existing email
        def fetch_existing():
            return supabase.table("users").select("id,email").eq("email", email).execute()

        existing_resp = supabase_retry(fetch_existing)
        existing = getattr(existing_resp, "data", []) or []
        if existing:
            return jsonify({"status": "error", "message": "Email already exists"}), 409

        avatar_url = None
        # Handle avatar upload (optional)
        if "avatar" in request.files:
            import os
            from werkzeug.utils import secure_filename
            file = request.files["avatar"]
            if file and file.filename:
                filename = secure_filename(file.filename)
                prefix = str(int(time.time()))
                save_name = f"{prefix}-{filename}"
                uploads_dir = os.path.join(os.getcwd(), "uploads")
                os.makedirs(uploads_dir, exist_ok=True)
                dest = os.path.join(uploads_dir, save_name)
                file.save(dest)
                avatar_url = f"/api/uploads/{save_name}"

        # Hash password if provided
        hashed = None
        if password:
            from bcrypt import hashpw, gensalt
            try:
                hashed = hashpw(password.encode(), gensalt()).decode()
            except Exception:
                hashed = None

        # Force isverified for official roles
        isverified = True if role in ("Barangay Official", "Responder") else False

        payload = {
            "firstname": firstname,
            "middlename": middlename,
            "lastname": lastname,
            "email": email,
            "password": hashed,
            "role": role,
            "isverified": isverified,
            "avatar_url": avatar_url or "/default-avatar.png",
        }

        def insert_user():
            return supabase.table("users").insert(payload).execute()

        resp = supabase_retry(insert_user)
        if not resp:
            return jsonify({"status": "error", "message": "Failed to create user (no response)"}), 500

        inserted = getattr(resp, "data", []) or []
        user_row = inserted[0] if inserted else None
        if not user_row:
            return jsonify({"status": "error", "message": "Failed to create user"}), 500

        # Remove password before returning
        user_row.pop("password", None)

        # If the admin provided a barangay for this user and the role is Responder (or Barangay Official), persist it
        address_barangay = form.get("address_barangay") or None
        try:
            if role == "Responder" or role == "Barangay Official":
                info_payload = {
                    "user_id": user_row.get("id"),
                    "address_barangay": address_barangay,
                    "address_city": "Olongapo",
                    "address_province": "Zambales",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }

                def insert_info():
                    return supabase.table("info").insert(info_payload).execute()

                info_resp = supabase_retry(insert_info)
                if not info_resp:
                    print(f"⚠️ info insert returned no response for user {user_row.get('id')}")
                else:
                    inserted_info = getattr(info_resp, "data", []) or []
                    if not inserted_info:
                        print(f"⚠️ info insert returned no row for user {user_row.get('id')}")
        except Exception as e:
            print(f"❌ Failed to insert info row for user {user_row.get('id')}: {e}")

        return jsonify({"status": "success", "user": user_row}), 201

    except Exception as e:
        print(f"❌ Error creating user: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@admin_bp.route("/users/<user_id>", methods=["DELETE"])
@token_required
def delete_user(user_id):
    """Admin or owner: permanently delete a user"""
    try:
        # Check caller privileges
        caller_resp = supabase.table("users").select("role").eq("id", request.user_id).execute()
        caller = getattr(caller_resp, "data", [None])[0]
        if not caller:
            return jsonify({"status": "error", "message": "Unauthorized"}), 403

        # Only Admins or the user themself may delete
        if caller.get("role") != "Admin" and str(request.user_id) != str(user_id):
            return jsonify({"status": "error", "message": "Admin access required"}), 403

        now = datetime.now(timezone.utc).isoformat()

        # Delete posts
        def do_delete_posts():
            return supabase.table("posts").delete().eq("user_id", user_id).execute()

        try:
            posts_resp = supabase_retry(do_delete_posts)
            print(f"delete_user: deleted posts response: {getattr(posts_resp, 'data', None)}")
        except Exception as e:
            print(f"⚠️ delete_user: failed to delete posts for {user_id}: {e}")

        # Delete sessions
        def do_delete_sessions():
            return supabase.table("sessions").delete().eq("user_id", user_id).execute()

        try:
            sessions_resp = supabase_retry(do_delete_sessions)
            print(f"delete_user: deleted sessions response: {getattr(sessions_resp, 'data', None)}")
        except Exception as e:
            print(f"⚠️ delete_user: failed to delete sessions for {user_id}: {e}")

        # Delete info row
        def do_delete_info():
            return supabase.table("info").delete().eq("user_id", user_id).execute()

        try:
            info_resp = supabase_retry(do_delete_info)
            print(f"delete_user: deleted info response: {getattr(info_resp, 'data', None)}")
        except Exception as e:
            print(f"⚠️ delete_user: failed to delete info for {user_id}: {e}")

        # Delete notifications
        def do_delete_notifications():
            return supabase.table("notifications").delete().eq("user_id", user_id).execute()

        try:
            notifs_resp = supabase_retry(do_delete_notifications)
            print(f"delete_user: deleted notifications response: {getattr(notifs_resp, 'data', None)}")
        except Exception as e:
            print(f"⚠️ delete_user: failed to delete notifications for {user_id}: {e}")

        # Finally, delete the user row itself
        def do_delete_user():
            return supabase.table("users").delete().eq("id", user_id).execute()

        resp = None
        try:
            resp = supabase_retry(do_delete_user)
        except Exception as e:
            print(f"❌ delete_user: supabase delete user failed for {user_id}: {e}")
            return jsonify({"status": "error", "message": "Failed to delete user"}), 500

        if not resp:
            print(f"❌ delete_user: supabase_retry returned no response for delete user {user_id}")
            return jsonify({"status": "error", "message": "Failed to delete user (no response)"}), 500

        # Log and validate response
        try:
            resp_data = getattr(resp, "data", None)
            resp_status = getattr(resp, "status_code", None)
            print(f"delete_user: supabase delete response status={resp_status} data={resp_data}")
            if resp_data is None or (isinstance(resp_data, list) and len(resp_data) == 0):
                print(f"⚠️ delete_user: delete executed but no rows returned for user {user_id}")
                return jsonify({"status": "error", "message": "User delete executed but no rows removed"}), 500
        except Exception as e:
            print(f"❌ delete_user: error reading supabase delete response: {e}")

        # Create an admin notification
        try:
            who = f"user ({user_id})"
            admin_title = "User account permanently deleted"
            admin_message = f"{who} was permanently deleted by admin {request.user_id}. Posts and related data were removed."
            create_admin_notification(
                actor_id=request.user_id, 
                user_id=user_id, 
                title=admin_title, 
                type_label="User Deleted", 
                message=admin_message
            )
        except Exception as e:
            print(f"⚠️ delete_user: failed to create admin notification: {e}")

        return jsonify({"status": "success", "message": "User permanently deleted"}), 200
    except Exception as e:
        print(f"❌ Error deleting user {user_id}: {e}")
        return jsonify({"status": "error", "message": "Internal server error"}), 500

