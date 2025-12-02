import { HashRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import RegistrationForm from "./components/RegistrationForm";
import AdminLogin from "./components/AdminLogin";
import ResidentLogin from "./components/ResidentLogin";
import BarangayLogin from "./components/BarangayLogin";
import ResponderLogin from "./components/ResponderLogin";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";
import Layout from "./components/Layout";
import AdminLayout from "./components/Admin-Layout";
import Home from "./components/Home";
import Reports from "./components/Reports";
import ArchivedReports from "./components/ArchivedReports";
import AdminReports from "./components/Admin-Reports";
import AdminUsers from "./components/Admin-Users";
import Profile from "./components/Profile";
import Notifications from "./components/Notifications";
import AdminNotifications from "./components/Admin-Notifications";
import Maps from "./components/Maps";
import AdminMaps from "./components/Admin-Maps";
import CommunityMetrics from "./components/CommunityMetrics";
import BarangayLayout from "./components/BarangayLayout";
import CommunityFeedBarangay from "./components/CommunityFeedBarangay";
import ResponderLayout from "./components/ResponderLayout";
import ResponderHome from "./components/ResponderHome";
import CommunityFeedResponder from "./components/CommunityFeedResponder";
import { fetchSession } from "./utils/session";
import VerificationForm from "./components/VerificationForm";
import HomePage from "./components/HomePage";
import SafetyTips from "./components/SafetyTips";
import CommunityFeed from "./components/CommunityFeed";
import LoadingScreen from "./components/LoadingScreen";
import SuccessRedirect from "./components/SuccessRedirect";
import CommunityFeedAdmin from "./components/CommunityFeedAdmin";
import BarangayDashboard from "./components/BarangayDashboard";
import BarangayReports from "./components/BarangayReports";
import BarangayNotifications from "./components/BarangayNotifications";

import RespondersLayout from "./components/RespondersLayout";
import RespondersDashboard from "./components/RespondersDashboard";
import RespondersReports from "./components/RespondersReports"; 
import RespondersNotifications from "./components/RespondersNotifications";
import CCTVViewer from "./components/CCTVViewer";


// ---------------- LOGIN WRAPPER ----------------
function LoginWrapper({ session, setSession, setNotification }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const forceLogin = params.get("force");
  const role = (params.get("role") || "resident").toLowerCase();

  if (session && !forceLogin) return <Navigate to="/home" replace />;

  // Route to the appropriate role-specific login component based on ?role=
  if (role === "admin") return <AdminLogin setSession={setSession} setNotification={setNotification} />;
  if (role === "barangay") return <BarangayLogin setSession={setSession} setNotification={setNotification} />;
  if (role === "responder") return <ResponderLogin setSession={setSession} setNotification={setNotification} />;
  // default to resident
  return <ResidentLogin setSession={setSession} setNotification={setNotification} />;
}

// ---------------- APP COMPONENT ----------------
function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loaderStage, setLoaderStage] = useState('loading'); // 'loading' | 'exit' | 'success' | 'done'
  const [notification, setNotification] = useState({ message: "", type: "" });

  // 🔹 Fetch session on mount with retry logic for Vercel cold starts
  useEffect(() => {
    let cancelled = false;
    let successTimeout = null;

    const completeLoading = (reason = 'default') => {
      if (cancelled) {
        return;
      }
      console.log(`🎉 Showing success screen [${reason}]`);
      setShowSuccess(true);
      setLoaderStage('success');
      successTimeout = setTimeout(() => {
        if (cancelled) {
          return;
        }
        console.log(`✅ Completed loading [${reason}]`);
        setShowSuccess(false);
        setLoaderStage('done');
        setLoading(false);
      }, 2000);
    };

    const initSession = async () => {
      const startTime = Date.now();
      const token = localStorage.getItem("token");
      
      if (!token) {
        // No token stored, but still show loading for minimum time
        const elapsed = Date.now() - startTime;
        const minLoadTime = 1500; // Minimum 1.5s to show loading
        
        if (elapsed < minLoadTime) {
          await new Promise(resolve => setTimeout(resolve, minLoadTime - elapsed));
        }

        // Ensure the success overlay is mounted before playing loader exit
        setShowSuccess(true);
        setLoaderStage('exit');
        completeLoading('no-token');
        return;
      }
      
      let currentSession = null;
      let retries = 3;
      
      while (retries > 0 && !currentSession) {
        currentSession = await fetchSession();
        if (!currentSession && retries > 1) {
          // Wait before retrying (helps with backend cold starts)
          await new Promise(resolve => setTimeout(resolve, 1500));
          retries--;
        } else {
          break;
        }
      }
      
      if (!currentSession) {
        // Only clear token if we're certain it's invalid (not just network issues)
        const storedSession = localStorage.getItem("session");
        if (!storedSession) {
          console.log("🔐 No valid session - clearing token");
          localStorage.removeItem("token");
        } else {
          console.log("⚠️ Backend unavailable but cached session exists - keeping user logged in");
        }
        setSession(null);
      } else {
        setSession(currentSession);
      }
      
      // Ensure minimum loading time for better UX
      const elapsed = Date.now() - startTime;
      const minLoadTime = 2500; // Minimum 2.5s total loading time
      
      if (elapsed < minLoadTime) {
        await new Promise(resolve => setTimeout(resolve, minLoadTime - elapsed));
      }
      
      // Start staged transition: mount success overlay first, then play loading exit
      setShowSuccess(true);
      setLoaderStage('exit');
      completeLoading('session-loaded');
    };
    initSession();

    return () => {
      cancelled = true;
      if (successTimeout) {
        clearTimeout(successTimeout);
      }
    };
  }, []);

  // 🔹 Auto-hide notifications
  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => setNotification({ message: "", type: "" }), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Show loader stages until done: loading -> exit -> success -> done
  if (loaderStage !== 'done') {
    console.log('📊 Loader state:', { loaderStage, showSuccess, loading });
    
    if (showSuccess) {
      console.log('🎉 RENDERING SUCCESS SCREEN');
      return <SuccessRedirect message="Success! Loading your workspace..." />;
    }
    
    console.log('⏳ RENDERING LOADING SCREEN');
    return (
      <LoadingScreen
        title="Starting Community Guard"
        subtitle="Initializing services and loading your session..."
        cycleMs={3000}
        stage={loaderStage}
        features={[
          { title: "Connecting", description: "Contacting backend services." },
          { title: "Preparing UI", description: "Loading interface and user preferences." },
        ]}
      />
    );
  }

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
                  session.user?.role === "Barangay Official" ? "/barangay/dashboard" :
                  session.user?.role === "Responder" ? "/responder/home" :
                  "/home"
                }
                replace
              />
            ) : (
              <HomePage />
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
                    session.user?.role === "Barangay Official" ? "/barangay/dashboard" :
                    session.user?.role === "Responder" ? "/responder/home" :
                    "/home"
                  }
                  replace
                />
              )
              : (
                <LoginWrapper
                  session={session}
                  setSession={setSession}
                  setNotification={setNotification}
                />
              )
          }
        />

        <Route path="/homepage" element={<HomePage />} />
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
              <Navigate to="/barangay/dashboard" replace />
            ) : session && session.user?.role === "Responder" ? (
              <Navigate to="/responder/home" replace />
            ) : (
              <Navigate to="/login?role=resident" replace />
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
                <Navigate to="/barangay/dashboard" replace />
              ) : session?.user?.role === "Responder" ? (
                <Navigate to="/responder/home" replace />
              ) : (
                <Navigate to="/login?role=resident" replace />
              )
            }
          />
          <Route
            path="/maps"
            element={
              session?.user?.role === "Resident" ? (
                <Maps session={session} userRole="Resident" />
              ) : session?.user?.role === "Admin" ? (
                <Navigate to="/admin/maps" replace />
              ) : session?.user?.role === "Barangay Official" ? (
                <Navigate to="/barangay/dashboard" replace />
              ) : session?.user?.role === "Responder" ? (
                <Navigate to="/responder/maps" replace />
              ) : (
                <Navigate to="/login?role=resident" replace />
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
                <Navigate to="/barangay/dashboard" replace />
              ) : session?.user?.role === "Responder" ? (
                <Navigate to="/responder/reports" replace />
              ) : (
                <Navigate to="/login?role=resident" replace />
              )
            }
          />
          <Route
            path="/archived"
            element={
              session?.user?.role === "Resident" ? (
                <ArchivedReports session={session} />
              ) : session?.user?.role === "Admin" ? (
                <Navigate to="/admin/reports" replace />
              ) : session?.user?.role === "Barangay Official" ? (
                <Navigate to="/barangay/dashboard" replace />
              ) : session?.user?.role === "Responder" ? (
                <Navigate to="/responder/reports" replace />
              ) : (
                <Navigate to="/login?role=resident" replace />
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
                <Navigate to="/barangay/dashboard" replace />
              ) : session?.user?.role === "Responder" ? (
                <Navigate to="/responder/notifications" replace />
              ) : (
                <Navigate to="/login?role=resident" replace />
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
                <Navigate to="/login?role=resident" replace />
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
                <Navigate to="/login?role=resident" replace />
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
                <Navigate to="/barangay/dashboard" replace />
              ) : session?.user?.role === "Responder" ? (
                <Navigate to="/responder/profile" replace />
              ) : (
                <Navigate to="/login?role=resident" replace />
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
              <Navigate to="/login?role=barangay" replace />
            )
          }
        >
          <Route path="/barangay/dashboard" element={<BarangayDashboard token={session?.token} />} />
          <Route path="/barangay/maps" element={<Maps session={session} userRole="Barangay Official" />} />
          <Route path="/barangay/reports" element={<BarangayReports token={session?.token} />} />
          <Route path="/barangay/archived" element={<ArchivedReports session={session} />} />
          <Route path="/barangay/notifications" element={<Notifications token={session?.token} />} />
          <Route path="/barangay/community-feed" element={<CommunityFeedBarangay token={session?.token} session={session} />} />
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
              <Navigate to="/login?role=responder" replace />
            )
          }
        >
          <Route path="/responder/home" element={<ResponderHome token={session?.token} session={session} />} />
          <Route path="/responder/maps" element={<Maps session={session} userRole="Responder" />} />
          <Route path="/responder/reports" element={<AdminReports token={session?.token} />} />
          <Route path="/responder/archived" element={<ArchivedReports session={session} />} />
          <Route path="/responder/notifications" element={<Notifications token={session?.token} />} />
          <Route path="/responder/community-feed" element={<CommunityFeedResponder token={session?.token} session={session} />} />
          <Route path="/responder/profile" element={<Profile token={session?.token} />} />
          <Route path="/responder/cctv" element={<CCTVViewer />} />
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
              <Navigate to="/login?role=admin" replace />
            )
          }
        >
          <Route
            path="/admin/dashboard"
            element={<Navigate to="/admin/users" replace />}
          />
          <Route
            path="/admin/maps"
            element={
              session?.user?.role !== "Admin" ? (
                <Navigate to="/home" replace />
              ) : (
                <AdminMaps session={session} />
              )
            }
          />
          <Route
            path="/admin/reports"
            element={
              session?.user?.role !== "Admin" ? (
                <Navigate to="/home" replace />
              ) : (
                <AdminReports token={session?.token} />
              )
            }
          />
          <Route
            path="/admin/archived"
            element={
              session?.user?.role !== "Admin" ? (
                <Navigate to="/home" replace />
              ) : (
                <ArchivedReports session={session} />
              )
            }
          />
          <Route
            path="/admin/communityfeedadmin"
            element={
              session?.user?.role !== "Admin" ? (
                <Navigate to="/home" replace />
              ) : (
                <CommunityFeedAdmin />
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
              <Navigate to="/" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;