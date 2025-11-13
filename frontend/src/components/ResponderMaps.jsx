import React, { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  Circle,
} from "react-leaflet";
import { useMapEvents } from "react-leaflet";
import { API_CONFIG, getApiUrl } from "../utils/apiConfig";
import L from "leaflet";
import "./Maps.css";
import "leaflet/dist/leaflet.css";

// Olongapo Center for map initialization
const OLONGAPO_CENTER = [14.8291, 120.2829];
const INITIAL_ZOOM = 13;

const barangayColors = {
  Barretto: "blue",
  "East Bajac-Bajac": "red",
  "East Tapinac": "green",
  "Gordon Heights": "orange",
  Kalaklan: "violet",
  Mabayuan: "grey",
  "New Asinan": "yellow",
  "New Banicain": "green",
  "New Cabalan": "orange",
  "New Ilalim": "blue",
  "New Kababae": "violet",
  "New Kalalake": "black",
  "Old Cabalan": "grey",
  "Pag-Asa": "yellow",
  "Santa Rita": "red",
  "West Bajac-Bajac": "orange",
  "West Tapinac": "green",
};

const createColoredIcon = (color) =>
  new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

const getColor = (barangay) => barangayColors[barangay?.trim()] || "gray";

// Map event handler to add safezone
function SafezoneCreator({ onSafezoneCreated, isCreating }) {
  const [position, setPosition] = useState(null);

  useMapEvents({
    click(e) {
      if (isCreating) {
        setPosition([e.latlng.lat, e.latlng.lng]);
        onSafezoneCreated([e.latlng.lat, e.latlng.lng]);
      }
    },
  });

  return position ? (
    <Marker position={position}>
      <Popup>New Safezone Location</Popup>
    </Marker>
  ) : null;
}

