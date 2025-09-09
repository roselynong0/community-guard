import React, { useState, useEffect } from "react";
import { Outlet, NavLink } from "react-router-dom";
import {
  FaHome,
  FaPlusCircle,
  FaBell,
  FaUser,
  FaSignOutAlt,
  FaBars,
  FaCalendarAlt,
} from "react-icons/fa";
import "./Layout.css";
import logo from "../assets/logo.png"; 

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dateTime, setDateTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setDateTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Format date & time
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

  return (
    <div className="home-container">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="sidebar">
          <div className="logo">
            <img src={logo} alt="Community Guard Logo" className="logo-img" />
            <h2>Community Guard</h2>
          </div>
          <nav>
            <NavLink to="/home"><FaHome /> Home</NavLink>
            <NavLink to="/reports"><FaPlusCircle /> Reports</NavLink>
            <NavLink to="/notifications"><FaBell /> Notifications</NavLink>
            <NavLink to="/profile"><FaUser /> Profile</NavLink>
          </nav>
          <button className="logout-btn"><FaSignOutAlt /> Logout</button>
        </aside>
      )}

      {/* Main Area */}
      <main className="main-area">
        {/* Top Bar */}
        <div className="top-bar">
          <button
            className="menu-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <FaBars />
          </button>

          {/* Mobile logo */}
          <div className="mobile-logo">
            <img src={logo} alt="Community Guard Logo" className="logo-img" />
          </div>

          <div className="date-time">
            <FaCalendarAlt /> {formattedDateTime}
          </div>
        </div>

        {/* Page content will load here */}
        <Outlet />
      </main>

      {/* Bottom Nav (Mobile Only) */}
      <nav className="bottom-nav">
        <NavLink to="/home"><FaHome /> Home</NavLink>
        <NavLink to="/reports"><FaPlusCircle /> Reports</NavLink>
        <NavLink to="/notifications"><FaBell /> Notifications</NavLink>
        <NavLink to="/profile"><FaUser /> Profile</NavLink>
      </nav>
    </div>
  );
}

export default Layout;
