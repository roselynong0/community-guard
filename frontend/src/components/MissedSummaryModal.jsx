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

  const hasReports = total > 0;

  // Simple pie segment generator for small counts
  const totalForPie = Math.max(1, Object.values(categories).reduce((s,v)=>s+v,0));
  let acc = 0;

  // Robust timestamp parsing to handle Postgres/Supabase formats and browser differences
  const parseTimestamp = (ts) => {
    if (!ts) return null;
    if (ts instanceof Date) return ts;
    try {
      let s = String(ts).trim();
      // common Postgres format: '2025-11-20 23:21:12.72662+00'
      if (s.indexOf('T') === -1 && s.indexOf(' ') !== -1) {
        s = s.replace(' ', 'T');
      }
      // ensure timezone offset like +00 becomes +00:00
      const tzMatch = s.match(/([+-]\d{2})(:?\d{2})?$/);
      if (tzMatch) {
        const part = tzMatch[0];
        if (/^[+-]\d{2}$/.test(part)) {
          s = s.replace(/([+-]\d{2})$/, '$1:00');
        } else if (/^[+-]\d{4}$/.test(part)) {
          // +hhmm -> +hh:mm
          s = s.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
        }
      }
      let d = new Date(s);
      if (isNaN(d)) {
        // fallback: try appending Z
        d = new Date(s + 'Z');
      }
      return isNaN(d) ? null : d;
    } catch {
      return null;
    }
  };

  const offlineStart = parseTimestamp(summary.offline_start);
  const offlineEnd = parseTimestamp(summary.offline_end);
  const offlineDuration = (() => {
    try {
      if (!offlineStart || !offlineEnd) return null;
      const diff = Math.max(0, offlineEnd.getTime() - offlineStart.getTime());
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}h ${remMins}m`;
    } catch { return null; }
  })();

  return (
    <div className="missed-overlay" role="dialog" aria-modal="true" aria-labelledby="missed-summary-title">
      <div className="missed-modal">
        <header className="missed-header">
          <div className="missed-header-left">
            <h2 id="missed-summary-title">Summary of Reports</h2>
            {offlineDuration ? (
              <p className="muted subtitle">Offline duration: {offlineDuration}</p>
            ) : null}
            <div className="online-row">
              <span className="online-dot" aria-hidden></span>
              <span className="online-text">You are online</span>
            </div>
          </div>
          <div className="missed-header-right">
            <span className="ch-badge">💡 {summary.ai_name || 'Community Helper'}</span>
          </div>
        </header>

        <div className="missed-body">
          {!hasReports ? (
            <div className="no-reports-center">
              <div className="no-reports-icon">✅</div>
              <h3>No reports missed</h3>
              <p className="muted">You're all up to date!</p>
            </div>
          ) : (
            <>
              <section className="missed-stats">
                <div className="stat-card">
                  <h3>Total missed</h3>
                  <p className="big">{total}</p>
                  <p className="muted">From {summary.offline_start ? new Date(summary.offline_start).toLocaleString() : 'N/A'} to {summary.offline_end ? new Date(summary.offline_end).toLocaleString() : 'N/A'}</p>
                </div>

                {severity && severity.count ? (
                  <div className="stat-card">
                    <h3>Severity</h3>
                    <p className="big">{severity.mean.toFixed(2)}</p>
                    <p className="muted">median: {severity.median ? severity.median.toFixed(2) : '—'} • p90: {severity.p90 ? severity.p90.toFixed(2) : '—'}</p>
                  </div>
                ) : null}

                <div className="stat-card">
                  <h3>Top barangay</h3>
                  <p className="big">{barangayEntries[0] ? barangayEntries[0][0] : '—'}</p>
                  <p className="muted">{barangayEntries[0] ? `${barangayEntries[0][1]} reports` : '—'}</p>
                </div>
              </section>

              <section className="missed-charts">
                {categoryEntries.length > 0 ? (
                  <div className="chart-card">
                    <h4>By Category</h4>
                    <svg viewBox="0 0 100 100" className="pie" aria-hidden>
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
                      {categoryEntries.map(([k,v], i)=> (
                        <li key={k} className="legend-item"><span className="swatch" style={{background: ['#e74c3c','#3498db','#f39c12','#2ecc71','#9b59b6','#95a5a6','#e67e22'][i%7]}}></span>{k} <strong>{v}</strong></li>
                      ))}
                    </ul>
                  </div>
                ) : null}

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
            </>
          )}
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
