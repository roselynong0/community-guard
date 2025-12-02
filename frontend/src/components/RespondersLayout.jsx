import React, { useState, useEffect } from "react";
import {
  FaHome,
  FaChartLine,
  FaFileAlt,
  FaMap,
  FaBell,
  FaBars,
  FaCalendarAlt,
  FaSignOutAlt,
} from "react-icons/fa";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import "./Layout.css";
import logo from "../assets/logo.png";

function ResponderLayout({ session, setSession, setNotification }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dateTime, setDateTime] = useState(new Date());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [user, setUser] = useState({
    firstname: "Alex",
    lastname: "Reyes",
    avatar_url: "/default-avatar.png",
  });

  const navigate = useNavigate();

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

  const handleLogout = () => {
    localStorage.removeItem("token");
    setSession(null);
    setUser(null);
    setNotification({
      message: `Responder ${user.firstname} logged out successfully`,
      type: "success",
    });
    navigate("/login?role=responder");
  };

  return (
    <div className="home-container">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="sidebar">
          <div className="logo">
            <img src={logo} alt="Community Guard Logo" className="logo-img" width={40} height={40} loading="eager" fetchpriority="high" decoding="async" />
            <h2
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                textAlign: "center",
              }}
            >
              Community Guard
            </h2>
          </div>

          <nav
            style={{
              textAlign: "center",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <NavLink to="/responders/dashboard">
              <FaHome /> Response Dashboard
            </NavLink>
            <NavLink to="/responders/reports">
              <FaFileAlt /> Reports
            </NavLink>
            <NavLink to="/responders/maps">
              <FaMap /> Map
            </NavLink>
            <NavLink to="/responders/notifications">
              <FaBell /> Notifications
            </NavLink>
          </nav>

          <button className="logout-btn" onClick={() => setShowLogoutConfirm(true)}>
            <FaSignOutAlt /> Logout
          </button>
        </aside>
      )}

      {/* TOP BAR */}
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
          {/* LEFT */}
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

          {/* RIGHT USER */}
          {user && (
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
                src={user.avatar_url}
                alt="Responder"
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
                    fontWeight: 600,
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
                  Responder
                </p>
              </div>
            </div>
          )}
        </div>

        <Outlet />
      </main>

      {/* ✅ Mobile bottom nav */}
      <nav className="bottom-nav">
        <NavLink to="/responders/dashboard"><FaHome /></NavLink>
        <NavLink to="/responders/reports"><FaFileAlt /></NavLink>
        <NavLink to="/responders/maps"><FaMap /></NavLink>
        <NavLink to="/responders/notifications"><FaBell /></NavLink>
      </nav>

      {/* ✅ ✅ Added — Mobile Logout Bubble */}
      <div
        className="mobile-logout-bubble"
        onClick={() => setShowLogoutConfirm(true)}
        title="Responder Logout"
      >
        <FaSignOutAlt />
      </div>

      {/* Logout Modal */}
      {showLogoutConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to log out?</p>
            <div className="modal-actions">
              <button onClick={() => setShowLogoutConfirm(false)} className="cancel-btn">
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

export default ResponderLayout;