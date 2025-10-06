import React, { useState, useEffect } from "react";
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
import { logout } from "../utils/session";
import "./Layout.css";
import logo from "../assets/logo.png";

function Layout({ session, setSession }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dateTime, setDateTime] = useState(new Date());
  const [showAuthModal, setShowAuthModal] = useState(false); // for unauthenticated
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const navigate = useNavigate();

  // 🔹 Fetch profile if session exists
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
    await logout(setSession);
    setUser(null);
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
            <NavLink
              to={user ? "/profile" : "#"}   // navigate only if signed in
              onClick={(e) => {
                if (!user) {
                  e.preventDefault();
                  setShowAuthModal(true);   // show modal if not signed in
                }
              }}
            >
              <FaUser /> Profile
            </NavLink>
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

      {/* Mobile logout button */}
      <div
        className="mobile-logout-btn"
        onClick={() => setShowLogoutConfirm(true)}
        title="Logout"
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
              <button onClick={confirmLogout} className="confirm-btn">
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unauthenticated profile modal */}
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
    </div>
  );
}

export default Layout;
