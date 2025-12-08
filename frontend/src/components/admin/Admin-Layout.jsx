import React, { useState, useEffect, useRef, useCallback } from "react";
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
  FaArchive,
  FaComments,
  FaEllipsisV,
  FaUser,
} from "react-icons/fa";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import Toast from "../shared/Toast";
import ChatBot from "../shared/ChatBot";
import ModalPortal from "../shared/ModalPortal";
import { registerToastCallback, registerNotificationCountCallback, startNotificationPolling, stopNotificationPolling } from "../../utils/notificationService";
import { API_CONFIG, getApiUrl } from "../../utils/apiConfig";
import { handleSessionExpired, isSessionExpired } from "../../utils/session";
import "../shared/Layout.css";
import logo from "../../assets/logo.png";
import LoadingScreen from "../shared/LoadingScreen";

function AdminLayout({ session, setSession, setNotification }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dateTime, setDateTime] = useState(new Date());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notificationCount, setNotificationCount] = useState(0);
  const [showChatBot, setShowChatBot] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false); // Mobile hamburger navigation menu
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
        const profileUrl = getApiUrl(API_CONFIG.endpoints.profile);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout for profile fetch

        const res = await fetch(profileUrl, {
          headers: { Authorization: `Bearer ${session.token}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        
        // Check for session expiration (401/403)
        if (isSessionExpired(res)) {
          handleSessionExpired(setSession, setNotification, navigate, 'admin');
          return;
        }
        
        const data = await res.json();
        if (!res.ok || data.status !== "success") {
          handleSessionExpired(setSession, setNotification, navigate, 'admin', 'Your session is no longer valid. Please log in again to access the admin panel.');
          setUser(null);
          return;
        } else {
          if (data.profile?.role !== "Admin") {
            setSession(null);
            setUser(null);
            setNotification({
              message: "Access denied. Admin privileges required.",
              type: "error",
            });
            navigate("/login?role=admin");
            return;
          }
          
          // Auto-set onpremium = true for Admin users (ensures premium status in database)
          // This is a fire-and-forget call - Admin always has premium access regardless of DB state
          if (data.profile?.role === "Admin") {
            // Always set premium in the profile state for Admin users
            data.profile.onpremium = true;
            
            // Try to sync with database if not already premium
            if (!data.profile?.onpremium) {
              const premiumUrl = getApiUrl('/api/admin/set-premium');
              fetch(premiumUrl, {
                method: 'POST',
                headers: { 
                  'Authorization': `Bearer ${session.token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ onpremium: true })
              }).then(resp => {
                if (resp.ok) {
                  console.log('[Admin] ✅ Auto-set onpremium=true for Admin user');
                } else {
                  console.log('[Admin] ⚠️ Premium sync returned:', resp.status, '- Admin still has premium access');
                }
              }).catch(err => {
                // Silently ignore - Admin always has premium access in the app
                console.log('[Admin] ℹ️ Premium sync skipped (network) - Admin has premium access by default');
              });
            }
          }
          
          setUser({
            ...data.profile,
            avatar_url: data.profile?.avatar_url || "/default-avatar.png",
          });
        }
      } catch (err) {
        console.error("Admin profile fetch error:", err);
        const isNetworkError =
          (err && err.name === 'AbortError') ||
          (err && (err.message || '').toLowerCase().includes("fetch")) ||
          (err && (err.message || '').toLowerCase().includes("network")) ||
          err.name === "TypeError";

        if (isNetworkError) {
          // If we have a cached session user, use it to continue the admin UI gracefully
          if (session?.user) {
            setUser({
              ...session.user,
              avatar_url: session.user.avatar_url || "/default-avatar.png",
            });
            setNotification({
              message:
                "Connection issue detected — showing cached profile. Some features may be unavailable.",
              type: "caution",
            });
          } else {
            setNotification({
              message:
                "Connection issue detected. Some features may be temporarily unavailable.",
              type: "caution",
            });
          }
        } else {
          setSession(null);
          setUser(null);
          setNotification({
            message: "Admin session expired. Please login again.",
            type: "error",
          });
          navigate("/login?role=admin");
        }
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [session, setSession, setNotification, navigate]);

  // 🔹 Fetch missed reports summary for admin (toast only)
  useEffect(() => {
    const fetchMissedReports = async () => {
      if (!session?.token || !user) return;

      // Only show toast once per session
      const toastKey = `missed_toast_shown_admin_${user.id || 'anon'}`;
      if (sessionStorage.getItem(toastKey)) return;

      try {
        const res = await fetch(getApiUrl('/api/reports/missed_summary'), {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        
        if (!res.ok) return;
        
        const data = await res.json();
        if (data?.status === 'success' && data?.summary?.total > 0) {
          const totalMissed = data.summary.total;
          
          // Show toast after 2.5 seconds delay
          setTimeout(() => {
            if (toastRef.current) {
              toastRef.current.show(
                `📢 ${totalMissed} new report${totalMissed > 1 ? 's' : ''} submitted while you were away.`,
                'info'
              );
            }
          }, 2500);
          
          sessionStorage.setItem(toastKey, '1');
        }
      } catch (e) {
        console.warn('Failed to fetch missed reports for admin:', e);
      }
    };

    fetchMissedReports();
  }, [session?.token, user]);

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
          const logoutUrl = getApiUrl(API_CONFIG.endpoints.logout);
          await fetch(logoutUrl, {
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
      navigate("/login?role=admin");
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

          {/* Sidebar Nav - Order: Users(Admin Dashboard), Maps, Reports, Archived, Community Feed, Notifications */}
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
            <NavLink to="/admin/archived">
              <FaArchive /> Archived
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

          {/* Logout - matching Layout/BarangayLayout design */}
          <button
            className="logout-btn"
            onClick={() => setShowLogoutConfirm(true)}
            aria-label="Sign Out"
          >
            <FaSignOutAlt /> Sign Out
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
            <button 
              className="mobile-nav-toggle-top" 
              onClick={() => setShowMobileNav(!showMobileNav)}
              aria-label="Toggle navigation menu"
              title="Navigation menu"
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

      {/* Mobile Navigation Menu - Shows in top bar */}
      {showMobileNav && (
        <div className="mobile-nav-dropdown-top">
          <NavLink to="/admin/users" onClick={() => setShowMobileNav(false)}>
            <FaUsers /> Users
          </NavLink>
          <NavLink to="/admin/maps" onClick={() => setShowMobileNav(false)}>
            <FaMap /> Maps
          </NavLink>
          <NavLink to="/admin/reports" onClick={() => setShowMobileNav(false)}>
            <FaChartLine /> Reports
          </NavLink>
          <NavLink to="/admin/archived" onClick={() => setShowMobileNav(false)}>
            <FaArchive /> Archived
          </NavLink>
          <NavLink to="/admin/communityfeedadmin" onClick={() => setShowMobileNav(false)}>
            <FaComment /> Community Feed
          </NavLink>
          <NavLink to="/admin/notifications" onClick={() => setShowMobileNav(false)}>
            <FaBell /> Notifications
            {notificationCount > 0 && (
              <span className="notification-badge">{notificationCount}</span>
            )}
          </NavLink>
        </div>
      )}

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
            <NavLink to="/admin/communityfeedadmin">
              <FaComment />
            </NavLink>
            <NavLink to="/admin/notifications">
              <FaBell />
            </NavLink>
      </nav>

      {/* Desktop: Floating Chat Button - Always visible when chat is closed */}
      {session?.token && !showChatBot && (
        <button
          className="floating-chat-btn desktop-only"
          onClick={() => setShowChatBot(true)}
          title="Open Community Helper"
          aria-label="Open chat"
        >
          <FaComments />
        </button>
      )}

      {/* Mobile: 3-dot action menu */}
      <div className="mobile-action-menu">
        <button
          className="mobile-action-trigger"
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          aria-label="Open menu"
          title="More options"
        >
          <FaEllipsisV />
        </button>
        
        {showMobileMenu && (
          <div className="mobile-action-dropdown">
            {session?.token && (
              <button
                className="mobile-action-item"
                onClick={() => {
                  setShowMobileMenu(false);
                  setShowChatBot(true);
                }}
              >
                <FaComments /> Community Helper
              </button>
            )}
            <button
              className="mobile-action-item logout-item"
              onClick={() => {
                setShowMobileMenu(false);
                setShowLogoutConfirm(true);
              }}
            >
              <FaSignOutAlt /> Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Logout confirmation modal - matching Layout/BarangayLayout design */}
      {showLogoutConfirm && (
        <ModalPortal>
        <div className="portal-modal-overlay">
          <div
            className="portal-modal logout-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            aria-describedby="logout-desc"
          >
            <h3 id="logout-title">Confirm Sign Out</h3>
            <p id="logout-desc">You're about to sign out of your Community Guard account. Don't worry, you can always sign back in whenever you need to.</p>
            <div className="portal-modal-actions">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button onClick={handleLogout} className="confirm-btn" aria-label="Confirm sign out">
                <FaSignOutAlt style={{ marginRight: 8 }} /> Sign Out
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ChatBot Component - Premium for Admin */}
      {session?.token && (
        <ChatBot 
          isOpen={showChatBot} 
          onClose={() => setShowChatBot(false)}
          token={session.token}
          isPremium={true}
        />
      )}
    </div>
  );
}

export default AdminLayout;