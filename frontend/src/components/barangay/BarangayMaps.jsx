import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  Circle,
  FeatureGroup,
} from "react-leaflet";
import { API_CONFIG, getApiUrl } from "../../utils/apiConfig";
import { fetchSafezonesWithCache } from "../../utils/safezonesService";
import L from "leaflet";
import "../resident/Maps.css";
import "leaflet/dist/leaflet.css";
import LoadingScreen from "../shared/LoadingScreen";

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

function BarangayMaps({ session, userBarangay }) {
  const [reports, setReports] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [safezones, setSafezones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showSafezones, setShowSafezones] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [overlayExited, setOverlayExited] = useState(false);

  useEffect(() => {
    const fetchBarangayReports = async () => {
      try {
        setLoading(true);
        const token = session?.token || localStorage.getItem("token");

        if (!token || !userBarangay) {
          console.warn("Missing token or barangay for barangay maps");
          setLoading(false);
          return;
        }

        const endpoint = getApiUrl('/api/map_reports');

        const response = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();

        if (data.status === "success") {
          const allReports = (data.reports || []).map((r) => ({
            ...r,
            latitude: parseFloat(r.latitude),
            longitude: parseFloat(r.longitude),
          }));
          const filteredReports = allReports.filter(r => {
            if (r.address_barangay !== userBarangay) return false;
            const isRejected = r.is_rejected === true || r.is_rejected === 'true';
            const isApprovedFalse = r.is_approved === false || r.is_approved === 'false' || r.is_accepted === false || r.is_accepted === 'false';
            const isResolved = (r.status || '').toString().toLowerCase() === 'resolved';
            return !isRejected && !isApprovedFalse && !isResolved;
          });
          setReports(filteredReports);
          console.log(`✅ Loaded ${filteredReports.length} accepted, non-resolved reports for barangay: ${userBarangay}`);
        } else {
          console.error("Barangay map reports error:", data.message);
        }

        // Fetch hotspots
        const hotspotsEndpoint = getApiUrl(API_CONFIG.endpoints.hotspots);
        const hotspotsResponse = await fetch(hotspotsEndpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const hotspotsData = await hotspotsResponse.json();

        if (hotspotsData.status === "success") {
          setHotspots(hotspotsData.hotspots || []);
          console.log(`✅ Loaded ${(hotspotsData.hotspots || []).length} hotspots`);
        }

        // Fetch safezones
        const cachedSafezones = await fetchSafezonesWithCache(token);
        setSafezones(cachedSafezones || []);
        console.log(`✅ Loaded ${(cachedSafezones || []).length} safezones`);
      } catch (err) {
        console.error("Failed to load barangay map reports:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBarangayReports();
  }, [session, userBarangay]);

  const reportsByBarangay = reports.reduce((acc, r) => {
    if (!acc[r.address_barangay]) acc[r.address_barangay] = [];
    acc[r.address_barangay].push(r);
    return acc;
  }, {});

  return (
    <div className="maps-page">
      <div className="maps-header desktop-only">
        <h2>{userBarangay} Reports Map</h2>
        <p>Viewing reports, hotspots, and safezones in {userBarangay} barangay.</p>
      </div>

      {/* Map with overlaid controls */}
      <div className="maps-container">
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
          {showSafezones && safezones.map((sz, idx) => {
            const latitude = sz?.center?.latitude || sz?.latitude;
            const longitude = sz?.center?.longitude || sz?.longitude;
            if (!latitude || !longitude) return null;

            const pointerOffset = 0.00027;

            return (
              <FeatureGroup key={`safezone-frag-${sz.id || idx}`}>
                <Circle
                  key={`safezone-${sz.id || idx}`}
                  center={[Number(latitude), Number(longitude)]}
                  radius={sz.radius_meters || 100}
                  color="#0891b2"
                  fillColor="#06b6d4"
                  fillOpacity={0.25}
                  weight={3}
                  dashArray="5, 5"
                />

                <Marker
                  key={`safezone-pointer-${sz.id || idx}`}
                  position={[Number(latitude) + pointerOffset, Number(longitude)]}
                  icon={createColoredIcon('#3b82f6')}
                />

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
              </FeatureGroup>
            );
          })}

          {/* Render hotspots */}
          {showHotspots && hotspots.map((hs, idx) => (
            <Circle
              key={`hotspot-${hs.id || idx}`}
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

          {/* Barangay markers */}
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
          {reports.map((r, idx) =>
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

        {/* Mobile Filter Toggle Button */}
        {!loading && (
          <button
            className="mobile-filter-toggle"
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? '✕' : '☰'} {showFilters ? 'Close' : 'Filters'}
          </button>
        )}

        {/* Mobile Collapsible Filter Panel */}
        {!loading && showFilters && (
          <div className="mobile-filter-panel">
            <div className="mobile-filter-content">
              {/* Toggle Controls */}
              <div className="mobile-filter-toggles">
                <label className="mobile-toggle-item hotspot-toggle">
                  <input
                    type="checkbox"
                    checked={showHotspots}
                    onChange={(e) => setShowHotspots(e.target.checked)}
                  />
                  <span>Hotspots ({hotspots.length})</span>
                </label>
                <label className="mobile-toggle-item safezone-toggle">
                  <input
                    type="checkbox"
                    checked={showSafezones}
                    onChange={(e) => setShowSafezones(e.target.checked)}
                  />
                  <span>Safezones ({safezones.length})</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Control Panel */}
        {!loading && (
          <div className="maps-control-panel desktop-only">
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

        {/* Statistics Overlay */}
        {!loading && (
          <div className="maps-stats-panel">
            <div className="maps-stats-grid">
              <div className="maps-stat-item stat-reports">
                <span className="stat-icon">📋</span>
                <span className="stat-value">{reports.length}</span>
                <span className="stat-label">Reports</span>
              </div>
              <div className="maps-stat-item stat-hotspots">
                <span className="stat-icon">🔴</span>
                <span className="stat-value">{hotspots.length}</span>
                <span className="stat-label">Hotspots</span>
              </div>
              <div className="maps-stat-item stat-safezones">
                <span className="stat-icon">🛡️</span>
                <span className="stat-value">{safezones.length}</span>
                <span className="stat-label">Safezones</span>
              </div>
              <div className="maps-stat-item stat-barangays">
                <span className="stat-icon">🏘️</span>
                <span className="stat-value">1</span>
                <span className="stat-label">Barangay</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BarangayMaps;