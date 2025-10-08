import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import RegistrationForm from "./components/RegistrationForm";
import LoginForm from "./components/LoginForm";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword"; // ✅ new import
import Layout from "./components/Layout";
import Home from "./components/Home";
import Reports from "./components/Reports";
import Profile from "./components/Profile";
import Notifications from "./components/Notifications";
import Maps from "./components/Maps";
import { fetchSession } from "./utils/session";
import VerificationForm from "./components/VerificationForm";

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
          element={<Navigate to={session ? "/home" : "/login"} replace />}
        />

        <Route
          path="/login"
          element={
            session
              ? <Navigate to="/home" replace />
              : <LoginForm setSession={setSession} setNotification={setNotification} />
          }
        />

        <Route path="/register" element={<RegistrationForm />} />
        <Route path="/verify-email" element={<VerificationForm />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* --- PROTECTED ROUTES --- */}
        <Route
          element={
            session ? (
              <Layout
                session={session}
                setSession={setSession}
                setNotification={setNotification}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route path="/home" element={<Home token={session?.token} />} />
          <Route path="/maps" element={<Maps token={session?.token} />} />
          <Route path="/reports" element={<Reports session={session} />} />
          <Route path="/notifications" element={<Notifications token={session?.token} />} />
          <Route path="/profile" element={<Profile token={session?.token} />} />
        </Route>

        {/* --- FALLBACK --- */}
        <Route
          path="*"
          element={<Navigate to={session ? "/home" : "/login"} replace />}
        />
      </Routes>
    </Router>
  );
}

export default App;