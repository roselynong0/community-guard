import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { API_CONFIG, getApiUrl } from "../../utils/apiConfig";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Red marker icon for hotspots
const redMarkerIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const MapView = forwardRef(function MapView(props, ref) {
  const { reports, barangay } = props || {};
  const [hotspots, setHotspots] = useState((reports && reports.length) ? reports : []);
  const mapRef = useRef(null);

  useEffect(() => {
    // If parent provided `reports`, prefer those and skip fetching.
    if (reports && reports.length) return;

    const fetchHotspots = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        // If a barangay is provided, request barangay-scoped hotspots
        const base = getApiUrl(API_CONFIG.endpoints.hotspots);
        const url = barangay ? `${base}?barangay=${encodeURIComponent(barangay)}` : base;

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error("Failed to fetch hotspots");

        const data = await response.json();
        setHotspots(data.hotspots || []);
      } catch (error) {
        console.error("Error fetching hotspots:", error);
        setHotspots([]);
      }
    };

    fetchHotspots();
  }, [reports, barangay]);

  // Expose an invalidate API so parent can force a redraw
  useImperativeHandle(ref, () => ({
    invalidate: () => {
      try {
        if (mapRef.current) mapRef.current.invalidateSize();
      } catch (e) {
        // swallow errors
        console.debug('Map invalidate failed', e);
      }
    }
  }));

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <MapContainer
        whenCreated={(mapInstance) => { mapRef.current = mapInstance; }}
        center={[14.8292, 120.2828]}
        zoom={13}
        style={{ height: "100%", width: "100%", borderRadius: "12px" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Show markers for hotspots */}
        {hotspots.map((hotspot) => {
          const coords = [hotspot.centroid.latitude, hotspot.centroid.longitude];
          
          return (
            <Marker key={hotspot.id} position={coords} icon={redMarkerIcon}>
              <Popup>
                <div style={{ textAlign: "center", minWidth: "150px" }}>
                  <strong>Hotspot</strong>
                  <br />
                  Reports: {hotspot.report_count}
                  {hotspot.category_counts && (
                    <>
                      <br />
                      <small>{JSON.stringify(hotspot.category_counts).slice(0, 50)}...</small>
                    </>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Default center marker if no hotspots */}
        {hotspots.length === 0 && (
          <Marker position={[14.8292, 120.2828]}>
            <Popup>
              📍 Olongapo City, Zambales <br /> Philippines
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
    });

    export default MapView;
