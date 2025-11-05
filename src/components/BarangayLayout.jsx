import React, { useState, useEffect } from 'react';
import {
  FaHome,
  FaChartBar,
  FaMap,
  FaBell,
  FaUser,
  FaSignOutAlt,
  FaBars,
  FaCalendarAlt,
} from 'react-icons/fa';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import './Layout.css';
import logo from '../assets/logo.png';
import { logout } from '../utils/session';

export default function BarangayLayout({ session, setNotification }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [dateTime, setDateTime] = useState(new Date());
  const navigate = useNavigate();

  const token = session?.token || '';

  useEffect(() => {
    const loadProfile = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('http://localhost:5000/api/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok || data.status !== 'success') {
          setUser(null);
        } else {
          setUser({
            ...data.profile,
            avatar_url: data.profile?.avatar_url || '/default-avatar.png',
          });
        }
      } catch (err) {
        console.error('Profile fetch error:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [token]);

  useEffect(() => {
    const interval = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formattedDateTime = dateTime.toLocaleString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  });

  const confirmLogout = async () => {
    await logout(() => {});
    setUser(null);
    setNotification({ message: 'Logged out successfully.', type: 'success' });
    navigate('/login');
  };

  if (loading)
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Loading user...
      </div>
    );

  return (
    <div className="home-container">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="sidebar">
          <div className="logo">
            <img src={logo} alt="Logo" className="logo-img" />
            <h2>Barangay Officials</h2>

            {/* User Profile Section */}
            {!loading && user && (
              <div
                className="user-profile"
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  marginBottom: '1rem',
                  textAlign: 'center',
                }}
              > 
              </div>
            )}
          </div>

          {/* Nav links - keep only barangay-specific tabs + profile */}
          <nav style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
            <NavLink to="/barangay/home"><FaHome /> Home</NavLink>
            <NavLink to="/barangay/stats"><FaChartBar /> Reports</NavLink>
            <NavLink to="/barangay/maps"><FaMap /> Map</NavLink>
            <NavLink to="/barangay/notifications"><FaBell /> Notifications</NavLink>
            <NavLink to="/profile"><FaUser /> Profile</NavLink>
          </nav>

          <button className="logout-btn" onClick={() => setShowLogoutConfirm(true)}>
            <FaSignOutAlt /> Logout
          </button>
        </aside>
      )}

      {/* Main content */}
      <main className="main-area">
        <div className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <FaBars />
            </button>
            <div className="date-time" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FaCalendarAlt />
              {formattedDateTime}
            </div>
          </div>

          {/* Right: User Profile */}
          {user && (
            <div className="user"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.8rem',
                cursor: 'pointer',
              }}
              onClick={() => navigate('/profile')}
            >
              <img
                src={user.avatar_url || '/src/assets/profile.png'}
                alt="User Avatar" />
              <div>
                <span>
                  {user.firstname} {user.lastname}
                </span>
                <p
                  style={{
                    fontStyle: 'Italic',
                    margin: 0,
                    fontSize: '0.7rem',
                    color: 'rgba(0,0,0,0.5)',
                  }}
                >
                  {user.role || 'Barangay Official'}
                </p>
              </div>
            </div>
          )}
        </div>

        <Outlet />
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="bottom-nav">
        <NavLink to="/barangay/home">
          <FaHome />
        </NavLink>
        <NavLink to="/barangay/maps">
          <FaMap />
        </NavLink>
        <NavLink to="/barangay/stats">
          <FaChartBar />
        </NavLink>
        <NavLink to="/barangay/notifications">
          <FaBell />
        </NavLink>
        <NavLink to="/profile">
          <FaUser />
        </NavLink>
      </nav>

      {/* Mobile logout */}
      <div
        className="mobile-logout-btn"
        onClick={() => setShowLogoutConfirm(true)}
        title="Logout"
      >
        <FaSignOutAlt />
      </div>

      {/* Logout Confirmation */}
      {showLogoutConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to log out?</p>
            <div className="modal-actions">
              <button onClick={() => setShowLogoutConfirm(false)} className="cancel-btn">Cancel</button>
              <button onClick={confirmLogout} className="confirm-btn">Logout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
