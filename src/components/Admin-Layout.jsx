import React, { useState, useEffect } from "react";
import {
  FaHome,
  FaPlusCircle,
  FaSignOutAlt,
  FaBars,
  FaCalendarAlt,
  FaUser,
  FaUsers,
  FaBell,
  FaFileAlt,
} from "react-icons/fa";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import "./Layout.css";
import logo from "../assets/logo.png";

function AdminLayout({ session, setSession, setNotification }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dateTime, setDateTime] = useState(new Date());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // � Fetch admin profile if session exists
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
          // Verify user is actually an admin
          if (data.profile?.role !== "Admin") {
            setSession(null);
            setUser(null);
            setNotification({ 
              message: "Access denied. Admin privileges required.", 
              type: "error" 
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
        
        // Don't immediately clear session for network errors, but show a warning
        const isNetworkError = err.message.includes('fetch') || err.message.includes('network') || err.name === 'TypeError';
        
        if (isNetworkError) {
          console.log("Network error detected, keeping session but showing warning");
          setNotification({ 
            message: "Connection issue detected. Some features may be temporarily unavailable.", 
            type: "caution" 
          });
          // Keep existing user data if available, just mark loading as complete
        } else {
          // Only clear session for actual auth errors
          setSession(null);
          setUser(null);
          setNotification({ 
            message: "Admin session expired. Please login again.", 
            type: "error" 
          });
          navigate("/login");
        }
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [session, setSession, setNotification, navigate]);

  // �🕒 Update date/time every second
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
      // Clear session and user data regardless of API call success
      localStorage.removeItem("token");
      setSession(null);
      setUser(null);
      setNotification({ 
        message: `Admin ${user?.firstname || 'user'} logged out successfully`, 
        type: "success" 
      });
      navigate("/login");
    }
  };

  // Show loading while fetching admin profile
  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        Loading Admin Panel...
      </div>
    );
  }

  return (
    <div className="home-container">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="sidebar">
          <div className="logo">
            <img src={logo} alt="Community Guard Logo" className="logo-img" />
            <h2>Community Guard
            </h2>
          </div>
          
          {/* Admin Profile Section */}
          {!loading && user && (
            <div className="admin-profile" style={{
              padding: '1rem',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              <img 
                src={user.avatar_url || "/src/assets/profile.png"} 
                alt="Admin Profile" 
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  marginBottom: '0.5rem',
                  border: '2px solid rgba(255,255,255,0.2)'
                }}
              />
              <h4 style={{ 
                margin: 0, 
                fontSize: '0.9rem', 
                color: 'white',
                fontWeight: '500'
              }}>
                {user.firstname} {user.lastname}
              </h4>
              <p style={{ 
                margin: 0, 
                fontSize: '0.75rem', 
                color: 'rgba(255,255,255,0.7)',
                fontStyle: 'italic'
              }}>
                Administrator
              </p>
            </div>
          )}
          <nav>
            <NavLink to="/admin/dashboard"><FaHome /> Dashboard</NavLink>
            <NavLink to="/admin/reports"><FaFileAlt /> Reports</NavLink>
            <NavLink to="/admin/users"><FaUsers /> Users</NavLink>
          </nav>
          <button 
            className="logout-btn admin-logout-btn" 
            onClick={() => setShowLogoutConfirm(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.8rem',
              color: '#c7c7c7',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              borderRadius: '8px',
              transition: 'all 0.3s ease',
              width: '100%'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'linear-gradient(135deg, #d9534f, #c9302c)';
              e.target.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'none';
              e.target.style.color = '#c7c7c7';
            }}
          >
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
        <NavLink to="/admin/dashboard"><FaHome /></NavLink>
        <NavLink to="/admin/reports"><FaFileAlt /></NavLink>
        <NavLink to="/admin/users"><FaUsers /></NavLink>
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