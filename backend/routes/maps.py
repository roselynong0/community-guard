"""
Maps Blueprint
Handles map data, hotspots, and safezones
"""
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from middleware.auth import token_required
from utils import supabase
import struct
import re

maps_bp = Blueprint("maps", __name__)


def parse_wkb_point(hex_string):
    """
    Parse WKB (Well-Known Binary) hex string to extract lat/lng coordinates.
    Handles little/big endian and optional SRID flag.
    """
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
