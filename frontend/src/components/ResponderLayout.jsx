import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FaHome,
  FaExclamationTriangle,
  FaMap,
  FaBell,
  FaUser,
  FaSignOutAlt,
  FaBars,
  FaCalendarAlt,
  FaArchive,
} from 'react-icons/fa';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { API_CONFIG, getApiUrl } from '../utils/apiConfig';
import Toast from './Toast';
import ChatBot from './ChatBot';
import { registerToastCallback, registerNotificationCountCallback, startNotificationSSE, stopNotificationSSE, startNotificationPolling, stopNotificationPolling } from '../utils/notificationService';
import './Layout.css';
import logo from '../assets/logo.png';
import { logout, handleSessionExpired, isSessionExpired } from '../utils/session';
import LoadingScreen from './LoadingScreen';

// Enhanced responder layout with improved design matching admin/barangay styles
export default function ResponderLayout({ session, setSession, setNotification }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [dateTime, setDateTime] = useState(new Date());
  const [notificationCount, setNotificationCount] = useState(0);
  const [showChatBot, setShowChatBot] = useState(false);
  const [autoEvaluationTrigger, setAutoEvaluationTrigger] = useState(false);
  const toastRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const hasCheckedEvaluations = useRef(false);

  const navigate = useNavigate();

  const token = session?.token || '';

  // Check for new AI evaluations (for Responders)
  const checkForNewEvaluations = useCallback(async () => {
    if (!token || hasCheckedEvaluations.current) return;
    
    try {
      const res = await fetch(getApiUrl('/api/chat/check-new-evaluations'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        
        if (data.should_notify && data.has_new_evaluations) {
          hasCheckedEvaluations.current = true;
          
          // Auto-open chatbot with evaluation prompt for responders
          setAutoEvaluationTrigger(true);
          setShowChatBot(true);
          
          // Show toast notification
          if (toastRef.current) {
            toastRef.current.show(
              `🤖 AI found ${data.count} new report(s) to evaluate - Check Community Helper`,
              'info'
            );
          }
        }
      }
    } catch (e) {
      console.warn('Error checking for new evaluations:', e);
    }
  }, [token]);

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

  // Check for AI evaluations after user profile is loaded
  useEffect(() => {
    if (user && token && !hasCheckedEvaluations.current) {
      // Small delay to not overwhelm initial load
      const timer = setTimeout(() => {
        checkForNewEvaluations();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user, token, checkForNewEvaluations]);

  // Handle evaluation completion callback
  const handleEvaluationComplete = (approvalResult) => {
    if (approvalResult?.approved_count > 0) {
      if (toastRef.current) {
        toastRef.current.show(
          `✅ Auto-approved ${approvalResult.approved_count} HIGH/CRITICAL report(s)`,
          'success'
        );
      }
    }
  };

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
            <NavLink to="/responder/reports"><FaExclamationTriangle /> Reports</NavLink>
            <NavLink to="/responder/archived"><FaArchive /> Archived</NavLink>
            <NavLink to="/responder/notifications"><FaBell /> Notifications
              {notificationCount > 0 && (
                <span className="notification-badge">{notificationCount}</span>
              )}
            </NavLink>
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
        title="Sign Out"
      >
        <FaSignOutAlt />
      </div>

      {/* Logout confirmation modal - matching Layout/BarangayLayout design */}
      {showLogoutConfirm && (
        <div className="modal-overlay">
          <div
            className="modal logout-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            aria-describedby="logout-desc"
          >
            <h3 id="logout-title">Confirm Sign Out</h3>
            <p id="logout-desc">You're about to sign out of your Community Guard account. Don't worry, you can always sign back in whenever you need to.</p>
            <div className="modal-actions">
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
      )}

      {/* ChatBot Component with AI Evaluation - Premium feature for Responders */}
      {token && (
        <ChatBot 
          isOpen={showChatBot} 
          onClose={() => {
            setShowChatBot(false);
            setAutoEvaluationTrigger(false);
          }}
          token={token}
          isPremium={true}
          autoEvaluationTrigger={autoEvaluationTrigger}
          onEvaluationComplete={handleEvaluationComplete}
        />
      )}
    </div>
  );
}
