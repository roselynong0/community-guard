"""
Reports Blueprint
Handles all report/incident CRUD operations including map reports and statistics
"""
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone, timedelta
import time
import base64
from middleware.auth import token_required
from utils import supabase, supabase_retry, create_report_notification, create_admin_notification, create_barangay_notification
from utils.notifications import trigger_priority_response, is_high_risk_report, get_priority_from_category
from routes.notifications import trigger_emergency_alerts
from PIL import Image
import io

reports_bp = Blueprint("reports", __name__)

# Default reporter for anonymous/missing users
DEFAULT_REPORTER = {"id": 0, "firstname": "Unknown", "lastname": "User", "avatar_url": None, "isverified": False, "verified": False}

def fetch_reports(limit=10, sort="desc", user_only=False, barangay_filter=False, barangay_param=None, user_id=None, current_user_id=None, status_param=None):
    """
    Fetch reports with optimized batch loading of related data.
    Supports filtering by user, barangay, and sorting.
    """
    start_time = time.time()
    
    user_role = None
    if current_user_id:
        user_role_resp = supabase.table("users").select("role").eq("id", current_user_id).execute()
        user_role_data = getattr(user_role_resp, "data", [])
        if user_role_data:
            user_role = user_role_data[0].get("role")

    try:
        # Use retry mechanism for the main reports query
        def fetch_main_reports():
            query = supabase.table("reports").select("*").is_("deleted_at", "null")

            # Optional status filter (e.g. 'Resolved')
            if status_param:
                query = query.eq("status", status_param)

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

            # Apply visibility rules based on user role
            if user_role in ["Barangay Official", "Admin"]:
                # Admins and Barangay Officials see all reports that are not rejected
                query = query.eq("is_rejected", False)
            elif current_user_id:
                # Regular users: We need to fetch approved reports + their own reports
                # PostgREST doesn't support OR conditions easily, so we'll filter in Python later
                # Just exclude rejected reports here
                query = query.eq("is_rejected", False)
            else:
                # Public/unauthenticated users only see approved and not rejected posts
                query = query.eq("is_approved", True).eq("is_rejected", False)

            query = query.order("created_at", desc=(sort=="desc")).limit(limit)
            return query.execute()
        
        resp = supabase_retry(fetch_main_reports)
        reports_list = getattr(resp, "data", []) or []
        
        # For regular users, filter out other users' unapproved reports (but keep their own)
        if user_role not in ["Barangay Official", "Admin"] and current_user_id:
            reports_list = [
                r for r in reports_list 
                if r.get("is_approved") == True or str(r.get("user_id")) == str(current_user_id)
            ]

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

        # Batch fetch assigned responder data
        assigned_responder_ids = list(set([
            report.get("assigned_responder_id") 
            for report in reports_list 
            if report.get("assigned_responder_id")
        ]))
        
        assigned_responders_data = {}
        if assigned_responder_ids:
            def fetch_assigned_responders():
                return supabase.table("users").select("id, firstname, lastname, email").in_("id", assigned_responder_ids).execute()
            
            try:
                responders_resp = supabase_retry(fetch_assigned_responders)
                responders_list = getattr(responders_resp, "data", []) or []
                assigned_responders_data = {resp["id"]: resp for resp in responders_list}
                print(f"👥 Loaded {len(responders_list)} assigned responders")
            except Exception as e:
                print(f"⚠️ Failed to fetch assigned responders: {e}")
        
        # Attach assigned responder info to each report
        for report in reports_list:
            responder_id = report.get("assigned_responder_id")
            if responder_id and responder_id in assigned_responders_data:
                report["assigned_responder"] = assigned_responders_data[responder_id]
            else:
                report["assigned_responder"] = None

        total_time = round((time.time() - start_time) * 1000, 1)
        print(f"✅ Reports processed in {total_time}ms total")
        
        # DEBUG: Log first 3 reports with is_approved values
        for i, report in enumerate(reports_list[:3]):
            print(f"[DEBUG] Report {i+1} ID={report.get('id')}, is_approved={report.get('is_approved')}, status={report.get('status')}")
        
        # Attach reaction data to reports
        # Note: reaction_count is already on the reports table from the migration
        try:
            report_ids = [r.get("id") for r in reports_list if r.get("id")]
            if report_ids:
                # Check if current user has liked each report (if user context available)
                user_reactions = {}
                if hasattr(request, 'user_id') and request.user_id:
                    user_reactions_resp = supabase.table("report_reactions").select("report_id").eq("user_id", request.user_id).in_("report_id", report_ids).execute()
                    user_reactions_data = getattr(user_reactions_resp, "data", [])
                    user_reactions = {r["report_id"]: True for r in user_reactions_data}
                
                # Attach user_liked status to each report
                # reaction_count is already in the report data from the database
                for report in reports_list:
                    report_id = report.get("id")
                    # Ensure reaction_count has a default value
                    if report.get("reaction_count") is None:
                        report["reaction_count"] = 0
                    report["user_liked"] = user_reactions.get(report_id, False)
                    
                print(f"✅ Attached reaction data to {len(reports_list)} reports")
        except Exception as e:
            print(f"⚠️ Failed to fetch user reactions: {e}")
            # Set defaults if reaction fetch fails
            for report in reports_list:
                if report.get("reaction_count") is None:
                    report["reaction_count"] = 0
                report["user_liked"] = False
        
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
            user_id=user_id,
            current_user_id=user_id
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
            user_id=user_id_to_filter,
            current_user_id=request.user_id
        ) 
        
        print(f"✅ Sent {len(reports_list)} reports to client")
        return jsonify({"status": "success", "reports": reports_list}), 200
    except Exception as e:
        print(f"❌ Reports fetch failed: {str(e)}")
        return jsonify({"status": "error", "message": str(e), "reports": []}), 500


