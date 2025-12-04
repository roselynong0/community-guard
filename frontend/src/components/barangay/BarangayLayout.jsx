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
  const [autoEvaluationTrigger, setAutoEvaluationTrigger] = useState(false);
  const [isPremiumUser, setIsPremiumUser] = useState(false); // Track premium status from user profile
  const toastRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const logoutConfirmBtnRef = useRef(null);
  const hasCheckedEvaluations = useRef(false);

  const navigate = useNavigate();

  // Check for new AI evaluations (for Barangay Officials)
  const checkForNewEvaluations = useCallback(async () => {
    if (!session?.token || hasCheckedEvaluations.current) return;
    
    try {
      const res = await fetch(getApiUrl('/api/chat/check-new-evaluations'), {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        
        if (data.should_notify && data.has_new_evaluations) {
          hasCheckedEvaluations.current = true;
          
          // Auto-open chatbot with evaluation prompt for officials
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
  }, [session?.token]);

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

  // Check for AI evaluations after user profile is loaded
  useEffect(() => {
    if (user && session?.token && !hasCheckedEvaluations.current) {
      // Small delay to not overwhelm initial load
      const timer = setTimeout(() => {
        checkForNewEvaluations();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user, session?.token, checkForNewEvaluations]);

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
            <NavLink to="/barangay/assign-responders">
              <FaUsers /> Assign Responders
            </NavLink>
            <NavLink to="/barangay/archived">
              <FaArchive /> Archived
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

      {/* Mobile logout bubble */}
      <div
        className="mobile-logout-bubble"
        onClick={() => setShowLogoutConfirm(true)}
        title="Barangay Official Logout"
      >
        <FaSignOutAlt />
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

      {/* ChatBot Component with AI Evaluation - Premium feature for Officials */}
      {session?.token && (
        <ChatBot 
          isOpen={showChatBot} 
          onClose={() => {
            setShowChatBot(false);
            setAutoEvaluationTrigger(false);
          }}
          token={session.token}
          isPremium={isPremiumUser}
          autoEvaluationTrigger={autoEvaluationTrigger}
          onEvaluationComplete={handleEvaluationComplete}
        />
      )}
    </div>
  );
}

export default BarangayLayout;
