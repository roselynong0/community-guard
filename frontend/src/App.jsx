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
import CommunityMetrics from "./components/CommunityMetrics";
import BarangayLayout from "./components/BarangayLayout";
import BarangayHome from "./components/BarangayHome";
import CommunityFeedBarangay from "./components/CommunityFeedBarangay";
import ResponderLayout from "./components/ResponderLayout";
import ResponderHome from "./components/ResponderHome";
import CommunityFeedResponder from "./components/CommunityFeedResponder";
import { fetchSession } from "./utils/session";
import VerificationForm from "./components/VerificationForm";
import LandingPage from "./components/LandingPage";
import SafetyTips from "./components/SafetyTips";
import CommunityFeed from "./components/CommunityFeed";
import BarangayDashboard from "./components/BarangayDashboard";
import BarangayReports from "./components/BarangayReports";
import BarangayCommunityFeed from "./components/BarangayCommunityFeed"; 


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
                to={
                  session.user?.role === "Admin" ? "/admin/users" :
                  session.user?.role === "Barangay Official" ? "/barangay/home" :
                  session.user?.role === "Responder" ? "/responder/home" :
                  "/home"
                }
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
                  to={
                    session.user?.role === "Admin" ? "/admin/users" :
                    session.user?.role === "Barangay Official" ? "/barangay/home" :
                    session.user?.role === "Responder" ? "/responder/home" :
                    "/home"
                  }
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

        {/* --- RESIDENT PROTECTED ROUTES (Residents only) --- */}
        <Route
          element={
            session && session.user?.role === "Resident" ? (
              <Layout
                session={session}
                setSession={setSession}
                setNotification={setNotification}
              />
            ) : session && session.user?.role === "Admin" ? (
              <Navigate to="/admin/users" replace />
            ) : session && session.user?.role === "Barangay Official" ? (
              <Navigate to="/barangay/home" replace />
            ) : session && session.user?.role === "Responder" ? (
              <Navigate to="/responder/home" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route
            path="/home"
            element={
              session?.user?.role === "Resident" ? (
                <Home token={session?.token} session={session} />
              ) : session?.user?.role === "Admin" ? (
                <Navigate to="/admin/users" replace />
              ) : session?.user?.role === "Barangay Official" ? (
                <Navigate to="/barangay/home" replace />
              ) : session?.user?.role === "Responder" ? (
                <Navigate to="/responder/home" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/maps"
            element={
              session?.user?.role === "Resident" ? (
                <Maps token={session?.token} />
              ) : session?.user?.role === "Admin" ? (
                <Navigate to="/admin/maps" replace />
              ) : session?.user?.role === "Barangay Official" ? (
                <Navigate to="/barangay/maps" replace />
              ) : session?.user?.role === "Responder" ? (
                <Navigate to="/responder/maps" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/reports"
            element={
              session?.user?.role === "Resident" ? (
                <Reports session={session} />
              ) : session?.user?.role === "Admin" ? (
                <Navigate to="/admin/reports" replace />
              ) : session?.user?.role === "Barangay Official" ? (
                <Navigate to="/barangay/reports" replace />
              ) : session?.user?.role === "Responder" ? (
                <Navigate to="/responder/reports" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/notifications"
            element={
              session?.user?.role === "Resident" ? (
                <Notifications token={session?.token} />
              ) : session?.user?.role === "Admin" ? (
                <Navigate to="/admin/notifications" replace />
              ) : session?.user?.role === "Barangay Official" ? (
                <Navigate to="/barangay/notifications" replace />
              ) : session?.user?.role === "Responder" ? (
                <Navigate to="/responder/notifications" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/safety-tips"
            element={
              session?.user?.role === "Resident" ? (
                <SafetyTips />
              ) : session?.user?.role === "Admin" ? (
                <Navigate to="/admin/users" replace />
              ) : session?.user?.role === "Barangay Official" ? (
                <Navigate to="/barangay/home" replace />
              ) : session?.user?.role === "Responder" ? (
                <Navigate to="/responder/home" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/community-feed"
            element={
              session?.user?.role === "Resident" ? (
                <CommunityFeed />
              ) : session?.user?.role === "Admin" ? (
                <Navigate to="/admin/users" replace />
              ) : session?.user?.role === "Barangay Official" ? (
                <Navigate to="/barangay/community-feed" replace />
              ) : session?.user?.role === "Responder" ? (
                <Navigate to="/responder/community-feed" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/profile"
            element={
              session?.user?.role === "Resident" ? (
                <Profile token={session?.token} />
              ) : session?.user?.role === "Admin" ? (
                <Navigate to="/admin/profile" replace />
              ) : session?.user?.role === "Barangay Official" ? (
                <Navigate to="/barangay/profile" replace />
              ) : session?.user?.role === "Responder" ? (
                <Navigate to="/responder/profile" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Route>

        {/* --- BARANGAY PROTECTED ROUTES --- */}
        <Route
          element={
            session && session.user?.role === "Barangay Official" ? (
              <BarangayLayout session={session} setSession={setSession} setNotification={setNotification} />
            ) : session ? (
              <Navigate to="/home" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route path="/barangay/home" element={<BarangayHome token={session?.token} session={session} />} />
          <Route path="/barangay/dashboard" element={<BarangayDashboard token={session?.token} session={session} />} />
          <Route path="/barangay/maps" element={<Maps token={session?.token} />} />
          <Route path="/barangay/reports" element={<BarangayReports token={session?.token} session={session} />} />
          <Route path="/barangay/notifications" element={<Notifications token={session?.token} />} />
          <Route path="/barangay/community-feed" element={<BarangayCommunityFeed token={session?.token} session={session} />} />
          <Route path="/barangay/profile" element={<Profile token={session?.token} />} />
        </Route>

        {/* --- RESPONDER PROTECTED ROUTES --- */}
        <Route
          element={
            session && session.user?.role === "Responder" ? (
              <ResponderLayout session={session} setSession={setSession} setNotification={setNotification} />
            ) : session ? (
              <Navigate to="/home" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route path="/responder/home" element={<ResponderHome token={session?.token} session={session} />} />
          <Route path="/responder/maps" element={<Maps token={session?.token} />} />
          <Route path="/responder/reports" element={<AdminReports token={session?.token} />} />
          <Route path="/responder/notifications" element={<Notifications token={session?.token} />} />
          <Route path="/responder/community-feed" element={<CommunityFeedResponder token={session?.token} session={session} />} />
          <Route path="/responder/profile" element={<Profile token={session?.token} />} />
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
            element={<Navigate to="/admin/users" replace />}
          />
          <Route
            path="/admin/maps"
            element={<Navigate to="/admin/users" replace />}
          />
          <Route
            path="/admin/reports"
            element={<Navigate to="/admin/users" replace />}
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
            path="/admin/community-metrics"
            element={
              session?.user?.role !== "Admin" ? (
                <Navigate to="/home" replace />
              ) : (
                <CommunityMetrics session={session} setNotification={setNotification} />
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
          <Route path="/barangay/notifications" element={<Notifications />} />
          <Route path="/barangay/community-feed" element={<BarangayCommunityFeed />} />
        </Route>
        </Route>


        {/* --- FALLBACK --- */}
        <Route
          path="*"
          element={
            session ? (
              <Navigate
                to={session.user?.role === "Admin" ? "/admin/users" : "/home"}
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