import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
} from "react-leaflet";
import { API_CONFIG } from "../utils/apiConfig";
import L from "leaflet";
import "./Maps.css";
import "leaflet/dist/leaflet.css";

import { getApiUrl } from "../utils/apiConfig";

// Build endpoints with getApiUrl so VITE_API_URL is used in prod and localhost in dev
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

function Maps({ session, userRole }) {
  const [reports, setReports] = useState([]);
  const [userBarangay, setUserBarangay] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMapReports = async () => {
      try {
        setLoading(true);
        const token = session?.token || localStorage.getItem("access_token");
        
        // Check if user is a barangay official
        const isBarangayOfficial = userRole === "Barangay Official";
        
  let endpoint = getApiUrl('/api/map_reports');
        let headers = { Authorization: `Bearer ${token}` };
        
        // If barangay official, use the filtered endpoint
          if (isBarangayOfficial && token) {
          endpoint = getApiUrl('/api/map_reports/barangay');
        }

        const response = await fetch(endpoint, { headers });
        const data = await response.json();

        if (data.status === "success") {
          const formatted = (data.reports || []).map((r) => ({
            ...r,
            latitude: parseFloat(r.latitude),
            longitude: parseFloat(r.longitude),
          }));
          setReports(formatted);
          
          // Set user's barangay if they're a barangay official
          if (isBarangayOfficial && data.barangay) {
            setUserBarangay(data.barangay);
          }
          
          console.log(`✅ Loaded ${formatted.length} map reports${isBarangayOfficial ? ` for barangay: ${data.barangay}` : ''}`);
        } else {
          console.error("Map reports error:", data.message);
        }
      } catch (err) {
        console.error("Failed to load map reports:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMapReports();
  }, [session, userRole]);

  // Group reports by barangay
  const reportsByBarangay = reports.reduce((acc, r) => {
    if (!acc[r.address_barangay]) acc[r.address_barangay] = [];
    acc[r.address_barangay].push(r);
    return acc;
  }, {});

  const mapTitle = userBarangay 
    ? `${userBarangay} Reports Map`
    : "Olongapo City Reports Map";

  const mapSubtitle = userBarangay
    ? `Viewing reports in ${userBarangay} barangay`
    : "Click on a colored marker to view report details.";

  return (
    <div className="maps-page">
      <h2>{mapTitle}</h2>
      {loading ? (
        <p>Loading map reports...</p>
      ) : (
        <p>{mapSubtitle}</p>
      )}

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

        {/* Individual report markers with colored icons - each at its own location */}
        {reports.map((r, idx) =>
          r.latitude && r.longitude ? (
            <React.Fragment key={`report-${idx}`}>
              {/* Colored marker icon with popup */}
              <Marker
                position={[r.latitude, r.longitude]}
                icon={createColoredIcon(getColor(r.address_barangay))}
              >
                <Popup>
                  <div style={{ fontWeight: "bold", fontSize: "14px", marginBottom: "4px" }}>
                    {r.address_barangay}
                  </div>
                  <div style={{ fontSize: "13px", marginBottom: "4px" }}>
                    📊 Total Reports: {reportsByBarangay[r.address_barangay]?.length || 1}
                  </div>

                  <div style={{ fontSize: "13px", marginBottom: "6px" }}>
                    <strong>{r.title}</strong>
                    <br />
                    📍 {r.address_street}
                    <br />
                    👤 {r.reporter?.first_name || "Unknown"} {r.reporter?.last_name || ""}
                    <br />
                    🌍 {r.latitude.toFixed(6)}, {r.longitude.toFixed(6)}
                  </div>
                </Popup>
              </Marker>
              
              {/* Colored circle dot at the same location */}
              <CircleMarker
                center={[r.latitude, r.longitude]}
                radius={6}
                color={getColor(r.address_barangay)}
                fillColor={getColor(r.address_barangay)}
                fillOpacity={0.8}
              />
            </React.Fragment>
          ) : null
        )}
      </MapContainer>
    </div>
  );
}

export default Maps;