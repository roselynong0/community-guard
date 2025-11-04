import React, { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { FaHome, FaChartBar, FaMap, FaBell, FaUser } from 'react-icons/fa';
import './Layout.css';

export default function BarangayLayout({ session }) {
  const [selectedBarangay, setSelectedBarangay] = useState('All');
  const [barangayOptions, setBarangayOptions] = useState([]);
  const token = session?.token || '';

  // Fetch barangays from backend to populate select options
  useEffect(() => {
    let mounted = true;
    if (!token) return;
    const fetchBarangays = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/barangays', { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.status === 'success' && Array.isArray(data.barangays)) {
          if (mounted) setBarangayOptions(data.barangays);
        } else {
          // fallback: keep empty
          if (mounted) setBarangayOptions([]);
        }
      } catch (e) {
        console.error('Failed to load barangays', e);
      }
    };
    fetchBarangays();
    return () => { mounted = false; };
  }, [token]);

  return (
    <div className="home-container">
      <aside className="sidebar">
        <div className="logo">
          <h2>Barangay Officials</h2>
        </div>

        <nav>
          <NavLink to="/barangay/home"><FaHome /> Home</NavLink>
          <NavLink to="/barangay/stats"><FaChartBar /> Statistics</NavLink>
          <NavLink to="/barangay/maps"><FaMap /> Map</NavLink>
          <NavLink to="/barangay/notifications"><FaBell /> Notifications</NavLink>
          <NavLink to="/profile"><FaUser /> Profile</NavLink>
        </nav>
      </aside>

      <main className="main-area">
        <div className="top-bar" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 1rem' }}>
          <div>
            Barangay Dashboard
          </div>
          <div>
            <label style={{ marginRight: 8, fontSize: 13 }}>Barangay</label>
            <select value={selectedBarangay} onChange={(e) => setSelectedBarangay(e.target.value)}>
              <option value="All">All Barangays</option>
              {barangayOptions && barangayOptions.length ? (
                barangayOptions.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))
              ) : (
                <option value="All">All Barangays</option>
              )}
            </select>
          </div>
        </div>

        {/* Provide selected barangay via context/prop if routes/components read it from location.state.
            For now the children can read the select via DOM or prop drilling if needed. */}
        <Outlet context={{ selectedBarangay, setSelectedBarangay, barangayOptions }} />
      </main>
    </div>
  );
}
