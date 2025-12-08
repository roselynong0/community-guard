import React, { useState, useEffect } from "react";
import { FaShieldAlt, FaFireExtinguisher, FaUserShield, FaFirstAid, FaPhoneAlt } from "react-icons/fa";
import "./SafetyTips.css";
import LoadingScreen from "../shared/LoadingScreen";
import EQ from "../../assets/safety/earthquake.jpg";
import FLOOD from "../../assets/safety/flood.png";
import FIRE from "../../assets/safety/fire.png";


const SafetyTips = () => {
  const [loading, setLoading] = useState(true);
  const [overlayExited, setOverlayExited] = useState(false);
  const successTitle = "Safety Tips Complete!";

  useEffect(() => {
    // Simulate loading safety tips content
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const content = (
    <div className={`safety-container ${overlayExited ? 'overlay-exited' : ''}`}>
      <h1 className="title"><FaShieldAlt /> Safety Tips</h1>
      <p className="subtitle">
        Stay informed. Protect yourself, your family, and your community with practical safety guidelines.
      </p>

      {/* Disaster Preparedness */}
    <div className="tips-section">
        <h2><FaFireExtinguisher /> Disaster Preparedness</h2>

        <div className="tips-grid">
            
            <div className="tip-card">
            <img src={EQ} alt="Earthquake Safety" className="tip-img" />
            <h3>⚡ Earthquake</h3>
            <p className="tip-caption">Drop, cover, and hold, protect head, move to safe zone.</p>
            </div>

            <div className="tip-card">
            <img src={FIRE} alt="Flood Safety" className="tip-img" />
            <h3>🔥 Fire</h3>
            <p className="tip-caption">Plan escape route, exit immediately, never re-enter.</p>   
            </div>

            <div className="tip-card">
            <img src={FLOOD} alt="Flood Safety" className="tip-img" />
            <h3>🌧️ Flood</h3>
            <p className="tip-caption">Secure valuables, move to high ground, avoid floodwater.</p>
            </div>

        </div>
    </div>

    {/* Crime Prevention */}
      <div className="tips-section">
        <h2><FaUserShield /> Crime Prevention</h2>

        <div className="tips-grid">
          <div className="tip-card">
            <h3>✅ Home Safety</h3>
            <ul>
              <li>Lock all doors and windows.</li>
              <li>Do not share travel plans on social media.</li>
              <li>Know your neighbors; build awareness.</li>
              <li>Install CCTV or smart doorbells if possible.</li>
              <li>Keep valuables out of sight from windows.</li>
              <li>Ensure gates, fences, and garages are secured.</li>
              <li>Report unfamiliar or suspicious visitors.</li>
            </ul>
          </div>

          <div className="tip-card">
            <h3>✅ Personal Safety Outside</h3>
            <ul>
              <li>Stay in well-lit areas.</li>
              <li>Avoid using phones while walking.</li>
              <li>Report suspicious behavior immediately.</li>
              <li>Walk confidently and stay aware of surroundings.</li>
              <li>Use trusted transportation services only.</li>
              <li>Carry a whistle or small alarm.</li>
              <li>Avoid traveling alone late at night.</li>
            </ul>
          </div>
        </div>
      </div>


      {/* Emergency Numbers */}
    <div className="tips-section">
        <h2><FaPhoneAlt /> Emergency Hotlines</h2>

        <div className="hotline-card">
            <h3>📍National</h3>
            <p>📞 National Emergency Hotline: <strong>911</strong></p>
            <p>👮 Police: <strong>117</strong></p>
            <p>🚑 Medical Assistance: <strong>8888</strong></p>
            <br />
            <h3>📍 Olongapo City</h3>
            <p>🏛️ City Hall / General City Offices: <strong>(047) 222-2565 / 611-4800</strong></p>
            <p>🚨 DRRMO / Olongapo Rescue: <strong>0998-593-7446</strong></p>
            <p>🚒 Fire & Rescue – Central: <strong>223-1415</strong></p>
            <p>🚒 Fire & Rescue – New Cabalan: <strong>224-5414</strong></p>
            <p>🚒 Fire & Rescue – Gordon Heights: <strong>223-5497</strong></p>
            <p>🩸 Philippine Red Cross (Olongapo): <strong>0917-889-2783 / 222-2181</strong></p>
        </div>
        </div>
    </div>
  );

  const loadingFeatures = [
    {
      title: "Disaster Preparedness",
      description: "Learn essential earthquake, fire, and flood safety protocols.",
    },
    {
      title: "Crime Prevention",
      description: "Secure your home and stay safe with proven safety measures.",
    },
    {
      title: "Emergency Hotlines",
      description: "Access national and local emergency contact numbers instantly.",
    },
    {
      title: "Home Safety",
      description: "Protect your property with security best practices.",
    },
    {
      title: "Personal Safety",
      description: "Stay aware and confident in public spaces with safety tips.",
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
      title={loading ? "Loading safety tips..." : undefined}
      subtitle={loading ? "Preparing essential safety information and guidelines" : undefined}
      stage={effectiveStage}
      onExited={handleLoadingExited}
      inlineOffset="25vh"
      successDuration={900}
      successTitle={successTitle}
    >
      {content}
    </LoadingScreen>
  );
};

export default SafetyTips;