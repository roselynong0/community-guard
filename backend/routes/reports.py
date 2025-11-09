"""
Reports Blueprint
Handles all report/incident CRUD operations including map reports and statistics
"""
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
import time
import base64
from middleware.auth import token_required
from utils import supabase, supabase_retry, create_report_notification, create_admin_notification, create_barangay_notification
from PIL import Image
import io

reports_bp = Blueprint("reports", __name__)

# Default reporter for anonymous/missing users
DEFAULT_REPORTER = {"id": 0, "firstname": "Unknown", "lastname": "User", "avatar_url": None, "isverified": False, "verified": False}

def fetch_reports(limit=10, sort="desc", user_only=False, barangay_filter=False, barangay_param=None, user_id=None):
    """
    Fetch reports with optimized batch loading of related data.
    Supports filtering by user, barangay, and sorting.
    """
    start_time = time.time()
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
        reports_list = getattr(resp, "data", []) or []

        if not reports_list:
            print("📊 No reports found")
            return []

        # Batch fetch all reporter data for better performance
        user_ids = list(set([report.get("user_id") for report in reports_list if report.get("user_id")]))
        
        # Batch queries for optimal performance
        users_data = {}
        info_data = {}
        
        if user_ids:
            # Fetch all users in one query with retry mechanism
            def fetch_users():
                return supabase.table("users").select("id, firstname, lastname, avatar_url, email, isverified").in_("id", user_ids).execute()
            
            def fetch_info():
                return supabase.table("info").select("user_id, verified").in_("user_id", user_ids).execute()
            
            try:
                users_resp = supabase_retry(fetch_users)
                users_list = getattr(users_resp, "data", []) or []
                users_data = {user["id"]: user for user in users_list}
                
                # Fetch all info data in one query with retry mechanism
                info_resp = supabase_retry(fetch_info)
                info_list = getattr(info_resp, "data", []) or []
                info_data = {info["user_id"]: info for info in info_list}
            except Exception as e:
                print(f"⚠️ Failed to fetch user data after retries: {e}")
                # Continue with empty user data rather than failing

        print(f"📊 Loaded {len(reports_list)} reports with {len(users_data)} users")

        # Attach reporter info to each report
        for report in reports_list:
            author_id = report.get("user_id")
            
            # Get reporter data from batch-fetched data
            reporter = users_data.get(author_id, DEFAULT_REPORTER.copy())
            if reporter != DEFAULT_REPORTER:
                # Add verification info from batch-fetched info data
                user_info = info_data.get(author_id, {})
                reporter["verified"] = user_info.get("verified", False)
            else:
                reporter["verified"] = False
            
            report["reporter"] = reporter
            report["user_email"] = reporter.get("email")

            # Force barangay to string
            report["barangay"] = str(report.get("address_barangay") or "All")

        # Batch fetch all images for all reports in one query with retry mechanism
        report_ids = [report["id"] for report in reports_list]
        images_data = {}
        
        if report_ids:
            def fetch_images():
                return supabase.table("report_images").select("report_id, image_url").in_("report_id", report_ids).execute()
            
            try:
                images_resp = supabase_retry(fetch_images)
                images_list = getattr(images_resp, "data", []) or []
                
                # Group images by report_id
                for img in images_list:
                    report_id = img["report_id"]
                    if report_id not in images_data:
                        images_data[report_id] = []
                    images_data[report_id].append({"url": img["image_url"]})
                    
                print(f"📸 Successfully loaded {len(images_list)} images for {len(report_ids)} reports")
            except Exception as e:
                print(f"⚠️ Failed to batch fetch images after retries: {e}")
                # Continue without images rather than failing completely

        # Attach images to each report
        for report in reports_list:
            report["images"] = images_data.get(report["id"], [])

        total_time = round((time.time() - start_time) * 1000, 1)
        print(f"✅ Reports processed in {total_time}ms total")
        
        return reports_list
    except Exception as e:
        print("fetch_reports error:", e)
        return []