@reports_bp.route("/reports/archived", methods=["GET"])
@token_required
def get_archived_reports():
    """Get archived reports (Resolved) for user.

    - Admin: returns all reports with status 'Resolved'
    - Barangay Official or Responder: returns reports with status 'Resolved' in their address_barangay
    """
    try:
        user_id = request.user_id
        limit = int(request.args.get("limit", 100))
        sort = request.args.get("sort", "desc").lower()

        # Get current user's role
        user_role_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_role_data = getattr(user_role_resp, "data", [])
        user_role = user_role_data[0].get("role") if user_role_data else None

        # Admin: return all Resolved reports
        if user_role == "Admin":
            reports_list = fetch_reports(limit=limit, sort=sort, current_user_id=user_id, status_param="Resolved")
            return jsonify({"status": "success", "reports": reports_list}), 200

        # For Barangay Official or Responder: fetch barangay from info table
        info_resp = supabase.table("info").select("address_barangay").eq("user_id", user_id).execute()
        info_data = getattr(info_resp, "data", [])
        user_barangay = info_data[0].get("address_barangay") if info_data else None

        if not user_barangay:
            # No barangay set - return empty list
            return jsonify({"status": "success", "reports": []}), 200

        reports_list = fetch_reports(limit=limit, sort=sort, barangay_param=user_barangay, current_user_id=user_id, status_param="Resolved")
        return jsonify({"status": "success", "reports": reports_list}), 200

    except Exception as e:
        print(f"❌ Archived reports fetch failed: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


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

        # =================================================================
        # STEP 1: NOTIFY BARANGAY OFFICIALS - "New Report in Your Barangay"
        # =================================================================
        # This notification goes FIRST before any emergency alerts
        try:
            barangay_name = report.get('address_barangay')
            if barangay_name and barangay_name != "No barangay selected":
                # Get barangay officials for this barangay (from info table)
                info_resp = supabase.table("info").select("user_id").eq("address_barangay", barangay_name).execute()
                barangay_user_ids = [i.get("user_id") for i in (getattr(info_resp, "data", []) or []) if i.get("user_id")]
                
                if barangay_user_ids:
                    # Get Barangay Officials only
                    officials_resp = supabase.table("users").select("id").eq("role", "Barangay Official").in_("id", barangay_user_ids).execute()
                    officials = getattr(officials_resp, "data", []) or []
                    
                    for official in officials:
                        official_id = official.get('id')
                        if official_id:
                            create_barangay_notification(
                                barangay_official_id=official_id,
                                report_id=report_id,
                                report_title=report.get('title'),
                                event_type="created",
                                barangay_name=barangay_name,
                                report_category=report.get('category')
                            )
                    print(f"📧 Notified {len(officials)} barangay official(s) about new report")
        except Exception as brgy_err:
            print(f"⚠️ Failed to notify barangay officials: {brgy_err}")

        # =================================================================
        # STEP 2: PRIORITY-BASED AUTOMATIC RESPONSE SYSTEM
        # =================================================================
        # Trigger priority-based notifications based on report category
        # High-risk (Crime/Hazard) -> Automatic urgent response
        # Lower priority (Concern/Lost&Found/Others) -> Evaluation queue
        try:
            reporter_name = f"{reporter.get('firstname','') or ''} {reporter.get('lastname','') or ''}".strip() or str(user_id)
            
            # Get AI priority for this report (or derive from category)
            report_priority = get_priority_from_category(report.get('category', 'Others'))
            
            # Trigger priority-based response
            priority_result = trigger_priority_response(
                report_data={
                    'id': report_id,
                    'title': report.get('title'),
                    'category': report.get('category'),
                    'user_id': user_id,
                    'address_barangay': report.get('address_barangay'),
                    'description': report.get('description'),
                    'priority': report_priority
                },
                actor_id=user_id
            )
            
            # Log the result
            if priority_result.get('is_high_risk'):
                print(f"🚨 HIGH-RISK REPORT: {priority_result.get('notifications_sent')} notifications sent")
            else:
                print(f"📋 EVALUATION QUEUE: Report queued for assessment")
            
            # Add priority info to response
            report['priority_response'] = priority_result
            
        except Exception as priority_err:
            print(f"⚠️ Priority response system error (falling back to standard): {priority_err}")
            # Fallback to standard notification if priority system fails
            try:
                admin_title = f"New report submitted: {report.get('title')}"
                admin_message = f"{reporter_name} submitted a new report '{report.get('title')}' in {report.get('address_barangay') or 'Unknown'}. Please review and update its status."
                create_admin_notification(actor_id=user_id, user_id=user_id, report_id=report_id, title=admin_title, type_label="New Report", message=admin_message)
            except Exception as e:
                print(f"⚠️ Failed to create fallback admin notification: {e}")

        # =================================================================
        # EMERGENCY ALERT SYSTEM - Notify nearby users
        # =================================================================
        # Trigger emergency alerts for users in the same barangay
        # and notify all admins about the new report
        try:
            emergency_result = trigger_emergency_alerts({
                'id': report_id,
                'title': report.get('title'),
                'category': report.get('category'),
                'user_id': user_id,
                'address_barangay': report.get('address_barangay'),
                'description': report.get('description'),
                'priority': report_priority
            })
            
            print(f"🔔 Emergency Alerts: {emergency_result.get('total_notified', 0)} users notified")
            report['emergency_alerts'] = emergency_result
            
        except Exception as emergency_err:
            print(f"⚠️ Emergency alert system error: {emergency_err}")

        # =================================================================
        # AUTO-HOTSPOT GENERATION - Check if this barangay qualifies
        # =================================================================
        # For HIGH/CRITICAL reports, check if the barangay now meets hotspot thresholds
        try:
            high_priority_categories = ['Crime', 'Hazard', 'Fire', 'Accident']
            report_category = report.get('category')
            report_barangay = report.get('address_barangay')
            
            if report_category in high_priority_categories and report_barangay:
                from routes.maps import check_and_create_hotspot_for_barangay
                
                hotspot_result = check_and_create_hotspot_for_barangay(
                    report_barangay,
                    report_data={
                        'id': report_id,
                        'category': report_category,
                        'latitude': report.get('latitude'),
                        'longitude': report.get('longitude')
                    }
                )
                
                if hotspot_result.get('status') == 'created':
                    print(f"🔥 AUTO-HOTSPOT: Created hotspot for {report_barangay} - {hotspot_result.get('reason')}")
                    report['auto_hotspot'] = hotspot_result
                elif hotspot_result.get('status') == 'updated':
                    print(f"🔄 AUTO-HOTSPOT: Updated existing hotspot in {report_barangay}")
                    report['auto_hotspot'] = hotspot_result
                else:
                    print(f"📊 AUTO-HOTSPOT: {report_barangay} - {hotspot_result.get('status')}")
                    
        except Exception as hotspot_err:
            print(f"⚠️ Auto-hotspot check error: {hotspot_err}")

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
def patch_report(report_id):
    """
    PATCH: Update report status (for assigned responder, barangay official, admin), or soft delete (for owner).
    """
    try:
        user_id = request.user_id
        data = request.get_json(force=True) if request.is_json else request.form

        # Fetch the report
        report_resp = supabase.table("reports").select("user_id, title, assigned_responder_id").eq("id", report_id).execute()
        report = getattr(report_resp, "data", [None])[0]
        if not report:
            return jsonify({"status": "error", "message": "Report not found"}), 404

        # Get user role
        user_role_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_role_data = getattr(user_role_resp, "data", [])
        user_role = user_role_data[0].get("role") if user_role_data else None

        # Allow status update if user is assigned responder, barangay official, or admin
        allowed_status = (
            user_role in ["Admin", "Barangay Official"] or
            str(report.get("assigned_responder_id")) == str(user_id)
        )

        # Allow soft delete only for owner
        allowed_delete = str(report["user_id"]) == str(user_id)

        # Status update
        if "status" in data:
            if not allowed_status:
                return jsonify({"status": "error", "message": "Forbidden"}), 403
            new_status = data["status"]
            supabase.table("reports").update({"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", report_id).execute()
            return jsonify({"status": "success", "message": f"Status updated to {new_status}"}), 200

        # Soft delete
        if "deleted_at" in data:
            if not allowed_delete:
                return jsonify({"status": "error", "message": "Not authorized"}), 403
            supabase.table("reports").update({"deleted_at": datetime.now(timezone.utc).isoformat()}).eq("id", report_id).execute()
            # Create an admin notification for soft-deletion by owner
            try:
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

        return jsonify({"status": "error", "message": "No valid PATCH operation"}), 400
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
        
        # Fetch only reports from their barangay with valid coordinates (exclude rejected and non-approved reports)
        response = supabase.table("reports").select(
            "id, title, category, status, address_barangay, address_street, latitude, longitude, user_id, created_at"
        ).eq("address_barangay", user_barangay).is_("deleted_at", "null").eq("is_rejected", False).eq("is_approved", True).execute()

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
        # Fetch only relevant fields from reports (exclude deleted, rejected, and non-approved reports)
        response = supabase.table("reports").select(
            "id, title, category, status, address_barangay, address_street, latitude, longitude, user_id, created_at"
        ).is_("deleted_at", "null").eq("is_rejected", False).eq("is_approved", True).execute()

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
        # Fetch all reports with barangay info (exclude deleted, rejected, and non-approved reports)
        response = supabase.table("reports").select("address_barangay").is_("deleted_at", "null").eq("is_rejected", False).eq("is_approved", True).execute()
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
    """Get report statistics by status (only approved, non-rejected reports)"""
    try:
        barangay_filter = request.args.get("barangay")
        
        # Use retry mechanism for stats query - only approved reports
        def fetch_stats():
            query = supabase.table("reports").select("status").is_("deleted_at", "null").eq("is_rejected", False).eq("is_approved", True)
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
        
        # Use retry mechanism for Supabase query - only approved reports
        def fetch_categories():
            query = (
                supabase
                .table("reports")
                .select("category")
                .is_("deleted_at", "null")
                .eq("is_rejected", False)
                .eq("is_approved", True)
            )
            
            # Apply barangay filter for all users if provided
            if barangay_filter and barangay_filter != "all":
                query = query.eq("address_barangay", barangay_filter)
            elif filter_type == "all":
                # Show all reports - no additional filtering
                pass
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
            return supabase.table("reports").select("address_barangay").is_("deleted_at", "null").execute()
        
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


# Responder-specific endpoints
@reports_bp.route("/responder/reports", methods=["GET"])
@token_required
def get_responder_reports():
    """
    Responder endpoint: Returns reports ASSIGNED to this responder (via assigned_responder_id).
    Only shows reports where assigned_responder_id = current user's id.
    Excludes rejected reports. Returns stats and reports for the responder dashboard.
    """
    user_id = request.user_id
    limit = request.args.get("limit", 100, type=int)
    
    try:
        # Verify user is a Responder
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user = getattr(user_resp, "data", [None])[0]
        
        if not user or user.get("role") != "Responder":
            return jsonify({"status": "error", "message": "Responder access required"}), 403
        
        # Get barangay from info table (for display purposes)
        info_resp = supabase.table("info").select("address_barangay").eq("user_id", user_id).execute()
        info = getattr(info_resp, "data", [None])[0]
        user_barangay = info.get("address_barangay") if info else None
        
        print(f"📍 Fetching responder reports ASSIGNED to user {user_id}, barangay: {user_barangay}")
        
        # Build query - filter by assigned_responder_id = current user (only assigned reports)
        # Select all fields to include reporter data, images, and other necessary fields
        query = supabase.table("reports").select(
            "*"
        ).is_("deleted_at", "null").eq("is_rejected", False).eq("is_approved", True).eq("assigned_responder_id", user_id)
        
        query = query.order("created_at", desc=True).limit(limit)
        response = query.execute()
        
        reports_list = getattr(response, "data", []) or []
        print(f"✅ Responder fetched {len(reports_list)} ASSIGNED reports")
        
        # Batch fetch all reporter data for better performance
        user_ids = list(set([report.get("user_id") for report in reports_list if report.get("user_id")]))
        
        users_data = {}
        info_data = {}
        
        if user_ids:
            try:
                # Fetch all users in one query
                users_resp = supabase.table("users").select("id, firstname, lastname, avatar_url, email, isverified").in_("id", user_ids).execute()
                users_list = getattr(users_resp, "data", []) or []
                users_data = {user["id"]: user for user in users_list}
                
                # Fetch all info data in one query
                info_resp = supabase.table("info").select("user_id, verified").in_("user_id", user_ids).execute()
                info_list = getattr(info_resp, "data", []) or []
                info_data = {info["user_id"]: info for info in info_list}
            except Exception as e:
                print(f"⚠️ Failed to fetch user data: {e}")
        
        # Batch fetch all images for all reports in one query
        report_ids = [report.get("id") for report in reports_list if report.get("id")]
        images_data = {}
        
        if report_ids:
            try:
                images_resp = supabase.table("report_images").select("report_id, image_url").in_("report_id", report_ids).execute()
                images_list = getattr(images_resp, "data", []) or []
                
                # Group images by report_id
                for img in images_list:
                    report_id = img["report_id"]
                    if report_id not in images_data:
                        images_data[report_id] = []
                    images_data[report_id].append({"url": img["image_url"]})
                    
                print(f"📸 Successfully loaded {len(images_list)} images for {len(report_ids)} reports")
            except Exception as e:
                print(f"⚠️ Failed to fetch images: {e}")
        
        # Enrich reports with reporter and image data
        enriched_reports = []
        for report in reports_list:
            report_user_id = report.get("user_id")
            reporter = users_data.get(report_user_id) if report_user_id else None
            reporter_info = info_data.get(report_user_id) if report_user_id else None
            
            # Build reporter object
            if reporter:
                reporter_obj = {
                    "id": reporter.get("id"),
                    "firstname": reporter.get("firstname", "Unknown"),
                    "lastname": reporter.get("lastname", "User"),
                    "avatar_url": reporter.get("avatar_url"),
                    "email": reporter.get("email"),
                    "verified": reporter_info.get("verified", False) if reporter_info else False,
                    "isverified": reporter.get("isverified", False)
                }
            else:
                reporter_obj = {
                    "id": 0,
                    "firstname": "Unknown",
                    "lastname": "User",
                    "avatar_url": None,
                    "email": None,
                    "verified": False,
                    "isverified": False
                }
            
            # Get images from batch-fetched data
            images = images_data.get(report.get("id"), [])
            
            # Build enriched report
            enriched_report = dict(report)
            enriched_report["reporter"] = reporter_obj
            enriched_report["images"] = images
            enriched_reports.append(enriched_report)
        
        reports_list = enriched_reports
        
        # Calculate stats from filtered reports
        pending = sum(1 for r in reports_list if (r.get("status") or "").lower() == "pending")
        ongoing = sum(1 for r in reports_list if (r.get("status") or "").lower() == "ongoing")
        resolved = sum(1 for r in reports_list if (r.get("status") or "").lower() == "resolved")
        
        # Calculate avg response time from resolved reports
        resolved_reports = [r for r in reports_list if (r.get("status") or "").lower() == "resolved" and r.get("created_at") and r.get("updated_at")]
        avg_response_time = "0h"
        if resolved_reports:
            total_ms = 0
            for r in resolved_reports:
                try:
                    created = datetime.fromisoformat(r["created_at"].replace('Z', '+00:00'))
                    updated = datetime.fromisoformat(r["updated_at"].replace('Z', '+00:00'))
                    total_ms += (updated - created).total_seconds() * 1000
                except:
                    pass
            if resolved_reports:
                avg_ms = total_ms / len(resolved_reports)
                avg_hours = avg_ms / (1000 * 60 * 60)
                days = int(avg_hours // 24)
                hours = int(avg_hours % 24)
                if days > 0:
                    avg_response_time = f"{days}d {hours}h" if hours > 0 else f"{days}d"
                else:
                    avg_response_time = f"{int(avg_hours)}h"
        
        # Calculate monthly trends from filtered reports
        month_order = {"Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
                       "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12}
        monthly_counts = {}
        for report in reports_list:
            created_at = report.get("created_at")
            if created_at:
                try:
                    report_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    month = report_date.strftime("%b")
                    monthly_counts[month] = monthly_counts.get(month, 0) + 1
                except:
                    pass
        
        trends = [
            {"month": month, "count": monthly_counts[month]}
            for month in sorted(monthly_counts.keys(), key=lambda m: month_order.get(m, 0))
        ]
        
        # Calculate high incident areas (barangay counts)
        barangay_counts = {}
        for report in reports_list:
            barangay = report.get("address_barangay", "Unknown")
            barangay_counts[barangay] = barangay_counts.get(barangay, 0) + 1
        
        high_incident_areas = sorted(
            [{"area": k, "total": v} for k, v in barangay_counts.items()],
            key=lambda x: x["total"],
            reverse=True
        )[:5]
        
        return jsonify({
            "status": "success",
            "reports": reports_list,
            "barangay": user_barangay,
            "stats": {
                "pending": pending,
                "ongoing": ongoing,
                "resolved": resolved,
                "avgResponseTime": avg_response_time
            },
            "trends": trends if trends else [{"month": "No Data", "count": 0}],
            "highIncidentAreas": high_incident_areas if high_incident_areas else [{"area": "No Data", "total": 0}],
            "total": len(reports_list)
        }), 200

    except Exception as e:
        print(f"❌ Error fetching responder reports: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@reports_bp.route("/responder/map_reports", methods=["GET"])
@token_required
def get_responder_map_reports():
    """
    Responder endpoint: Returns map reports filtered by the responder's barangay from info table.
    Excludes rejected reports. Only returns reports with valid coordinates.
    """
    user_id = request.user_id
    
    try:
        # Verify user is a Responder
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user = getattr(user_resp, "data", [None])[0]
        
        if not user or user.get("role") != "Responder":
            return jsonify({"status": "error", "message": "Responder access required"}), 403
        
        # Get barangay from info table
        info_resp = supabase.table("info").select("address_barangay").eq("user_id", user_id).execute()
        info = getattr(info_resp, "data", [None])[0]
        user_barangay = info.get("address_barangay") if info else None
        
        print(f"📍 Fetching responder map reports for user {user_id}, barangay: {user_barangay}")
        
        # Build query - filter by barangay if set, exclude rejected, deleted, and non-approved reports
        query = supabase.table("reports").select(
            "id, title, address_barangay, address_street, latitude, longitude, user_id, created_at, status, category"
        ).is_("deleted_at", "null").eq("is_rejected", False).eq("is_approved", True)
        
        # Filter by responder's barangay if they have one set
        if user_barangay and user_barangay != "No barangay selected":
            query = query.eq("address_barangay", user_barangay)
            print(f"📊 Filtering map reports by barangay: {user_barangay}")
        
        response = query.execute()
        reports_list = getattr(response, "data", []) or []
        
        # Filter only valid geotagged reports
        reports_list = [r for r in reports_list if r.get("latitude") and r.get("longitude")]
        print(f"📍 Responder map reports with valid coordinates: {len(reports_list)}")
        
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
        
        return jsonify({
            "status": "success",
            "reports": reports_list,
            "barangay": user_barangay,
            "total": len(reports_list)
        }), 200

    except Exception as e:
        print(f"❌ Error fetching responder map reports: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


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
        elif time_filter == "all":
            date_filter = None  # No date filter - get all reports
            print(f"🕐 No date filter - fetching ALL reports")
        else:
            date_filter = None  # Default to all reports for barangay dashboard
            print(f"🕐 Unknown filter '{time_filter}' - defaulting to all reports")
        
        # Fetch reports with barangay and date filters - only approved reports
        def fetch_reports_for_stats():
            query = supabase.table("reports").select("status, created_at, address_barangay").is_("deleted_at", "null").eq("is_rejected", False).eq("is_approved", True)
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
        
        # Calculate barangay counts from ALL approved reports (lifetime data)
        # This shows trends across ALL barangays with NO date filtering for lifetime view
        def fetch_all_barangay_reports():
            query = supabase.table("reports").select("address_barangay").is_("deleted_at", "null").eq("is_rejected", False).eq("is_approved", True)
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
        
        # Calculate monthly trends ONLY for the barangay official's own barangay (approved reports only)
        def fetch_barangay_reports_for_trends():
            query = supabase.table("reports").select("created_at").is_("deleted_at", "null").eq("is_rejected", False).eq("is_approved", True)
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


# Admin Dashboard Stats - System-wide statistics for ALL barangays
@reports_bp.route("/dashboard/admin/stats", methods=["GET"])
@token_required
def get_admin_dashboard_stats():
    """
    Admin Dashboard Stats
    Returns system-wide statistics for ALL barangays
    Only accessible by Admin users
    """
    try:
        from datetime import datetime as dt, timedelta
        
        user_id = request.user_id
        time_filter = request.args.get("filter", "all").lower()
        
        print(f"🔧 Admin dashboard stats requested by user {user_id}, time filter: {time_filter}")
        
        # Verify user is Admin
        def get_user_role():
            return supabase.table("users").select("role").eq("id", user_id).single().execute()
        
        try:
            user_resp = supabase_retry(get_user_role)
            user_role = getattr(user_resp, "data", {}).get("role")
            if user_role != "Admin":
                print(f"⚠️ Non-admin user {user_id} tried to access admin dashboard")
                return jsonify({"status": "error", "message": "Admin access required"}), 403
        except Exception as e:
            print(f"⚠️ Could not verify user role: {e}")
            return jsonify({"status": "error", "message": "Could not verify user role"}), 403
        
        # Calculate date range based on filter
        now = dt.now(timezone.utc)
        date_filter = None
        
        if time_filter == "today":
            date_filter = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif time_filter == "yesterday":
            yesterday = now - timedelta(days=1)
            date_filter = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
        elif time_filter == "this-month":
            date_filter = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        elif time_filter == "this-year":
            date_filter = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        elif time_filter == "all":
            date_filter = None
        
        print(f"🕐 Date filter: {date_filter}")
        
        # Fetch ALL reports (system-wide) - only approved reports
        def fetch_all_reports_for_stats():
            query = supabase.table("reports").select("status, created_at, address_barangay").is_("deleted_at", "null").eq("is_rejected", False).eq("is_approved", True)
            if date_filter:
                query = query.gte("created_at", date_filter.isoformat())
            return query.execute()
        
        reports_resp = supabase_retry(fetch_all_reports_for_stats)
        reports_list = getattr(reports_resp, "data", []) or []
        
        print(f"✅ Fetched {len(reports_list)} system-wide reports")
        
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
        
        # Calculate barangay counts
        from collections import defaultdict
        barangay_counts = defaultdict(int)
        
        for report in reports_list:
            barangay = report.get("address_barangay", "Unknown")
            barangay_counts[barangay] += 1
        
        # Sort by count and get ALL barangays
        all_barangays_sorted = sorted(
            [{"barangay": k, "total": v} for k, v in barangay_counts.items()],
            key=lambda x: x["total"],
            reverse=True
        )
        
        # Calculate monthly trends for ALL reports (system-wide)
        month_order = {"Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
                       "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12}
        monthly_counts = defaultdict(int)
        
        for report in reports_list:
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
        
        # Count total users
        def fetch_total_users():
            return supabase.table("users").select("id", count="exact").execute()
        
        try:
            users_resp = supabase_retry(fetch_total_users)
            total_users = users_resp.count if hasattr(users_resp, 'count') else len(getattr(users_resp, "data", []) or [])
        except:
            total_users = 0
        
        print(f"✅ Admin Stats: {stats}, Barangays: {len(all_barangays_sorted)}, Trends: {len(trends)} months, Users: {total_users}")
        
        return jsonify({
            "status": "success",
            "stats": stats,
            "topBarangays": all_barangays_sorted,
            "trends": trends,
            "totalUsers": total_users,
            "filter": time_filter
        }), 200
        
    except Exception as e:
        print(f"❌ get_admin_dashboard_stats error: {e}")
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
            
            # Fallback to manual query - only approved reports
            def fetch_monthly():
                query = supabase.table("reports").select("created_at").is_("deleted_at", "null").eq("is_rejected", False).eq("is_approved", True)
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
            
            # Fallback to manual query - only approved reports
            def fetch_all_barangays():
                return supabase.table("reports").select("address_barangay").is_("deleted_at", "null").eq("is_rejected", False).eq("is_approved", True).execute()
            
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


@reports_bp.route("/reports/missed_summary", methods=["GET"])
@token_required
def get_missed_reports_summary():
    """Return a summary of reports that occurred while the user was offline.

    Uses the sessions table to determine the previous session end (expires_at) and
    the current session start (created_at) based on the token in Authorization header.
    If no previous session is found, the endpoint will consider the last 24 hours.
    Response includes counts, barangay breakdown, category breakdown, severity stats
    (if available), and up to 5 recent reports.
    """
    user_id = request.user_id
    token = request.headers.get("Authorization", "").replace("Bearer ", "")

    try:
        # Get current session by token (should exist)
        try:
            curr_resp = supabase.table("sessions").select("*").eq("token", token).eq("user_id", user_id).single().execute()
            current_session = getattr(curr_resp, "data", None)
        except Exception:
            current_session = None

        if current_session and current_session.get("created_at"):
            curr_created = current_session.get("created_at")
            curr_dt = datetime.fromisoformat(curr_created.replace('Z', '+00:00'))
        else:
            # Fallback to now as current session start
            curr_dt = datetime.now(timezone.utc)

        # Find previous session (most recent before current session created_at)
        prev_session = None
        try:
            if current_session and current_session.get("created_at"):
                prev_resp = supabase.table("sessions").select("*").eq("user_id", user_id).lt("created_at", current_session.get("created_at")).order("created_at", desc=True).limit(1).single().execute()
                prev_session = getattr(prev_resp, "data", None)
            else:
                prev_session = None
        except Exception:
            prev_session = None

        if prev_session:
            # Prefer use of explicit ended_at (set when user logged out) for more accurate offline intervals.
            offline_start_str = prev_session.get("ended_at") or prev_session.get("expires_at") or prev_session.get("created_at")
            offline_start = datetime.fromisoformat(offline_start_str.replace('Z', '+00:00'))
        else:
            # Default to 24 hours before current session
            offline_start = curr_dt - timedelta(hours=24)

        offline_end = curr_dt

        # Fetch reports created between offline_start (exclusive) and offline_end (inclusive)
        def fetch_reports_window():
            # Supabase expects ISO strings; use Z format
            return supabase.table("reports").select("*").gte("created_at", offline_start.isoformat()).lt("created_at", offline_end.isoformat()).is_("deleted_at", "null").execute()

        resp = supabase_retry(fetch_reports_window)
        reports_list = getattr(resp, "data", []) or []

        total = len(reports_list)

        # Aggregate breakdowns
        from collections import Counter
        categories = Counter([r.get("category") or "uncategorized" for r in reports_list])
        barangays = Counter([r.get("address_barangay") or "Unknown" for r in reports_list])

        # Severity stats using numpy if numeric severity/risk fields exist
        numeric_severities = []
        for r in reports_list:
            val = r.get("severity") or r.get("risk_score")
            try:
                if val is not None:
                    numeric_severities.append(float(val))
            except Exception:
                continue

        severity_stats = {"count": 0}
        try:
            import numpy as np
            if numeric_severities:
                arr = np.array(numeric_severities, dtype=float)
                severity_stats = {
                    "count": int(arr.size),
                    "mean": float(np.mean(arr)),
                    "median": float(np.median(arr)),
                    "p90": float(np.percentile(arr, 90)),
                }
        except Exception as e:
            print("numpy not available or failed to compute severity stats:", e)

        # Top 5 recent reports
        def parse_created(r):
            c = r.get("created_at")
            try:
                return datetime.fromisoformat(c.replace('Z', '+00:00'))
            except Exception:
                return datetime.now(timezone.utc)

        top_reports = sorted(reports_list, key=parse_created, reverse=True)[:5]
        # Minimalize report payload for frontend
        top_reports_min = [
            {
                "id": r.get("id"),
                "title": r.get("title") or r.get("category") or "Report",
                "created_at": r.get("created_at"),
                "address_barangay": r.get("address_barangay"),
                "severity": r.get("severity") or r.get("risk_score")
            }
            for r in top_reports
        ]

        # Get user display name and verification flags
        user_display = None
        user_row = getattr(request, 'user_record', None)
        user_flags = {"isverified": False, "verified": False, "status_label": "Email Verified"}
        if user_row:
            user_display = f"{user_row.get('firstname','Resident')}"
            user_flags["isverified"] = bool(user_row.get('isverified'))
            user_flags["verified"] = bool(user_row.get('verified'))
            # Determine status label
            if user_flags["verified"] and user_flags["isverified"]:
                user_flags["status_label"] = "Fully Verified"
            elif user_flags["isverified"]:
                user_flags["status_label"] = "Email Verified"
            else:
                user_flags["status_label"] = "Email Verified"
        else:
            try:
                user_resp = supabase.table("users").select("firstname,isverified,verified").eq("id", user_id).single().execute()
                ud = getattr(user_resp, 'data', None)
                user_display = ud.get('firstname') if ud else 'Resident'
                if ud:
                    user_flags["isverified"] = bool(ud.get('isverified'))
                    user_flags["verified"] = bool(ud.get('verified'))
                    # Determine status label
                    if user_flags["verified"] and user_flags["isverified"]:
                        user_flags["status_label"] = "Fully Verified"
                    elif user_flags["isverified"]:
                        user_flags["status_label"] = "Email Verified"
                    else:
                        user_flags["status_label"] = "Email Verified"
            except Exception:
                user_display = 'Resident'

        if total == 0:
            summary_message = f"Welcome back {user_display}, Community Helper detected no new reports while you were away. You're all caught up!"
        else:
            summary_message = f"Welcome back {user_display}, while you were away we detected {total} new report{'' if total==1 else 's'} you may have missed."

        return jsonify({
            "status": "success",
            "summary": {
                "message": summary_message,
                "total": total,
                "categories": dict(categories),
                "barangays": dict(barangays),
                "severity_stats": severity_stats,
                "top_reports": top_reports_min,
                "offline_start": offline_start.isoformat(),
                "offline_end": offline_end.isoformat(),
                "ai_name": "Community Helper",
                "user_flags": user_flags
            }
        }), 200

    except Exception as e:
        print("get_missed_reports_summary error:", e)
        return jsonify({"status": "error", "message": str(e), "summary": {}}), 500


# Report Approval Endpoints
@reports_bp.route("/reports/<report_id>/approve", methods=["POST"])
@token_required
def approve_report(report_id):
    """
    Approve a pending report to make it visible to public.
    Only admins and barangay officials can approve reports.
    
    When approved:
    - High-risk reports (Crime/Hazard) trigger automatic urgent response
    - Lower priority reports are queued for standard handling
    """
    user_id = request.user_id
    try:
        # Get user role to check authorization
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        user_role = user_data.get("role") if user_data else None
        
        # Only admin or barangay official can approve
        if user_role not in ["Admin", "Barangay Official"]:
            print(f"❌ User {user_id} with role {user_role} not authorized to approve reports")
            return jsonify({"status": "error", "message": "Not authorized to approve reports"}), 403
        
        # Check if report exists and get full report info for priority processing
        report_resp = supabase.table("reports").select("*").eq("id", report_id).execute()
        report = getattr(report_resp, "data", [None])[0]
        
        if not report:
            print(f"❌ Report {report_id} not found")
            return jsonify({"status": "error", "message": "Report not found"}), 404
        
        # Check if already approved
        if report.get("is_approved"):
            print(f"⚠️ Report {report_id} already approved")
            return jsonify({"status": "error", "message": "Report already approved"}), 400
        
        # Update report to approved
        now = datetime.now(timezone.utc).isoformat()
        supabase.table("reports").update({
            "is_approved": True,
            "approved_by": user_id,
            "approved_at": now
        }).eq("id", report_id).execute()
        
        print(f"✅ Report {report_id} approved by {user_id}")
        
        # Create notification for the reporter
        reporter_id = report.get("user_id")
        report_title = report.get("title")
        if reporter_id:
            from utils.notifications import create_report_approval_notification
            create_report_approval_notification(reporter_id, report_id, report_title, user_id)
        
        # =================================================================
        # TRIGGER PRIORITY-BASED RESPONSE ON APPROVAL
        # =================================================================
        # Now that the report is approved, trigger the priority response
        # This ensures high-risk reports get immediate attention from responders
        try:
            report_category = report.get("category", "Others")
            report_priority = get_priority_from_category(report_category)
            
            # Only trigger urgent response for high-risk approved reports
            if is_high_risk_report(priority=report_priority, category=report_category):
                priority_result = trigger_priority_response(
                    report_data={
                        'id': report_id,
                        'title': report_title,
                        'category': report_category,
                        'user_id': reporter_id,
                        'address_barangay': report.get('address_barangay'),
                        'description': report.get('description'),
                        'priority': report_priority
                    },
                    actor_id=user_id
                )
                print(f"🚨 HIGH-RISK APPROVED: Urgent response triggered - {priority_result.get('notifications_sent')} notifications")
            else:
                print(f"📋 Standard priority report approved - no urgent response needed")
                
        except Exception as priority_err:
            print(f"⚠️ Priority response on approval failed: {priority_err}")
        
        return jsonify({"status": "success", "message": "Report approved successfully"}), 200
        
    except Exception as e:
        print(f"❌ Failed to approve report {report_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@reports_bp.route("/reports/<report_id>/reject", methods=["POST"])
@token_required
def reject_report(report_id):
    """
    Reject a pending report by setting is_rejected=TRUE.
    Only admins and barangay officials can reject reports.
    When a rejected report is deleted by user with is_rejected=TRUE and deleted_at set,
    no notification is sent to admin/barangay.
    """
    user_id = request.user_id
    try:
        # Get user role to check authorization
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        user_role = user_data.get("role") if user_data else None
        
        # Only admin or barangay official can reject
        if user_role not in ["Admin", "Barangay Official"]:
            print(f"❌ User {user_id} with role {user_role} not authorized to reject reports")
            return jsonify({"status": "error", "message": "Not authorized to reject reports"}), 403
        
        # Check if report exists
        report_resp = supabase.table("reports").select("id, user_id, title").eq("id", report_id).execute()
        report = getattr(report_resp, "data", [None])[0]
        
        if not report:
            print(f"❌ Report {report_id} not found")
            return jsonify({"status": "error", "message": "Report not found"}), 404
        
        # Get rejection reason from request body if provided
        data = request.get_json() or {}
        rejection_reason = data.get("rejection_reason", "Your report violated our community guidelines.")
        
        # Set is_rejected to TRUE and record rejection metadata
        supabase.table("reports").update({
            "is_rejected": True,
            "rejected_by": user_id,
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "rejection_reason": rejection_reason
        }).eq("id", report_id).execute()
        
        print(f"✅ Report {report_id} rejected by {user_id}")
        
        # Create notification for the reporter about rejection
        reporter_id = report.get("user_id")
        report_title = report.get("title")
        if reporter_id:
            from utils.notifications import create_notification
            create_notification(
                reporter_id,
                "Report Rejected",
                f'Your report "{report_title}" did not meet our community guidelines and was not approved for public visibility.',
                "Report Alert"
            )
        
        return jsonify({"status": "success", "message": "Report rejected"}), 200
        
    except Exception as e:
        print(f"❌ Failed to reject report {report_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@reports_bp.route("/reports/<report_id>/assign", methods=["PUT"])
@token_required
def assign_responder(report_id):
    """
    Assign a responder to a report.
    Only barangay officials can assign responders.
    Handles both new assignments and reassignments.
    """
    user_id = request.user_id
    try:
        # Get user role to check authorization
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        user_role = user_data.get("role") if user_data else None
        
        if user_role not in ["Admin", "Barangay Official"]:
            return jsonify({"status": "error", "message": "Not authorized to assign responders"}), 403
        
        data = request.get_json()
        responder_id = data.get("responder_id")
        previous_responder_id = data.get("previous_responder_id")  # For reassignment tracking
        
        if not responder_id:
            return jsonify({"status": "error", "message": "Responder ID is required"}), 400
        
        # Check if report exists and get current assignment
        report_resp = supabase.table("reports").select("id, title, address_barangay, assigned_responder_id").eq("id", report_id).execute()
        report = getattr(report_resp, "data", [None])[0]
        
        if not report:
            return jsonify({"status": "error", "message": "Report not found"}), 404
        
        # Get current assigned responder (if any) for reassignment notification
        current_responder_id = report.get("assigned_responder_id")
        is_reassignment = current_responder_id and current_responder_id != responder_id
        
        # Check if responder exists and is actually a responder
        responder_resp = supabase.table("users").select("id, role, firstname, lastname").eq("id", responder_id).execute()
        responder = getattr(responder_resp, "data", [None])[0]
        
        if not responder or responder.get("role") != "Responder":
            return jsonify({"status": "error", "message": "Invalid responder"}), 400
        
        # Update report with assigned responder
        supabase.table("reports").update({
            "assigned_responder_id": responder_id,
            "assigned_at": datetime.now(timezone.utc).isoformat(),
            "assigned_by": user_id
        }).eq("id", report_id).execute()
        
        print(f"✅ Report {report_id} {'reassigned' if is_reassignment else 'assigned'} to responder {responder_id} by user {user_id}")
        
        from utils.notifications import create_notification, create_admin_notification
        
        # Get assigner (barangay official) info for admin notification
        assigner_resp = supabase.table("users").select("firstname, lastname").eq("id", user_id).execute()
        assigner_data = getattr(assigner_resp, "data", [None])[0]
        assigner_name = f"{assigner_data.get('firstname', '')} {assigner_data.get('lastname', '')}".strip() if assigner_data else "Barangay Official"
        
        # Get new responder name
        new_responder_name = f"{responder.get('firstname', '')} {responder.get('lastname', '')}".strip()
        
        # If this is a reassignment, notify the previous responder that they've been removed
        if is_reassignment and current_responder_id:
            # Get previous responder name for admin notification
            prev_responder_resp = supabase.table("users").select("firstname, lastname").eq("id", current_responder_id).execute()
            prev_responder_data = getattr(prev_responder_resp, "data", [None])[0]
            prev_responder_name = f"{prev_responder_data.get('firstname', '')} {prev_responder_data.get('lastname', '')}".strip() if prev_responder_data else "Previous Responder"
            
            create_notification(
                current_responder_id,
                "📋 Assignment Removed",
                f'You have been unassigned from the report: "{report.get("title")}" in {report.get("address_barangay")}. This report has been reassigned to another responder.',
                "assignment_removed"
            )
            print(f"📨 Notified previous responder {current_responder_id} about reassignment")
            
            # Create admin notification for reassignment
            create_admin_notification(
                actor_id=user_id,
                user_id=responder_id,
                report_id=report_id,
                title="Responder Reassigned",
                type_label="Responder Reassignment",
                message=f'{assigner_name} reassigned the report "{report.get("title")}" from {prev_responder_name} to {new_responder_name} in {report.get("address_barangay")}.'
            )
            print(f"📋 Admin notification created for responder reassignment")
        
        # Notify the new responder about the assignment
        if is_reassignment:
            create_notification(
                responder_id,
                "🚨 Report Reassignment",
                f'You have been assigned to respond to: "{report.get("title")}" in {report.get("address_barangay")}. This report was previously assigned to another responder. Please respond immediately.',
                "responder_assignment"
            )
        else:
            create_notification(
                responder_id,
                "🚨 New Report Assignment",
                f'You have been assigned to respond to: "{report.get("title")}" in {report.get("address_barangay")}. Please respond immediately.',
                "responder_assignment"
            )
            
            # Create admin notification for new assignment
            create_admin_notification(
                actor_id=user_id,
                user_id=responder_id,
                report_id=report_id,
                title="Responder Assigned",
                type_label="Responder Assignment",
                message=f'{assigner_name} assigned {new_responder_name} to respond to the report "{report.get("title")}" in {report.get("address_barangay")}.'
            )
            print(f"📋 Admin notification created for new responder assignment")
        
        return jsonify({"status": "success", "message": "Responder assigned successfully"}), 200
        
    except Exception as e:
        print(f"❌ Failed to assign responder to report {report_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@reports_bp.route("/reports/<report_id>/unassign", methods=["PUT"])
@token_required
def unassign_responder(report_id):
    """
    Remove responder assignment from a report.
    Only barangay officials can unassign responders.
    """
    user_id = request.user_id
    try:
        # Get user role to check authorization
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        user_role = user_data.get("role") if user_data else None
        
        if user_role not in ["Admin", "Barangay Official"]:
            return jsonify({"status": "error", "message": "Not authorized to unassign responders"}), 403
        
        # Check if report exists
        report_resp = supabase.table("reports").select("id, assigned_responder_id").eq("id", report_id).execute()
        report = getattr(report_resp, "data", [None])[0]
        
        if not report:
            return jsonify({"status": "error", "message": "Report not found"}), 404
        
        # Update report to remove assignment
        supabase.table("reports").update({
            "assigned_responder_id": None,
            "assigned_at": None,
            "assigned_by": None
        }).eq("id", report_id).execute()
        
        print(f"✅ Responder unassigned from report {report_id} by user {user_id}")
        
        return jsonify({"status": "success", "message": "Responder unassigned successfully"}), 200
        
    except Exception as e:
        print(f"❌ Failed to unassign responder from report {report_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@reports_bp.route("/users/responders", methods=["GET"])
@token_required
def get_responders():
    """
    Get list of responders, optionally filtered by barangay.
    Admin users can see ALL responders or filter by any barangay.
    Barangay Officials can only see responders in their own barangay.
    """
    user_id = request.user_id
    barangay = request.args.get("barangay")
    
    try:
        # Get user role and barangay to check authorization
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        user_role = user_data.get("role") if user_data else None
        
        if user_role not in ["Admin", "Barangay Official"]:
            return jsonify({"status": "error", "message": "Not authorized to view responders"}), 403
        
        # Get user's barangay from info table
        user_barangay = None
        if user_role == "Barangay Official":
            info_resp = supabase.table("info").select("address_barangay").eq("user_id", user_id).execute()
            info_data = getattr(info_resp, "data", [None])[0]
            user_barangay = info_data.get("address_barangay") if info_data else None
        
        # Query users with Responder role (phone is in info table, not users table)
        query = supabase.table("users").select("id, firstname, lastname, email").eq("role", "Responder")
        responders_resp = query.execute()
        responders = getattr(responders_resp, "data", [])
        
        print(f"🔍 Found {len(responders)} total responders: {[r.get('id') for r in responders]}")
        
        # Determine which barangay to filter by
        # Admin: can use any barangay filter or none (sees all)
        # Barangay Official: must use their own barangay (override any provided filter)
        filter_barangay = None
        if user_role == "Admin":
            # Admin can filter by any barangay or see all
            filter_barangay = barangay if barangay else None
            print(f"👑 Admin user - filtering by: {filter_barangay or 'ALL responders'}")
        else:
            # Barangay Official must use their own barangay
            filter_barangay = user_barangay
            print(f"🏘️ Barangay Official - filtering by own barangay: {filter_barangay}")
        
        # If barangay filter is needed, filter responders by their address_barangay from info table
        if filter_barangay and responders:
            responder_ids = [r["id"] for r in responders]
            print(f"🔍 Looking for responders in barangay: '{barangay}' from IDs: {responder_ids}")
            
            # Get info for these responders - address_barangay is an ENUM type in the DB
            info_resp = supabase.table("info").select("user_id, address_barangay").in_("user_id", responder_ids).execute()
            info_data = getattr(info_resp, "data", [])
            print(f"📋 Info data for responders: {info_data}")
            
            # Create mapping of user_id to barangay
            # Note: address_barangay is an ENUM type, so comparison should be exact
            barangay_map = {}
            for info in info_data:
                uid = info.get("user_id")
                addr_brgy = info.get("address_barangay")
                if uid:
                    barangay_map[uid] = addr_brgy or ""
                    print(f"  → User {uid}: address_barangay = '{addr_brgy}'")
            
            print(f"🗺️ Barangay map: {barangay_map}")
            print(f"🎯 Looking for barangay: '{filter_barangay}'")
            
            # Filter responders by barangay - try both exact match and case-insensitive
            filtered_responders = []
            for r in responders:
                rid = r["id"]
                responder_barangay = barangay_map.get(rid, "")
                
                # Try exact match first (for ENUM), then case-insensitive fallback
                if responder_barangay == filter_barangay:
                    filtered_responders.append(r)
                    print(f"  ✓ Exact match: {rid} in '{responder_barangay}'")
                elif responder_barangay and filter_barangay and responder_barangay.lower().strip() == filter_barangay.lower().strip():
                    filtered_responders.append(r)
                    print(f"  ✓ Case-insensitive match: {rid} in '{responder_barangay}'")
                else:
                    print(f"  ✗ No match: {rid} has '{responder_barangay}', looking for '{filter_barangay}'")
            
            responders = filtered_responders
            print(f"✅ Found {len(responders)} responders in barangay '{filter_barangay}'")
        
        return jsonify({"status": "success", "responders": responders}), 200
        
    except Exception as e:
        print(f"❌ Failed to get responders: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500


# ============ REPORT REACTIONS (Heart/Like) ============

@reports_bp.route("/reports/<report_id>/react", methods=["POST"])
@token_required
def toggle_report_reaction(report_id):
    """
    Toggle like/heart reaction on a report.
    If user already reacted, remove reaction. If not, add reaction.
    """
    user_id = request.user_id
    
    try:
        # Check if report exists
        report_resp = supabase.table("reports").select("id, status, is_approved").eq("id", report_id).is_("deleted_at", "null").execute()
        report = getattr(report_resp, "data", [None])[0]
        
        if not report:
            return jsonify({"status": "error", "message": "Report not found"}), 404
        
        # Check if user already reacted
        existing_resp = supabase.table("report_reactions").select("id").eq("report_id", report_id).eq("user_id", user_id).execute()
        existing = getattr(existing_resp, "data", [])
        
        if existing:
            # Remove reaction (unlike)
            supabase.table("report_reactions").delete().eq("report_id", report_id).eq("user_id", user_id).execute()
            
            # Get updated count
            count_resp = supabase.table("report_reactions").select("id", count="exact").eq("report_id", report_id).execute()
            new_count = count_resp.count if hasattr(count_resp, 'count') else 0
            
            print(f"💔 User {user_id} unliked report {report_id}")
            return jsonify({
                "status": "success", 
                "action": "unliked",
                "reaction_count": new_count,
                "user_liked": False
            }), 200
        else:
            # Add reaction (like)
            supabase.table("report_reactions").insert({
                "report_id": report_id,
                "user_id": user_id,
                "reaction_type": "like",
                "created_at": datetime.now(timezone.utc).isoformat()
            }).execute()
            
            # Get updated count
            count_resp = supabase.table("report_reactions").select("id", count="exact").eq("report_id", report_id).execute()
            new_count = count_resp.count if hasattr(count_resp, 'count') else 1
            
            print(f"❤️ User {user_id} liked report {report_id}")
            return jsonify({
                "status": "success", 
                "action": "liked",
                "reaction_count": new_count,
                "user_liked": True
            }), 200
            
    except Exception as e:
        print(f"❌ Error toggling reaction on report {report_id}: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@reports_bp.route("/reports/<report_id>/reactions", methods=["GET"])
@token_required
def get_report_reactions(report_id):
    """
    Get reaction count and whether current user has reacted to a report.
    """
    user_id = request.user_id
    
    try:
        # Get total count
        count_resp = supabase.table("report_reactions").select("id", count="exact").eq("report_id", report_id).execute()
        reaction_count = count_resp.count if hasattr(count_resp, 'count') else 0
        
        # Check if current user has reacted
        user_resp = supabase.table("report_reactions").select("id").eq("report_id", report_id).eq("user_id", user_id).execute()
        user_liked = len(getattr(user_resp, "data", [])) > 0
        
        return jsonify({
            "status": "success",
            "reaction_count": reaction_count,
            "user_liked": user_liked
        }), 200
        
    except Exception as e:
        print(f"❌ Error getting reactions for report {report_id}: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@reports_bp.route("/reports/trending", methods=["GET"])
@token_required
def get_trending_reports():
    """
    Get trending reports using engagement algorithm.
    Returns reports sorted by trending score (reactions + recency).
    Supports filtering by barangay.
    """
    user_id = request.user_id
    barangay = request.args.get("barangay")
    limit = int(request.args.get("limit", 10))
    exclude_own = request.args.get("exclude_own", "true").lower() == "true"
    
    try:
        # Build query for approved, non-resolved reports
        query = supabase.table("reports").select(
            "id, title, category, status, address_barangay, created_at, reaction_count, user_id"
        ).is_("deleted_at", "null").neq("status", "Resolved")
        
        # Filter by approval status
        query = query.or_("is_approved.eq.true,is_rejected.eq.false")
        
        if barangay and barangay != "All":
            query = query.eq("address_barangay", barangay)
        
        # Get more reports than needed for scoring
        response = query.order("created_at", desc=True).limit(limit * 3).execute()
        reports = getattr(response, "data", []) or []
        
        # Filter out own reports if requested
        if exclude_own:
            reports = [r for r in reports if str(r.get("user_id")) != str(user_id)]
        
        # Calculate trending score for each report
        now = datetime.now(timezone.utc)
        scored_reports = []
        
        for report in reports:
            # Parse created_at
            created_at = report.get("created_at")
            if isinstance(created_at, str):
                try:
                    created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                except:
                    created_at = now
            
            hours_old = max(0, (now - created_at).total_seconds() / 3600)
            
            # Engagement score from reactions
            reaction_count = report.get("reaction_count") or 0
            
            # Category weight for priority
            category_weights = {"Crime": 3, "Hazard": 2.5, "Concern": 2, "Lost&Found": 1, "Others": 1}
            category_weight = category_weights.get(report.get("category"), 1)
            
            # Trending score = (reactions * 2 + category_weight) / (hours_old + 2)^1.5
            engagement = (reaction_count * 2) + category_weight
            time_decay = pow(hours_old + 2, 1.5)
            trending_score = engagement / time_decay
            
            scored_reports.append({
                **report,
                "trending_score": trending_score
            })
        
        # Sort by trending score and limit
        trending = sorted(scored_reports, key=lambda x: x["trending_score"], reverse=True)[:limit]
        
        return jsonify({
            "status": "success",
            "reports": trending,
            "total": len(trending)
        }), 200
        
    except Exception as e:
        print(f"❌ Error getting trending reports: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e), "reports": []}), 500


@reports_bp.route("/reports/trending/by-barangay", methods=["GET"])
@token_required  
def get_trending_by_barangay():
    """
    Get trending reports grouped by barangay.
    Returns top reports for user's barangay and other barangays.
    """
    user_id = request.user_id
    limit_per_barangay = int(request.args.get("limit", 3))
    
    try:
        # Get user's barangay
        info_resp = supabase.table("info").select("address_barangay").eq("user_id", user_id).execute()
        info_data = getattr(info_resp, "data", [None])[0]
        user_barangay = info_data.get("address_barangay") if info_data else None
        
        # Get all recent reports with reactions
        query = supabase.table("reports").select(
            "id, title, category, status, address_barangay, created_at, reaction_count, user_id"
        ).is_("deleted_at", "null").neq("status", "Resolved")
        
        response = query.order("created_at", desc=True).limit(100).execute()
        reports = getattr(response, "data", []) or []
        
        # Exclude own reports
        reports = [r for r in reports if str(r.get("user_id")) != str(user_id)]
        
        # Calculate trending scores
        now = datetime.now(timezone.utc)
        for report in reports:
            created_at = report.get("created_at")
            if isinstance(created_at, str):
                try:
                    created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                except:
                    created_at = now
            
            hours_old = max(0, (now - created_at).total_seconds() / 3600)
            reaction_count = report.get("reaction_count") or 0
            category_weights = {"Crime": 3, "Hazard": 2.5, "Concern": 2, "Lost&Found": 1, "Others": 1}
            category_weight = category_weights.get(report.get("category"), 1)
            
            engagement = (reaction_count * 2) + category_weight
            time_decay = pow(hours_old + 2, 1.5)
            report["trending_score"] = engagement / time_decay
        
        # Group by barangay
        barangay_groups = {}
        for report in reports:
            brgy = report.get("address_barangay") or "Unknown"
            if brgy not in barangay_groups:
                barangay_groups[brgy] = []
            barangay_groups[brgy].append(report)
        
        # Sort each group and take top N
        result = {
            "user_barangay": user_barangay,
            "your_barangay": [],
            "other_barangays": {}
        }
        
        for brgy, brgy_reports in barangay_groups.items():
            sorted_reports = sorted(brgy_reports, key=lambda x: x["trending_score"], reverse=True)[:limit_per_barangay]
            
            if brgy == user_barangay:
                result["your_barangay"] = sorted_reports
            else:
                if sorted_reports:  # Only include barangays with reports
                    result["other_barangays"][brgy] = sorted_reports
        
        return jsonify({
            "status": "success",
            **result
        }), 200
        
    except Exception as e:
        print(f"❌ Error getting trending by barangay: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500