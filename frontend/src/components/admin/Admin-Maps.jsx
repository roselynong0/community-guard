import React, { useEffect, useState, useRef } from "react";
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
import { fetchSafezonesWithCache, addSafezonesToCache, clearSafezonesCache } from "../../utils/safezonesService";
import L from "leaflet";
import "../resident/Maps.css";
import "leaflet/dist/leaflet.css";
import SafezoneModal from "../shared/SafezoneModal";
import HotspotModal from "../shared/HotspotModal";
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

  const normalizeSafezone = (safezone) => {
    if (!safezone) {
      return null;
    }

    if (
      safezone.center &&
      typeof safezone.center === "object" &&
      safezone.center.latitude !== undefined &&
      safezone.center.longitude !== undefined
    ) {
      return {
        ...safezone,
        center: {
          latitude: Number(safezone.center.latitude),
          longitude: Number(safezone.center.longitude),
        },
      };
    }

    if (
      safezone.center &&
      typeof safezone.center === "object" &&
      Array.isArray(safezone.center.coordinates) &&
      safezone.center.coordinates.length >= 2
    ) {
      const [lng, lat] = safezone.center.coordinates;
      return {
        ...safezone,
        center: {
          latitude: Number(lat),
          longitude: Number(lng),
        },
      };
    }

    if (typeof safezone.center === "string") {
      const match = safezone.center.match(/POINT\s*\(\s*([\d.+\-eE]+)\s+([\d.+\-eE]+)\s*\)/i);
      if (match) {
        return {
          ...safezone,
          center: {
            latitude: Number(match[2]),
            longitude: Number(match[1]),
          },
        };
      }
    }

    if (safezone.latitude !== undefined && safezone.longitude !== undefined) {
      return {
        ...safezone,
        center: {
          latitude: Number(safezone.latitude),
          longitude: Number(safezone.longitude),
        },
      };
    }

    return null;
  };

