import React, { useState, useEffect, useRef } from "react";
import {
  FaHome,
  FaBell,
  FaUser,
  FaSignOutAlt,
  FaBars,
  FaCalendarAlt,
  FaLightbulb,
  FaUserFriends,
  FaMap,
  FaChartLine,
  FaArchive,
  FaComments,
} from "react-icons/fa";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { logout, handleSessionExpired, isSessionExpired } from "../../utils/session";
import { API_CONFIG, getApiUrl } from "../../utils/apiConfig";
import Toast from "./Toast";
import ChatBot from "./ChatBot";
import VerificationModal from "./VerificationModal";
import ModalPortal from "./ModalPortal";
import { registerToastCallback, registerNotificationCountCallback, startNotificationPolling, stopNotificationPolling } from "../../utils/notificationService";
import "./Layout.css";
import logo from "../../assets/logo.png";
import LoadingScreen from "./LoadingScreen";

function Layout({ session, setSession, setNotification }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dateTime, setDateTime] = useState(new Date());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [showChatBot, setShowChatBot] = useState(false);
  const toastRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const logoutConfirmBtnRef = useRef(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyUserData, setVerifyUserData] = useState(null);

  const navigate = useNavigate();

  // 🔹 Fetch user profile
  useEffect(() => {
    const loadProfile = async () => {
      if (!session?.token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(getApiUrl(API_CONFIG.endpoints.profile), {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        
        // Check for session expiration (401/403)
        if (isSessionExpired(res)) {
          handleSessionExpired(setSession, setNotification, navigate, '');
          setUser(null);
          return;
        }
        
        const data = await res.json();
        if (!res.ok || data.status !== "success") {
          handleSessionExpired(setSession, setNotification, navigate, '', 'Your session is no longer valid. Please log in again to continue.');
          setUser(null);
          return;
        } else {
          setUser({
            ...data.profile,
            avatar_url: data.profile?.avatar_url || "/default-avatar.png",
          });
        }
      } catch (err) {
        console.error("Profile fetch error:", err);
        handleSessionExpired(setSession, setNotification, navigate, '');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [session, setSession, setNotification, navigate]);

  // 🔹 Fetch missed reports summary once after profile and session load (toast only, no modal)
  useEffect(() => {
    const tryFetchSummary = async () => {
      if (!session?.token || !user) return;

      // Check URL params - only show toast when coming from login
      const params = new URLSearchParams(window.location.search || "");
      const showMissedParam = params.get('showMissed') || params.get('show_missed');
      
      // Only proceed if user came from login
      if (!showMissedParam) return;

      // Use a unique key to prevent duplicate toasts (shared between Home.jsx and Layout.jsx)
      const toastKey = `missed_toast_layout_${user.id || user?.email || 'anon'}`;
      const alreadyShownToast = sessionStorage.getItem(toastKey);

      // If we've already shown toast this session, skip
      if (alreadyShownToast) return;

      try {
        const res = await fetch(getApiUrl('/api/reports/missed_summary'), {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        if (!res) return;
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok) {
          if (contentType.includes('application/json')) {
            const errBody = await res.json().catch(() => ({}));
            console.warn('Missed summary non-ok response:', errBody);
          }
          return;
        }

        if (contentType.includes('application/json')) {
          const data = await res.json().catch((e) => {
            console.warn('Failed to parse missed_summary JSON:', e);
            return null;
          });
          if (data && data.status === 'success' && data.summary) {
            const totalMissed = data.summary.total || 0;
            
            // Show toast for missed reports (once per session) - delayed to avoid duplicate with Home.jsx
            if (totalMissed > 0 && toastRef.current) {
              // Mark as shown immediately to prevent race condition
              try { sessionStorage.setItem(toastKey, '1'); } catch { /* ignore */ }
              
              // Delay toast by 3 seconds (after Home.jsx toast at 2s)
              setTimeout(() => {
                // Double-check Home.jsx didn't already show a toast
                const homeToastKey = `missed_toast_home_${user.id || user?.email || 'anon'}`;
                if (sessionStorage.getItem(homeToastKey)) {
                  console.log('📢 Skipping Layout toast - Home.jsx already showed one');
                  return;
                }
                
                if (toastRef.current) {
                  const userBarangay = user.address_barangay || '';
                  const barangayCounts = data.summary.barangays || {};
                  const missedInBarangay = userBarangay ? (barangayCounts[userBarangay] || 0) : totalMissed;
                  
                  if (missedInBarangay > 0) {
                    toastRef.current.show(
                      `📢 You missed ${missedInBarangay} report${missedInBarangay > 1 ? 's' : ''} in ${userBarangay || 'your area'} while you were away.`,
                      'info'
                    );
                  } else if (totalMissed > 0) {
                    toastRef.current.show(
                      `📢 You missed ${totalMissed} report${totalMissed > 1 ? 's' : ''} while you were away.`,
                      'info'
                    );
                  }
                }
              }, 3000);
            }

            // If user is partially verified (isverified true but verified false) show verify modal
            try {
              const flags = data.summary.user_flags || {};
              if (flags.isverified === true && flags.verified === false) {
                setVerifyUserData(Object.assign({}, user, { firstname: user.firstname, lastname: user.lastname, email: user.email, address_barangay: user.address_barangay, phone: user.phone }));
              }
            } catch (e) {
              console.warn('verify flags parse error', e);
            }
          }
        } else {
          const text = await res.text().catch(() => '');
          console.warn('Skipped missed_summary: unexpected content-type, response starts with:', text ? text.slice(0, 200) : '<empty>');
        }
      } catch (e) {
        console.warn('Failed to fetch missed summary:', e);
      }
    };

    tryFetchSummary();
  }, [session?.token, user]);

  // 🔹 Setup real-time notifications via SSE
  useEffect(() => {
    if (!session?.token) {
      // Stop polling if token is cleared (logout)
      if (pollingIntervalRef.current) {
        stopNotificationPolling(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

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

    // Start polling only for regular residents (Resident layout calls /api/notifications)
    try {
      // Try SSE first, but layout context only needs /api/notifications
      // Use the actual session/user role when available; fallback to 'Resident'
      const resolvedRole = session?.user?.role || user?.role || 'Resident';
      pollingIntervalRef.current = startNotificationPolling(session.token, resolvedRole, 10000);
    } catch (e) {
      console.warn('Notification polling error:', e);
    }

    return () => {
      if (pollingIntervalRef.current) {
        stopNotificationPolling(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [session, user]);

  // 🔹 Update date/time
  useEffect(() => {
    const interval = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Focus confirm button when logout modal opens
  useEffect(() => {
    if (showLogoutConfirm) {
      const t = setTimeout(() => {
        try { logoutConfirmBtnRef.current?.focus(); } catch { /* noop */ }
      }, 60);
      return () => clearTimeout(t);
    }
  }, [showLogoutConfirm]);

  const formattedDateTime = dateTime.toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const confirmLogout = async () => {
    await logout(setSession);
    setUser(null);
    setNotification({ message: "Logged out successfully.", type: "success" });
    navigate("/login?role=resident");
  };

  if (loading)
    return (
      <LoadingScreen
        title="Welcome back, Resident!"
        subtitle="Hold on, building up the interface… Thanks for helping keep your community safe."
        features={[
          {
            title: "Incident Reporting",
            description: "Report and track neighborhood incidents quickly.",
          },
          {
            title: "Interactive Maps",
            description: "See nearby alerts and safe routes in real time.",
          },
          {
            title: "Community Feed",
            description: "Stay updated and support your neighbors.",
          },
          {
            title: "Safety Tips",
            description: "Learn best practices to protect your area.",
          },
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

          {/* Nav links - Order: Dashboard, Map, Reports, Archived, Community Feed, Safety Tips, Notifications, Profile */}
          <nav
            style={{
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              textAlign: "center",
            }}
          >
            <NavLink to="/home">
              <FaHome /> Dashboard
            </NavLink>
            <NavLink to="/maps">
              <FaMap /> Map
            </NavLink>
            <NavLink to="/reports">
              <FaChartLine /> Reports
            </NavLink>
            <NavLink to="/archived">
              <FaArchive /> Archived
            </NavLink>
            <NavLink to="/community-feed">
              <FaUserFriends /> Community Feed
            </NavLink>
            <NavLink to="/safety-tips">
              <FaLightbulb /> Safety Tips
            </NavLink>
            <NavLink to="/notifications">
              <FaBell /> Notifications
              {notificationCount > 0 && (
                <span className="notification-badge">{notificationCount}</span>
              )}
            </NavLink>
            <NavLink
              to={user ? "/profile" : "#"}
              onClick={(e) => {
                if (!user) {
                  e.preventDefault();
                  setShowAuthModal(true);
                }
              }}
            >
              <FaUser /> Profile
            </NavLink>
          </nav>

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
        <div className="top-bar">
          {/* Left: Menu + Date */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <FaBars />
            </button>
            <div className="date-time" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <FaCalendarAlt />
              {formattedDateTime}
            </div>
          </div>

          {/* Right: User Profile */}
          {user && (
            <div className="user"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.8rem",
                cursor: "pointer",
              }}
              onClick={() => navigate("/profile")}
            >
              <img
                src={user.avatar_url || "/src/assets/profile.png"}
                alt="User Avatar"/>
              <div>
                <span>
                  {user.firstname} {user.lastname}
                </span>
                <p
                  style={{
                    fontStyle: "Italic",
                    margin: 0,
                    fontSize: "0.7rem",
                    color: "rgba(0,0,0,0.5)",
                  }}
                >
                  {user.role || "Resident"}
                </p>
              </div>
            </div>
          )}
        </div>

        <Outlet />
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="bottom-nav">
        <NavLink to="/home">
          <FaHome />
        </NavLink>
        <NavLink to="/maps">
          <FaMap />
        </NavLink>
        <NavLink to="/reports">
          <FaChartLine />
        </NavLink>
        <NavLink to="/notifications">
          <FaBell />
        </NavLink>
        <NavLink
          to={user ? "/profile" : "#"}
          onClick={(e) => {
            if (!user) {
              e.preventDefault();
              setShowAuthModal(true);
            }
          }}
        >
          <FaUser />
        </NavLink>
      </nav>

      {/* Mobile logout - Hide when modal is open */}
      {!showLogoutConfirm && !showAuthModal && (
        <div
          className="mobile-logout-btn"
          onClick={() => setShowLogoutConfirm(true)}
          title="Sign Out"
        >
          <FaSignOutAlt />
        </div>
      )}

      {/* Floating Chat Button - Always visible when chat is closed */}
      {session?.token && !showChatBot && (
        <button
          className="floating-chat-btn"
          onClick={() => setShowChatBot(true)}
          title="Open Community Helper"
          aria-label="Open chat"
        >
          <FaComments />
        </button>
      )}

      {/* Logout Confirmation */}
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
            <p id="logout-desc">You're about to sign out of your Community Guard account. Don’t worry, you can always sign back in whenever you need to.</p>
            <div className="portal-modal-actions">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button
                ref={logoutConfirmBtnRef}
                onClick={confirmLogout}
                className="confirm-btn"
                aria-label="Confirm sign out"
              >
                <FaSignOutAlt style={{ marginRight: 8 }} /> Sign Out
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Verification prompt modal (shows if user needs to complete profile) */}
      <VerificationModal open={showVerifyModal} onClose={() => setShowVerifyModal(false)} user={verifyUserData} />

      {/* ChatBot Component - Basic for residents (AI evaluation moved to official layouts) */}
      {session?.token && (
        <ChatBot 
          isOpen={showChatBot} 
          onClose={() => setShowChatBot(false)}
          token={session.token}
          isPremium={false}
          autoEvaluationTrigger={false}
        />
      )}
    </div>
  );
}

export default Layout;