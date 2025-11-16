import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  Circle,
} from "react-leaflet";
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

function AdminMaps({ session }) {
  const [reports, setReports] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [safezones, setSafezones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBarangay, setSelectedBarangay] = useState('all');
  const [showHotspots, setShowHotspots] = useState(true);
  const [showSafezones, setShowSafezones] = useState(true);

  useEffect(() => {
    const fetchAdminMapData = async () => {
      try {
        setLoading(true);
        const token = session?.token || localStorage.getItem("access_token");

        if (!token) {
          console.warn("Missing token for admin maps");
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

        console.log(
          `✅ Loaded admin map data: ${reportsData.reports?.length || 0} reports, ${
            hotspotsData.hotspots?.length || 0
          } hotspots, ${safezonesData.safezones?.length || 0} safezones`
        );
      } catch (err) {
        console.error("Failed to load admin map data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAdminMapData();
  }, [session]);

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

  // Filter hotspots by selected barangay if needed
  const filteredHotspots = selectedBarangay === 'all'
    ? hotspots
    : hotspots;

  return (
    <div className="maps-page">
      <h2>City-Wide Reports & Analytics Map</h2>
      <p>Admin dashboard showing all city reports, hotspots, and safezones. Use filters to focus on specific areas.</p>

      {/* Map with overlaid controls */}
      <div style={{ position: 'relative', height: '80vh', overflow: 'hidden' }}>
        <MapContainer
          center={OLONGAPO_CENTER}
          zoom={INITIAL_ZOOM}
          scrollWheelZoom={true}
          className="map-container"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Render safezones as circles */}
          {showSafezones && safezones.map((sz, idx) => (
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
                  <strong style={{ fontSize: "14px" }}>🛡️ {sz.name}</strong>
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
          {showHotspots && filteredHotspots.map((hs, idx) => (
            <Circle
              key={`hotspot-${idx}`}
              center={[hs.centroid.latitude, hs.centroid.longitude]}
              radius={300}
              color="#dc2626"
              fillColor="#dc2626"
              fillOpacity={0.2}
            >
              <Popup>
                <div>
                  <strong style={{ fontSize: "14px" }}>🔴 Hotspot</strong>
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
                    📍 {barangay}
                  </div>
                  <div style={{ fontSize: "13px", marginBottom: "4px" }}>
                    📊 Total Reports: {reportsArray.length}
                  </div>

                  {reportsArray.slice(0, 3).map((r, idx) => (
                    <div key={idx} style={{ fontSize: "12px", marginBottom: "6px", borderTop: idx === 0 ? 'none' : '1px solid #eee', paddingTop: idx === 0 ? '0' : '6px' }}>
                      <strong>{r.title}</strong>
                      <br />
                      📍 {r.address_street}
                      <br />
                      👤 {r.reporter?.first_name || "Unknown"} {r.reporter?.last_name || ""}
                    </div>
                  ))}
                  {reportsArray.length > 3 && (
                    <div style={{ fontSize: "11px", color: "#2563eb", marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #eee' }}>
                      +{reportsArray.length - 3} more reports
                    </div>
                  )}
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
            {/* Barangay Filter */}
            {allBarangays.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#666', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Filter Barangay
                </label>
                <select
                  value={selectedBarangay}
                  onChange={(e) => setSelectedBarangay(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    cursor: 'pointer',
                    backgroundColor: '#fff',
                    color: '#111',
                    fontWeight: '500'
                  }}
                >
                  <option value="all">All Barangays ({reports.length})</option>
                  {allBarangays.map(barangay => (
                    <option key={barangay} value={barangay}>
                      {barangay} ({reportsByBarangay[barangay].length})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Toggle Hotspots */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '12px' }}>
              <input
                type="checkbox"
                checked={showHotspots}
                onChange={(e) => setShowHotspots(e.target.checked)}
                style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#ef4444' }}
              />
              <span style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>Hotspots ({hotspots.length})</span>
            </label>

            {/* Toggle Safezones */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showSafezones}
                onChange={(e) => setShowSafezones(e.target.checked)}
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
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#111' }}>{selectedBarangay === 'all' ? reports.length : filteredReports.length}</div>
              </div>
              <div style={{ padding: '8px 12px', backgroundColor: '#fef2f2', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#666', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Hotspots</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#dc2626' }}>{hotspots.length}</div>
              </div>
              <div style={{ padding: '8px 12px', backgroundColor: '#f0fdf4', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#666', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Safezones</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#16a34a' }}>{safezones.length}</div>
              </div>
              <div style={{ padding: '8px 12px', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#666', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Barangays</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#111' }}>{allBarangays.length}</div>
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
            <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>Loading map data...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminMaps;
