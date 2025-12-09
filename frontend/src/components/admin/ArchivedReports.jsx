import React, { useState, useEffect } from 'react';
import '../admin/ArchivedReports.css';

export default function ArchivedReports({ session }) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState('list');

  // Placeholder data - this component is intentionally lightweight so the
  // app can build. Real data fetching can be added later.
  const [items, setItems] = useState([]);

  useEffect(() => {
    // If a real endpoint is available later, replace this with a fetch.
    setItems([]);
  }, []);

  return (
    <div className="archived-reports-page">
      <div className="reports-header archived-header">
        <div>
          <h2>Archived Reports</h2>
          <div className="muted">Review older or exported reports</div>
        </div>

        <div className="header-right">
          <div className="view-toggle" role="tablist" aria-label="View toggle">
            <button
              className={`view-toggle-btn ${view === 'list' ? 'active' : ''}`}
              onClick={() => setView('list')}
            >
              List
            </button>
            <button
              className={`view-toggle-btn ${view === 'grid' ? 'active' : ''}`}
              onClick={() => setView('grid')}
            >
              Grid
            </button>
          </div>

          <div className="export-buttons">
            <button className="export-btn csv">Export CSV</button>
            <button className="export-btn pdf">Export PDF</button>
          </div>
        </div>
      </div>

      <div className="archived-top-controls">
        <div className="archived-search-container">
          <input
            className="archived-search-input"
            placeholder="Search archived reports..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="archived-search-icon">🔍</div>
        </div>

        <select className="archived-filter-select" defaultValue="all">
          <option value="all">All types</option>
          <option value="incidents">Incidents</option>
          <option value="alerts">Alerts</option>
        </select>

        <button
          className="archived-toggle-my-reports"
          aria-pressed={false}
        >
          My reports
        </button>
      </div>

      <div className="archived-list-table" role="table" aria-label="Archived reports list">
        <div className="list-header">
          <div />
          <div>Title / Description</div>
          <div>Type</div>
          <div>Date</div>
          <div>Barangay</div>
          <div>Reporter</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {items.length === 0 ? (
          <div className="list-row" style={{ padding: 24 }}>
            <div style={{ gridColumn: '1/-1', color: '#64748b' }}>
              No archived reports available.
            </div>
          </div>
        ) : (
          items.map((it, idx) => (
            <div className="list-row" key={idx}>
              <div className="list-col">
                {it.thumbnail ? <img src={it.thumbnail} className="list-thumbnail" alt="thumb" /> : <div className="no-thumbnail">📷</div>}
              </div>
              <div className="list-col col-title">
                <div className="list-title">{it.title}</div>
                <div className="list-description">{it.description}</div>
              </div>
              <div className="list-col">{it.type}</div>
              <div className="list-col">{it.date}</div>
              <div className="list-col">{it.barangay}</div>
              <div className="list-col">{it.reporter}</div>
              <div className="list-col">{it.status}</div>
              <div className="list-col">-</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
