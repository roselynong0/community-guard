"""
Maps Blueprint
Handles map data, hotspots, and safezones
"""
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from middleware.auth import token_required
from utils import supabase, supabase_retry
import struct
import re

maps_bp = Blueprint("maps", __name__)


def parse_wkb_point(hex_string):
    try:
        hex_clean = hex_string.strip().replace(" ", "")
        if len(hex_clean) < 2:
            return None, None

        byte_order = hex_clean[:2]
        is_little_endian = byte_order == "01"

        offset = 10
        geom_type_hex = hex_clean[2:10]
        geom_type_bytes = bytes.fromhex(geom_type_hex)
        geom_type = struct.unpack(("<I" if is_little_endian else ">I"), geom_type_bytes)[0]

        if geom_type & 0x20000000:
            offset = 18

        if len(hex_clean) < offset + 32:
            return None, None

        coords_hex = hex_clean[offset:]
        x_hex = coords_hex[:16]
        y_hex = coords_hex[16:32]

        x_bytes = bytes.fromhex(x_hex)
        y_bytes = bytes.fromhex(y_hex)

        longitude = struct.unpack(("<d" if is_little_endian else ">d"), x_bytes)[0]
        latitude = struct.unpack(("<d" if is_little_endian else ">d"), y_bytes)[0]

        return latitude, longitude
    except Exception as exc:
        print(f"⚠️  Error parsing WKB: {exc}")
        return None, None


# ============ SAFEZONES ============

@maps_bp.route("/safezones", methods=["GET"])
@token_required
def get_safezones():
    """Get all safezones"""
    try:
        response = supabase.table("safezones").select("*").eq("is_active", True).execute()
        safezones = getattr(response, "data", []) or []

        formatted_safezones = []
        for sz in safezones:
            try:
                center = sz.get("center")
                latitude = None
                longitude = None

                if center:
                    if isinstance(center, dict):
                        coords = center.get("coordinates", [])
                        if len(coords) >= 2:
                            longitude = coords[0]
                            latitude = coords[1]
                    elif isinstance(center, str):
                        if len(center) > 20 and not center.strip().startswith("POINT"):
                            latitude, longitude = parse_wkb_point(center)
                        else:
                            match = re.search(r"POINT\s*\(\s*([\d.\-]+)\s+([\d.\-]+)\s*\)", center, re.IGNORECASE)
                            if match:
                                longitude = float(match.group(1))
                                latitude = float(match.group(2))

                if latitude is not None and longitude is not None:
                    formatted_safezones.append({
                        "id": sz["id"],
                        "name": sz.get("name", "Unnamed"),
                        "description": sz.get("description", ""),
                        "center": {
                            "latitude": latitude,
                            "longitude": longitude,
                        },
                        "radius_meters": sz.get("radius_meters", 100),
                        "created_by": sz.get("created_by"),
                        "created_at": sz.get("created_at"),
                    })
                else:
                    print(f"⚠️  Skipping safezone {sz.get('id')} - could not parse coordinates: {center}")
            except Exception as parse_err:
                print(f"⚠️  Error parsing safezone {sz.get('id')}: {parse_err}")

        print(f"✅ Loaded {len(formatted_safezones)} valid safezones")
        return jsonify({"status": "success", "safezones": formatted_safezones}), 200
    except Exception as exc:
        print(f"❌ Error fetching safezones: {exc}")
        return jsonify({"status": "error", "message": str(exc), "safezones": []}), 500


