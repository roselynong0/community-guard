import React, { useState, useEffect, useRef } from "react";
import {
  FaHome,
  FaPlusCircle,
  FaSignOutAlt,
  FaBars,
  FaCalendarAlt,
  FaMap,
  FaUsers,
  FaBell,
  FaChartLine,
  FaChartBar,
  FaComment,
} from "react-icons/fa";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import Toast from "./Toast";
import { registerToastCallback, registerNotificationCountCallback, startNotificationPolling, stopNotificationPolling } from "../utils/notificationService";
import "./Layout.css";
import logo from "../assets/logo.png";
import LoadingScreen from "./LoadingScreen";

function AdminLayout({ session, setSession, setNotification }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dateTime, setDateTime] = useState(new Date());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notificationCount, setNotificationCount] = useState(0);
  const toastRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  const navigate = useNavigate();

  // Fetch admin profile if session exists
  useEffect(() => {
    const loadProfile = async () => {
      if (!session?.token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch("http://localhost:5000/api/profile", {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        const data = await res.json();
        if (!res.ok || data.status !== "success") {
          setSession(null);
          setUser(null);
        } else {
          if (data.profile?.role !== "Admin") {
            setSession(null);
            setUser(null);
            setNotification({
              message: "Access denied. Admin privileges required.",
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
        console.error("Admin profile fetch error:", err);
        const isNetworkError =
          err.message.includes("fetch") ||
          err.message.includes("network") ||
          err.name === "TypeError";
        if (isNetworkError) {
          setNotification({
            message:
              "Connection issue detected. Some features may be temporarily unavailable.",
            type: "caution",
          });
        } else {
          setSession(null);
          setUser(null);
          setNotification({
            message: "Admin session expired. Please login again.",
            type: "error",
          });
          navigate("/login");
        }
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [session, setSession, setNotification, navigate]);

  // 🔹 Setup real-time notifications via SSE for admin
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

    // Start polling only for Admin role (Admin layout only calls /api/admin/admin_notifications)
    try {
      pollingIntervalRef.current = startNotificationPolling(session.token, 'Admin', 10000);
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
    try {
      const token = session?.token || localStorage.getItem("token");
      if (token) {
        await fetch("http://localhost:5000/api/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (error) {
      console.error("Admin logout error:", error);
    } finally {
      localStorage.removeItem("token");
      setSession(null);
      setUser(null);
      setNotification({
        message: `Admin ${user?.firstname || "user"} logged out successfully`,
        type: "success",
      });
      navigate("/login");
    }
  };

  // Community metrics are provided on a separate Admin page

  if (loading) {
    return (
      <LoadingScreen
        title="Welcome back, Admin!"
        subtitle="Keep the momentum—your leadership keeps the system running smoothly."
        features={[
          { title: "User Management", description: "Review roles, approvals, and profiles with confidence." },
          { title: "Reports Analytics", description: "Track trends and outcomes to guide decisions." },
          { title: "Moderation Tools", description: "Maintain a safe, respectful community space." },
          { title: "System Health", description: "Monitor status and keep operations reliable." },
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

          {/* Sidebar Nav - Users prioritized; admin no longer has direct Dashboard/Map/Reports links */}
          <nav
            style={{
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              textAlign: "center",
            }}
          >
            <NavLink to="/admin/users">
              <FaUsers /> Users
            </NavLink>
            <NavLink to="/admin/maps">
              <FaMap /> Maps
            </NavLink>
            <NavLink to="/admin/reports">
              <FaChartLine /> Reports
            </NavLink>
            <NavLink to="/admin/communityfeedadmin">
              <FaComment /> Community Feed
            </NavLink>
            <NavLink to="/admin/notifications">
              <FaBell /> Notifications
              {notificationCount > 0 && (
                <span className="notification-badge">{notificationCount}</span>
              )}
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

          {/* Right side: Admin Profile */}
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
              {/* Admin actions moved to the Community Metrics page */}
              <img
                src={user.avatar_url || "/src/assets/profile.png"}
                alt="Admin Profile"
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
                  Administrator
                </p>
              </div>
            </div>
          )}
        </div>

        <Outlet />
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="bottom-nav">
            <NavLink to="/admin/users">
              <FaUsers />
            </NavLink>
            <NavLink to="/admin/maps">
              <FaMap />
            </NavLink>
            <NavLink to="/admin/reports">
              <FaChartLine />
            </NavLink>
            <NavLink to="/admin/community-feed">
              <FaComment />
            </NavLink>
            <NavLink to="/admin/notifications">
              <FaBell />
            </NavLink>
      </nav>

      {/* Mobile logout bubble */}
      <div
        className="mobile-logout-bubble"
        onClick={() => setShowLogoutConfirm(true)}
        title="Admin Logout"
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

export default AdminLayout;