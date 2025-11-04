import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import Home from './Home';

// BarangayHome wraps the main Home dashboard and adds a barangay selector
// to fetch and display barangay-filtered statistics. It delegates the heavy
// lifting to Home where possible but also fetches barangay-specific stats
// to display in a small panel above the dashboard.
export default function BarangayHome({ session, token, selectedBarangay: initialSelected }) {
  // Try to read selected barangay from Outlet context (provided by BarangayLayout) or fallback to prop
  const outlet = useOutletContext?.() || {};
  const selectedFromOutlet = outlet.selectedBarangay;
  const setSelectedFromOutlet = outlet.setSelectedBarangay;
  const [selectedBarangay, setSelectedBarangay] = useState(selectedFromOutlet || initialSelected || 'All');
  const [barangayStats, setBarangayStats] = useState(null);
  const authToken = session?.token || token || '';

  // If layout provided a setter, keep local selected in sync
  useEffect(() => {
    if (selectedFromOutlet && selectedFromOutlet !== selectedBarangay) setSelectedBarangay(selectedFromOutlet);
  }, [selectedFromOutlet, selectedBarangay]);

  useEffect(() => {
    if (!authToken) return;
    const abort = { ok: false };
    const fetchStats = async () => {
      try {
        const url = `http://localhost:5000/api/stats${selectedBarangay && selectedBarangay !== 'All' ? `?barangay=${encodeURIComponent(selectedBarangay)}` : ''}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' } });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.status === 'success') setBarangayStats(data);
        else setBarangayStats(null);
      } catch (e) {
        console.error('Failed to load barangay stats', e);
        setBarangayStats(null);
      }
    };
    fetchStats();
    return () => { abort.ok = true; };
  }, [selectedBarangay, authToken]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <label style={{ fontWeight: 600 }}>Barangay</label>
        <select value={selectedBarangay} onChange={(e) => {
          const v = e.target.value;
          setSelectedBarangay(v);
          if (setSelectedFromOutlet) setSelectedFromOutlet(v);
        }}>
          <option value="All">All Barangays</option>
          {(outlet.barangayOptions || []).map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        {barangayStats ? (
          <div style={{ marginLeft: 'auto', padding: '0.4rem 0.6rem', background: '#f3f4f6', borderRadius: 6 }}>
            <strong>Reports:</strong> {barangayStats.totalReports ?? '—'} • <strong>Ongoing:</strong> {barangayStats.ongoing ?? '—'}
          </div>
        ) : null}
      </div>

      <Home session={session} token={token} />
    </div>
  );
}