function AdminMaps({ session }) {
  const [reports, setReports] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [safezones, setSafezones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overlayExited, setOverlayExited] = useState(false);
  const [selectedBarangay, setSelectedBarangay] = useState('all');
  const [showHotspots, setShowHotspots] = useState(true);
  const [showSafezones, setShowSafezones] = useState(true);
  const [showSafezoneModal, setShowSafezoneModal] = useState(false);
  const [showHotspotModal, setShowHotspotModal] = useState(false);
  const [selectedMapLocation, setSelectedMapLocation] = useState({ lat: null, lng: null });
  const mapRef = useRef(null);

  // Loading features
  const loadingFeatures = [
    { title: "Map Data", description: "Loading all reports and locations." },
    { title: "Hotspots", description: "Identifying high-incident areas." },
    { title: "Safezones", description: "Loading community safe zones." },
  ];

  useEffect(() => {
    const fetchAdminMapData = async () => {
      try {
        setLoading(true);
        const token = session?.token || localStorage.getItem("token");

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
        const hotspotsEndpoint = getApiUrl(API_CONFIG.endpoints.hotspots);
        const hotspotsResponse = await fetch(hotspotsEndpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const hotspotsData = await hotspotsResponse.json();

        if (hotspotsData.status === "success") {
          setHotspots(hotspotsData.hotspots || []);
        }

        // Fetch safezones
        const cachedSafezones = await fetchSafezonesWithCache(token);
        const normalizedSafezones = cachedSafezones
          .map((sz) => normalizeSafezone(sz))
          .filter(Boolean);
        setSafezones(normalizedSafezones);

        console.log(
          `✅ Loaded admin map data: ${reportsData.reports?.length || 0} reports, ${
            hotspotsData.hotspots?.length || 0
          } hotspots, ${normalizedSafezones.length} safezones`
        );
      } catch (err) {
        console.error("Failed to load admin map data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAdminMapData();
  }, [session]);

  // Handle safezone modal close
  const handleCloseSafezoneModal = () => {
    setShowSafezoneModal(false);
    setSelectedMapLocation({ lat: null, lng: null });
  };

  // Handle safezone creation
  const handleSafezoneCreated = (newSafezone) => {
    const normalized = normalizeSafezone(newSafezone);
    if (!normalized) {
      console.warn("⚠️  Ignoring safezone with invalid coordinates", newSafezone);
      return;
    }
    setSafezones((prev) => [...prev, normalized]);
    addSafezonesToCache([normalized]);
    handleCloseSafezoneModal();

    (async () => {
      try {
        const token = session?.token || localStorage.getItem("token");
        if (!token) return;
        await fetch(getApiUrl('/api/hotspots/refresh'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ radius_meters: normalized.radius_meters || 200 })
        });
        console.log('🔁 Triggered hotspots refresh after safezone creation');
      } catch (e) {
        console.warn('Failed to refresh hotspots after safezone creation:', e);
      }
    })();
  };

  const handleSafezoneDelete = async (safezoneId) => {
    if (!window.confirm("Are you sure you want to delete this safezone?")) {
      return;
    }

    try {
      const token = session?.token || localStorage.getItem("token");
      const response = await fetch(getApiUrl(`/api/safezones/${safezoneId}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.status === "success") {
        const updatedSafezones = safezones.filter((sz) => sz.id !== safezoneId);
        setSafezones(updatedSafezones);
        clearSafezonesCache();
        if (updatedSafezones.length > 0) {
          addSafezonesToCache(updatedSafezones);
        }
        console.log("✅ Safezone deleted successfully");
      } else {
        console.error("❌ Error deleting safezone:", data.message);
        alert("Error deleting safezone: " + data.message);
      }
    } catch (err) {
      console.error("❌ Error deleting safezone:", err);
      alert("Error deleting safezone");
    }
  };

  // Handle hotspot modal close
  const handleCloseHotspotModal = () => {
    setShowHotspotModal(false);
  };

  // Handle hotspot refresh
  const handleHotspotRefreshed = (hotspotsData) => {
    setHotspots(hotspotsData);
    handleCloseHotspotModal();
  };

  const acceptedReports = reports.filter(r => {
    const isRejected = r.is_rejected === true || r.is_rejected === 'true';
    const isApprovedFalse = r.is_approved === false || r.is_approved === 'false' || r.is_accepted === false || r.is_accepted === 'false';
    return !isRejected && !isApprovedFalse;
  });

  const nonResolvedAcceptedReports = acceptedReports.filter(r => (r.status || '').toString().toLowerCase() !== 'resolved');

  const reportsByBarangay = nonResolvedAcceptedReports.reduce((acc, r) => {
    if (!acc[r.address_barangay]) acc[r.address_barangay] = [];
    acc[r.address_barangay].push(r);
    return acc;
  }, {});

  // Get all unique barangays
  const allBarangays = Object.keys(reportsByBarangay).sort();

  // Filter reports by selected barangay
  const filteredReports = selectedBarangay === 'all'
    ? nonResolvedAcceptedReports
    : nonResolvedAcceptedReports.filter(r => r.address_barangay === selectedBarangay);

  const filteredHotspots = selectedBarangay === 'all'
    ? hotspots
    : hotspots;

  const content = (
    <div className={`maps-page ${overlayExited ? 'overlay-exited' : ''}`}>
      <h2>City-Wide Reports & Analytics Map</h2>
      <p>Admin dashboard showing all city reports, hotspots, and safezones. Use filters to focus on specific areas.</p>

      {/* MAP CONTROLS */}
      <div style={{ position: 'relative', height: '80vh', overflow: 'hidden' }}>
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

          {/* RENDER SAFEZONES */}
          {showSafezones && safezones.map((sz, idx) => {
            const latitude = sz?.center?.latitude;
            const longitude = sz?.center?.longitude;
            if (
              latitude === undefined ||
              longitude === undefined ||
              Number.isNaN(Number(latitude)) ||
              Number.isNaN(Number(longitude))
            ) {
              console.warn(`⚠️ Skipping safezone ${sz?.id ?? "unknown"} - invalid coordinates`, sz);
              return null;
            }

            const pointerOffset = 0.00027;

            return (
              <FeatureGroup key={`safezone-frag-${sz.id ?? `${latitude}-${longitude}`}`}>
                <Circle
                  key={`safezone-${sz.id ?? `${latitude}-${longitude}`}`}
                  center={[Number(latitude), Number(longitude)]}
                  radius={sz.radius_meters}
                  color="#0891b2"
                  fillColor="#06b6d4"
                  fillOpacity={0.25}
                  weight={3}
                  dashArray="5, 5"
                />

                <Marker
                  key={`safezone-pointer-${sz.id ?? idx}`}
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
                    <br />
                    {sz.id && (
                      <button
                        onClick={() => handleSafezoneDelete(sz.id)}
                        style={{
                          marginTop: "8px",
                          padding: "6px 12px",
                          backgroundColor: "#ef4444",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}
                        onMouseOver={(e) => {
                          e.target.style.backgroundColor = "#dc2626";
                        }}
                        onMouseOut={(e) => {
                          e.target.style.backgroundColor = "#ef4444";
                        }}
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                </Popup>
              </FeatureGroup>
            );
          })}

          {/* RENDER HOTSPOTS */}
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

          {Object.entries(reportsByBarangay).map(([barangay, reportsArray], i) => {
            const markerPosition = [reportsArray[0].latitude, reportsArray[0].longitude];
            const isSelected = selectedBarangay === 'all' || barangay === selectedBarangay;

            return (
              <Marker
                key={`marker-${i}`}
                position={markerPosition}
                icon={createColoredIcon(getColor(barangay))}
                opacity={isSelected ? 1 : 0.35}
                className={`barangay-marker barangay-${barangay.replace(/\s+/g, '-')}`}
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

          {/* REPORT MARKERS */}
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

        {/* CONTROL PANNEL */}
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
            {/* BARANGAY FILTER */}
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
                  <option value="all">All Barangays ({nonResolvedAcceptedReports.length})</option>
                  {allBarangays.map(barangay => (
                    <option key={barangay} value={barangay}>
                      {barangay} ({reportsByBarangay[barangay].length})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* TOGGLE HOTSPOTS */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '12px' }}>
              <input
                type="checkbox"
                checked={showHotspots}
                onChange={(e) => setShowHotspots(e.target.checked)}
                style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#ef4444' }}
              />
              <span style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>Hotspots ({hotspots.length})</span>
            </label>

            {/* TOGGLE SAFEZONES */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '12px' }}>
              <input
                type="checkbox"
                checked={showSafezones}
                onChange={(e) => setShowSafezones(e.target.checked)}
                style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#22c55e' }}
              />
              <span style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>Safezones ({safezones.length})</span>
            </label>

            {/* CREATE/MANAGE BUTTONS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '12px', borderTop: '1px solid #d1d5db' }}>
              <button
                onClick={() => setShowSafezoneModal(true)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#06b6d4',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#0891b2'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#06b6d4'}
              >
                + Create Safezone
              </button>
              <button
                onClick={() => setShowHotspotModal(true)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#d97706'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#f59e0b'}
              >
                ⟳ Refresh Hotspots
              </button>
            </div>
          </div>
        )}

        {/* STATISTICS OVERLAY */}
        {!loading && (
          <div className="maps-stats-panel">
            <div className="maps-stats-grid">
              <div className="maps-stat-item stat-reports">
                <span className="stat-icon">📋</span>
                <span className="stat-value">{filteredReports.length}</span>
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
                <span className="stat-value">{allBarangays.length}</span>
                <span className="stat-label">Barangays</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      <SafezoneModal
        isOpen={showSafezoneModal}
        onClose={handleCloseSafezoneModal}
        onSave={handleSafezoneCreated}
        defaultLat={selectedMapLocation.lat}
        defaultLng={selectedMapLocation.lng}
      />
      <HotspotModal
        isOpen={showHotspotModal}
        onClose={handleCloseHotspotModal}
        onSave={handleHotspotRefreshed}
      />
    </div>
  );

  return (
    <LoadingScreen
      variant="inline"
      features={loadingFeatures}
      title={loading ? "Admin Maps" : undefined}
      subtitle={loading ? "Loading reports, hotspots, and safezones" : undefined}
      stage={loading ? "loading" : "exit"}
      onExited={() => {
        setOverlayExited(true);
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
          try { mapRef.current?.invalidateSize?.(); } catch (e) { console.debug('map invalidate error', e); }
        }, 120);
      }}
      inlineOffset="20vh"
      successDuration={700}
      successTitle="Map Ready!"
    >
      {content}
    </LoadingScreen>
  );
}

export default AdminMaps;