function ResponderMaps({ session }) {
  const [reports, setReports] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [safezones, setSafezones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingSafezone, setIsCreatingSafezone] = useState(false);
  const [safezoneModal, setSafezoneModal] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const fetchResponderData = async () => {
      try {
        setLoading(true);
        const token = session?.token || localStorage.getItem("access_token");

        if (!token) {
          console.warn("Missing token for responder maps");
          setLoading(false);
          return;
        }

        // Fetch reports
        const reportsEndpoint = getApiUrl('/api/map_reports');
        const reportsResponse = await fetch(reportsEndpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const reportsData = await reportsResponse.json();

        if (reportsData.status === "success") {
          const formatted = (reportsData.reports || []).map((r) => ({
            ...r,
            latitude: parseFloat(r.latitude),
            longitude: parseFloat(r.longitude),
          }));
          setReports(formatted);
        }

        // Fetch hotspots
        const hotspotsEndpoint = getApiUrl('/api/hotspots');
        const hotspotsResponse = await fetch(hotspotsEndpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const hotspotsData = await hotspotsResponse.json();

        if (hotspotsData.status === "success") {
          setHotspots(hotspotsData.hotspots || []);
        }

        // Fetch safezones
        const safezonesEndpoint = getApiUrl('/api/safezones');
        const safezonesResponse = await fetch(safezonesEndpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const safezonesData = await safezonesResponse.json();

        if (safezonesData.status === "success") {
          setSafezones(safezonesData.safezones || []);
        }

        console.log(`✅ Loaded responder data: ${reportsData.reports?.length || 0} reports, ${hotspotsData.hotspots?.length || 0} hotspots, ${safezonesData.safezones?.length || 0} safezones`);
      } catch (err) {
        console.error("Failed to load responder map data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchResponderData();
  }, [session]);

  // Group reports by barangay
  const reportsByBarangay = reports.reduce((acc, r) => {
    if (!acc[r.address_barangay]) acc[r.address_barangay] = [];
    acc[r.address_barangay].push(r);
    return acc;
  }, {});

  const handleAddSafezone = (position) => {
    setSafezoneModal({
      position,
      name: "",
      description: "",
      radius: 100,
    });
  };

  const handleSaveSafezone = async () => {
    try {
      const token = session?.token || localStorage.getItem("access_token");

      const safezoneData = {
        name: safezoneModal.name,
        description: safezoneModal.description,
        center: {
          latitude: safezoneModal.position[0],
          longitude: safezoneModal.position[1],
        },
        radius_meters: parseInt(safezoneModal.radius),
      };

      const response = await fetch(getApiUrl('/api/safezones'), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(safezoneData),
      });

      const data = await response.json();

      if (data.status === "success") {
        setSafezones([...safezones, data.safezone]);
        setSafezoneModal(null);
        setIsCreatingSafezone(false);
        alert("✅ Safezone created successfully!");
      } else {
        alert(`❌ Error: ${data.message}`);
      }
    } catch (err) {
      console.error("Failed to save safezone:", err);
      alert("❌ Failed to create safezone");
    }
  };

  return (
    <div className="maps-page">
      <h2>Responder Operations Map</h2>
      <p>View all reports, hotspots, and safezones. Click 'Create Safezone' and then click on the map to add a new safezone.</p>
      
      <button
        onClick={() => setIsCreatingSafezone(!isCreatingSafezone)}
        style={{
          marginBottom: "10px",
          padding: "8px 16px",
          backgroundColor: isCreatingSafezone ? "#ef4444" : "#2563eb",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "14px",
        }}
      >
        {isCreatingSafezone ? "Cancel Safezone Creation" : "Create Safezone"}
      </button>

      <div style={{ position: "relative", height: "80vh" }}>
        <MapContainer
          center={OLONGAPO_CENTER}
          zoom={INITIAL_ZOOM}
          scrollWheelZoom={true}
          className="map-container"
          ref={mapRef}
        >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Safezone creation mode */}
        {isCreatingSafezone && (
          <SafezoneCreator onSafezoneCreated={handleAddSafezone} isCreating={isCreatingSafezone} />
        )}

        {/* Render safezones as circles */}
        {safezones.map((sz, idx) => (
          <Circle
            key={`safezone-${idx}`}
            center={[sz.center.latitude, sz.center.longitude]}
            radius={sz.radius_meters}
            color="green"
            fillColor="lightgreen"
            fillOpacity={0.3}
          >
            <Popup>
              <div>
                <strong style={{ fontSize: "14px" }}>{sz.name}</strong>
                <br />
                <span style={{ fontSize: "12px" }}>{sz.description}</span>
                <br />
                <span style={{ fontSize: "11px", color: "#666" }}>
                  Radius: {sz.radius_meters}m
                </span>
              </div>
            </Popup>
          </Circle>
        ))}

        {/* Render hotspots */}
        {hotspots.map((hs, idx) => (
          <Circle
            key={`hotspot-${idx}`}
            center={[hs.centroid.latitude, hs.centroid.longitude]}
            radius={200} // Default visual radius
            color="red"
            fillColor="lightcoral"
            fillOpacity={0.2}
          >
            <Popup>
              <div>
                <strong style={{ fontSize: "14px" }}>Hotspot</strong>
                <br />
                <span style={{ fontSize: "12px" }}>Reports: {hs.report_count}</span>
                <br />
                <span style={{ fontSize: "11px", color: "#666" }}>
                  Last activity: {new Date(hs.last_report_at).toLocaleDateString()}
                </span>
              </div>
            </Popup>
          </Circle>
        ))}

        {/* Report markers grouped by barangay */}
        {Object.entries(reportsByBarangay).map(([barangay, reportsArray], i) => {
          const markerPosition = [
            reportsArray[0].latitude,
            reportsArray[0].longitude,
          ];

          return (
            <Marker
              key={`marker-${i}`}
              position={markerPosition}
              icon={createColoredIcon(getColor(barangay))}
            >
              <Popup>
                <div style={{ fontWeight: "bold", fontSize: "14px", marginBottom: "4px" }}>
                  {barangay}
                </div>
                <div style={{ fontSize: "13px", marginBottom: "4px" }}>
                  📊 Total Reports: {reportsArray.length}
                </div>

                {reportsArray.map((r, idx) => (
                  <div key={idx} style={{ fontSize: "13px", marginBottom: "6px" }}>
                    <strong>{r.title}</strong>
                    <br />
                    📍 {r.address_street}
                    <br />
                    👤 {r.reporter?.first_name || "Unknown"} {r.reporter?.last_name || ""}
                    <br />
                    🌍 {r.latitude.toFixed(6)}, {r.longitude.toFixed(6)}
                  </div>
                ))}
              </Popup>
            </Marker>
          );
        })}

        {/* Individual report markers */}
        {reports.map((r, idx) =>
          r.latitude && r.longitude ? (
            <CircleMarker
              key={`report-${idx}`}
              center={[r.latitude, r.longitude]}
              radius={6}
              color={getColor(r.address_barangay)}
              fillColor={getColor(r.address_barangay)}
              fillOpacity={0.8}
            />
          ) : null
        )}
      </MapContainer>

        {loading && (
          <div className="map-loading-overlay">
            <div className="map-spinner"></div>
          </div>
        )}
      </div>

      {/* Safezone Creation Modal */}
      {safezoneModal && (
        <div
          className="modal-overlay"
          onClick={() => setSafezoneModal(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "white",
              borderRadius: "8px",
              padding: "20px",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            }}
          >
            <h3>Create Safezone</h3>
            <p style={{ fontSize: "12px", color: "#666" }}>
              Location: {safezoneModal.position[0].toFixed(6)}, {safezoneModal.position[1].toFixed(6)}
            </p>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                Safezone Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Community Center"
                value={safezoneModal.name}
                onChange={(e) =>
                  setSafezoneModal({ ...safezoneModal, name: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                Description
              </label>
              <textarea
                placeholder="Describe this safezone..."
                value={safezoneModal.description}
                onChange={(e) =>
                  setSafezoneModal({ ...safezoneModal, description: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  boxSizing: "border-box",
                  minHeight: "60px",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                Radius (meters)
              </label>
              <input
                type="number"
                min="10"
                max="1000"
                value={safezoneModal.radius}
                onChange={(e) =>
                  setSafezoneModal({ ...safezoneModal, radius: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setSafezoneModal(null)}
                style={{
                  flex: 1,
                  padding: "8px 16px",
                  backgroundColor: "#e5e7eb",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSafezone}
                disabled={!safezoneModal.name.trim()}
                style={{
                  flex: 1,
                  padding: "8px 16px",
                  backgroundColor: safezoneModal.name.trim() ? "#2563eb" : "#ccc",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: safezoneModal.name.trim() ? "pointer" : "not-allowed",
                  fontSize: "14px",
                }}
              >
                Create Safezone
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ResponderMaps;
