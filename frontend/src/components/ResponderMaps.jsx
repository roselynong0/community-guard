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
  Barretto: "#3b82f6",
  "East Bajac-Bajac": "#ef4444",
  "East Tapinac": "#10b981",
  "Gordon Heights": "#f97316",
  Kalaklan: "#a855f7",
  Mabayuan: "#6b7280",
  "New Asinan": "#eab308",
  "New Banicain": "#10b981",
  "New Cabalan": "#f97316",
  "New Ilalim": "#3b82f6",
  "New Kababae": "#a855f7",
  "New Kalalake": "#000000",
  "Old Cabalan": "#6b7280",
  "Pag-Asa": "#eab308",
  "Santa Rita": "#ef4444",
  "West Bajac-Bajac": "#f97316",
  "West Tapinac": "#10b981",
};

const createColoredIcon = (color) => {
  // Map hex colors to leaflet-color-markers color names
  const colorMap = {
    "#3b82f6": "blue",
    "#ef4444": "red",
    "#10b981": "green",
    "#f97316": "orange",
    "#a855f7": "violet",
    "#6b7280": "grey",
    "#eab308": "yellow",
    "#000000": "black",
  };
  
  const markerColor = colorMap[color] || "gray";
  
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${markerColor}.png`,
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
};

const getColor = (barangay) => barangayColors[barangay?.trim()] || "gray";

const hexToColorName = (hex) => {
  const colorMap = {
    "#3b82f6": "blue",
    "#ef4444": "red",
    "#10b981": "green",
    "#f97316": "orange",
    "#a855f7": "violet",
    "#6b7280": "grey",
    "#eab308": "yellow",
    "#000000": "black",
  };
  return colorMap[hex] || "gray";
};

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
  const [responderBarangay, setResponderBarangay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCreatingSafezone, setIsCreatingSafezone] = useState(false);
  const [safezoneModal, setSafezoneModal] = useState(null);
  const [selectedBarangay, setSelectedBarangay] = useState('all');
  const mapRef = useRef(null);

  // Fetch responder profile to get barangay
  useEffect(() => {
    const fetchResponderBarangay = async () => {
      try {
        const token = session?.token || localStorage.getItem("access_token");
        if (!token) return;

        const response = await fetch(getApiUrl('/api/profile'), {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.status === 'success' && data.profile?.address_barangay) {
          setResponderBarangay(data.profile.address_barangay);
        }
      } catch (error) {
        console.error('Error fetching responder barangay:', error);
      }
    };
    fetchResponderBarangay();
  }, [session]);

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

        // Fetch all reports
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
          // Filter to responder's barangay only
          const filteredByBarangay = responderBarangay 
            ? formatted.filter(r => r.address_barangay === responderBarangay)
            : formatted;
          setReports(filteredByBarangay);
        }

        // Fetch hotspots
        const hotspotsEndpoint = getApiUrl(API_CONFIG.endpoints.hotspots);
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

        console.log(`✅ Loaded responder data: ${reportsData.reports?.length || 0} reports${responderBarangay ? ` for ${responderBarangay}` : ''}, ${hotspotsData.hotspots?.length || 0} hotspots, ${safezonesData.safezones?.length || 0} safezones`);
      } catch (err) {
        console.error("Failed to load responder map data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchResponderData();
  }, [session, responderBarangay]);

  // Group reports by barangay
  const reportsByBarangay = reports.reduce((acc, r) => {
    if (!acc[r.address_barangay]) acc[r.address_barangay] = [];
    acc[r.address_barangay].push(r);
    return acc;
  }, {});

  // Get all unique barangays
  const allBarangays = Object.keys(reportsByBarangay).sort();

  // Filter reports by selected barangay
  const filteredReports = selectedBarangay === 'all'
    ? reports
    : reports.filter(r => r.address_barangay === selectedBarangay);

  // Filter hotspots by selected barangay (match by proximity if needed)
  const filteredHotspots = selectedBarangay === 'all'
    ? hotspots
    : hotspots;

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
      <h2>{responderBarangay ? `${responderBarangay} Operations Map` : "Responder Operations Map"}</h2>
      <p>{responderBarangay ? `Viewing reports and operations in ${responderBarangay} barangay.` : "Viewing all reports, hotspots, and safezones."} Click 'Create Safezone' and then click on the map to add a new safezone.</p>
      
      {/* Control Buttons */}
      <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => setIsCreatingSafezone(!isCreatingSafezone)}
          style={{
            padding: '8px 16px',
            backgroundColor: isCreatingSafezone ? '#ef4444' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          {isCreatingSafezone ? "Cancel Safezone Creation" : "Create Safezone"}
        </button>
      </div>

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
            color="#06b6d4"
            fillColor="#06b6d4"
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
            radius={200}
            color="#dc2626"
            fillColor="#dc2626"
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
          // Only show if this barangay is selected or all are selected
          if (selectedBarangay !== 'all' && barangay !== selectedBarangay) {
            return null;
          }

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
        {filteredReports.map((r, idx) =>
          r.latitude && r.longitude ? (
            <CircleMarker
              key={`report-${idx}`}
              center={[r.latitude, r.longitude]}
              radius={6}
              color={hexToColorName(getColor(r.address_barangay))}
              fillColor={hexToColorName(getColor(r.address_barangay))}
              fillOpacity={0.8}
            />
          ) : null
        )}
      </MapContainer>

        {/* Control Panel Overlay - Top Right */}
        {!loading && (
          <div style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            padding: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            maxWidth: '320px'
          }}>
            {/* Toggle Hotspots */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '12px' }}>
              <input
                type="checkbox"
                defaultChecked={true}
                style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#ef4444' }}
              />
              <span style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>Hotspots ({hotspots.length})</span>
            </label>

            {/* Toggle Safezones */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                defaultChecked={true}
                style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#22c55e' }}
              />
              <span style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>Safezones ({safezones.length})</span>
            </label>
          </div>
        )}

        {/* Statistics Overlay - Bottom Left */}
        {!loading && (
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            padding: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            maxWidth: '320px'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
              <div style={{ padding: '8px 12px', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#666', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Total Reports</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#111' }}>{reports.length}</div>
              </div>
              <div style={{ padding: '8px 12px', backgroundColor: '#fef2f2', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#666', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Hotspots</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#dc2626' }}>{hotspots.length}</div>
              </div>
              <div style={{ padding: '8px 12px', backgroundColor: '#f0fdf4', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#666', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Safezones</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#16a34a' }}>{safezones.length}</div>
              </div>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(255,255,255,0.95)',
            borderRadius: '8px',
            padding: '32px',
            textAlign: 'center',
            zIndex: 1001
          }}>
            <div style={{ width: '40px', height: '40px', border: '4px solid #e5e7eb', borderTop: '4px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
            <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>Loading responder data...</p>
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
