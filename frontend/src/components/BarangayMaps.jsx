import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
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

function BarangayMaps({ session, userBarangay }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBarangayReports = async () => {
      try {
        setLoading(true);
        const token = session?.token || localStorage.getItem("access_token");

        if (!token || !userBarangay) {
          console.warn("Missing token or barangay for barangay maps");
          setLoading(false);
          return;
        }

        // Always fetch all reports, filter by user's barangay only
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
          // Filter to only show reports from the user's barangay
          const filteredReports = allReports.filter(r => r.address_barangay === userBarangay);
          setReports(filteredReports);
          console.log(`✅ Loaded ${filteredReports.length} reports for barangay: ${userBarangay}`);
        } else {
          console.error("Barangay map reports error:", data.message);
        }
      } catch (err) {
        console.error("Failed to load barangay map reports:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBarangayReports();
  }, [session, userBarangay]);

  // Group reports by barangay (should only be one in this case)
  const reportsByBarangay = reports.reduce((acc, r) => {
    if (!acc[r.address_barangay]) acc[r.address_barangay] = [];
    acc[r.address_barangay].push(r);
    return acc;
  }, {});

  return (
    <div className="maps-page">
      <h2>{userBarangay} Reports Map</h2>
      <p>Viewing reports in {userBarangay} barangay. Click on colored markers to view report details.</p>

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
            <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>Loading barangay reports...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default BarangayMaps;
