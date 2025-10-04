import React, { useState, useEffect } from "react";
import { FaHome, FaPlusCircle, FaBell, FaUser, FaSignOutAlt, FaBars, FaCalendarAlt, FaMap } from "react-icons/fa";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import "./Layout.css";
import logo from "../assets/logo.png";

async function fetchWithToken(url, token) {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  return res.json();
}

function Layout({ session, setSession }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dateTime, setDateTime] = useState(new Date());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [user, setUser] = useState(session?.user || null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadProfile = async () => {
      if (!session?.token) {
        navigate("/login");
        return;
      }

      try {
        const data = await fetchWithToken("http://localhost:5000/api/profile", session.token);
        if (data.status !== "success") {
          setSession(null);
          navigate("/login");
          return;
        }
        setUser(data.profile);
      } catch (err) {
        console.error(err);
        setSession(null);
        navigate("/login");
      }
    };
    loadProfile();
  }, [session, navigate, setSession]);

  useEffect(() => {
    const interval = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formattedDateTime = dateTime.toLocaleString("en-US", {
    weekday: "long", month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true
  });

  const handleLogout = () => {
    setSession(null);
    setUser(null);
    setShowLogoutConfirm(false);
    navigate("/login");
  };

  return (
    <div className="home-container">
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
          <button className="logout-btn" onClick={() => setShowLogoutConfirm(true)}><FaSignOutAlt /> Logout</button>
        </aside>
      )}

      <main className="main-area">
        <div className="top-bar">
          <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}><FaBars /></button>
          <div className="mobile-logo">
            <img src={logo} alt="Community Guard Logo" className="logo-img" />
          </div>
          <div className="date-time"><FaCalendarAlt /> {formattedDateTime}</div>
        </div>
        <Outlet />
      </main>

      <nav className="bottom-nav">
        <NavLink to="/home"><FaHome /></NavLink>
        <NavLink to="/maps"><FaMap /></NavLink> 
        <NavLink to="/reports"><FaPlusCircle /></NavLink>
        <NavLink to="/notifications"><FaBell /></NavLink>
        <NavLink to="/profile"><FaUser /></NavLink>
      </nav>

      {showLogoutConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to log out?</p>
            <div className="modal-actions">
              <button onClick={() => setShowLogoutConfirm(false)} className="cancel-btn">Cancel</button>
              <button onClick={handleLogout} className="confirm-btn">Logout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Layout;