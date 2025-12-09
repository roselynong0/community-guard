import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  Circle,
} from "react-leaflet";
import { getApiUrl } from "../../utils/apiConfig";
import { fetchSafezonesWithCache } from "../../utils/safezonesService";
import L from "leaflet";
import "./Maps.css";
import "leaflet/dist/leaflet.css";
import LoadingScreen from "../shared/LoadingScreen";

// Build endpoints with getApiUrl so VITE_API_URL is used in prod and localhost in dev
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

// Priority colors matching reports - Critical (Crime), High (Hazard), Medium (Concern/Lost&Found), Low (Others)
const CATEGORY_COLORS = {
  Crime: { bg: '#fdedec', text: '#c0392b', label: '🔴 Critical' },
  Hazard: { bg: '#fef5e7', text: '#d35400', label: '🟠 High' },
  Concern: { bg: '#fef9c3', text: '#ca8a04', label: '🟡 Medium' },
  'Lost&Found': { bg: '#fef9c3', text: '#ca8a04', label: '🟡 Medium' },
  Others: { bg: '#ecf0f1', text: '#95a5a6', label: '⚪ Low' },
};

const STATUS_COLORS = {
  Resolved: { bg: '#d1fae5', text: '#059669' },
  Ongoing: { bg: '#fee2e2', text: '#dc2626' },
  Pending: { bg: '#fef9c3', text: '#ca8a04' },
};

const getCategoryStyle = (category) => CATEGORY_COLORS[category] || CATEGORY_COLORS.Others;
const getStatusStyle = (status) => STATUS_COLORS[status] || STATUS_COLORS.Pending;

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

const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Group overlapping reports within a distance threshold (default 150 meters)
const groupOverlappingReports = (reports, thresholdMeters = 150) => {
  const validReports = reports.filter(r => r.latitude && r.longitude);
  const groups = [];
  const assigned = new Set();
  
  console.log(`📍 Grouping ${validReports.length} reports with ${thresholdMeters}m threshold`);
  
  validReports.forEach((report, idx) => {
    if (assigned.has(idx)) return;
    
    // Start a new group with this report
    const group = {
      latitude: parseFloat(report.latitude),
      longitude: parseFloat(report.longitude),
      reports: [report]
    };
    assigned.add(idx);
    
    // Find all other reports within threshold distance
    validReports.forEach((otherReport, otherIdx) => {
      if (assigned.has(otherIdx)) return;
      
      const distance = getDistanceInMeters(
        parseFloat(report.latitude), parseFloat(report.longitude),
        parseFloat(otherReport.latitude), parseFloat(otherReport.longitude)
      );
      
      if (distance <= thresholdMeters) {
        group.reports.push(otherReport);
        assigned.add(otherIdx);
        console.log(`  ↳ Grouped report ${otherReport.id} (${distance.toFixed(1)}m away)`);
      }
    });
    
    // Calculate centroid for the group marker position
    if (group.reports.length > 1) {
      const avgLat = group.reports.reduce((sum, r) => sum + parseFloat(r.latitude), 0) / group.reports.length;
      const avgLng = group.reports.reduce((sum, r) => sum + parseFloat(r.longitude), 0) / group.reports.length;
      group.latitude = avgLat;
      group.longitude = avgLng;
      console.log(`📦 Created group with ${group.reports.length} reports at centroid [${avgLat.toFixed(5)}, ${avgLng.toFixed(5)}]`);
    }
    
    groups.push(group);
  });
  
  console.log(`📍 Result: ${groups.length} marker groups from ${validReports.length} reports`);
  return groups;
};

