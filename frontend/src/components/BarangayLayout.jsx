import React, { useState, useEffect, useRef } from "react";
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
} from "react-icons/fa";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { API_CONFIG } from "../utils/apiConfig";
import { logout } from "../utils/session";
import Toast from "./Toast";
import { registerToastCallback, registerNotificationCountCallback, startNotificationPolling, stopNotificationPolling } from "../utils/notificationService";
import "./Layout.css";
import logo from "../assets/logo.png";

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
  const toastRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  const navigate = useNavigate();

  // Fetch barangay official profile if session exists
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
          console.error("Profile fetch failed:", data);
          if (res.status === 401) {
            // Only logout on authentication errors
            setSession(null);
            setUser(null);
            navigate("/login");
          }
        } else {
          if (data.profile?.role !== "Barangay Official") {
            setSession(null);
            setUser(null);
            setNotification({
              message: "Access denied. Barangay Official privileges required.",
              type: "error",
            });
            navigate("/login");
            return;
          }
          setUser({
            ...data.profile,
            avatar_url: data.profile?.avatar_url || "/default-avatar.png",
          });
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
    setShowLogoutConfirm(false);
    
    // Capture user name before clearing
    const userName = user?.firstname || "user";
    
    // Use the same logout utility as Layout.jsx
    await logout(setSession);
    setUser(null);
    
    setNotification({
      message: `Barangay Official ${userName} logged out successfully`,
      type: "success",
    });
    
    navigate("/login");
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        Loading Barangay Panel...
      </div>
    );
  }

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
            }}>Community Guard</h2>
          </div>

          {/* Sidebar Nav */}
          <nav
            style={{
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              textAlign: "center",
            }}
          >
            <NavLink to="/barangay/dashboard">
              <FaHome /> Dashboard
            </NavLink>
            <NavLink to="/barangay/reports">
              <FaChartLine /> Reports
            </NavLink>
            <NavLink to="/barangay/maps">
              <FaMap /> Maps
            </NavLink>
            <NavLink to="/barangay/notifications">
              <FaBell /> Notifications
              {notificationCount > 0 && (
                <span className="notification-badge">{notificationCount}</span>
              )}
            </NavLink>
            <NavLink to="/barangay/community-feed">
              <FaUserFriends /> Community Feed
            </NavLink>
            <NavLink to="/barangay/profile">
              <FaUsers /> Profile
            </NavLink>
          </nav>

          {/* Logout */}
          <button
            className="logout-btn admin-logout-btn"
            onClick={() => setShowLogoutConfirm(true)}
            style={{
              background: "none",
              border: "none",
              padding: "0.8rem",
              color: "#c7c7c7",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              borderRadius: "8px",
              transition: "all 0.3s ease",
              width: "100%",
            }}
            onMouseEnter={(e) => {
              e.target.style.background =
                "linear-gradient(135deg, #d9534f, #c9302c)";
              e.target.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "none";
              e.target.style.color = "#c7c7c7";
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
              <button onClick={handleLogout} className="confirm-btn">
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BarangayLayout;
