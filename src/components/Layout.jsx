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
  FaComments,
  FaBook,
} from "react-icons/fa";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { logout } from "../utils/session";
import "./Layout.css";
import logo from "../assets/logo.png";

function Layout({ session, setSession, setNotification }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dateTime, setDateTime] = useState(new Date());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const navigate = useNavigate();

  // 🔹 Fetch user profile
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
                  paddingBottom: "1rem",
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                  marginBottom: "1rem",
                  textAlign: "center",
                }}
              > 
                  <img
                    src={user.avatar_url || "/src/assets/profile.png"}
                    alt="avatar"
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid rgba(255,255,255,0.08)'
                    }}
                  />
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontWeight: 700, color: '#fff' }}>{user.firstname} {user.lastname}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{user.role || 'Resident'}</div>
                  </div>
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
            <NavLink to="/community">
              <FaComments /> Community
            </NavLink>
            <NavLink to="/maps">
              <FaMap /> Map
            </NavLink>
            <NavLink to="/reports">
              <FaPlusCircle /> Reports
            </NavLink>
            <NavLink to="/resources">
              <FaBook /> Resources
            </NavLink>
            <NavLink to="/notifications">
              <FaBell /> Notifications
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
        <div
          className="top-bar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.5rem 1rem",
          }}
        >
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
            <div
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
                alt="User Avatar"
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid #11163e",
                }}
              />
              <div>
                <span
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    color: "#11163e",
                  }}
                >
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
          <FaPlusCircle />
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

      {/* Mobile logout */}
      <div
        className="mobile-logout-btn"
        onClick={() => setShowLogoutConfirm(true)}
        title="Logout"
      >
        <FaSignOutAlt />
      </div>

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
    </div>
  );
}

export default Layout;
