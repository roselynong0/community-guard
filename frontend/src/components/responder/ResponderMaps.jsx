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
import { API_CONFIG, getApiUrl } from "../../utils/apiConfig";
import { fetchSafezonesWithCache, addSafezonesToCache, clearSafezonesCache } from "../../utils/safezonesService";
import L from "leaflet";
import "../resident/Maps.css";
import "leaflet/dist/leaflet.css";
import SafezoneModal from "../shared/SafezoneModal";
import LoadingScreen from "../shared/LoadingScreen";

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
  const [showFilters, setShowFilters] = useState(false);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showSafezones, setShowSafezones] = useState(true);
  const [showSafezoneModalForm, setShowSafezoneModalForm] = useState(false);
  const [isRefreshingHotspots, setIsRefreshingHotspots] = useState(false);
  const [overlayExited, setOverlayExited] = useState(false);
  const mapRef = useRef(null);

  // Fetch responder profile to get barangay
  useEffect(() => {
    const fetchResponderBarangay = async () => {
      try {
        const token = session?.token || localStorage.getItem("token");
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
        const token = session?.token || localStorage.getItem("token");

        if (!token) {
          console.warn("Missing token for responder maps");
          setLoading(false);
          return;
        }

        // Use responder-specific map endpoint that filters by barangay and excludes rejected reports
        const reportsEndpoint = getApiUrl('/api/responder/map_reports');
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
          // Ensure client-side filtering for accepted + non-resolved reports as a safety net
          const accepted = formatted.filter(r => {
            const isRejected = r.is_rejected === true || r.is_rejected === 'true';
            const isApprovedFalse = r.is_approved === false || r.is_approved === 'false' || r.is_accepted === false || r.is_accepted === 'false';
            const isResolved = (r.status || '').toString().toLowerCase() === 'resolved';
            return !isRejected && !isApprovedFalse && !isResolved;
          });
          setReports(accepted);
          
          // Update responder barangay from response if available
          if (reportsData.barangay) {
            setResponderBarangay(reportsData.barangay);
          }
          
          console.log(`✅ Loaded ${formatted.length} responder map reports for barangay: ${reportsData.barangay || 'All'}`);
        } else {
          // Fallback to regular map_reports if responder endpoint fails
          console.warn("Responder map endpoint failed, falling back to regular map_reports");
          const fallbackEndpoint = getApiUrl('/api/map_reports');
          const fallbackResponse = await fetch(fallbackEndpoint, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const fallbackData = await fallbackResponse.json();
          
          if (fallbackData.status === "success") {
            const formatted = (fallbackData.reports || []).map((r) => ({
              ...r,
              latitude: parseFloat(r.latitude),
              longitude: parseFloat(r.longitude),
            }));
            // Filter to responder's barangay only, and ensure accepted + non-resolved
            const filteredByBarangay = (responderBarangay 
              ? formatted.filter(r => r.address_barangay === responderBarangay)
              : formatted)
              .filter(r => {
                const isRejected = r.is_rejected === true || r.is_rejected === 'true';
                const isApprovedFalse = r.is_approved === false || r.is_approved === 'false' || r.is_accepted === false || r.is_accepted === 'false';
                const isResolved = (r.status || '').toString().toLowerCase() === 'resolved';
                return !isRejected && !isApprovedFalse && !isResolved;
              });
            setReports(filteredByBarangay);
          }
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

        // Fetch safezones with caching
        const cachedSafezones = await fetchSafezonesWithCache(token);
        const normalizedSafezones = (cachedSafezones || []).map(sz => {
          // Normalize safezone center format
          if (sz?.center?.latitude && sz?.center?.longitude) {
            return sz;
          }
          if (sz?.latitude && sz?.longitude) {
            return { ...sz, center: { latitude: sz.latitude, longitude: sz.longitude } };
          }
          return sz;
        }).filter(Boolean);
        setSafezones(normalizedSafezones);

        console.log(`✅ Loaded responder map data: ${hotspotsData.hotspots?.length || 0} hotspots, ${normalizedSafezones.length} safezones`);
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

  // Refresh hotspots function
  const handleRefreshHotspots = async () => {
    setIsRefreshingHotspots(true);
    try {
      const token = session?.token || localStorage.getItem("token");
      const response = await fetch(getApiUrl('/api/hotspots/refresh'), {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ radius_meters: 200 })
      });
      const data = await response.json();
      if (data.status === "success" && data.hotspots) {
        setHotspots(data.hotspots);
        alert(`✅ Refreshed ${data.hotspots.length} hotspots!`);
      } else {
        alert(`⚠️ ${data.message || 'No new hotspots found'}`);
      }
    } catch (err) {
      console.error("Failed to refresh hotspots:", err);
      alert("❌ Failed to refresh hotspots");
    } finally {
      setIsRefreshingHotspots(false);
    }
  };

  // Handle safezone created from SafezoneModal
  const handleSafezoneCreated = (newSafezone) => {
    const normalized = {
      ...newSafezone,
      center: newSafezone.center || { latitude: newSafezone.latitude, longitude: newSafezone.longitude }
    };
    setSafezones(prev => [...prev, normalized]);
    addSafezonesToCache([normalized]);
    setShowSafezoneModalForm(false);
    
    // Trigger hotspots refresh
    handleRefreshHotspots();
  };

  const handleSaveSafezone = async () => {
    try {
      const token = session?.token || localStorage.getItem("token");

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
        // Trigger hotspots refresh after creating a safezone
        try {
          await fetch(getApiUrl('/api/hotspots/refresh'), {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ radius_meters: safezoneData.radius_meters || 200 })
          });
          console.log('🔁 Triggered hotspots refresh after safezone creation (responder)');
        } catch (e) {
          console.warn('Failed to refresh hotspots after responder safezone creation:', e);
        }
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
      <div className="maps-header desktop-only">
        <h2>{responderBarangay ? `${responderBarangay} Operations Map` : "Responder Operations Map"}</h2>
        <p>{responderBarangay ? `Viewing reports and operations in ${responderBarangay} barangay.` : "Viewing all reports, hotspots, and safezones."}</p>
      </div>
      
      {/* Control Buttons */}
      <div className="desktop-only" style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => setIsCreatingSafezone(!isCreatingSafezone)}
          style={{
            padding: '8px 16px',
            backgroundColor: isCreatingSafezone ? '#ef4444' : '#06b6d4',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
          }}
        >
          {isCreatingSafezone ? "Cancel" : "+ Create Safezone"}
        </button>
        <button
          onClick={handleRefreshHotspots}
          disabled={isRefreshingHotspots}
          style={{
            padding: '8px 16px',
            backgroundColor: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: isRefreshingHotspots ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            opacity: isRefreshingHotspots ? 0.6 : 1,
          }}
        >
          {isRefreshingHotspots ? "Refreshing..." : "⟳ Refresh Hotspots"}
        </button>
      </div>

      <div className="maps-container">
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
        {showSafezones && safezones.map((sz, idx) => {
          const latitude = sz?.center?.latitude || sz?.latitude;
          const longitude = sz?.center?.longitude || sz?.longitude;
          if (!latitude || !longitude) return null;

          return (
            <Circle
              key={`safezone-${sz.id || idx}`}
              center={[Number(latitude), Number(longitude)]}
              radius={sz.radius_meters || 100}
              color="#0891b2"
              fillColor="#06b6d4"
              fillOpacity={0.25}
              weight={3}
              dashArray="5, 5"
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
              
              {/* Mobile action buttons */}
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={() => { setShowSafezoneModalForm(true); setShowFilters(false); }}
                  style={{
                    padding: '10px',
                    backgroundColor: '#06b6d4',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    fontSize: '13px',
                  }}
                >
                  + Create Safezone
                </button>
                <button
                  onClick={() => { handleRefreshHotspots(); setShowFilters(false); }}
                  disabled={isRefreshingHotspots}
                  style={{
                    padding: '10px',
                    backgroundColor: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    fontSize: '13px',
                    opacity: isRefreshingHotspots ? 0.6 : 1,
                  }}
                >
                  {isRefreshingHotspots ? "Refreshing..." : "⟳ Refresh Hotspots"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Control Panel Overlay - Top Right */}
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

        {/* Statistics Overlay - Bottom Left (Desktop) / Bottom Bar (Mobile) */}
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
                <span className="stat-value">{Object.keys(reportsByBarangay).length}</span>
                <span className="stat-label">Barangays</span>
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
