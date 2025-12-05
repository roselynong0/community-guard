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
} from "react-icons/fa";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { logout, handleSessionExpired, isSessionExpired } from "../../utils/session";
import { API_CONFIG, getApiUrl } from "../../utils/apiConfig";
import Toast from "./Toast";
import ChatBot from "./ChatBot";
import MissedSummaryModal from "./MissedSummaryModal";
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
  const [showMissedModal, setShowMissedModal] = useState(false);
  const [missedSummary, setMissedSummary] = useState(null);
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

  // 🔹 Fetch missed reports summary once after profile and session load
  useEffect(() => {
    const tryFetchSummary = async () => {
      if (!session?.token || !user) return;

      // Check URL params - modal only shows when explicitly requested
      const params = new URLSearchParams(window.location.search || "");
      const showMissedParam = params.get('showMissed') || params.get('show_missed');

      // Persist a per-session flag so the TOAST is only shown once per session
      const toastKey = `missed_toast_shown_${user.id || user?.email || 'anon'}`;
      const alreadyShownToast = sessionStorage.getItem(toastKey);

      // Persist a per-user flag so the MODAL is only shown once ever (per-browser)
      const modalKey = `missed_modal_shown_once_${user.id || user?.email || 'anon'}`;
      const alreadyShownModal = localStorage.getItem(modalKey);

      // If we've already shown toast this session and no URL param, skip entirely
      if (alreadyShownToast && !showMissedParam) return;

      try {
        const res = await fetch(getApiUrl('/api/reports/missed_summary'), {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        if (!res) return;
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok) {
          // Non-OK response: try to read json safely, else skip
          if (contentType.includes('application/json')) {
            const errBody = await res.json().catch(() => ({}));
            console.warn('Missed summary non-ok response:', errBody);
          } else {
            const textBody = await res.text().catch(() => '');
            console.warn('Missed summary non-ok response (non-json):', textBody ? textBody.slice(0, 200) : '<no body>');
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
            
            // ALWAYS show toast for missed reports (once per session)
            if (!alreadyShownToast && totalMissed > 0 && toastRef.current) {
              // Delay toast by 2.5 seconds after login
              setTimeout(() => {
                if (toastRef.current) {
                  const userBarangay = user.address_barangay || '';
                  const barangayCounts = data.summary.barangays || {};
                  const missedInBarangay = userBarangay ? (barangayCounts[userBarangay] || 0) : totalMissed;
                  
                  if (missedInBarangay > 0) {
                    toastRef.current.show(
                      `📢 You missed ${missedInBarangay} report${missedInBarangay > 1 ? 's' : ''} in ${userBarangay || 'your area'} while you were away. Check it out!`,
                      'info'
                    );
                  } else if (totalMissed > 0) {
                    toastRef.current.show(
                      `📢 You missed ${totalMissed} report${totalMissed > 1 ? 's' : ''} while you were away. Check it out!`,
                      'info'
                    );
                  }
                }
              }, 2500);
              // Mark toast as shown for this session
              try { sessionStorage.setItem(toastKey, '1'); } catch { /* ignore */ }
            }
            
            // Only show MODAL when URL param is set AND not shown before
            if (showMissedParam && !alreadyShownModal) {
              setMissedSummary(data);
              setShowMissedModal(true);
              // Mark modal as shown so we never flash it again for this user
              try { localStorage.setItem(modalKey, '1'); } catch { /* ignore */ }
            }

            // If user is partially verified (isverified true but verified false) show verify modal after summary
            try {
              const flags = data.summary.user_flags || {};
              if (flags.isverified === true && flags.verified === false) {
                // Prepare verify data from user object we already have (prefer server profile)
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

      {/* Chat Button - Always visible */}
      {/* Chat button removed per user request */}

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

      {/* ChatBot Component */}
      {/* Missed reports summary modal */}
      <MissedSummaryModal
        open={showMissedModal}
        onClose={() => setShowMissedModal(false)}
        data={missedSummary}
        showProceedAsNext={Boolean(verifyUserData)}
        onProceed={() => {
          // Close summary and open verification modal
          setShowMissedModal(false);
          if (verifyUserData) setShowVerifyModal(true);
        }}
      />

      {/* Verification prompt modal (shows after summary if needed) */}
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