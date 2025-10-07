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

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      const currentSession = await fetchSession();
      setSession(currentSession);
      setLoading(false);
    };
    initSession();
  }, []);

  // Auto-hide notification after 4 seconds
  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => setNotification({ message: "", type: "" }), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  if (loading) return <p>Loading...</p>;

  return (
    <Router>
      {/* Global notification div */}
      {notification.message && (
        <div className={`notif notif-${notification.type}`}>
          {notification.message}
        </div>
      )}

  <Routes>
    {/* Public routes */}
    <Route path="/login" element={<LoginForm setSession={setSession} setNotification={setNotification} />} />
    <Route path="/register" element={<RegistrationForm />} />
    <Route path="/verify-email" element={<VerificationForm />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />

    {/* Protected routes wrapped in Layout */}
    <Route
      element={
        session ? <Layout session={session} setSession={setSession} setNotification={setNotification} />
                : <Navigate to="/login" replace />
      }
    >
      <Route path="/home" element={<Home token={session.token} />} />
      <Route path="/maps" element={<Maps token={session.token} />} />
      <Route path="/reports" element={<Reports session={session} />} />
      <Route path="/notifications" element={<Notifications token={session.token} />} />
      <Route path="/profile" element={<Profile token={session.token} />} />
    </Route>


    {/* Fallback */}
    <Route path="*" element={<Navigate to="/home" replace />} />
  </Routes>

    </Router>
  );
}

export default App;