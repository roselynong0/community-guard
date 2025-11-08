import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import RegistrationForm from "./components/RegistrationForm";
import LoginForm from "./components/LoginForm";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";
import Layout from "./components/Layout";
import AdminLayout from "./components/Admin-Layout";
import Home from "./components/Home";
import Reports from "./components/Reports";
import AdminReports from "./components/Admin-Reports";
import AdminUsers from "./components/Admin-Users";
import Profile from "./components/Profile";
import Notifications from "./components/Notifications";
import AdminNotifications from "./components/Admin-Notifications";
import Maps from "./components/Maps";
import { fetchSession } from "./utils/session";
import VerificationForm from "./components/VerificationForm";
import LandingPage from "./components/LandingPage";
import SafetyTips from "./components/SafetyTips";
import CommunityFeed from "./components/CommunityFeed";

import BarangayLayout from "./components/BarangayLayout";
import BarangayDashboard from "./components/BarangayDashboard";
import BarangayReports from "./components/BarangayReports";
import BarangayCommunityFeed from "./components/BarangayCommunityFeed"; 
import BarangayNotifications from "./components/BarangayNotifications";

import RespondersLayout from "./components/RespondersLayout";
import RespondersDashboard from "./components/RespondersDashboard";
import RespondersReports from "./components/RespondersReports"; 
import RespondersNotifications from "./components/RespondersNotifications";


// ---------------- LOGIN WRAPPER ----------------
function LoginWrapper({ session, setSession, setNotification }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const forceLogin = params.get("force");

  if (session && !forceLogin) return <Navigate to="/home" replace />;

  return <LoginForm setSession={setSession} setNotification={setNotification} />;
}

