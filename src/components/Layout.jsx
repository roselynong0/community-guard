import React, { useState, useEffect, useCallback } from "react";
import {
  FaHome,
  FaPlusCircle,
  FaBell,
  FaUser,
  FaSignOutAlt,
  FaBars,
  FaCalendarAlt,
  FaMap,
} from "react-icons/fa";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { logout } from "../utils/session";   // ✅ shared logout util
import "./Layout.css";
import logo from "../assets/logo.png";

function Layout({ session, setSession }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dateTime, setDateTime] = useState(new Date());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 🔹 Fetch profile when session token exists
  const loadProfile = useCallback(async () => {
    if (!session?.token) {
      setLoading(false);
      return navigate("/login");
    }

    try {
      const res = await fetch("http://localhost:5000/api/profile", {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const data = await res.json();

      if (!res.ok || data.status !== "success") {
        setSession(null);
        setUser(null);
        navigate("/login");
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
      navigate("/login");
    } finally {
      setLoading(false);
    }
  }, [session, setSession, navigate]);

  useEffect(() => {
    if (session?.token) loadProfile();
  }, [session, loadProfile]);

  // 🔹 Update date/time every second
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

  // ✅ Centralized logout
  const confirmLogout = async () => {
    await logout(setSession);  // shared util clears token + session
    setUser(null);
    navigate("/login");
  };

  if (loading)
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        Loading user...
      </div>
    );

  if (!session || !user) return null;

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
            <NavLink to="/maps"><FaMap /> Map</NavLink>
            <NavLink to="/reports"><FaPlusCircle /> Reports</NavLink>
            <NavLink to="/notifications"><FaBell /> Notifications</NavLink>
            <NavLink to="/profile"><FaUser /> Profile</NavLink>
          </nav>
          <button
            className="logout-btn"
            onClick={() => setShowLogoutConfirm(true)}
          >
            <FaSignOutAlt /> Logout
          </button>
        </aside>
      )}

      {/* Main content */}
      <main className="main-area">
        <div className="top-bar">
          <button
            className="menu-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
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
        <NavLink to="/maps"><FaMap /></NavLink>
        <NavLink to="/reports"><FaPlusCircle /></NavLink>
        <NavLink to="/notifications"><FaBell /></NavLink>
        <NavLink to="/profile"><FaUser /></NavLink>
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
              <button onClick={confirmLogout} className="confirm-btn">
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Layout;