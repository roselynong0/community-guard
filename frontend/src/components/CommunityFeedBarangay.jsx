import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

// Barangay feed reads `selectedBarangay` from the Outlet context if present.
export default function CommunityFeedBarangay({ session, token }) {
  const outlet = useOutletContext?.() || {};
  const selectedBarangay = outlet.selectedBarangay || 'All';
  const [reports, setReports] = useState(null);
  const authToken = token || session?.token || localStorage.getItem('access_token') || '';

  useEffect(() => {
    let mounted = true;
    if (!authToken) return;

    const fetchReports = async () => {
      try {
        const url = selectedBarangay && selectedBarangay !== 'All'
          ? `http://localhost:5000/api/reports?barangay=${encodeURIComponent(selectedBarangay)}`
          : 'http://localhost:5000/api/reports';

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json().catch(() => ({}));
        if (!mounted) return;
        if (res.ok && data.status === 'success') setReports(data.reports || []);
        else setReports([]);
      } catch (err) {
        console.warn('CommunityFeedBarangay: failed to load reports', err);
        if (mounted) setReports([]);
      }
    };

    fetchReports();
    return () => { mounted = false; };
  }, [authToken, selectedBarangay]);

  return (
    <div>
      <h3>Community Feed — {selectedBarangay === 'All' ? 'All Barangays' : selectedBarangay}</h3>
      {!reports ? (
        <div>Loading feed…</div>
      ) : reports.length === 0 ? (
        <div>No reports for this barangay.</div>
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
