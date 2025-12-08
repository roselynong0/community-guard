import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  FaHome,
  FaSignOutAlt,
  FaBars,
  FaCalendarAlt,
  FaMap,
  FaUserFriends,
  FaUsers,
  FaBell,
  FaChartLine,
  FaArchive,
  FaVideo,
  FaCrown,
  FaComments,
  FaEllipsisV,
} from "react-icons/fa";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { API_CONFIG, getApiUrl } from "../../utils/apiConfig";
import { logout, handleSessionExpired, isSessionExpired } from "../../utils/session";
import Toast from "../shared/Toast";
import ChatBot from "../shared/ChatBot";
import ModalPortal from "../shared/ModalPortal";
import { registerToastCallback, registerNotificationCountCallback, startNotificationPolling, stopNotificationPolling } from "../../utils/notificationService";
import "../shared/Layout.css";
import logo from "../../assets/logo.png";
import LoadingScreen from "../shared/LoadingScreen";

function BarangayLayout({ session, setSession, setNotification }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dateTime, setDateTime] = useState(new Date());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [user, setUser] = useState({
    firstname: "Juan",
    lastname: "Dela Cruz",
    avatar_url: "/default-avatar.png",
  });
  const [loading, setLoading] = useState(true);
  const [notificationCount, setNotificationCount] = useState(0);
  const [showChatBot, setShowChatBot] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false); // Mobile hamburger navigation menu
  const [isPremiumUser, setIsPremiumUser] = useState(false); // Track premium status from user profile
  const toastRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const logoutConfirmBtnRef = useRef(null);

  const navigate = useNavigate();

  // Fetch barangay official profile if session exists
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
          handleSessionExpired(setSession, setNotification, navigate, 'barangay');
          setUser(null);
          return;
        }
        
        const data = await res.json();
        
        if (!res.ok || data.status !== "success") {
          console.error("Profile fetch failed:", data);
          handleSessionExpired(setSession, setNotification, navigate, 'barangay', 'Your session is no longer valid. Please log in again to continue.');
          setUser(null);
          return;
        } else {
          if (data.profile?.role !== "Barangay Official") {
            setSession(null);
            setUser(null);
            setNotification({
              message: "Access denied. Barangay Official privileges required.",
              type: "error",
            });
            navigate("/login?role=barangay");
            return;
          }
          setUser({
            ...data.profile,
            avatar_url: data.profile?.avatar_url || "/default-avatar.png",
          });
          // Set premium status - Only users with onpremium=TRUE are premium
          // Barangay Officials do NOT auto-get premium - they must have onpremium=true in database
          const hasPremium = data.profile?.onpremium === true;
          setIsPremiumUser(hasPremium);
          console.log('[BarangayLayout] Premium status:', hasPremium, 'Role:', data.profile?.role, 'onpremium:', data.profile?.onpremium);
        }
      } catch (err) {
        console.error("Officials profile fetch error:", err);
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    
    loadProfile();
  }, [session, setSession, setNotification, navigate]);

  // 🔹 Fetch missed reports summary for barangay official (toast only)
  useEffect(() => {
    const fetchMissedReports = async () => {
      if (!session?.token || !user) return;

      // Only show toast once per session
      const toastKey = `missed_toast_shown_barangay_${user.id || 'anon'}`;
      if (sessionStorage.getItem(toastKey)) return;

      try {
        const res = await fetch(getApiUrl('/api/reports/missed_summary'), {
          headers: { Authorization: `Bearer ${session.token}` },
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
                  `📢 ${missedInBarangay} new report${missedInBarangay > 1 ? 's' : ''} in ${userBarangay || 'your barangay'} while you were away.`,
                  'info'
                );
              }
            }, 2500);
            
            sessionStorage.setItem(toastKey, '1');
          }
        }
      } catch (e) {
        console.warn('Failed to fetch missed reports for barangay:', e);
      }
    };

    fetchMissedReports();
  }, [session?.token, user]);

  // 🔹 Setup real-time notifications via SSE for barangay official
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

    // Start polling only for Barangay Official role (Barangay layout only calls /api/barangay/notifications)
    try {
      pollingIntervalRef.current = startNotificationPolling(session.token, 'Barangay Official', 10000);
    } catch (e) {
      console.warn('Notification polling error:', e);
    }

    return () => {
      if (pollingIntervalRef.current) {
        stopNotificationPolling(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [session?.token]);

  // 🕒 Update date/time every second
  useEffect(() => {
    const interval = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Focus confirm button when logout modal opens (match Layout.jsx behavior)
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

  const handleLogout = async () => {
    // Close the modal first
    setShowLogoutConfirm(false);

    // Capture user name before clearing
    const userName = user?.firstname || "user";

    // Use the shared logout utility
    await logout(setSession);
    setUser(null);

    setNotification({
      message: `Barangay Official ${userName} logged out successfully`,
      type: "success",
    });

    navigate("/login?role=barangay");
  };

  if (loading) {
    return (
      <LoadingScreen
        title="Welcome back, Barangay Official!"
        subtitle="Preparing your tools — together we improve community safety."
        cycleMs={3000}
        features={[
          { title: "MVP: Incident Reporting", description: "Fast creation + structured intake for follow-up." },
          { title: "MVP: Community Outreach", description: "Broadcast guidance and gather resident feedback." },
        ]}
      />
    );
  }

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

          {/* Sidebar Nav - Order: Dashboard, Map, Reports, Assign Responders, Archived, Community Feed, Notifications, Profile */}
          <nav
            style={{
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              textAlign: "center",
            }}
          >
            <NavLink to="/barangay/dashboard">
              <FaHome /> Dashboard
            </NavLink>
            <NavLink to="/barangay/maps">
              <FaMap /> Maps
            </NavLink>
            <NavLink to="/barangay/reports">
              <FaChartLine /> Reports
            </NavLink>
            <NavLink to="/barangay/archived">
              <FaArchive /> Archived
            </NavLink>
            <NavLink to="/barangay/assign-responders">
              <FaUsers /> Assign Responders
            </NavLink>
            <NavLink to="/barangay/cctv">
              <FaVideo /> Live CCTV Feeds
            </NavLink>
            <NavLink to="/barangay/community-feed">
              <FaUserFriends /> Community Feed
            </NavLink>
            <NavLink to="/barangay/notifications">
              <FaBell /> Notifications
              {notificationCount > 0 && (
                <span className="notification-badge">{notificationCount}</span>
              )}
            </NavLink>
            <NavLink to="/barangay/premium" className="premium-nav-link" style={{
              background: 'linear-gradient(135deg, rgba(243,156,18,0.15), rgba(231,76,60,0.1))',
              borderLeft: '3px solid #f39c12'
            }}>
              <FaCrown style={{ color: '#f39c12' }} /> Premium
            </NavLink>
            <NavLink to="/barangay/profile">
              <FaUsers /> Profile
            </NavLink>
          </nav>

          {/* Logout */}
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
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.8rem 1.2rem",
          }}
        >
          {/* Left side: Menu + DateTime */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              color: "#11163e",
            }}
          >
            <button
              className="menu-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
                color: "#11163e",
              }}
            >
              <FaBars />
            </button>
            <button 
              className="mobile-nav-toggle-top" 
              onClick={() => setShowMobileNav(!showMobileNav)}
              aria-label="Toggle navigation menu"
              title="Navigation menu"
            >
              <FaBars />
            </button>
            <div className="date-time" style={{ fontWeight: 500 }}>
              <FaCalendarAlt style={{ marginRight: "0.4rem" }} />{" "}
              {formattedDateTime}
            </div>
          </div>

          {/* Right side: Barangay Profile */}
          {!loading && user && (
            <div
              className="admin-profile-top"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.7rem",
                cursor: "pointer",
              }}
            >
              <img
                src={user.avatar_url || "/src/assets/profile.png"}
                alt="Barangay Profile"
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid #11163e",
                }}
              />
              <div style={{ textAlign: "right" }}>
                <h4
                  style={{
                    margin: 0,
                    fontSize: "0.9rem",
                    color: "#11163e",
                    fontWeight: "600",
                  }}
                >
                  {user.firstname} {user.lastname}
                </h4>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.75rem",
                    color: "#666",
                    fontStyle: "italic",
                  }}
                >
                  Barangay Official
                </p>
              </div>
            </div>
          )}
        </div>

        <Outlet />
      </main>

      {/* Mobile Navigation Menu - Shows in top bar */}
      {showMobileNav && (
        <div className="mobile-nav-dropdown-top">
          <NavLink to="/barangay/dashboard" onClick={() => setShowMobileNav(false)}>
            <FaHome /> Dashboard
          </NavLink>
          <NavLink to="/barangay/maps" onClick={() => setShowMobileNav(false)}>
            <FaMap /> Maps
          </NavLink>
          <NavLink to="/barangay/reports" onClick={() => setShowMobileNav(false)}>
            <FaChartLine /> Reports
          </NavLink>
          <NavLink to="/barangay/archived" onClick={() => setShowMobileNav(false)}>
            <FaArchive /> Archived
          </NavLink>
          <NavLink to="/barangay/assign-responders" onClick={() => setShowMobileNav(false)}>
            <FaUsers /> Assign Responders
          </NavLink>
          <NavLink to="/barangay/cctv" onClick={() => setShowMobileNav(false)}>
            <FaVideo /> Live CCTV Feeds
          </NavLink>
          <NavLink to="/barangay/community-feed" onClick={() => setShowMobileNav(false)}>
            <FaUserFriends /> Community Feed
          </NavLink>
          <NavLink to="/barangay/notifications" onClick={() => setShowMobileNav(false)}>
            <FaBell /> Notifications
            {notificationCount > 0 && (
              <span className="notification-badge">{notificationCount}</span>
            )}
          </NavLink>
          <NavLink to="/barangay/premium" onClick={() => setShowMobileNav(false)}>
            <FaCrown style={{ color: '#f39c12' }} /> Premium
          </NavLink>
          <NavLink to="/barangay/profile" onClick={() => setShowMobileNav(false)}>
            <FaUsers /> Profile
          </NavLink>
        </div>
      )}

      {/* Bottom nav (mobile) */}
      <nav className="bottom-nav">
        <NavLink to="/barangay/dashboard">
          <FaHome />
        </NavLink>
         <NavLink to="/barangay/reports">
          <FaChartLine />
        </NavLink>
        <NavLink to="/barangay/maps">
          <FaMap />
        </NavLink>
        <NavLink to="/barangay/notifications">
          <FaBell />
        </NavLink>
        <NavLink to="/barangay/community-feed">
          <FaUserFriends />
        </NavLink>
        <NavLink to="/barangay/profile">
          <FaUsers />
        </NavLink>
      </nav>

      {/* Desktop: Floating Chat Button - Always visible when chat is closed */}
      {session?.token && !showChatBot && (
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
            {session?.token && (
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

      {/* Logout confirmation modal (shared design with Layout.jsx) */}
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
                onClick={handleLogout}
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

      {/* ChatBot Component - Premium for Officials */}
      {session?.token && (
        <ChatBot 
          isOpen={showChatBot} 
          onClose={() => setShowChatBot(false)}
          token={session.token}
          isPremium={isPremiumUser}
        />
      )}
    </div>
  );
}

export default BarangayLayout;
