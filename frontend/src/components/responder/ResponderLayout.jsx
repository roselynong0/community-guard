import React, { useState, useEffect, useRef } from 'react';
import {
  FaHome,
  FaChartLine,
  FaMap,
  FaBell,
  FaUser,
  FaSignOutAlt,
  FaBars,
  FaCalendarAlt,
  FaArchive,
  FaComments,
  FaEllipsisV,
  FaVideo,
} from 'react-icons/fa';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { API_CONFIG, getApiUrl } from '../../utils/apiConfig';
import Toast from '../shared/Toast';
import ChatBot from '../shared/ChatBot';
import ModalPortal from '../shared/ModalPortal';
import { registerToastCallback, registerNotificationCountCallback, startNotificationSSE, stopNotificationSSE, startNotificationPolling, stopNotificationPolling } from '../../utils/notificationService';
import '../shared/Layout.css';
import logo from '../../assets/logo.png';
import { logout, handleSessionExpired, isSessionExpired } from '../../utils/session';
import LoadingScreen from '../shared/LoadingScreen';

// Enhanced responder layout with improved design matching admin/barangay styles
export default function ResponderLayout({ session, setSession, setNotification }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [dateTime, setDateTime] = useState(new Date());
  const [notificationCount, setNotificationCount] = useState(0);
  const [showChatBot, setShowChatBot] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
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
        const res = await fetch(getApiUrl(API_CONFIG.endpoints.profile), {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        // Check for session expiration (401/403)
        if (isSessionExpired(res)) {
          handleSessionExpired(setSession, setNotification, navigate, 'responder');
          setUser(null);
          return;
        }
        
        const data = await res.json();
        if (!res.ok || data.status !== 'success') {
          handleSessionExpired(setSession, setNotification, navigate, 'responder', 'Your session is no longer valid. Please log in again to continue.');
          setUser(null);
          return;
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
  }, [token, setSession, setNotification, navigate]);

  // 🔹 Fetch missed reports summary for responder (toast only)
  useEffect(() => {
    const fetchMissedReports = async () => {
      if (!token || !user) return;

      // Only show toast once per session
      const toastKey = `missed_toast_shown_responder_${user.id || 'anon'}`;
      if (sessionStorage.getItem(toastKey)) return;

      try {
        const res = await fetch(getApiUrl('/api/reports/missed_summary'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!res.ok) return;
        
        const data = await res.json();
        if (data?.status === 'success' && data?.summary?.total > 0) {
          const totalMissed = data.summary.total;
          const userBarangay = user.address_barangay || '';
          const barangayCounts = data.summary.barangays || {};
          const missedInBarangay = userBarangay ? (barangayCounts[userBarangay] || 0) : totalMissed;
          
          if (missedInBarangay > 0) {
            // Show toast after 2.5 seconds delay
            setTimeout(() => {
              if (toastRef.current) {
                toastRef.current.show(
                  `📢 ${missedInBarangay} new report${missedInBarangay > 1 ? 's' : ''} in ${userBarangay || 'your area'} while you were away.`,
                  'info'
                );
              }
            }, 2500);
            
            sessionStorage.setItem(toastKey, '1');
          }
        }
      } catch (e) {
        console.warn('Failed to fetch missed reports for responder:', e);
      }
    };

    fetchMissedReports();
  }, [token, user]);

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
    navigate('/login?role=responder');
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
            <img src={logo} alt="Community Guard Logo" className="logo-img" width={40} height={40} loading="eager" fetchpriority="high" decoding="async" />
            <h2 style={{
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              textAlign: 'center'
            }}>Community Guard</h2>
          </div>

          {/* Responder navigation - Order: Dashboard, Map, Reports, Archived, Notifications, Profile */}
          <nav
            style={{
              borderBottom: 'rgba(255,255,255,0.1)',
              textAlign: 'center',
            }}
          >
            <NavLink to="/responder/home"><FaHome /> Dashboard</NavLink>
            <NavLink to="/responder/maps"><FaMap /> Map</NavLink>
            <NavLink to="/responder/reports"><FaChartLine /> Reports</NavLink>
            <NavLink to="/responder/archived"><FaArchive /> Archived</NavLink>
            <NavLink to="/responder/notifications"><FaBell /> Notifications
              {notificationCount > 0 && (
                <span className="notification-badge">{notificationCount}</span>
              )}
            </NavLink>
            <NavLink to="/responder/cctv"><FaVideo /> Live CCTV Feeds</NavLink>
            <NavLink to="/responder/profile"><FaUser /> Profile</NavLink>
          </nav>

          {/* Logout Button - matching Layout/BarangayLayout design */}
          <button
            className="logout-btn"
            onClick={() => setShowLogoutConfirm(true)}
            aria-label="Sign Out"
          >
            <FaSignOutAlt /> Sign Out
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
            <button
              className="mobile-nav-toggle-top"
              onClick={() => setShowMobileNav(!showMobileNav)}
              aria-label="Toggle navigation"
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

        {/* Mobile Navigation Dropdown */}
        {showMobileNav && (
          <div className="mobile-nav-dropdown-top">
            <NavLink to="/responder/home" onClick={() => setShowMobileNav(false)}>
              <FaHome /> Dashboard
            </NavLink>
            <NavLink to="/responder/maps" onClick={() => setShowMobileNav(false)}>
              <FaMap /> Map
            </NavLink>
            <NavLink to="/responder/reports" onClick={() => setShowMobileNav(false)}>
              <FaChartLine /> Reports
            </NavLink>
            <NavLink to="/responder/archived" onClick={() => setShowMobileNav(false)}>
              <FaArchive /> Archived
            </NavLink>
            <NavLink to="/responder/notifications" onClick={() => setShowMobileNav(false)}>
              <FaBell /> Notifications
              {notificationCount > 0 && (
                <span className="notification-badge">{notificationCount}</span>
              )}
            </NavLink>
            <NavLink to="/responder/cctv" onClick={() => setShowMobileNav(false)}>
              <FaVideo /> Live CCTV Feeds
            </NavLink>
            <NavLink to="/responder/profile" onClick={() => setShowMobileNav(false)}>
              <FaUser /> Profile
            </NavLink>
          </div>
        )}

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
          <FaChartLine />
        </NavLink>
        <NavLink to="/responder/notifications">
          <FaBell />
        </NavLink>
        <NavLink to="/responder/profile">
          <FaUser />
        </NavLink>
      </nav>

      {/* Desktop: Floating Chat Button - Always visible when chat is closed */}
      {token && !showChatBot && (
        <button
          className="floating-chat-btn desktop-only"
          onClick={() => setShowChatBot(true)}
          title="Open Community Helper"
          aria-label="Open chat"
        >
          <FaComments />
        </button>
      )}

      {/* Mobile: 3-dot action menu */}
      <div className="mobile-action-menu">
        <button
          className="mobile-action-trigger"
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          aria-label="Open menu"
          title="More options"
        >
          <FaEllipsisV />
        </button>
        
        {showMobileMenu && (
          <div className="mobile-action-dropdown">
            {token && (
              <button
                className="mobile-action-item"
                onClick={() => {
                  setShowMobileMenu(false);
                  setShowChatBot(true);
                }}
              >
                <FaComments /> Community Helper
              </button>
            )}
            <button
              className="mobile-action-item logout-item"
              onClick={() => {
                setShowMobileMenu(false);
                setShowLogoutConfirm(true);
              }}
            >
              <FaSignOutAlt /> Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Logout confirmation modal - matching Layout/BarangayLayout design */}
      {showLogoutConfirm && (
        <ModalPortal>
        <div className="portal-modal-overlay">
          <div
            className="portal-modal logout-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            aria-describedby="logout-desc"
          >
            <h3 id="logout-title">Confirm Sign Out</h3>
            <p id="logout-desc">You're about to sign out of your Community Guard account. Don't worry, you can always sign back in whenever you need to.</p>
            <div className="portal-modal-actions">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button onClick={confirmLogout} className="confirm-btn" aria-label="Confirm sign out">
                <FaSignOutAlt style={{ marginRight: 8 }} /> Sign Out
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ChatBot Component - Premium for Responders */}
      {token && (
        <ChatBot 
          isOpen={showChatBot} 
          onClose={() => setShowChatBot(false)}
          token={token}
          isPremium={true}
        />
      )}
    </div>
  );
}
