import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import RegistrationForm from "./components/RegistrationForm";
import LoginForm from "./components/LoginForm";
import ForgotPassword from "./components/ForgotPassword";
import Layout from "./components/Layout";
import Home from "./components/Home";
import Reports from "./components/Reports";
import Profile from "./components/Profile";
import Notifications from "./components/Notifications";
import Maps from "./components/Maps";
import { fetchSession } from "./utils/session";

// ---------------- LOGIN WRAPPER ----------------
function LoginWrapper({ session, setSession }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const forceLogin = params.get("force");

  // Redirect to home only if session exists AND user is not forcing login
  if (session && !forceLogin) return <Navigate to="/home" replace />;

  return <LoginForm setSession={setSession} />;
}

// ---------------- APP COMPONENT ----------------
function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initSession = async () => {
      const currentSession = await fetchSession();
      setSession(currentSession);
      setLoading(false);
    };
    initSession();
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={<LoginWrapper session={session} setSession={setSession} />}
        />
        <Route path="/register" element={<RegistrationForm />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Protected routes */}
        <Route
          element={
            session ? (
              <Layout session={session} setSession={setSession} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route path="/home" element={<Home token={session?.token} />} />
          <Route path="/maps" element={<Maps />} />
          <Route path="/reports" element={<Reports session={session} />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile token={session?.token} />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