// ---------------- APP COMPONENT ----------------
function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ message: "", type: "" });

  // 🔹 Fetch session on mount
  useEffect(() => {
    const initSession = async () => {
      const currentSession = await fetchSession();
      if (!currentSession) {
        localStorage.removeItem("token");
        setSession(null);
      } else {
        setSession(currentSession);
      }
      setLoading(false);
    };
    initSession();
  }, []);

  // 🔹 Auto-hide notifications
  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => setNotification({ message: "", type: "" }), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  if (loading) return <p>Loading...</p>;

  return (
    <Router>
      {/* 🔹 Global notification banner */}
      {notification.message && (
        <div className={`notif notif-${notification.type}`}>
          {notification.message}
        </div>
      )}

      <Routes>
        {/* --- PUBLIC ROUTES --- */}
        <Route
          path="/"
          element={
            session ? (
              <Navigate
                to={session.user?.role === "Admin" ? "/admin/dashboard" : "/home"}
                replace
              />
            ) : (
              <LandingPage />
            )
          }
        />

        <Route
          path="/login"
          element={
            session
              ? (
                <Navigate
                  to={session.user?.role === "Admin" ? "/admin/dashboard" : "/home"}
                  replace
                />
              )
              : <LoginForm setSession={setSession} setNotification={setNotification} />
          }
        />

        <Route path="/landingpage" element={<LandingPage />} />
        <Route path="/register" element={<RegistrationForm />} />
        <Route path="/verify" element={<VerificationForm />} />
        <Route path="/verify-email" element={<VerificationForm />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />


        {/* --- RESIDENT PROTECTED ROUTES --- */}
        <Route
          element={
            session && session.user?.role !== "Admin" ? (
              <Layout
                session={session}
                setSession={setSession}
                setNotification={setNotification}
              />
            ) : session && session.user?.role === "Admin" ? (
              <Navigate to="/admin/dashboard" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route
            path="/home"
            element={
              session?.user?.role === "Admin" ? (
                <Navigate to="/admin/dashboard" replace />
              ) : (
                <Home token={session?.token} session={session} />
              )
            }
          />
          <Route
            path="/maps"
            element={
              session?.user?.role === "Admin" ? (
                <Navigate to="/admin/maps" replace />
              ) : (
                <Maps token={session?.token} />
              )
            }
          />
          <Route
            path="/reports"
            element={
              session?.user?.role === "Admin" ? (
                <Navigate to="/admin/reports" replace />
              ) : (
                <Reports session={session} />
              )
            }
          />
          <Route
            path="/notifications"
            element={
              session?.user?.role === "Admin" ? (
                <Navigate to="/admin/notifications" replace />
              ) : (
                <Notifications token={session?.token} />
              )
            }
          />
          <Route
            path="/safety-tips"
            element={
              session?.user?.role === "Admin" ? (
                <Navigate to="/admin/dashboard" replace />
              ) : (
                <SafetyTips />
              )
            }
          />
          <Route
            path="/community-feed"
            element={
              session?.user?.role === "Admin" ? (
                <Navigate to="/admin/dashboard" replace />
              ) : (
                <CommunityFeed />
              )
            }
          />
          <Route
            path="/profile"
            element={
              session?.user?.role === "Admin" ? (
                <Navigate to="/admin/profile" replace />
              ) : (
                <Profile token={session?.token} />
              )
            }
          />
        </Route>

        {/* --- ADMIN PROTECTED ROUTES --- */}
        <Route
          element={
            session && session.user?.role === "Admin" ? (
              <AdminLayout
                session={session}
                setSession={setSession}
                setNotification={setNotification}
              />
            ) : session ? (
              <Navigate to="/home" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route
            path="/admin/dashboard"
            element={
              session?.user?.role !== "Admin" ? (
                <Navigate to="/home" replace />
              ) : (
                <Home token={session?.token} session={session} />
              )
            }
          />
          <Route
            path="/admin/maps"
            element={
              session?.user?.role !== "Admin" ? (
                <Navigate to="/maps" replace />
              ) : (
                <Maps token={session?.token} />
              )
            }
          />
          <Route
            path="/admin/reports"
            element={
              session?.user?.role !== "Admin" ? (
                <Navigate to="/reports" replace />
              ) : (
                <AdminReports token={session?.token} />
              )
            }
          />
          <Route
            path="/admin/users"
            element={
              session?.user?.role !== "Admin" ? (
                <Navigate to="/home" replace />
              ) : (
                <AdminUsers token={session?.token} />
              )
            }
          />
          <Route
            path="/admin/notifications"
            element={
              session?.user?.role !== "Admin" ? (
                <Navigate to="/notifications" replace />
              ) : (
                <AdminNotifications session={session} />
              )
            }
          />
          <Route
            path="/admin/profile"
            element={
              session?.user?.role !== "Admin" ? (
                <Navigate to="/profile" replace />
              ) : (
                <Profile token={session?.token} />
              )
            }
          />
        </Route>

        {/* --- BARANGAY OFFICIAL ROUTES --- */}
        <Route>
          <Route element={<BarangayLayout />}>
          <Route path="/barangay/dashboard" element={<BarangayDashboard />} />
          <Route path="/barangay/maps" element={<Maps />} />
          <Route path="/barangay/reports" element={<BarangayReports />} />
          <Route path="/barangay/notifications" element={<BarangayNotifications />} />
          <Route path="/barangay/community-feed" element={<BarangayCommunityFeed />} />
        </Route>
        </Route>

        {/* --- RESPONDERS ROUTES --- */}
        <Route>
          <Route element={<RespondersLayout />}>
          <Route path="/responders/dashboard" element={<RespondersDashboard />} />
          <Route path="/responders/maps" element={<Maps />} />
          <Route path="/responders/reports" element={<RespondersReports />} />
          <Route path="/responders/notifications" element={<RespondersNotifications />} />
        </Route>
        </Route>


        {/* --- FALLBACK --- */}
        <Route
          path="*"
          element={
            session ? (
              <Navigate
                to={session.user?.role === "Admin" ? "/admin/dashboard" : "/home"}
                replace
              />
            ) : (
              <Navigate to="/landingpage" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;