@reports_bp.route("/barangay/reports", methods=["GET"])
@token_required
def get_barangay_reports():
    """Get reports specific to Barangay Official's barangay only"""
    try:
        user_id = request.user_id
        limit = int(request.args.get("limit", 10))
        sort = request.args.get("sort", "desc").lower()
        
        # Verify user is a Barangay Official
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [])
        
        if not user_data or user_data[0].get("role") != "Barangay Official":
            print(f"❌ User {user_id} is not a Barangay Official")
            return jsonify({"status": "error", "message": "Only Barangay Officials can access this endpoint"}), 403
        
        # Get barangay from info table
        info_resp = supabase.table("info").select("address_barangay").eq("user_id", user_id).execute()
        info_data = getattr(info_resp, "data", [])
        
        if not info_data or not info_data[0].get("address_barangay"):
            print(f"❌ Could not determine barangay for Barangay Official {user_id}")
            return jsonify({"status": "error", "message": "Barangay information not found"}), 400
        
        user_barangay = info_data[0].get("address_barangay")
        
        print(f"📊 Fetching reports for Barangay Official in {user_barangay}")
        
        # Fetch reports for this barangay using the fetch_reports function
        reports_list = fetch_reports(
            limit=limit,
            sort=sort,
            barangay_filter=True,
            barangay_param=user_barangay,
            user_id=user_id
        )
        
        print(f"✅ Sent {len(reports_list)} reports for barangay {user_barangay}")
        return jsonify({
            "status": "success",
            "reports": reports_list,
            "barangay": user_barangay,
            "total": len(reports_list)
        }), 200
    except Exception as e:
        print(f"❌ Barangay reports fetch failed: {str(e)}")
        return jsonify({"status": "error", "message": str(e), "reports": []}), 500


@reports_bp.route("/reports", methods=["GET"])
@token_required
def get_reports():
    """Get all reports with optional filtering"""
    try:
        limit = int(request.args.get("limit", 10))
        sort = request.args.get("sort", "desc").lower()
        filter_type = request.args.get("filter", "all").lower()  # 'all', 'my', or 'barangay'
        barangay_filter_param = request.args.get("barangay")
        
        print(f"📊 Fetching reports: filter={filter_type}, limit={limit}")
        
        # Determine filtering options
        user_only_filter = filter_type == "my"
        barangay_filter = filter_type == "barangay"
        user_id_to_filter = request.user_id if user_only_filter else None

        # Pass the filtering options to fetch_reports
        reports_list = fetch_reports(
            limit=limit, 
            sort=sort, 
            user_only=user_only_filter,
            barangay_filter=barangay_filter,
            barangay_param=barangay_filter_param,
            user_id=user_id_to_filter
        ) 
        
        print(f"✅ Sent {len(reports_list)} reports to client")
        return jsonify({"status": "success", "reports": reports_list}), 200
    except Exception as e:
        print(f"❌ Reports fetch failed: {str(e)}")
        return jsonify({"status": "error", "message": str(e), "reports": []}), 500


