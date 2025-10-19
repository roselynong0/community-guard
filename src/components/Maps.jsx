import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
} from "react-leaflet";
import L from "leaflet";
import "./Maps.css";
import "leaflet/dist/leaflet.css";

const API_URL = "http://localhost:5000/api";
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

function Maps() {
  const [reports, setReports] = useState([]);

  useEffect(() => {
    const fetchMapReports = async () => {
      try {
        const token = localStorage.getItem("access_token");
        const response = await fetch(`${API_URL}/map_reports`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();

        if (data.status === "success") {
          const formatted = (data.reports || []).map((r) => ({
            ...r,
            latitude: parseFloat(r.latitude),
            longitude: parseFloat(r.longitude),
          }));
          setReports(formatted);
        } else {
          console.error("Map reports error:", data.message);
        }
      } catch (err) {
        console.error("Failed to load map reports:", err);
      }
    };

    fetchMapReports();
  }, []);

  // Group reports by barangay
  const reportsByBarangay = reports.reduce((acc, r) => {
    if (!acc[r.address_barangay]) acc[r.address_barangay] = [];
    acc[r.address_barangay].push(r);
    return acc;
  }, {});

  return (
    <div className="maps-page">
      <h2>Olongapo City Barangay Map</h2>
      <p>Click on a colored marker to view report details.</p>

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

        {/* Barangay markers - one per barangay with reports */}
        {Object.entries(reportsByBarangay).map(([barangay, reportsArray], i) => {
          // Use the first report for marker position
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
    </div>
  );
}

export default Maps;