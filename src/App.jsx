import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react"; // combined import
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

  if (loading) return <p>Loading...</p>; // optional loading state

  return (
    <Router>
      <Routes>
        <Route path="/" element={<RegistrationForm />} />
        <Route path="/login" element={<LoginForm setSession={setSession} />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Protected routes */}
        <Route element={<Layout session={session} setSession={setSession} />}>
          <Route path="/home" element={<Home token={session?.token} />} />
          <Route path="/maps" element={<Maps />} />
          <Route path="/reports" element={<Reports token={session?.token} />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile token={session?.token} />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;