@reports_bp.route("/reports", methods=["POST"])
@token_required
def add_report():
    """Create a new report with images"""
    user_id = request.user_id
    try:
        data = request.json if request.is_json else request.form

        # Validation: Check required fields
        required_fields = {
            "title": data.get("title"),
            "description": data.get("description"),
            "category": data.get("category"),
            "addressStreet": data.get("addressStreet"),
            "barangay": data.get("barangay")
        }
        
        # Check for missing required fields
        missing_fields = [field for field, value in required_fields.items() if not value or (isinstance(value, str) and value.strip() == "")]
        
        if missing_fields:
            print(f"❌ Missing required fields: {missing_fields}")
            return jsonify({
                "status": "error", 
                "message": f"Missing required fields: {', '.join(missing_fields)}"
            }), 400
        
        # Validation: Check if barangay is not "All" (must select a specific barangay)
        if data.get("barangay") == "All":
            print("❌ Invalid barangay selection")
            return jsonify({
                "status": "error", 
                "message": "Please select a specific barangay"
            }), 400
        
        # Validation: Check if at least one image is provided
        if "images" not in request.files or not request.files.getlist("images"):
            print("❌ No images provided")
            return jsonify({
                "status": "error", 
                "message": "At least one image is required to submit a report"
            }), 400
        
        # Validate uploaded images
        files = request.files.getlist("images")
        if not files or all(not file.filename for file in files):
            print("❌ No valid images provided")
            return jsonify({
                "status": "error", 
                "message": "At least one valid image is required to submit a report"
            }), 400

        print(f"✅ Report validation passed - all required fields present and {len(files)} images provided")

        report = {
            "user_id": user_id,
            "title": data.get("title").strip(),
            "description": data.get("description").strip(),
            "category": data.get("category"),
            "status": data.get("status", "Pending"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "deleted_at": None,
            "address_street": data.get("addressStreet").strip(),
            "address_barangay": data.get("barangay"),
            "latitude": float(data.get("lat")) if data.get("lat") else None,
            "longitude": float(data.get("lng")) if data.get("lng") else None
        }

        resp = supabase.table("reports").insert(report).execute()
        inserted_report = resp.data[0]
        report_id = inserted_report["id"]
        
        # Update the report object with the ID and all fields returned from DB
        report.update(inserted_report)

        # Save images if any - store as compressed base64 in database
        images_data = []
        if "images" in request.files:
            files = request.files.getlist("images")
            print(f"📸 Processing {len(files)} images for new report")
            for file in files:
                try:
                    # Read file content
                    file_content = file.read()
                    
                    # Open image with PIL
                    img = Image.open(io.BytesIO(file_content))
                    
                    # Convert to RGB if needed (handles RGBA, P, etc.)
                    if img.mode != 'RGB':
                        img = img.convert('RGB')
                    
                    # Resize if too large (max 1200x1200 to maintain quality but reduce size)
                    max_size = (1200, 1200)
                    img.thumbnail(max_size, Image.Resampling.LANCZOS)
                    
                    # Save to bytes with smart compression
                    output = io.BytesIO()
                    
                    # Determine quality based on original size
                    original_size = len(file_content)
                    if original_size > 500000:  # 500KB
                        quality = 70  # More aggressive compression for large files
                    elif original_size > 200000:  # 200KB
                        quality = 80
                    else:
                        quality = 85  # Light compression for smaller files
                    
                    img.save(output, format='JPEG', quality=quality, optimize=True)
                    compressed_content = output.getvalue()
                    
                    # If compression made it larger, use original (rare case with small images)
                    if len(compressed_content) > original_size:
                        print(f"⚠️ Compression increased size, using original")
                        compressed_content = file_content
                    
                    # Convert to base64
                    file_base64 = base64.b64encode(compressed_content).decode('utf-8')
                    
                    # Create data URL format (always JPEG after compression)
                    image_data_url = f"data:image/jpeg;base64,{file_base64}"
                    images_data.append({"url": image_data_url})
                    
                    print(f"📸 Compressed image: {len(file_content)} bytes → {len(compressed_content)} bytes (quality: {quality})")
                    
                    # Store in database
                    supabase.table("report_images").insert({
                        "report_id": report_id,
                        "image_url": image_data_url,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }).execute()
                    
                except Exception as img_error:
                    print(f"❌ Failed to process image {file.filename}: {img_error}")
                    continue

        # Fetch user info with proper verification status
        user_resp = supabase.table("users").select("id, firstname, lastname, avatar_url, isverified").eq("id", user_id).execute()
        reporter = getattr(user_resp, "data", [None])[0] or DEFAULT_REPORTER
        
        # Fetch verification status from info table for full verification
        info_resp = supabase.table("info").select("verified").eq("user_id", user_id).execute()
        info_data = getattr(info_resp, "data", [None])[0]
        reporter["verified"] = info_data.get("verified", False) if info_data else False

        report["images"] = images_data
        report["reporter"] = reporter
        
        print(f"✅ Report created successfully by user {user_id}")
        print(f"📊 New report with {len(images_data)} images")

        # Create an admin notification for newly submitted reports
        try:
            reporter_name = f"{reporter.get('firstname','') or ''} {reporter.get('lastname','') or ''}".strip() or str(user_id)
            admin_title = f"New report submitted: {report.get('title')}"
            admin_message = f"{reporter_name} submitted a new report '{report.get('title')}' in {report.get('address_barangay') or 'Unknown'}. Please review and update its status."
            create_admin_notification(actor_id=user_id, user_id=user_id, report_id=report_id, title=admin_title, type_label="New Report", message=admin_message)
        except Exception as e:
            print(f"⚠️ Failed to create admin notification for new report: {e}")

        # Create a barangay official notification for the barangay where report was submitted
        try:
            barangay_name = report.get('address_barangay') or 'Unknown'
            report_category = report.get('category') or 'General'
            
            # Find barangay officials for this barangay
            barangay_officials_resp = supabase.table("users").select("id").eq("role", "Barangay Official").eq("barangay", barangay_name).execute()
            barangay_officials = getattr(barangay_officials_resp, "data", []) or []
            
            # Send notification to all barangay officials in that barangay
            for official in barangay_officials:
                official_id = official.get("id")
                if official_id:
                    create_barangay_notification(
                        barangay_official_id=official_id,
                        report_id=report_id,
                        report_title=report.get('title'),
                        event_type="created",
                        barangay_name=barangay_name,
                        report_category=report_category,
                        actor_name=reporter_name
                    )
        except Exception as e:
            print(f"⚠️ Failed to create barangay notification for new report: {e}")

        return jsonify({"status": "success", "report": report}), 201
    except Exception as e:
        print("add_report error:", e)
        return jsonify({"status": "error", "message": str(e)}), 500


@reports_bp.route("/reports/<report_id>", methods=["PUT"])
@token_required
def update_report(report_id):
    """Update an existing report"""
    try:
        print(f"=== UPDATE REPORT CALLED ===")
        print(f"Report ID: {report_id}")
        print(f"User ID: {request.user_id}")
        
        data = request.form if request.form else request.json

        # Validation: Check required fields for updates
        required_fields = {
            "title": data.get("title"),
            "description": data.get("description"),
            "category": data.get("category"),
            "addressStreet": data.get("addressStreet"),
            "barangay": data.get("barangay")
        }
        
        # Check for missing required fields
        missing_fields = [field for field, value in required_fields.items() if not value or (isinstance(value, str) and value.strip() == "")]
        
        if missing_fields:
            print(f"❌ Missing required fields in update: {missing_fields}")
            return jsonify({
                "status": "error", 
                "message": f"Missing required fields: {', '.join(missing_fields)}"
            }), 400
        
        # Validation: Check if barangay is not "All"
        if data.get("barangay") == "All":
            print("❌ Invalid barangay selection in update")
            return jsonify({
                "status": "error", 
                "message": "Please select a specific barangay"
            }), 400

        # Fetch current report status before updating
        report_resp = supabase.table("reports").select("user_id, status, title").eq("id", report_id).execute()
        report = getattr(report_resp, "data", [None])[0]
        if not report or report["user_id"] != request.user_id:
            return jsonify({"status": "error", "message": "Not authorized"}), 403

        old_status = report.get("status")
        report_title = report.get("title")

        # Update report data
        update_data = {
            "title": data.get("title").strip(),
            "description": data.get("description").strip(),
            "category": data.get("category"),
            "address_street": data.get("addressStreet").strip(),
            "address_barangay": data.get("barangay"),
            "latitude": float(data.get("lat")) if data.get("lat") else None,
            "longitude": float(data.get("lng")) if data.get("lng") else None,
            "status": data.get("status")
        }
        supabase.table("reports").update(update_data).eq("id", report_id).execute()

        # Only create notification if status changed
        new_status = data.get("status")
        if new_status and new_status != old_status:
            create_report_notification(request.user_id, report_id, report_title, new_status)

        # Handle image replacement - store as base64 in database
        if "images" in request.files:
            print(f"🖼️ Processing image updates for report {report_id}")
            # Delete existing images from database
            supabase.table("report_images").delete().eq("report_id", report_id).execute()
            print(f"🗑️ Deleted existing images for report {report_id}")

            # Process new images with compression and store as base64
            files = request.files.getlist("images")
            print(f"📸 Processing {len(files)} new images")
            for file in files:
                try:
                    # Read file content
                    file_content = file.read()
                    
                    # Open image with PIL
                    img = Image.open(io.BytesIO(file_content))
                    
                    # Convert to RGB if needed (handles RGBA, P, etc.)
                    if img.mode != 'RGB':
                        img = img.convert('RGB')
                    
                    # Resize if too large (max 1200x1200 to maintain quality but reduce size)
                    max_size = (1200, 1200)
                    img.thumbnail(max_size, Image.Resampling.LANCZOS)
                    
                    # Save to bytes with compression
                    output = io.BytesIO()
                    img.save(output, format='JPEG', quality=85, optimize=True)
                    compressed_content = output.getvalue()
                    
                    # Convert to base64
                    file_base64 = base64.b64encode(compressed_content).decode('utf-8')
                    
                    # Create data URL format (always JPEG after compression)
                    image_data_url = f"data:image/jpeg;base64,{file_base64}"
                    
                    print(f"📸 Compressed image: {len(file_content)} bytes → {len(compressed_content)} bytes")
                    
                    # Store in database
                    supabase.table("report_images").insert({
                        "report_id": report_id,
                        "image_url": image_data_url,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }).execute()
                    
                except Exception as img_error:
                    print(f"❌ Failed to process image {file.filename}: {img_error}")
                    continue

        # Fetch the updated report with all related data
        updated_report_resp = supabase.table("reports").select("*").eq("id", report_id).execute()
        updated_report = getattr(updated_report_resp, "data", [None])[0]
        
        if updated_report:
            # Fetch reporter info
            user_resp = supabase.table("users").select("id, firstname, lastname, avatar_url").eq("id", updated_report["user_id"]).execute()
            reporter = getattr(user_resp, "data", [None])[0] or DEFAULT_REPORTER
            
            # Fetch verification status from info table
            info_resp = supabase.table("info").select("verified").eq("user_id", updated_report["user_id"]).execute()
            info_data = getattr(info_resp, "data", [None])[0]
            reporter["verified"] = info_data.get("verified", False) if info_data else False
            
            # Fetch images for this report
            images_resp = supabase.table("report_images").select("image_url").eq("report_id", report_id).execute()
            images_list = getattr(images_resp, "data", []) or []
            updated_report["images"] = [{"url": img["image_url"]} for img in images_list]
            updated_report["reporter"] = reporter

        print(f"✅ Report {report_id} updated successfully")
        return jsonify({"status": "success", "message": "Report updated", "report": updated_report}), 200

    except Exception as e:
        print(f"❌ Report update failed for {report_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@reports_bp.route("/reports/<report_id>", methods=["PATCH"])
@token_required
def soft_delete_report(report_id):
    """Soft delete a report (set deleted_at timestamp)"""
    try:
        # Only allow the owner to delete
        report_resp = supabase.table("reports").select("user_id, title").eq("id", report_id).execute()
        report = getattr(report_resp, "data", [None])[0]
        if not report or report["user_id"] != request.user_id:
            return jsonify({"status": "error", "message": "Not authorized"}), 403

        # Soft delete by setting deleted_at
        supabase.table("reports").update({"deleted_at": datetime.now(timezone.utc).isoformat()}).eq("id", report_id).execute()

        # Create an admin notification for soft-deletion by owner
        try:
            # Resolve reporter name
            actor_name = str(request.user_id)
            try:
                aresp = supabase.table("users").select("firstname, lastname").eq("id", request.user_id).single().execute()
                adata = getattr(aresp, "data", None) or {}
                if adata:
                    actor_name = f"{adata.get('firstname','').strip()} {adata.get('lastname','').strip()}".strip() or actor_name
            except Exception:
                pass

            admin_title = f"Report soft-deleted"
            report_title = report.get('title') or str(report_id)
            admin_message = f"Report '{report_title}' was soft-deleted by {actor_name}. Please review if administrative action is required."
            create_admin_notification(actor_id=request.user_id, user_id=request.user_id, report_id=report_id, title=admin_title, type_label="Report Soft Deleted", message=admin_message)
        except Exception as e:
            print(f"⚠️ Failed to create admin notification for soft-deleted report: {e}")

        return jsonify({"status": "success", "message": "Report deleted"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500




# Map Reports Endpoints
@reports_bp.route("/map_reports/barangay", methods=["GET"])
@token_required
def get_barangay_map_reports():
    """
    Barangay Official endpoint: Returns map reports only for their barangay
    Filters by the official's address_barangay from their profile
    """
    user_id = request.user_id
    
    try:
        # Verify user is a barangay official
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user = getattr(user_resp, "data", [None])[0]
        
        if not user or user.get("role") != "Barangay Official":
            return jsonify({"status": "error", "message": "Barangay Official access required"}), 403
        
        # Get barangay from info table
        info_resp = supabase.table("info").select("address_barangay").eq("user_id", user_id).execute()
        info = getattr(info_resp, "data", [None])[0]
        user_barangay = info.get("address_barangay") if info else None
        
        if not user_barangay:
            return jsonify({"status": "error", "message": "Barangay information not found in profile"}), 400
        
        print(f"📍 Fetching map reports for barangay official {user_id} in barangay: {user_barangay}")
        
        # Fetch only reports from their barangay with valid coordinates
        response = supabase.table("reports").select(
            "id, title, address_barangay, address_street, latitude, longitude, user_id, created_at, status"
        ).eq("address_barangay", user_barangay).is_("deleted_at", None).execute()

        reports_list = getattr(response, "data", []) or []
        print(f"📊 Total reports in {user_barangay}: {len(reports_list)}")

        # Filter only valid geotagged reports
        reports_list = [r for r in reports_list if r.get("latitude") and r.get("longitude")]
        print(f"📍 Reports with valid coordinates in {user_barangay}: {len(reports_list)}")

        # Fetch reporter info for each report
        for r in reports_list:
            user_data = (
                supabase.table("users")
                .select("firstname, lastname, email")
                .eq("id", r["user_id"])
                .execute()
                .data
            )
            if user_data:
                r["reporter"] = {
                    "first_name": user_data[0]["firstname"],
                    "last_name": user_data[0]["lastname"],
                    "email": user_data[0]["email"]
                }
            else:
                r["reporter"] = {"first_name": "Unknown", "last_name": "", "email": ""}
        
        print(f"✅ Barangay map reports prepared: {len(reports_list)} reports with reporter info")

        return jsonify({
            "status": "success", 
            "reports": reports_list,
            "barangay": user_barangay,
            "total": len(reports_list)
        }), 200

    except Exception as e:
        print(f"❌ Error fetching barangay map reports: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@reports_bp.route("/map_reports", methods=["GET"])
def get_map_reports():
    """Optimized endpoint for map view - returns only reports with valid coordinates"""
    try:
        # Fetch only relevant fields from reports
        response = supabase.table("reports").select(
            "id, title, address_barangay, address_street, latitude, longitude, user_id, created_at"
        ).execute()

        reports_list = response.data or []
        print(f"📊 Total reports fetched from DB: {len(reports_list)}")

        # Filter only valid geotagged reports
        reports_list = [r for r in reports_list if r.get("latitude") and r.get("longitude")]
        print(f"📍 Reports with valid coordinates: {len(reports_list)}")

        # Fetch reporter info for each report
        for r in reports_list:
            user = (
                supabase.table("users")
                .select("firstname, lastname, email")
                .eq("id", r["user_id"])
                .execute()
                .data
            )
            if user:
                r["reporter"] = {
                    "first_name": user[0]["firstname"],
                    "last_name": user[0]["lastname"],
                    "email": user[0]["email"]
                }
            else:
                r["reporter"] = {"first_name": "Unknown", "last_name": "", "email": ""}
        
        print(f"✅ Reports with reporter info attached: {len(reports_list)}")

        return jsonify({"status": "success", "reports": reports_list}), 200

    except Exception as e:
        print("❌ Error fetching map reports:", e)
        return jsonify({"status": "error", "message": str(e)}), 500


# Map Reports Endpoints
@reports_bp.route("/map_reports/counts", methods=["GET"])
def get_map_report_counts():
    """Returns the number of reports per barangay for the map view"""
    try:
        # Fetch all reports with barangay info
        response = supabase.table("reports").select("address_barangay").execute()
        reports_list = response.data or []
        print(f"📊 Total reports fetched for counts: {len(reports_list)}")

        # Count reports per barangay
        counts = {}
        for r in reports_list:
            barangay = r.get("address_barangay", "Unknown")
            if barangay:
                counts[barangay] = counts.get(barangay, 0) + 1

        print(f"✅ Report counts per barangay: {counts}")

        return jsonify({"status": "success", "counts": counts}), 200

    except Exception as e:
        print("❌ Error fetching report counts:", e)
        return jsonify({"status": "error", "message": str(e), "counts": {}}), 500


# Statistics Endpoints
@reports_bp.route("/stats", methods=["GET"])
@token_required
def get_stats():
    """Get report statistics by status"""
    try:
        barangay_filter = request.args.get("barangay")
        
        # Use retry mechanism for stats query
        def fetch_stats():
            query = supabase.table("reports").select("status").is_("deleted_at", None)
            if barangay_filter and barangay_filter != "all":
                query = query.eq("address_barangay", barangay_filter)
            return query.execute()
        
        reports_resp = supabase_retry(fetch_stats)
        reports_list = getattr(reports_resp, "data", []) or []

        stats = {"totalReports": len(reports_list), "pending": 0, "ongoing": 0, "resolved": 0}

        for report in reports_list:
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


@reports_bp.route("/reports/categories", methods=["GET"])
@token_required
def get_report_categories():
    """Get report counts by category"""
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
        reports_list = getattr(resp, "data", []) or []

        category_counts = {}
        for report in reports_list:
            if not report:
                continue
            cat = report.get("category") or "Uncategorized"
            category_counts[cat] = category_counts.get(cat, 0) + 1

        data = [{"name": k, "value": v} for k, v in category_counts.items()] or [{"name": "No Data", "value": 1}]
        return jsonify({"status": "success", "data": data}), 200
    except Exception as e:
        print("get_report_categories error:", e)
        return jsonify({"status": "error", "message": str(e), "data": [{"name": "No Data", "value": 1}]}), 500


@reports_bp.route("/barangays", methods=["GET"])
@token_required
def get_barangays():
    """Get list of all barangays from reports"""
    try:
        # Get distinct barangays from reports
        def fetch_barangays():
            return supabase.table("reports").select("address_barangay").is_("deleted_at", None).execute()
        
        resp = supabase_retry(fetch_barangays)
        reports_list = getattr(resp, "data", []) or []
        
        # Get unique barangays
        barangays = set()
        for report in reports_list:
            barangay = report.get("address_barangay")
            if barangay:
                barangays.add(barangay)
        
        # Format for dropdown
        barangay_options = [{"value": barangay, "label": barangay} for barangay in sorted(barangays)]
        
        return jsonify({"status": "success", "barangays": barangay_options}), 200
    except Exception as e:
        print("get_barangays error:", e)
        return jsonify({"status": "error", "message": str(e), "barangays": []}), 500


# Dashboard-specific endpoints for BarangayDashboard
@reports_bp.route("/dashboard/barangay/stats", methods=["GET"])
@token_required
def get_barangay_dashboard_stats():
    """
    Barangay Official Dashboard Stats
    Simplified endpoint that mirrors Home.jsx logic
    Works with or without RPC functions
    Supports time-based filtering: today, yesterday, this-month, this-year
    """
    try:
        from datetime import datetime as dt, timedelta
        
        user_id = request.user_id
        barangay_param = request.args.get("barangay")  # Optional barangay filter
        time_filter = request.args.get("filter", "this-month").lower()  # New time filter parameter
        
        print(f"🏘️ Barangay dashboard stats requested by user {user_id}, barangay filter: {barangay_param}, time filter: {time_filter}")
        
        # Get user's barangay from info table
        def get_user_info():
            return supabase.table("info").select("address_barangay").eq("user_id", user_id).single().execute()
        
        try:
            user_info_resp = supabase_retry(get_user_info)
            user_barangay = getattr(user_info_resp, "data", {}).get("address_barangay")
            print(f"✅ User barangay: {user_barangay}")
        except:
            user_barangay = None
            print(f"⚠️ Could not find user barangay")
        
        # Determine which barangay to filter by for stats (still use user's barangay for stats)
        filter_barangay = barangay_param if barangay_param and barangay_param != "All" else user_barangay
        
        # Calculate date range based on filter
        now = dt.now(timezone.utc)
        date_filter = None
        
        if time_filter == "today":
            date_filter = now.replace(hour=0, minute=0, second=0, microsecond=0)
            print(f"🕐 Filtering for today: {date_filter}")
        elif time_filter == "yesterday":
            yesterday = now - timedelta(days=1)
            date_filter = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
            print(f"🕐 Filtering for yesterday: {date_filter}")
        elif time_filter == "this-month":
            date_filter = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            print(f"🕐 Filtering for this month: {date_filter}")
        elif time_filter == "this-year":
            date_filter = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            print(f"🕐 Filtering for this year: {date_filter}")
        else:
            date_filter = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)  # Default to this month
        
        # Fetch reports with barangay and date filters
        def fetch_reports_for_stats():
            query = supabase.table("reports").select("status, created_at, address_barangay").is_("deleted_at", None)
            if filter_barangay:
                query = query.eq("address_barangay", filter_barangay)
                print(f"📊 Filtering reports by barangay: {filter_barangay}")
            if date_filter:
                query = query.gte("created_at", date_filter.isoformat())
                print(f"📊 Filtering reports from: {date_filter.isoformat()}")
            return query.execute()
        
        reports_resp = supabase_retry(fetch_reports_for_stats)
        reports_list = getattr(reports_resp, "data", []) or []
        
        print(f"✅ Fetched {len(reports_list)} reports for barangay {filter_barangay or 'All'} with filter {time_filter}")
        
        # Calculate stats
        stats = {
            "totalReports": len(reports_list),
            "pending": 0,
            "ongoing": 0,
            "resolved": 0
        }
        
        # Count by status
        for report in reports_list:
            status = (report.get("status") or "").lower()
            if status == "pending":
                stats["pending"] += 1
            elif status == "ongoing":
                stats["ongoing"] += 1
            elif status == "resolved":
                stats["resolved"] += 1
        
        # Calculate barangay counts from ALL reports (lifetime data)
        # This shows trends across ALL barangays with NO date filtering for lifetime view
        def fetch_all_barangay_reports():
            query = supabase.table("reports").select("address_barangay").is_("deleted_at", None)
            return query.execute()
        
        barangay_reports_resp = supabase_retry(fetch_all_barangay_reports)
        barangay_reports_list = getattr(barangay_reports_resp, "data", []) or []
        
        from collections import defaultdict
        barangay_counts = defaultdict(int)
        
        for report in barangay_reports_list:
            barangay = report.get("address_barangay", "Unknown")
            barangay_counts[barangay] += 1
        
        # Sort by count and get ALL barangays (not just top 5) - sorted by count
        all_barangays_sorted = sorted(
            [{"barangay": k, "total": v} for k, v in barangay_counts.items()],
            key=lambda x: x["total"],
            reverse=True
        )
        
        print(f"✅ Stats (for user's barangay): {stats}, Total Barangays (all barangays): {len(all_barangays_sorted)}")
        
        # Calculate monthly trends ONLY for the barangay official's own barangay
        def fetch_barangay_reports_for_trends():
            query = supabase.table("reports").select("created_at").is_("deleted_at", None)
            if user_barangay:
                query = query.eq("address_barangay", user_barangay)
            return query.execute()
        
        trends_resp = supabase_retry(fetch_barangay_reports_for_trends)
        barangay_specific_reports = getattr(trends_resp, "data", []) or []
        
        # Group by month for the barangay official's barangay only
        from collections import defaultdict
        month_order = {"Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
                       "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12}
        monthly_counts = defaultdict(int)
        
        for report in barangay_specific_reports:
            created_at = report.get("created_at")
            if created_at:
                try:
                    report_date = dt.fromisoformat(created_at.replace('Z', '+00:00'))
                    month = report_date.strftime("%b")
                    monthly_counts[month] += 1
                except:
                    pass
        
        # Sort by month order
        trends = [
            {"month": month, "count": monthly_counts[month]}
            for month in sorted(monthly_counts.keys(), key=lambda m: month_order.get(m, 0))
        ]
        
        print(f"✅ Monthly trends for {user_barangay}: {len(trends)} months")
        
        return jsonify({
            "status": "success",
            "stats": stats,
            "topBarangays": all_barangays_sorted,
            "trends": trends,
            "filter": time_filter
        }), 200
        
    except Exception as e:
        print(f"❌ get_barangay_dashboard_stats error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500


@reports_bp.route("/dashboard/monthly-trends", methods=["GET"])
@token_required
def get_monthly_trends():
    """Get monthly report trends for dashboard charts"""
    try:
        barangay_filter = request.args.get("barangay")
        
        # Try using RPC function first, fall back to manual query
        try:
            if barangay_filter and barangay_filter != "All":
                result = supabase.rpc("get_monthly_report_trends", {"barangay_filter": barangay_filter}).execute()
            else:
                result = supabase.rpc("get_monthly_report_trends").execute()
            
            trends = getattr(result, "data", []) or []
            return jsonify({"status": "success", "trends": trends}), 200
        except Exception as rpc_error:
            print(f"⚠️ RPC function not available, using fallback: {rpc_error}")
            
            # Fallback to manual query
            def fetch_monthly():
                query = supabase.table("reports").select("created_at").is_("deleted_at", None)
                if barangay_filter and barangay_filter != "All":
                    query = query.eq("address_barangay", barangay_filter)
                return query.execute()
            
            resp = supabase_retry(fetch_monthly)
            reports = getattr(resp, "data", []) or []
            
            # Group by month
            from collections import defaultdict
            from datetime import datetime as dt
            
            monthly_counts = defaultdict(int)
            for report in reports:
                created_at = report.get("created_at")
                if created_at:
                    month = dt.fromisoformat(created_at.replace('Z', '+00:00')).strftime("%b")
                    monthly_counts[month] += 1
            
            trends = [{"month": month, "count": count} for month, count in monthly_counts.items()]
            return jsonify({"status": "success", "trends": trends}), 200
            
    except Exception as e:
        print(f"get_monthly_trends error: {e}")
        return jsonify({"status": "error", "message": str(e), "trends": []}), 500


@reports_bp.route("/dashboard/top-barangays", methods=["GET"])
@token_required
def get_top_barangays():
    """Get top 5 barangays by report count"""
    try:
        # Try using RPC function first, fall back to manual query
        try:
            result = supabase.rpc("get_top_barangays_by_reports").execute()
            top_barangays = getattr(result, "data", []) or []
            return jsonify({"status": "success", "barangays": top_barangays}), 200
        except Exception as rpc_error:
            print(f"⚠️ RPC function not available, using fallback: {rpc_error}")
            
            # Fallback to manual query
            def fetch_all_barangays():
                return supabase.table("reports").select("address_barangay").is_("deleted_at", None).execute()
            
            resp = supabase_retry(fetch_all_barangays)
            reports = getattr(resp, "data", []) or []
            
            # Count by barangay
            from collections import Counter
            barangay_counts = Counter([r.get("address_barangay") for r in reports if r.get("address_barangay")])
            
            # Get top 5
            top_5 = barangay_counts.most_common(5)
            top_barangays = [{"barangay": barangay, "total": count} for barangay, count in top_5]
            
            return jsonify({"status": "success", "barangays": top_barangays}), 200
            
    except Exception as e:
        print(f"get_top_barangays error: {e}")
        return jsonify({"status": "error", "message": str(e), "barangays": []}), 500