import React, { useState, useEffect } from "react";
import {
  FaHome,
  FaPlusCircle,
  FaSignOutAlt,
  FaBars,
  FaCalendarAlt,
  FaUser,
} from "react-icons/fa";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import "./Layout.css";
import logo from "../assets/logo.png";

function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dateTime, setDateTime] = useState(new Date());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const navigate = useNavigate();

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

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    navigate("/login"); // just navigate to login
  };

  return (
    <div className="home-container">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="sidebar">
          <div className="logo">
            <img src={logo} alt="Community Guard Logo" className="logo-img" />
            <h2>Community Guard 
              <br />Admin
            </h2>
          </div>
          <nav>
            <NavLink to="/home"><FaHome /> Home</NavLink>
            <NavLink to="/reports"><FaPlusCircle /> Reports</NavLink>
          </nav>
          <button className="logout-btn" onClick={() => setShowLogoutConfirm(true)}>
            <FaSignOutAlt /> Logout
          </button>
        </aside>
      )}

      {/* Main content */}
      <main className="main-area">
        <div className="top-bar">
          <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <FaBars />
          </button>
          <div className="mobile-logo">
            <img src={logo} alt="Community Guard Logo" className="logo-img" />
          </div>
          <div className="date-time">
            <FaCalendarAlt /> {formattedDateTime}
          </div>
        </div>
        <Outlet />
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="bottom-nav">
        <NavLink to="/home"><FaHome /></NavLink>
        <NavLink to="/reports"><FaPlusCircle /></NavLink>
        <div className="logout-btn" onClick={() => setShowLogoutConfirm(true)}>
          <FaSignOutAlt />
        </div>
      </nav>

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
