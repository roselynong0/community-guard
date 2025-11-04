import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { FaHome, FaMap, FaBell, FaUser, FaPlusCircle } from 'react-icons/fa';
import './Layout.css';

// Lightweight responder layout that reuses the main Layout styling but exposes
// a simplified sidebar tailored for responders. It renders an <Outlet /> so
// you can mount role-specific pages (ResponderHome, ResponderReports, etc.).
export default function ResponderLayout({ session }) {
  return (
    <div className="home-container">
      <aside className="sidebar">
        <div className="logo">
          <h2>Responder Portal</h2>
        </div>

        <nav>
          <NavLink to="/responder/home"><FaHome /> Home</NavLink>
          <NavLink to="/responder/maps"><FaMap /> Map</NavLink>
          <NavLink to="/responder/reports"><FaPlusCircle /> Reports</NavLink>
          <NavLink to="/responder/notifications"><FaBell /> Notifications</NavLink>
          <NavLink to="/profile"><FaUser /> Profile</NavLink>
        </nav>
      </aside>

      <main className="main-area">
        <div className="top-bar" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 1rem' }}>
          <div>Responder</div>
          <div>{session?.user?.firstname || ''} {session?.user?.lastname || ''}</div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}
