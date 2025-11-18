import React, { useState, useRef, useEffect } from "react";
import { getApiUrl } from "../utils/apiConfig";
import { FaTimes, FaSpinner } from "react-icons/fa";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";
import "./Reports.css";

// Fix Leaflet marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Location Picker Component
function LocationPicker({ setLocation, currentLocation }) {
  const [position, setPosition] = useState(null);

  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      setLocation(e.latlng);
    },
  });

  useEffect(() => {
    if (currentLocation) {
      setPosition(null);
    }
  }, [currentLocation]);

  return position ? <Marker position={position} /> : null;
}

// Recenter Map Component
function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], 16);
    }
  }, [lat, lng, map]);
  return null;
}

const HotspotModal = ({ isOpen, onClose, onSave }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [radiusMeters, setRadiusMeters] = useState("500");
  const [minPoints, setMinPoints] = useState("3");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const modalRef = useRef(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setRadiusMeters("500");
      setMinPoints("3");
      setLatitude("");
      setLongitude("");
      setError("");
      setSuccess("");
    }
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const handleEscape = (e) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };

    modalRef.current.focus();
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, isSubmitting, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!radiusMeters || isNaN(radiusMeters) || parseInt(radiusMeters) <= 0) {
      setError("Radius must be a positive number");
      return;
    }

    if (!minPoints || isNaN(minPoints) || parseInt(minPoints) < 2) {
      setError("Minimum points must be 2 or greater");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const body = {
        radius_meters: parseInt(radiusMeters),
        min_points: parseInt(minPoints),
        since_interval: "7 days", // Default to last 7 days of reports
      };

      // Add location if specified
      if (latitude && longitude) {
        body.center_latitude = parseFloat(latitude);
        body.center_longitude = parseFloat(longitude);
      }

      const response = await fetch(getApiUrl(API_CONFIG.endpoints.hotspotsRefresh), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to refresh hotspots");
        return;
      }

      setSuccess(`Hotspots generated successfully! Found ${data.hotspots_count} hotspots.`);
      onSave(data.hotspots);

      // Close modal after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error("Error refreshing hotspots:", err);
      setError("Failed to refresh hotspots");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={() => !isSubmitting && onClose()}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        tabIndex="-1"
        style={{ maxWidth: "400px" }}
      >
        <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Refresh Hotspots</h3>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{ background: "none", border: "none", cursor: "pointer" }}
          >
            <FaTimes size={20} />
          </button>
        </div>

        {error && (
          <div style={{ color: "#ef4444", fontSize: "14px", marginBottom: "12px", padding: "8px", backgroundColor: "#fef2f2", borderRadius: "4px" }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ color: "#10b981", fontSize: "14px", marginBottom: "12px", padding: "8px", backgroundColor: "#f0fdf4", borderRadius: "4px" }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ backgroundColor: "#f3f4f6", padding: "12px", borderRadius: "4px", fontSize: "13px", color: "#374151" }}>
            <strong>About Hotspots:</strong> Hotspots are automatically generated from recent incident reports using clustering analysis. Adjust parameters below to refine detection.
          </div>

          {/* Map Picker for Location */}
          <div>
            <label style={{ fontWeight: "600", color: "#374151", fontSize: "13px" }}>
              Center Location (Optional)
            </label>
            <small style={{ color: "#666", fontSize: "12px", display: "block", marginBottom: "8px" }}>
              Click on map to select a center point, or leave empty to analyze all areas
            </small>
            <div style={{ height: "200px", borderRadius: "6px", overflow: "hidden", border: "1px solid #d1d5db" }}>
              <MapContainer
                center={[14.8477, 120.2879]}
                zoom={latitude && longitude ? 16 : 13}
                scrollWheelZoom={true}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {latitude && longitude && <Marker position={[parseFloat(latitude), parseFloat(longitude)]} />}
                <RecenterMap lat={latitude} lng={longitude} />
                <LocationPicker
                  setLocation={(latlng) => {
                    setLatitude(latlng.lat);
                    setLongitude(latlng.lng);
                  }}
                  currentLocation={latitude && longitude}
                />
              </MapContainer>
            </div>
            {latitude && longitude && (
              <small style={{ color: "#10b981", fontSize: "11px", display: "block", marginTop: "4px" }}>
                ✓ Location selected: {parseFloat(latitude).toFixed(4)}, {parseFloat(longitude).toFixed(4)}
              </small>
            )}
          </div>

          <div>
            <label>Clustering Radius (meters): <span style={{ color: "red" }}>*</span></label>
            <input
              type="number"
              placeholder="500"
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(e.target.value)}
              disabled={isSubmitting}
              min="50"
              max="3000"
              required
            />
            <small style={{ color: "#666", fontSize: "12px" }}>Distance for grouping nearby reports (50-3000m)</small>
          </div>

          <div>
            <label>Minimum Reports per Hotspot: <span style={{ color: "red" }}>*</span></label>
            <input
              type="number"
              placeholder="3"
              value={minPoints}
              onChange={(e) => setMinPoints(e.target.value)}
              disabled={isSubmitting}
              min="2"
              max="50"
              required
            />
            <small style={{ color: "#666", fontSize: "12px" }}>Minimum incidents required to form a hotspot (2-50)</small>
          </div>

          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "12px" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: "8px 16px",
                background: "#d1d5db",
                color: "#1f2937",
                border: "none",
                borderRadius: "4px",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: "8px 16px",
                background: "#f59e0b",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                opacity: isSubmitting ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {isSubmitting && <FaSpinner className="spinner" size={14} />}
              {isSubmitting ? "Generating..." : "Refresh Hotspots"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HotspotModal;
