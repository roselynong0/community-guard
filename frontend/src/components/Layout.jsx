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
} from "react-icons/fa";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { logout } from "../utils/session";
import { API_CONFIG } from "../utils/apiConfig";
import Toast from "./Toast";
import ChatBot from "./ChatBot";
import { registerToastCallback, registerNotificationCountCallback, startNotificationPolling, stopNotificationPolling } from "../utils/notificationService";
import "./Layout.css";
import logo from "../assets/logo.png";

function Layout({ session, setSession, setNotification }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dateTime, setDateTime] = useState(new Date());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [showChatBot, setShowChatBot] = useState(false);
  const [showChatBotToast, setShowChatBotToast] = useState(false);
  const toastRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const chatBotToastTimeoutRef = useRef(null);
  const newReportsIntervalRef = useRef(null);

  const navigate = useNavigate();

  // 🔹 Fetch user profile
  useEffect(() => {
    const loadProfile = async () => {
      if (!session?.token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_CONFIG.BASE_URL}/api/profile`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        const data = await res.json();
        if (!res.ok || data.status !== "success") {
          setSession(null);
          setUser(null);
        } else {
          setUser({
            ...data.profile,
            avatar_url: data.profile?.avatar_url || "/default-avatar.png",
          });
        }
      } catch (err) {
        console.error("Profile fetch error:", err);
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [session, setSession]);

  // 🔹 Show ChatBot toast after 10 seconds if user is logged in
  useEffect(() => {
    if (!session?.token || !user) return;

    // Check if user has already dismissed this toast
    const chatBotToastDismissed = localStorage.getItem("chatbot-toast-dismissed");
    if (chatBotToastDismissed) return;

    // Show toast after 10 seconds
    chatBotToastTimeoutRef.current = setTimeout(() => {
      setShowChatBotToast(true);
    }, 10000);

    return () => {
      if (chatBotToastTimeoutRef.current) {
        clearTimeout(chatBotToastTimeoutRef.current);
      }
    };
  }, [session?.token, user]);

  // Handle ChatBot toast Yes/No
  const handleChatBotYes = () => {
    setShowChatBot(true);
    setShowChatBotToast(false);
  };

  const handleChatBotNo = () => {
    setShowChatBotToast(false);
    localStorage.setItem("chatbot-toast-dismissed", "true");
  };

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

    // Start polling only for regular users (User layout only calls /api/notifications)
    try {
      // Try SSE first, but layout context only needs /api/notifications
      pollingIntervalRef.current = startNotificationPolling(session.token, 'User', 10000);
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

  // 🔹 Poll for new approved reports in user's barangay
  useEffect(() => {
    if (!session?.token) {
      if (newReportsIntervalRef.current) {
        clearInterval(newReportsIntervalRef.current);
        newReportsIntervalRef.current = null;
      }
      return;
    }

    // Track dismissed report IDs in localStorage so they don't show again
    const getDismissedReports = () => {
      try {
        const stored = localStorage.getItem('dismissedNewReports');
        return new Set(stored ? JSON.parse(stored) : []);
      } catch {
        return new Set();
      }
    };

    const markReportDismissed = (reportId) => {
      try {
        const dismissed = getDismissedReports();
        dismissed.add(reportId);
        localStorage.setItem('dismissedNewReports', JSON.stringify(Array.from(dismissed)));
      } catch (e) {
        console.warn('Failed to save dismissed report:', e);
      }
    };

    let dismissedReports = getDismissedReports();

    const pollNewReports = async () => {
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/notifications/new-reports`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (data.status === "success" && data.new_reports) {
          const newReports = data.new_reports || [];

          // Show toast for each new report that hasn't been dismissed or marked as read
          newReports.forEach((report) => {
            const isDismissed = dismissedReports.has(report.id);
            const isRead = report.is_read || report.read;
            
            if (!isDismissed && !isRead) {
              const message = `📍 New report in your barangay: "${report.title}"`;
              if (toastRef.current) {
                const toastId = toastRef.current.show(message, 'info');
                // Override the close handler to track dismissals
                const originalRemove = toastRef.current.remove;
                toastRef.current.remove = function(id) {
                  if (id === toastId) {
                    markReportDismissed(report.id);
                    dismissedReports.add(report.id);
                  }
                  return originalRemove.call(this, id);
                };
              }
            } else if (isRead) {
              // Also mark as dismissed so we don't keep checking it
              markReportDismissed(report.id);
              dismissedReports.add(report.id);
            }
          });
        }
      } catch (error) {
        console.error('Error polling new reports:', error);
      }
    };

    // Initial poll
    pollNewReports();

    // Poll every 10 seconds for new reports
    newReportsIntervalRef.current = setInterval(pollNewReports, 10000);

    return () => {
      if (newReportsIntervalRef.current) {
        clearInterval(newReportsIntervalRef.current);
        newReportsIntervalRef.current = null;
      }
    };
  }, [session?.token]);

  // 🔹 Update date/time
  useEffect(() => {
    const interval = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

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
    navigate("/login");
  };

  if (loading)
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        Loading user...
      </div>
    );

  return (
    <div className="home-container">
      <Toast ref={toastRef} />
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="sidebar">
          <div className="logo">
            <img src={logo} alt="Community Guard Logo" className="logo-img" />
            <h2>Community Guard</h2>

            {/* User Profile Section */}
            {!loading && user && (
              <div
                className="user-profile"
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                  marginBottom: "1rem",
                  textAlign: "center",
                }}
              > 
              </div>
            )}
          </div>

          {/* Nav links */}
          <nav
            style={{
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              textAlign: "center",
            }}
          >
            <NavLink to="/home">
              <FaHome /> Home
            </NavLink>
            <NavLink to="/maps">
              <FaMap /> Map
            </NavLink>
            <NavLink to="/reports">
              <FaChartLine /> Reports
            </NavLink>
            <NavLink to="/notifications">
              <FaBell /> Notifications
              {notificationCount > 0 && (
                <span className="notification-badge">{notificationCount}</span>
              )}
            </NavLink>
            <NavLink to="/community-feed">
              <FaUserFriends /> Community Feed
            </NavLink>
            <NavLink to="/safety-tips">
              <FaLightbulb /> Safety Tips
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

          <button className="logout-btn" onClick={() => setShowLogoutConfirm(true)}>
            <FaSignOutAlt /> Logout
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
      {!showLogoutConfirm && !showAuthModal && !showChatBotToast && (
        <div
          className="mobile-logout-btn"
          onClick={() => setShowLogoutConfirm(true)}
          title="Logout"
        >
          <FaSignOutAlt />
        </div>
      )}

      {/* Logout Confirmation */}
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

      {/* Sign-in modal */}
      {showAuthModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Sign In Required</h3>
            <p>You must be signed in to access your profile.</p>
            <div className="modal-actions">
              <button
                onClick={() => setShowAuthModal(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowAuthModal(false);
                  navigate("/login");
                }}
                className="confirm-btn"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ChatBot Toast Notification */}
      {showChatBotToast && (
        <div className="chatbot-toast-notification">
          <div className="chatbot-toast-content">
            <p>Would you like to know what our system can provide?</p>
            <div className="chatbot-toast-actions">
              <button
                onClick={handleChatBotYes}
                className="chatbot-toast-yes"
              >
                Yes
              </button>
              <button
                onClick={handleChatBotNo}
                className="chatbot-toast-no"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ChatBot Component */}
      {session?.token && (
        <ChatBot 
          isOpen={showChatBot} 
          onClose={() => setShowChatBot(false)}
          token={session.token}
        />
      )}
    </div>
  );
}

export default Layout;
