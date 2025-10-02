import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import './Maps.css';
import 'leaflet/dist/leaflet.css'; 

const OLONGAPO_CENTER = [14.8291, 120.2829]; 
const INITIAL_ZOOM = 13;

import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

function Maps() {
  return (
    <div className="maps-page">
      <h2>Olongapo City Map</h2>
      <p>View reported incidents and community points of interest on the map.</p>
      
      
      <MapContainer 
        center={OLONGAPO_CENTER} 
        zoom={INITIAL_ZOOM} 
        scrollWheelZoom={true}
        className="map-container" 
      >

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={OLONGAPO_CENTER}>
          <Popup>
            Olongapo City Center
            <br />
            This is the heart of your community.
          </Popup>
        </Marker>

      </MapContainer>
    </div>
  );
}

export default Maps;