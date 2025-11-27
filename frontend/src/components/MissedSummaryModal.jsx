import React from 'react';
import './MissedSummaryModal.css';

// Lightweight modal with simple SVG charts (no external chart libs required)
export default function MissedSummaryModal({ open, onClose, data, onProceed, showProceedAsNext = false }) {
  if (!open || !data) return null;

  const { summary } = data;
  const total = summary.total || 0;
  const categories = summary.categories || {};
  const barangays = summary.barangays || {};
  const severity = summary.severity_stats || {};
  const top = summary.top_reports || [];

  const categoryEntries = Object.entries(categories).sort((a,b)=>b[1]-a[1]);
  const barangayEntries = Object.entries(barangays).sort((a,b)=>b[1]-a[1]);

  // Simple pie segment generator for small counts
  const totalForPie = Math.max(1, Object.values(categories).reduce((s,v)=>s+v,0));
  let acc = 0;

  return (
    <div className="missed-overlay">
      <div className="missed-modal">
        <header className="missed-header">
          <div>
            <h2>{summary.message}</h2>
            <p className="muted">Summary provided by <strong>{summary.ai_name || 'Community Helper'}</strong></p>
          </div>
          <button className="close-btn" onClick={() => {
            if (showProceedAsNext && typeof onProceed === 'function') {
              onProceed();
            } else {
              onClose();
            }
          }}>{showProceedAsNext ? 'Next →' : 'Continue'}</button>
        </header>

        <div className="missed-body">
          <section className="missed-stats">
            <div className="stat-card">
              <h3>Total missed</h3>
              <p className="big">{total}</p>
              <p className="muted">From {new Date(summary.offline_start).toLocaleString()} to {new Date(summary.offline_end).toLocaleString()}</p>
            </div>

            <div className="stat-card">
              <h3>Severity</h3>
              <p className="big">{severity.count ? severity.mean.toFixed(2) : '—'}</p>
              <p className="muted">median: {severity.median ? severity.median.toFixed(2) : '—'} • p90: {severity.p90 ? severity.p90.toFixed(2) : '—'}</p>
            </div>

            <div className="stat-card">
              <h3>Top barangay</h3>
              <p className="big">{barangayEntries[0] ? barangayEntries[0][0] : '—'}</p>
              <p className="muted">{barangayEntries[0] ? `${barangayEntries[0][1]} reports` : '—'}</p>
            </div>
          </section>

          <section className="missed-charts">
            <div className="chart-card">
              <h4>By Category</h4>
              <svg viewBox="0 0 100 100" className="pie">
                {categoryEntries.map(([k,v], idx)=>{
                  const start = (acc/totalForPie)*360;
                  acc += v;
                  const end = (acc/totalForPie)*360;
                  const large = end-start > 180 ? 1 : 0;
                  const r = 30;
                  const cx = 50, cy = 50;
                  const rad = (deg)=> (Math.PI*deg)/180;
                  const x1 = cx + r*Math.cos(rad(start-90));
                  const y1 = cy + r*Math.sin(rad(start-90));
                  const x2 = cx + r*Math.cos(rad(end-90));
                  const y2 = cy + r*Math.sin(rad(end-90));
                  const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
                  const colors = ['#e74c3c','#3498db','#f39c12','#2ecc71','#9b59b6','#95a5a6','#e67e22'];
                  return <path key={k+idx} d={d} fill={colors[idx % colors.length]} stroke="#fff" strokeWidth="0.2" />
                })}
              </svg>
              <ul className="legend">
                {categoryEntries.length === 0 && <li className="muted">No reports by category</li>}
                {categoryEntries.map(([k,v], i)=> (
                  <li key={k} className="legend-item"><span className="swatch" style={{background: ['#e74c3c','#3498db','#f39c12','#2ecc71','#9b59b6','#95a5a6','#e67e22'][i%7]}}></span>{k} <strong>{v}</strong></li>
                ))}
              </ul>
            </div>

            <div className="chart-card">
              <h4>Top Reports</h4>
              {top.length === 0 ? (
                <div className="muted">No recent missed reports to show.</div>
              ) : (
                <ol className="top-list">
                  {top.map(r => (
                    <li key={r.id}>
                      <div className="top-title">{r.title}</div>
                      <div className="top-meta">{r.address_barangay || 'Unknown'} • {new Date(r.created_at).toLocaleString()}</div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

        </div>

        <footer className="missed-footer">
          <button className="primary" onClick={() => {
            if (showProceedAsNext && typeof onProceed === 'function') {
              onProceed();
            } else {
              onClose();
            }
          }}>{showProceedAsNext ? 'Next →' : 'Continue to dashboard'}</button>
        </footer>
      </div>
    </div>
  );
}