@maps_bp.route("/safezones", methods=["POST"])
@token_required
def create_safezone():
    """Admin-only: Create a new safezone"""
    try:
        user_id = request.user_id
        data = request.get_json()

        # Verify admin role
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        if not user_data or user_data.get("role") != "Admin":
            return jsonify({"status": "error", "message": "Forbidden"}), 403

        # Validate required fields
        required_fields = ["name", "latitude", "longitude", "radius_meters"]
        if not all(field in data for field in required_fields):
            return jsonify({"status": "error", "message": "Missing required fields"}), 400

        # Create safezone record
        new_safezone = {
            "name": data.get("name"),
            "description": data.get("description", ""),
            "center": f"POINT({data.get('longitude')} {data.get('latitude')})",
            "radius_meters": int(data.get("radius_meters", 100)),
            "is_active": True,
            "created_by": user_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        response = supabase.table("safezones").insert(new_safezone).execute()
        safezone = getattr(response, "data", [None])[0]

        if not safezone:
            return jsonify({"status": "error", "message": "Failed to create safezone"}), 500

        print(f"✅ Safezone created by admin {user_id}")
        return jsonify({"status": "success", "safezone": safezone}), 201

    except Exception as e:
        print(f"❌ Error creating safezone: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@maps_bp.route("/safezones/<safezone_id>", methods=["DELETE"])
@token_required
def delete_safezone(safezone_id):
    """Admin-only: Soft delete a safezone"""
    try:
        user_id = request.user_id

        # Verify admin role
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        if not user_data or user_data.get("role") != "Admin":
            return jsonify({"status": "error", "message": "Forbidden"}), 403

        # Soft delete by setting is_active to False
        supabase.table("safezones").update({"is_active": False}).eq("id", safezone_id).execute()

        print(f"✅ Safezone {safezone_id} deleted by admin {user_id}")
        return jsonify({"status": "success", "message": "Safezone deleted"}), 200

    except Exception as e:
        print(f"❌ Error deleting safezone: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ============ HOTSPOTS ============

@maps_bp.route("/hotspots", methods=["GET"])
@token_required
def get_hotspots():
    """Get all hotspots (computed clusters)"""
    try:
        # Use the retry wrapper to handle transient network/read errors (e.g. WinError 10035)
        def fetch_hotspots():
            return supabase.table("hotspots").select("*").order("report_count", desc=True).execute()

        try:
            # Increase retries for this potentially flaky query
            response = supabase_retry(fetch_hotspots, max_retries=5, delay=0.5)
            hotspots = getattr(response, "data", []) or []
        except Exception as e:
            # Log and return an empty successful response to avoid 500s on transient DB/network errors
            print(f"⚠️ Failed to load hotspots from Supabase: {e}")
            hotspots = []
        
        # Format hotspots for frontend
        formatted_hotspots = []
        for hs in hotspots:
            if hs.get("centroid"):
                centroid = hs["centroid"]
                if isinstance(centroid, dict):
                    formatted_hotspots.append({
                        "id": hs["id"],
                        "centroid": {
                            "latitude": centroid.get("coordinates", [0, 0])[1],
                            "longitude": centroid.get("coordinates", [0, 0])[0]
                        },
                        "report_count": hs["report_count"],
                        "category_counts": hs["category_counts"],
                        "first_report_at": hs["first_report_at"],
                        "last_report_at": hs["last_report_at"]
                    })
        
        print(f"✅ Loaded {len(formatted_hotspots)} hotspots")
        return jsonify({"status": "success", "hotspots": formatted_hotspots}), 200
    except Exception as e:
        # As a last resort, avoid returning 500 to the frontend for transient network/read issues.
        print(f"❌ Error fetching hotspots (final fallback): {e}")
        return jsonify({"status": "success", "hotspots": []}), 200


@maps_bp.route("/hotspots/refresh", methods=["POST"])
@token_required
def refresh_hotspots():
    """Admin-only: Refresh hotspots using PostGIS clustering"""
    try:
        user_id = request.user_id
        data = request.get_json() or {}

        # Verify admin role
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        if not user_data or user_data.get("role") != "Admin":
            return jsonify({"status": "error", "message": "Forbidden"}), 403

        radius_meters = data.get("radius_meters", 200)
        min_points = data.get("min_points", 3)
        since_interval = data.get("since_interval", "30 days")

        # Call the PostGIS function to refresh hotspots
        # Note: This requires the SQL function to be created on the database
        query = f"""
        SELECT refresh_hotspots_dbscan(
            radius_meters := {radius_meters},
            min_points := {min_points},
            since_interval := '{since_interval}'
        );
        """
        
        # Execute raw SQL (if available through Supabase RPC)
        try:
            response = supabase.rpc("refresh_hotspots_dbscan", {
                "radius_meters": radius_meters,
                "min_points": min_points,
                "since_interval": since_interval
            }).execute()
            
            print(f"✅ Hotspots refreshed by admin {user_id}")
            return jsonify({"status": "success", "message": "Hotspots refreshed"}), 200
        except Exception as rpc_error:
            print(f"⚠️ RPC call failed, trying alternative approach: {rpc_error}")
            # If RPC fails, return a message suggesting to run the SQL migration
            return jsonify({
                "status": "warning",
                "message": "PostGIS clustering requires database migration. Please ensure the SQL migration has been applied."
            }), 400

    except Exception as e:
        print(f"❌ Error refreshing hotspots: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ============ AUTO-HOTSPOT GENERATION ============

# Hotspot generation thresholds
HOTSPOT_THRESHOLDS = {
    'min_reports': 3,           # Minimum HIGH/CRITICAL reports to create hotspot
    'time_window_days': 7,      # Reports within this time window
    'critical_threshold': 2,     # If 2+ CRITICAL reports, auto-create
    'high_threshold': 3,         # If 3+ HIGH reports, auto-create
}

# Priority categories mapping
PRIORITY_CATEGORIES = {
    'Critical': ['Crime'],
    'High': ['Hazard', 'Fire', 'Accident'],
}


def check_and_create_hotspot_for_barangay(barangay: str, report_data: dict = None):
    """
    Check if a barangay qualifies for a hotspot based on HIGH/CRITICAL reports.
    Auto-creates a hotspot if thresholds are met.
    
    Args:
        barangay: The barangay name to check
        report_data: Optional - the report that triggered this check
        
    Returns:
        dict with status and hotspot info if created
    """
    from datetime import timedelta
    
    if not barangay or barangay == "No barangay selected":
        return {"status": "skipped", "reason": "Invalid barangay"}
    
    try:
        # Calculate time window
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(days=HOTSPOT_THRESHOLDS['time_window_days'])
        
        # Query for HIGH/CRITICAL reports in this barangay within time window
        critical_categories = PRIORITY_CATEGORIES.get('Critical', [])
        high_categories = PRIORITY_CATEGORIES.get('High', [])
        all_priority_categories = critical_categories + high_categories
        
        # Fetch reports with coordinates in this barangay
        reports_query = supabase.table("reports")\
            .select("id, category, latitude, longitude, created_at, title, address_barangay")\
            .eq("address_barangay", barangay)\
            .eq("is_rejected", False)\
            .is_("deleted_at", "null")\
            .gte("created_at", window_start.isoformat())\
            .execute()
        
        reports = getattr(reports_query, "data", []) or []
        
        # Filter for HIGH/CRITICAL priority reports
        priority_reports = [r for r in reports if r.get("category") in all_priority_categories]
        critical_reports = [r for r in reports if r.get("category") in critical_categories]
        high_reports = [r for r in reports if r.get("category") in high_categories]
        
        print(f"📊 [Auto-Hotspot] Barangay '{barangay}': "
              f"Critical={len(critical_reports)}, High={len(high_reports)}, "
              f"Total Priority={len(priority_reports)}")
        
        # Check if thresholds are met
        should_create = False
        reason = ""
        
        if len(critical_reports) >= HOTSPOT_THRESHOLDS['critical_threshold']:
            should_create = True
            reason = f"{len(critical_reports)} CRITICAL reports"
        elif len(high_reports) >= HOTSPOT_THRESHOLDS['high_threshold']:
            should_create = True
            reason = f"{len(high_reports)} HIGH priority reports"
        elif len(priority_reports) >= HOTSPOT_THRESHOLDS['min_reports']:
            should_create = True
            reason = f"{len(priority_reports)} combined HIGH/CRITICAL reports"
        
        if not should_create:
            return {
                "status": "below_threshold",
                "barangay": barangay,
                "critical_count": len(critical_reports),
                "high_count": len(high_reports),
                "total_priority": len(priority_reports),
                "thresholds": HOTSPOT_THRESHOLDS
            }
        
        # Calculate centroid from reports with valid coordinates
        reports_with_coords = [r for r in priority_reports 
                              if r.get("latitude") and r.get("longitude")]
        
        if not reports_with_coords:
            print(f"⚠️ [Auto-Hotspot] No reports with valid coordinates in {barangay}")
            return {"status": "no_coordinates", "barangay": barangay}
        
        # Calculate centroid (average of all coordinates)
        avg_lat = sum(r["latitude"] for r in reports_with_coords) / len(reports_with_coords)
        avg_lng = sum(r["longitude"] for r in reports_with_coords) / len(reports_with_coords)
        
        # Count categories
        category_counts = {}
        for r in priority_reports:
            cat = r.get("category", "Others")
            category_counts[cat] = category_counts.get(cat, 0) + 1
        
        # Get first and last report timestamps
        sorted_reports = sorted(priority_reports, key=lambda x: x.get("created_at", ""))
        first_report_at = sorted_reports[0].get("created_at") if sorted_reports else now.isoformat()
        last_report_at = sorted_reports[-1].get("created_at") if sorted_reports else now.isoformat()
        
        # Check if hotspot already exists for this area (within ~500m)
        existing_query = supabase.table("hotspots").select("id, centroid, report_count").execute()
        existing_hotspots = getattr(existing_query, "data", []) or []
        
        # Check for nearby existing hotspot
        for hs in existing_hotspots:
            centroid = hs.get("centroid")
            if centroid and isinstance(centroid, dict):
                coords = centroid.get("coordinates", [])
                if len(coords) >= 2:
                    hs_lng, hs_lat = coords[0], coords[1]
                    # Simple distance check (~500m threshold using approximate degrees)
                    dist_lat = abs(avg_lat - hs_lat) * 111000  # ~111km per degree
                    dist_lng = abs(avg_lng - hs_lng) * 85000   # ~85km at this latitude
                    if dist_lat < 500 and dist_lng < 500:
                        # Update existing hotspot instead
                        print(f"🔄 [Auto-Hotspot] Updating existing hotspot {hs['id']} in {barangay}")
                        try:
                            supabase.table("hotspots").update({
                                "report_count": len(priority_reports),
                                "category_counts": category_counts,
                                "last_report_at": last_report_at,
                                "generated_at": now.isoformat()
                            }).eq("id", hs["id"]).execute()
                            
                            return {
                                "status": "updated",
                                "hotspot_id": hs["id"],
                                "barangay": barangay,
                                "report_count": len(priority_reports),
                                "reason": reason
                            }
                        except Exception as update_err:
                            print(f"⚠️ [Auto-Hotspot] Failed to update hotspot: {update_err}")
        
        # Create new hotspot
        print(f"🔥 [Auto-Hotspot] Creating hotspot for {barangay}: {reason}")
        
        try:
            # Insert hotspot with PostGIS geometry
            # Using raw centroid as JSON for compatibility
            insert_data = {
                "centroid": {
                    "type": "Point",
                    "coordinates": [avg_lng, avg_lat]
                },
                "report_count": len(priority_reports),
                "category_counts": category_counts,
                "first_report_at": first_report_at,
                "last_report_at": last_report_at,
                "generated_at": now.isoformat()
            }
            
            result = supabase.table("hotspots").insert(insert_data).execute()
            inserted = getattr(result, "data", [])
            
            if inserted:
                hotspot_id = inserted[0].get("id")
                print(f"✅ [Auto-Hotspot] Created hotspot {hotspot_id} for {barangay}")
                
                return {
                    "status": "created",
                    "hotspot_id": hotspot_id,
                    "barangay": barangay,
                    "centroid": {"latitude": avg_lat, "longitude": avg_lng},
                    "report_count": len(priority_reports),
                    "category_counts": category_counts,
                    "reason": reason
                }
            else:
                return {"status": "error", "reason": "Insert returned no data"}
                
        except Exception as insert_err:
            print(f"❌ [Auto-Hotspot] Failed to create hotspot: {insert_err}")
            return {"status": "error", "reason": str(insert_err)}
        
    except Exception as e:
        print(f"❌ [Auto-Hotspot] Error checking barangay {barangay}: {e}")
        return {"status": "error", "reason": str(e)}


@maps_bp.route("/hotspots/auto-check", methods=["POST"])
@token_required
def auto_check_hotspot():
    """
    Endpoint to manually trigger hotspot check for a barangay.
    Called automatically after HIGH/CRITICAL report submission.
    """
    try:
        data = request.get_json() or {}
        barangay = data.get("barangay")
        report_data = data.get("report")
        
        if not barangay:
            return jsonify({"status": "error", "message": "Barangay is required"}), 400
        
        result = check_and_create_hotspot_for_barangay(barangay, report_data)
        
        return jsonify(result), 200
        
    except Exception as e:
        print(f"❌ Error in auto-check hotspot: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@maps_bp.route("/hotspots/check-all-barangays", methods=["POST"])
@token_required
def check_all_barangays_hotspots():
    """
    Admin endpoint to check and generate hotspots for all barangays.
    Useful for batch processing.
    """
    try:
        user_id = request.user_id
        
        # Verify admin role
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        if not user_data or user_data.get("role") != "Admin":
            return jsonify({"status": "error", "message": "Admin access required"}), 403
        
        # Get all unique barangays from reports
        barangays_query = supabase.table("reports")\
            .select("address_barangay")\
            .is_("deleted_at", "null")\
            .execute()
        
        barangays_data = getattr(barangays_query, "data", []) or []
        unique_barangays = list(set(
            r.get("address_barangay") for r in barangays_data 
            if r.get("address_barangay") and r.get("address_barangay") != "No barangay selected"
        ))
        
        results = {
            "checked": 0,
            "created": 0,
            "updated": 0,
            "below_threshold": 0,
            "details": []
        }
        
        for barangay in unique_barangays:
            result = check_and_create_hotspot_for_barangay(barangay)
            results["checked"] += 1
            
            if result.get("status") == "created":
                results["created"] += 1
            elif result.get("status") == "updated":
                results["updated"] += 1
            elif result.get("status") == "below_threshold":
                results["below_threshold"] += 1
            
            results["details"].append({
                "barangay": barangay,
                "result": result
            })
        
        print(f"✅ [Auto-Hotspot] Batch check complete: {results['created']} created, {results['updated']} updated")
        
        return jsonify({
            "status": "success",
            "summary": results
        }), 200
        
    except Exception as e:
        print(f"❌ Error in batch hotspot check: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
