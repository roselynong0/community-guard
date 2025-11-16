"""
Maps Blueprint
Handles map data, hotspots, and safezones
"""
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from middleware.auth import token_required
from utils import supabase

maps_bp = Blueprint("maps", __name__)

# ============ SAFEZONES ============

@maps_bp.route("/safezones", methods=["GET"])
@token_required
def get_safezones():
    """Get all safezones"""
    try:
        response = supabase.table("safezones").select("*").eq("is_active", True).execute()
        safezones = getattr(response, "data", []) or []
        
        # Format safezones for frontend
        formatted_safezones = []
        for sz in safezones:
            if sz.get("center"):
                # Parse geography point from Supabase
                center = sz["center"]
                if isinstance(center, dict):
                    formatted_safezones.append({
                        "id": sz["id"],
                        "name": sz["name"],
                        "description": sz["description"],
                        "center": {
                            "latitude": center.get("coordinates", [0, 0])[1],
                            "longitude": center.get("coordinates", [0, 0])[0]
                        },
                        "radius_meters": sz["radius_meters"],
                        "created_by": sz["created_by"],
                        "created_at": sz["created_at"]
                    })
        
        print(f"✅ Loaded {len(formatted_safezones)} safezones")
        return jsonify({"status": "success", "safezones": formatted_safezones}), 200
    except Exception as e:
        print(f"❌ Error fetching safezones: {e}")
        return jsonify({"status": "error", "message": str(e), "safezones": []}), 500


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
        response = supabase.table("hotspots").select("*").order("report_count", desc=True).execute()
        hotspots = getattr(response, "data", []) or []
        
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
        print(f"❌ Error fetching hotspots: {e}")
        return jsonify({"status": "error", "message": str(e), "hotspots": []}), 500


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
