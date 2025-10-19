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

const barangayLocations = [
  { name: "Barretto", lat: 14.8641, lng: 120.2493 },
  { name: "East Bajac-Bajac", lat: 14.8289, lng: 120.2836 },
  { name: "East Tapinac", lat: 14.8338, lng: 120.2838 },
  { name: "Gordon Heights", lat: 14.865, lng: 120.2904 },
  { name: "Kalaklan", lat: 14.8319, lng: 120.2728 },
  { name: "Mabayuan", lat: 14.8428, lng: 120.2799 },
  { name: "New Asinan", lat: 14.8269, lng: 120.2834 },
  { name: "New Banicain", lat: 14.8261, lng: 120.2895 },
  { name: "New Cabalan", lat: 14.8399, lng: 120.2979 },
  { name: "New Ilalim", lat: 14.8268, lng: 120.2823 },
  { name: "New Kababae", lat: 14.8279, lng: 120.2831 },
  { name: "New Kalalake", lat: 14.827, lng: 120.2838 },
  { name: "Old Cabalan", lat: 14.8414, lng: 120.3038 },
  { name: "Pag-Asa", lat: 14.8281, lng: 120.289 },
  { name: "Santa Rita", lat: 14.8462, lng: 120.2904 },
  { name: "West Bajac-Bajac", lat: 14.8262, lng: 120.2801 },
  { name: "West Tapinac", lat: 14.8328, lng: 120.2771 },
];

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

        {/* Small colored circles under each barangay */}
        {barangayLocations.map((b, i) => (
          <CircleMarker
            key={`circle-${i}`}
            center={[b.lat, b.lng]}
            radius={10} // small radius
            color={getColor(b.name)}
            fillColor={getColor(b.name)}
            fillOpacity={0.2}
            weight={1}
          />
        ))}

        {/* Barangay markers */}
        {barangayLocations.map((b, i) => (
          <Marker
            key={`marker-${i}`}
            position={[b.lat, b.lng]}
            icon={createColoredIcon(getColor(b.name))}
          >
            <Popup>
              <strong>{b.name}</strong>
              <br />
              Click a report to view details
            </Popup>
          </Marker>
        ))}

        {/* Report markers */}
        {reports.map((r, idx) =>
          r.latitude && r.longitude ? (
            <CircleMarker
              key={`report-${idx}`}
              center={[r.latitude, r.longitude]}
              radius={6}
              color={getColor(r.address_barangay)}
              fillColor={getColor(r.address_barangay)}
              fillOpacity={0.8}
            >
              <Popup>
                <strong>{r.title}</strong>
                <br />
                📍 {r.address_barangay}, {r.address_street}
                <br />
                👤 {r.reporter?.first_name || "Unknown"}{" "}
                {r.reporter?.last_name || ""}
                <br />
                🌍 {r.latitude.toFixed(6)}, {r.longitude.toFixed(6)}
              </Popup>
            </CircleMarker>
          ) : null
        )}
      </MapContainer>
    </div>
  );
}

export default Maps;