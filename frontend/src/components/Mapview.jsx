import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function MapView() {
  return (
    <div style={{ height: "100%", width: "100%" }}>
      <MapContainer
        center={[14.8292, 120.2828]}
        zoom={13}
        style={{ height: "100%", width: "100%", borderRadius: "12px" }}
      >

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={[14.8292, 120.2828]}>
          <Popup>
            📍 Olongapo City, Zambales <br /> Philippines
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
