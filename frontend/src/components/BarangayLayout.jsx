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

export default function BarangayLayout({ session, setSession, setNotification }) {
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
    await logout(setSession);
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
            <NavLink to="/barangay/profile"><FaUser /> Profile</NavLink>
          </nav>

          <button
            className="logout-btn"
            onClick={() => setShowLogoutConfirm(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.8rem',
              color: '#c7c7c7',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              borderRadius: '8px',
              transition: 'all 0.3s ease',
              width: '100%',
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'linear-gradient(135deg, #d9534f, #c9302c)';
              e.target.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'none';
              e.target.style.color = '#c7c7c7';
            }}
          >
            <FaSignOutAlt /> Logout
          </button>
        </aside>
      )}

      {/* Main content */}
      <main className="main-area">
        <div
          className="top-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.8rem 1.2rem',
          }}
        >
          {/* Left side: Menu + DateTime */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              color: '#11163e',
            }}
          >
            <button
              className="menu-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#11163e',
              }}
            >
              <FaBars />
            </button>
            <div className="date-time" style={{ fontWeight: 500 }}>
              <FaCalendarAlt style={{ marginRight: '0.4rem' }} />
              {formattedDateTime}
            </div>
          </div>

          {/* Right side: Barangay Official Profile */}
          {!loading && user && (
            <div
              className="user-profile-top"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.7rem',
                cursor: 'pointer',
              }}
              onClick={() => navigate('/barangay/profile')}
            >
              <img
                src={user.avatar_url || '/src/assets/profile.png'}
                alt="Barangay Official Profile"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid #11163e',
                }}
              />
              <div style={{ textAlign: 'right' }}>
                <h4
                  style={{
                    margin: 0,
                    fontSize: '0.9rem',
                    color: '#11163e',
                    fontWeight: '600',
                  }}
                >
                  {user.firstname} {user.lastname}
                </h4>
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.75rem',
                    color: '#666',
                    fontStyle: 'italic',
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
        <NavLink to="/barangay/profile">
          <FaUser />
        </NavLink>
      </nav>

      {/* Mobile logout */}
      <div
        className="mobile-logout-bubble"
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
