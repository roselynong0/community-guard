import React, { useState, useEffect } from 'react';
import './CCTVViewer.css';

export default function CCTVViewer() {
  const [activeTab, setActiveTab] = useState(1);

  const streams = [
    {
      id: 1,
      name: 'Live 1',
      videoId: 'tVjD_5R6zXg'
    },
    {
      id: 2,
      name: 'Live 2',
      videoId: 'id4xuDEWThI'
    },
    {
      id: 3,
      name: 'Live 3',
      videoId: 'I5DaVQTNYbc'
    }
  ];

  useEffect(() => {
    // Load YouTube IFrame API
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(script);
  }, []);

  const currentStream = streams.find(s => s.id === activeTab);

  return (
    <div className="cctv-viewer-main">
      <div className="cctv-header">
        <h1>Olongapo City CCTV Live Stream</h1>
        <p className="cctv-status">● Live Feed</p>
      </div>

      {/* Tabs Navigation */}
      <div className="cctv-tabs">
        {streams.map((stream) => (
          <button
            key={stream.id}
            className={`cctv-tab ${activeTab === stream.id ? 'active' : ''}`}
            onClick={() => setActiveTab(stream.id)}
          >
            {stream.name}
          </button>
        ))}
      </div>

      <div className="youtube-container">
        <iframe
          width="100%"
          height="100%"
          src={`https://www.youtube.com/embed/${currentStream.videoId}?autoplay=1`}
          title={`Olongapo City CCTV ${currentStream.name}`}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="youtube-player"
          key={currentStream.id}
        ></iframe>
      </div>

      <div className="cctv-info">
        <p>Olongapo City Live CCTV Stream - 24/7 Monitoring - {currentStream.name}</p>
      </div>
    </div>
  );
}
