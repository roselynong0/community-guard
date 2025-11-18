import React, { useState, useEffect, useRef } from 'react';
import {
  FaHome,
  FaExclamationTriangle,
  FaMap,
  FaBell,
  FaUser,
  FaSignOutAlt,
  FaBars,
  FaCalendarAlt,
} from 'react-icons/fa';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { API_CONFIG } from '../utils/apiConfig';
import Toast from './Toast';
import { registerToastCallback, registerNotificationCountCallback, startNotificationSSE, stopNotificationSSE, startNotificationPolling, stopNotificationPolling } from '../utils/notificationService';
import './Layout.css';
import logo from '../assets/logo.png';
import { logout } from '../utils/session';
import LoadingScreen from './LoadingScreen';

// Enhanced responder layout with improved design matching admin/barangay styles
export default function ResponderLayout({ session, setSession, setNotification }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [dateTime, setDateTime] = useState(new Date());
  const [notificationCount, setNotificationCount] = useState(0);
  const toastRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  const navigate = useNavigate();

  const token = session?.token || '';

  // Fetch user profile
  useEffect(() => {
    const loadProfile = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_CONFIG.BASE_URL}/api/profile`, {
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

  // 🔹 Setup real-time notifications via SSE for responder
  useEffect(() => {
    if (!token) return;

    // Register toast callback
    registerToastCallback((message, type) => {
      if (toastRef.current) {
        toastRef.current.show(message, type);
      }
    });

    // Register notification count callback
    registerNotificationCountCallback((count) => {
      setNotificationCount(count);
    });

    // Start SSE with Responder role (will fallback to polling if SSE not available)
    try {
      startNotificationSSE(token, 'Responder');
    } catch (e) {
      console.warn('SSE not available, falling back to polling:', e);
      pollingIntervalRef.current = startNotificationPolling(token, 'Responder', 10000);
    }

    return () => {
      stopNotificationSSE();
      if (pollingIntervalRef.current) {
        stopNotificationPolling(pollingIntervalRef.current);
      }
    };
  }, [token]);

  // Update date/time every second
  useEffect(() => {
    const interval = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formattedDateTime = dateTime.toLocaleString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const confirmLogout = async () => {
    await logout(setSession);
    setUser(null);
    setNotification({ message: 'Logged out successfully.', type: 'success' });
    navigate('/login');
  };

  if (loading)
    return (
      <LoadingScreen
        title="Welcome back, Responder!"
        subtitle="Hold on—building up the interface… Your readiness saves time when it matters most."
        features={[
          { title: 'Response Dashboard', description: 'See open incidents and assigned tasks.' },
          { title: 'Nearby Alerts', description: 'Get real-time updates on evolving situations.' },
          { title: 'Route Optimization', description: 'Choose safer, faster paths to the scene.' },
          { title: 'Incident Details', description: 'Review context, notes, and attachments fast.' },
        ]}
      />
    );

  return (
    <div className="home-container">
      <Toast ref={toastRef} />
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="sidebar">
          <div className="logo">
            <img src={logo} alt="Community Guard Logo" className="logo-img" />
            <h2 style={{
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              textAlign: 'center'
            }}>
              Responder Portal
            </h2>
          </div>

          {/* Responder-specific navigation */}
          <nav
            style={{
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              textAlign: 'center',
            }}
          >
            <NavLink to="/responder/home"><FaHome /> Home</NavLink>
            <NavLink to="/responder/reports"><FaExclamationTriangle /> Reports</NavLink>
            <NavLink to="/responder/maps"><FaMap /> Map</NavLink>
            <NavLink to="/responder/notifications"><FaBell /> Notifications
              {notificationCount > 0 && (
                <span className="notification-badge">{notificationCount}</span>
              )}
            </NavLink>
            <NavLink to="/responder/profile"><FaUser /> Profile</NavLink>
          </nav>

          {/* Logout Button */}
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

          {/* Right side: Responder Profile */}
          {!loading && user && (
            <div
              className="user-profile-top"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.7rem',
                cursor: 'pointer',
              }}
              onClick={() => navigate('/responder/profile')}
            >
              <img
                src={user.avatar_url || '/src/assets/profile.png'}
                alt="Responder Profile"
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
                  Responder
                </p>
              </div>
            </div>
          )}
        </div>

        <Outlet />
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="bottom-nav">
        <NavLink to="/responder/home">
          <FaHome />
        </NavLink>
        <NavLink to="/responder/maps">
          <FaMap />
        </NavLink>
        <NavLink to="/responder/reports">
          <FaExclamationTriangle />
        </NavLink>
        <NavLink to="/responder/notifications">
          <FaBell />
        </NavLink>
        <NavLink to="/responder/profile">
          <FaUser />
        </NavLink>
      </nav>

      {/* Mobile logout bubble */}
      <div
        className="mobile-logout-bubble"
        onClick={() => setShowLogoutConfirm(true)}
        title="Logout"
      >
        <FaSignOutAlt />
      </div>

      {/* Logout confirmation modal */}
      {showLogoutConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to log out?</p>
            <div className="modal-actions">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button onClick={confirmLogout} className="confirm-btn">
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
