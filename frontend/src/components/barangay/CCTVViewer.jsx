import React, { useState, useEffect } from 'react';
import { FaVideo, FaChartLine } from 'react-icons/fa';
import './CCTVViewer.css';

const CCTV_FEEDS = [
  {
    id: 1,
    name: 'Live Feed 1',
    url: 'https://www.youtube.com/embed/tVjD_5R6zXg?autoplay=1',
    location: 'Olongapo City Main'
  },
  {
    id: 2,
    name: 'Live Feed 2',
    url: 'https://www.youtube.com/embed/Hy89A7uRqzM?autoplay=1',
    location: 'Olongapo City Area 2'
  },
  {
    id: 3,
    name: 'Live Feed 3',
    url: 'https://www.youtube.com/embed/UU1z-2EHDz4?autoplay=1',
    location: 'Olongapo City Area 3'
  }
];

export default function CCTVViewer() {
  const [activeTab, setActiveTab] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load YouTube IFrame API
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    // Show loading when switching tabs
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, [activeTab]);

  const activeFeed = CCTV_FEEDS.find(feed => feed.id === activeTab);

  return (
    <div className="cctv-viewer-main">
      <div className="cctv-header">
        <div className="cctv-header-left">
          <FaVideo className="cctv-icon" />
          <h1>Olongapo City CCTV Live Stream</h1>
        </div>
        <p className="cctv-status">● Live Feed</p>
      </div>

      {/* Tab Navigation */}
      <div className="cctv-tabs">
        {CCTV_FEEDS.map(feed => (
          <button
            key={feed.id}
            className={`cctv-tab ${activeTab === feed.id ? 'active' : ''}`}
            onClick={() => setActiveTab(feed.id)}
          >
            <FaVideo className="tab-icon" />
            <span className="tab-name">{feed.name}</span>
          </button>
        ))}
      </div>

      <div className="youtube-container">
        {isLoading && (
          <div className="cctv-loading">
            <div className="cctv-spinner"></div>
            <p>Loading live feed...</p>
          </div>
        )}
        <iframe
          width="100%"
          height="100%"
          src={activeFeed?.url}
          title={activeFeed?.name}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="youtube-player"
          style={{ opacity: isLoading ? 0 : 1 }}
        ></iframe>
      </div>

      <div className="cctv-info">
        <p><strong>{activeFeed?.name}</strong> - {activeFeed?.location} - 24/7 Monitoring</p>
      </div>
    </div>
  );
}
