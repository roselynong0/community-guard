import React, { useEffect } from 'react';
import './CCTVViewer.css';

export default function CCTVViewer() {
  useEffect(() => {
    // Load YouTube IFrame API
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(script);
  }, []);

  return (
    <div className="cctv-viewer-main">
      <div className="cctv-header">
        <h1>Olongapo City CCTV Live Stream</h1>
        <p className="cctv-status">● Live Feed</p>
      </div>

      <div className="youtube-container">
        <iframe
          width="100%"
          height="100%"
          src="https://www.youtube.com/embed/tVjD_5R6zXg?autoplay=1"
          title="Olongapo City CCTV"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="youtube-player"
        ></iframe>
      </div>

      <div className="cctv-info">
        <p>Olongapo City Live CCTV Stream - 24/7 Monitoring</p>
      </div>
    </div>
  );
}
