import React, { useState, useRef, useEffect } from "react";
import { getApiUrl } from "../utils/apiConfig";
import { FaTimes } from "react-icons/fa";
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

const SafezoneModal = ({ isOpen, onClose, onSave, defaultLat, defaultLng }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState(defaultLat || "");
  const [longitude, setLongitude] = useState(defaultLng || "");
  const [radiusMeters, setRadiusMeters] = useState("100");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const modalRef = useRef(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      setDescription("");
      setLatitude(defaultLat || "");
      setLongitude(defaultLng || "");
      setRadiusMeters("100");
      setError("");
    }
  }, [isOpen, defaultLat, defaultLng]);

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

    if (!name.trim()) {
      setError("Safezone name is required");
      return;
    }

    if (!latitude || !longitude) {
      setError("Latitude and longitude are required");
      return;
    }

    if (!radiusMeters || isNaN(radiusMeters) || parseInt(radiusMeters) <= 0) {
      setError("Radius must be a positive number");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(getApiUrl("/api/safezones"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          radius_meters: parseInt(radiusMeters),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to create safezone");
        return;
      }

      onSave(data.safezone);
      onClose();
    } catch (err) {
      console.error("Error creating safezone:", err);
      setError("Failed to create safezone");
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
      >
        <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Create Safezone</h3>
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

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label>Safezone Name: <span style={{ color: "red" }}>*</span></label>
            <input
              type="text"
              placeholder="e.g., Downtown Park"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div>
            <label>Description:</label>
            <textarea
              placeholder="Describe the safezone..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              rows="3"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label>Pick Location on Map: <span style={{ color: "red" }}>*</span></label>
            
            {/* Get Current Location Button */}
            <button
              type="button"
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      const { latitude: lat, longitude: lng } = position.coords;
                      setLatitude(lat);
                      setLongitude(lng);
                    },
                    (error) => {
                      console.error("Geolocation error:", error);
                      setError("Unable to get your location. Please allow location access.");
                    }
                  );
                } else {
                  setError("Geolocation is not supported by your browser.");
                }
              }}
              disabled={isSubmitting}
              style={{
                backgroundColor: "#1976d2",
                color: "#fff",
                border: "none",
                padding: "8px 12px",
                borderRadius: "6px",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                fontSize: "13px",
                fontWeight: "600",
              }}
            >
              📍 Use My Current Location
            </button>

            {/* Map Container */}
            <MapContainer
              center={[latitude || 14.8477, longitude || 120.2879]}
              zoom={latitude && longitude ? 16 : 13}
              style={{ height: "250px", width: "100%", borderRadius: "6px" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              {latitude && longitude && (
                <Marker position={[latitude, longitude]} />
              )}
              <RecenterMap lat={latitude} lng={longitude} />
              <LocationPicker
                setLocation={(latlng) => {
                  setLatitude(latlng.lat);
                  setLongitude(latlng.lng);
                }}
                currentLocation={
                  latitude && longitude ? { lat: latitude, lng: longitude } : null
                }
              />
            </MapContainer>
          </div>

          <div>
            <label>Radius (meters): <span style={{ color: "red" }}>*</span></label>
            <input
              type="number"
              placeholder="100"
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(e.target.value)}
              disabled={isSubmitting}
              min="10"
              max="5000"
              required
            />
            <small style={{ color: "#666", fontSize: "12px" }}>Safe zone range in meters (10-5000m)</small>
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
                background: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting ? "Creating..." : "Create Safezone"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SafezoneModal;
