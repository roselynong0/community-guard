import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { API_CONFIG, getApiUrl } from "../../utils/apiConfig";

function RecenterOnUser({ userLocation, onCentered }) {
  const map = useMap();
  useEffect(() => {
    if (userLocation) {
      map.setView([userLocation.latitude, userLocation.longitude], 15, {
        animate: true,
        duration: 1
      });
      if (onCentered) {
        setTimeout(() => onCentered(), 100);
      }
    }
  }, [userLocation, map, onCentered]);
  return null;
}

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

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

const getColor = (barangay) => barangayColors[barangay?.trim()] || "#6b7280";

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
  
  const markerColor = colorMap[color] || "grey";
  
  return L.icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${markerColor}.png`,
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
};

const redMarkerIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const blueMarkerIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const groupOverlappingReports = (reports, thresholdMeters = 150) => {
  const validReports = reports.filter(r => r.latitude && r.longitude);
  const groups = [];
  const assigned = new Set();
  
  validReports.forEach((report, idx) => {
    if (assigned.has(idx)) return;
    
    const group = {
      latitude: parseFloat(report.latitude),
      longitude: parseFloat(report.longitude),
      reports: [report]
    };
    assigned.add(idx);
    
    validReports.forEach((otherReport, otherIdx) => {
      if (assigned.has(otherIdx)) return;
      
      const distance = getDistanceInMeters(
        parseFloat(report.latitude), parseFloat(report.longitude),
        parseFloat(otherReport.latitude), parseFloat(otherReport.longitude)
      );
      
      if (distance <= thresholdMeters) {
        group.reports.push(otherReport);
        assigned.add(otherIdx);
      }
    });
    
    if (group.reports.length > 1) {
      const avgLat = group.reports.reduce((sum, r) => sum + parseFloat(r.latitude), 0) / group.reports.length;
      const avgLng = group.reports.reduce((sum, r) => sum + parseFloat(r.longitude), 0) / group.reports.length;
      group.latitude = avgLat;
      group.longitude = avgLng;
    }
    
    groups.push(group);
  });
  
  return groups;
};

const MapView = forwardRef(function MapView(props, ref) {
  const { reports, barangay } = props || {};
  const [hotspots, setHotspots] = useState([]);
  const [barangayReports, setBarangayReports] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [initialCenterDone, setInitialCenterDone] = useState(false);
  const mapRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (navigator && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => console.warn('Geolocation error:', err),
        { enableHighAccuracy: true, maximumAge: 60_000 }
      );
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    if (!barangay) {
      console.log("📍 No barangay set - skipping map data fetch");
      setHotspots([]);
      setBarangayReports([]);
      return;
    }

    const fetchHotspots = async () => {
      try {
        const base = getApiUrl(API_CONFIG.endpoints.hotspots);
        const url = `${base}?barangay=${encodeURIComponent(barangay)}`;

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error("Failed to fetch hotspots");

        const data = await response.json();
        setHotspots(data.hotspots || []);
        console.log(`📍 Loaded ${(data.hotspots || []).length} hotspots for ${barangay}`);
      } catch (error) {
        console.error("Error fetching hotspots:", error);
        setHotspots([]);
      }
    };

    const fetchBarangayReports = async () => {
      try {
        const base = getApiUrl(API_CONFIG.endpoints.reports);
        const url = `${base}?barangay=${encodeURIComponent(barangay)}&limit=15`;

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error("Failed to fetch reports");

        const data = await response.json();
        const validReports = (data.reports || [])
          .map(r => ({ ...r, latitude: parseFloat(r.latitude), longitude: parseFloat(r.longitude) }))
          .filter(r => {
            if (!r.latitude || !r.longitude) return false;
            const isRejected = r.is_rejected === true || r.is_rejected === 'true';
            const isApprovedFalse = r.is_approved === false || r.is_approved === 'false' || r.is_accepted === false || r.is_accepted === 'false';
            const isResolved = (r.status || '').toString().toLowerCase() === 'resolved';
            return !isRejected && !isApprovedFalse && !isResolved;
          });
        setBarangayReports(validReports);
        console.log(`📍 Loaded ${validReports.length} accepted, non-resolved reports for ${barangay}`);
      } catch (error) {
        console.error("Error fetching barangay reports:", error);
        setBarangayReports([]);
      }
    };

    fetchHotspots();
    fetchBarangayReports();
  }, [reports, barangay]);

  useImperativeHandle(ref, () => ({
    invalidate: () => {
      try {
        if (mapRef.current) mapRef.current.invalidateSize();
      } catch (e) {
        console.debug('Map invalidate failed', e);
      }
    }
  }));

  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      {/* Hotspots count badge */}
      {barangay && (
        <div style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          zIndex: 1000,
          backgroundColor: hotspots.length > 0 ? "#dc2626" : "#6b7280",
          color: "white",
          padding: "6px 12px",
          borderRadius: "20px",
          fontSize: "12px",
          fontWeight: "600",
          boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
          display: "flex",
          alignItems: "center",
          gap: "6px"
        }}>
          🔴 {hotspots.length} Hotspot{hotspots.length !== 1 ? 's' : ''}
        </div>
      )}

      <MapContainer
        whenCreated={(mapInstance) => { mapRef.current = mapInstance; }}
        center={[14.8292, 120.2828]}
        zoom={14}
        style={{ height: "100%", width: "100%", borderRadius: "12px" }}
      >
        {!initialCenterDone && userLocation && (
          <RecenterOnUser 
            userLocation={userLocation} 
            onCentered={() => setInitialCenterDone(true)}
          />
        )}
        
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* User location marker */}
        {userLocation && (
          <>
            <Marker 
              position={[userLocation.latitude, userLocation.longitude]} 
              icon={blueMarkerIcon}
            >
              <Popup>
                <div style={{ textAlign: "center" }}>
                  <strong>📍 Your Location</strong>
                </div>
              </Popup>
            </Marker>
            <Circle
              center={[userLocation.latitude, userLocation.longitude]}
              radius={100}
              color="#2563eb"
              fillColor="#2563eb"
              fillOpacity={0.15}
              weight={2}
            />
          </>
        )}

        {/* Show markers for hotspots */}
        {hotspots.map((hotspot, idx) => {
          const coords = [hotspot.centroid.latitude, hotspot.centroid.longitude];
          
          return (
            <React.Fragment key={`hotspot-${hotspot.id || idx}`}>
              <Marker position={coords} icon={redMarkerIcon}>
                <Popup>
                  <div style={{ textAlign: "center", minWidth: "150px" }}>
                    <strong>🔴 Hotspot Area</strong>
                    <br />
                    <span style={{ fontSize: "13px" }}>Reports: {hotspot.report_count}</span>
                    <br />
                    <small style={{ color: "#666" }}>
                      Last activity: {hotspot.last_report_at ? new Date(hotspot.last_report_at).toLocaleDateString() : 'N/A'}
                    </small>
                  </div>
                </Popup>
              </Marker>
              <Circle
                center={coords}
                radius={300}
                color="#dc2626"
                fillColor="#dc2626"
                fillOpacity={0.15}
                weight={2}
              />
            </React.Fragment>
          );
        })}

        {groupOverlappingReports(barangayReports).map((group, groupIdx) => {
          const primaryReport = group.reports[0];
          const reportCount = group.reports.length;
          const isStacked = reportCount > 1;
          const reportColor = getColor(primaryReport.address_barangay);
          
          return (
            <Marker 
              key={`report-group-${groupIdx}`} 
              position={[group.latitude, group.longitude]} 
              icon={createColoredIcon(reportColor)}
            >
              <Popup>
                <div style={{ minWidth: "200px", maxHeight: isStacked ? '280px' : 'auto', overflowY: isStacked ? 'auto' : 'visible' }}>
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
                  {group.reports.map((report, rIdx) => {
                    const catStyle = getCategoryStyle(report.category);
                    const statStyle = getStatusStyle(report.status);
                    
                    return (
                      <div 
                        key={`report-${report.id || rIdx}`}
                        style={{ 
                          marginBottom: isStacked && rIdx < reportCount - 1 ? '10px' : '0',
                          paddingBottom: isStacked && rIdx < reportCount - 1 ? '10px' : '0',
                          borderBottom: isStacked && rIdx < reportCount - 1 ? '1px solid #e5e7eb' : 'none'
                        }}
                      >
                        {rIdx === 0 && (
                          <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
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
                              {report.category || 'Others'}
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
                              {report.status || 'Pending'}
                            </span>
                          </div>
                        )}
                        
                        {rIdx > 0 && (
                          <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ 
                              fontSize: '11px', 
                              fontWeight: '600', 
                              padding: '3px 8px',
                              background: catStyle.bg,
                              color: catStyle.text,
                              borderRadius: '4px',
                              border: `1px solid ${catStyle.text}`
                            }}>
                              {report.category || 'Others'}
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
                              {report.status || 'Pending'}
                            </span>
                          </div>
                        )}
                        
                        <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '3px' }}>
                          {report.title}
                        </div>
                        <div style={{ fontSize: '10px', color: '#555', marginBottom: '6px' }}>
                          📍 {report.address_street || 'Unknown street'}
                        </div>
                        {/* View Report Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/reports?highlight=${report.id}`);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            fontSize: '10px',
                            fontWeight: '600',
                            color: '#fff',
                            background: 'linear-gradient(135deg, #2d2d73, #1e1e5a)',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseOver={(e) => e.target.style.background = 'linear-gradient(135deg, #3b3b8a, #2d2d73)'}
                          onMouseOut={(e) => e.target.style.background = 'linear-gradient(135deg, #2d2d73, #1e1e5a)'}
                        >
                          👁️ View Report
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Popup>
            </Marker>
          );
        })}
        
        {!barangay && !userLocation && (
          <Marker position={[14.8292, 120.2828]}>
            <Popup>
              📍 Olongapo City, Zambales <br /> 
              <small style={{ color: '#666' }}>Set your barangay in profile to see local reports</small>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
});

export default MapView;