function Maps({ session, userRole }) {
  const [reports, setReports] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [safezones, setSafezones] = useState([]);
  const [userBarangay, setUserBarangay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBarangay, setSelectedBarangay] = useState('all');
  const [showFilters, setShowFilters] = useState(false); // Collapsible filter panel for mobile
  const [showHotspots, setShowHotspots] = useState(true);
  const [showSafezones, setShowSafezones] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [overlayExited, setOverlayExited] = useState(false);
  const successTitle = "Maps Complete!";

  useEffect(() => {
    const fetchMapReports = async () => {
      try {
        setLoading(true);
        const token = session?.token || localStorage.getItem("token");

        // Check if user is a barangay official
        const isBarangayOfficial = userRole === "Barangay Official";

        let endpoint = getApiUrl("/api/map_reports");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        // If barangay official, use the filtered endpoint
        if (isBarangayOfficial && token) {
          endpoint = getApiUrl("/api/map_reports/barangay");
        }

        const response = await fetch(endpoint, { headers });
        let data = null;

        if (!response.ok) {
          // Server returned a non-2xx response - capture body for debugging
          const text = await response.text().catch(() => null);
          console.error(`Map reports fetch failed: ${response.status} ${response.statusText}`, text);
        } else {
          try {
            data = await response.json();
          } catch (e) {
            console.error("Failed parsing map reports JSON:", e);
          }
        }

        if (data && data.status === "success") {
          const formatted = (data.reports || []).map((r) => ({
            ...r,
            latitude: parseFloat(r.latitude),
            longitude: parseFloat(r.longitude),
          }));
          setReports(formatted);
          
          // Set user's barangay if they're a barangay official
          if (isBarangayOfficial && data.barangay) {
            setUserBarangay(data.barangay);
            setSelectedBarangay(data.barangay);
          }
          
          console.log(`✅ Loaded ${formatted.length} map reports${isBarangayOfficial ? ` for barangay: ${data.barangay}` : ''}`);
        } else {
          console.error("Map reports error:", data.message);
        }

        // Fetch hotspots
        const hotspotsEndpoint = getApiUrl("/api/hotspots");
        const hotspotsResponse = await fetch(hotspotsEndpoint, { headers });
        let hotspotsData = null;
        if (!hotspotsResponse.ok) {
          const text = await hotspotsResponse.text().catch(() => null);
          console.error(`Hotspots fetch failed: ${hotspotsResponse.status} ${hotspotsResponse.statusText}`, text);
        } else {
          try {
            hotspotsData = await hotspotsResponse.json();
          } catch (e) {
            console.error("Failed parsing hotspots JSON:", e);
          }
        }

        if (hotspotsData && hotspotsData.status === "success") {
          setHotspots(hotspotsData.hotspots || []);
          console.log(`✅ Loaded ${(hotspotsData.hotspots || []).length} hotspots`);
        }

        const cachedSafezones = await fetchSafezonesWithCache(token);
        const normalizedSafezones = cachedSafezones
          .map((sz) => normalizeSafezone(sz))
          .filter(Boolean);
        setSafezones(normalizedSafezones);
        console.log(`✅ Loaded ${normalizedSafezones.length} safezones (cached)`);
        // Try to get user current location (for residents)
        try {
          if (userRole === 'Resident' && navigator && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
              (err) => console.warn('Geolocation error (user location):', err),
              { enableHighAccuracy: true, maximumAge: 60_000 }
            );
          }
        } catch (e) {
          console.warn('Geolocation not available:', e);
        }
      } catch (err) {
        console.error("Failed to load map reports:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMapReports();
  }, [session, userRole]);

  // Exclude unapproved or rejected reports from counts and maps
  const acceptedReports = reports.filter(r => {
    const isRejected = r.is_rejected === true || r.is_rejected === 'true';
    const isApprovedFalse = r.is_approved === false || r.is_approved === 'false' || r.is_accepted === false || r.is_accepted === 'false';
    return !isRejected && !isApprovedFalse;
  });

  // Separate resolved vs non-resolved accepted reports (case-insensitive)
  const resolvedAcceptedReports = acceptedReports.filter(r => (r.status || '').toString().toLowerCase() === 'resolved');
  const nonResolvedAcceptedReports = acceptedReports.filter(r => (r.status || '').toString().toLowerCase() !== 'resolved');

  // Group non-resolved accepted reports by barangay (for map markers and counts)
  const reportsByBarangay = nonResolvedAcceptedReports.reduce((acc, r) => {
    if (!acc[r.address_barangay]) acc[r.address_barangay] = [];
    acc[r.address_barangay].push(r);
    return acc;
  }, {});

  // Get all unique barangays for filter dropdown
  const allBarangays = Object.keys(reportsByBarangay).sort();

  // Filter reports by selected barangay (only non-resolved accepted reports)
  const filteredReports = selectedBarangay === 'all'
    ? nonResolvedAcceptedReports
    : nonResolvedAcceptedReports.filter(r => r.address_barangay === selectedBarangay);

  // Group overlapping markers for display
  const groupedMarkers = groupOverlappingReports(filteredReports);

  const content = (
    <div className="maps-page">
      <div className="maps-header desktop-only">
        <h2>Olongapo City Reports Map</h2>
        <p>View all community reports across the city.</p>
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
          {showSafezones && safezones.map((sz) => {
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

            return (
              <Circle
                key={`safezone-${sz.id ?? `${latitude}-${longitude}`}`}
                center={[Number(latitude), Number(longitude)]}
                radius={sz.radius_meters}
                color="#0891b2"
                fillColor="#06b6d4"
                fillOpacity={0.25}
                weight={3}
                dashArray="5, 5"
                className={`safezone safezone-${sz.id ?? 'unknown'}`}
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
                    <br />
                    <small style={{ color: '#666' }}>ID: {sz.id ?? 'n/a'}</small>
                  </div>
                </Popup>
              </Circle>
            );
          })}

          {/* Render hotspots */}
          {showHotspots && hotspots.map((hs, idx) => (
            <Circle
              key={`hotspot-${hs.id ?? idx}`}
              center={[hs.centroid.latitude, hs.centroid.longitude]}
              radius={300}
              color="#dc2626"
              fillColor="#dc2626"
              fillOpacity={0.2}
              className={`hotspot hotspot-${hs.id ?? idx}`}
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
                  <br />
                  <small style={{ color: '#666' }}>ID: {hs.id ?? 'n/a'}</small>
                </div>
              </Popup>
            </Circle>
          ))}

          {/* Grouped report markers - overlapping reports share one marker with stacked popup */}
          {groupedMarkers.map((group, groupIdx) => {
            const primaryReport = group.reports[0];
            const reportCount = group.reports.length;
            const isStacked = reportCount > 1;
            
            return (
              <Marker
                key={`report-group-${groupIdx}`}
                position={[group.latitude, group.longitude]}
                icon={createColoredIcon(getColor(primaryReport.address_barangay))}
                className={`report-marker barangay-${primaryReport.address_barangay?.replace(/\s+/g, '-')}`}
              >
                <Popup>
                  <div style={{ minWidth: '200px', maxHeight: isStacked ? '300px' : 'auto', overflowY: isStacked ? 'auto' : 'visible' }}>
                    {/* Header with barangay */}
                    <div style={{ 
                      fontWeight: "bold", 
                      fontSize: "14px", 
                      marginBottom: "8px", 
                      color: '#2d2d73',
                      borderBottom: '1px solid #e5e7eb',
                      paddingBottom: '8px'
                    }}>
                      📍 {primaryReport.address_barangay}
                    </div>
                    
                    {/* Render each report in the group */}
                    {group.reports.map((r, rIdx) => {
                      const catStyle = getCategoryStyle(r.category);
                      const statStyle = getStatusStyle(r.status);
                      
                      return (
                        <div 
                          key={`report-${r.id || rIdx}`}
                          style={{ 
                            marginBottom: isStacked && rIdx < reportCount - 1 ? '12px' : '0',
                            paddingBottom: isStacked && rIdx < reportCount - 1 ? '12px' : '0',
                            borderBottom: isStacked && rIdx < reportCount - 1 ? '1px solid #e5e7eb' : 'none'
                          }}
                        >
                          {/* Report Count, Category and Status Tags - show on first report only */}
                          {rIdx === 0 && (
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                background: '#3b82f6',
                                color: '#fff',
                                border: '1px solid #2563eb'
                              }}>
                                {reportCount} {reportCount === 1 ? 'Report' : 'Reports'}
                              </span>
                              <span style={{ 
                                fontSize: '11px', 
                                fontWeight: '600', 
                                padding: '3px 8px',
                                background: catStyle.bg,
                                color: catStyle.text,
                                borderRadius: '4px',
                                border: `1px solid ${catStyle.text}`
                              }}>
                                {r.category || 'Others'}
                              </span>
                              <span style={{ 
                                fontSize: '11px', 
                                fontWeight: '600',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                background: statStyle.bg,
                                color: statStyle.text,
                                border: `1px solid ${statStyle.text}`
                              }}>
                                {r.status || 'Pending'}
                              </span>
                            </div>
                          )}
                          
                          {/* Show category/status for additional stacked reports */}
                          {rIdx > 0 && (
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                              <span style={{ 
                                fontSize: '11px', 
                                fontWeight: '600', 
                                padding: '3px 8px',
                                background: catStyle.bg,
                                color: catStyle.text,
                                borderRadius: '4px',
                                border: `1px solid ${catStyle.text}`
                              }}>
                                {r.category || 'Others'}
                              </span>
                              <span style={{ 
                                fontSize: '11px', 
                                fontWeight: '600',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                background: statStyle.bg,
                                color: statStyle.text,
                                border: `1px solid ${statStyle.text}`
                              }}>
                                {r.status || 'Pending'}
                              </span>
                            </div>
                          )}
                          
                          <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                            {r.title}
                          </div>
                        <div style={{ fontSize: "11px", color: "#555", marginBottom: "3px" }}>
                          📍 {r.address_street}
                        </div>
                        <div style={{ fontSize: "11px", color: "#666", marginBottom: "3px" }}>
                          👤 {r.reporter?.first_name || r.reporter?.firstname || "Unknown"} {r.reporter?.last_name || r.reporter?.lastname || ""}
                        </div>
                          <div style={{ fontSize: '10px', color: '#888' }}>
                            🕐 {new Date(r.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* User location pointer - residents only */}
          {userLocation && userRole === 'Resident' && (
            <>
              <Marker
                key={`user-location`}
                position={[userLocation.latitude, userLocation.longitude]}
                icon={new L.Icon({
                  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
                  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
                  iconSize: [25,41],
                  iconAnchor: [12,41]
                })}
                className="user-location-marker"
              >
                <Popup>
                  <div>
                    <strong>📍 Your Location</strong>
                  </div>
                </Popup>
              </Marker>
              <Circle
                center={[userLocation.latitude, userLocation.longitude]}
                radius={50}
                color="#2563eb"
                fillColor="#2563eb"
                fillOpacity={0.12}
                weight={2}
                className="user-location-circle"
              />
            </>
          )}
        </MapContainer>

        {/* Control Panel Overlay - Top Right (Desktop only) */}
        {!loading && allBarangays.length > 0 && (
          <div className="maps-control-panel desktop-only">
            {/* Barangay Filter */}
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

        {/* Mobile Filter Toggle Button */}
        {!loading && allBarangays.length > 0 && (
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
              {/* Barangay Filter */}
              <div className="mobile-filter-section">
                <label className="mobile-filter-label">Filter Barangay</label>
                <select
                  value={selectedBarangay}
                  onChange={(e) => setSelectedBarangay(e.target.value)}
                  className="mobile-filter-select"
                >
                  <option value="all">All Barangays ({nonResolvedAcceptedReports.length})</option>
                  {allBarangays.map(barangay => (
                    <option key={barangay} value={barangay}>
                      {barangay} ({reportsByBarangay[barangay].length})
                    </option>
                  ))}
                </select>
              </div>

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
                <span className="stat-value">{allBarangays.length}</span>
                <span className="stat-label">Barangays</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );

  const loadingFeatures = [
    {
      title: "Map Reports",
      description: "View community reports across Olongapo City on an interactive map.",
    },
    {
      title: "Crime Hotspots",
      description: "Identify high-risk areas with real-time incident clustering.",
    },
    {
      title: "Safezones",
      description: "Locate designated safe areas and emergency facilities nearby.",
    },
    {
      title: "Barangay Filter",
      description: "Filter and focus on specific barangay reports.",
    },
    {
      title: "Location Tracking",
      description: "See your current location and nearby incidents in real-time.",
    },
  ];

  const effectiveStage = loading ? "loading" : "exit";

  const handleLoadingExited = () => {
    setOverlayExited(true);
  };

  return (
    <LoadingScreen
      variant="inline"
      features={loadingFeatures}
      title={loading ? "Loading map reports..." : undefined}
      subtitle={loading ? "Fetching reports, hotspots, and safezones" : undefined}
      stage={effectiveStage}
      onExited={handleLoadingExited}
      inlineOffset="25vh"
      successDuration={900}
      successTitle={successTitle}
    >
      {content}
    </LoadingScreen>
  );
}

export default Maps;