import React, { useEffect, useState } from 'react';

// Lightweight responder community feed. If a backend endpoint exists at
// /api/reports this will try to fetch reports (assignable to responders).
// This is intentionally small and resilient to missing endpoints.
export default function CommunityFeedResponder({ session, token }) {
  const [reports, setReports] = useState(null);
  const authToken = token || session?.token || localStorage.getItem('access_token') || '';

  useEffect(() => {
    let mounted = true;
    if (!authToken) return;

    const fetchReports = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/reports', {
          headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json().catch(() => ({}));
        if (!mounted) return;
        if (res.ok && data.status === 'success') setReports(data.reports || []);
        else setReports([]);
      } catch (err) {
        console.warn('CommunityFeedResponder: failed to load reports', err);
        if (mounted) setReports([]);
      }
    };

    fetchReports();
    return () => { mounted = false; };
  }, [authToken]);

  return (
    <div>
      <h3>Community Feed — Responder</h3>
      {!reports ? (
        <div>Loading feed…</div>
      ) : reports.length === 0 ? (
        <div>No reports available.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {reports.map((r) => (
            <li key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
              <div style={{ fontWeight: 600 }}>{r.title || r.subject || 'Untitled'}</div>
              <div style={{ fontSize: 13, color: '#555' }}>{r.address_street || r.address_barangay || ''}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
