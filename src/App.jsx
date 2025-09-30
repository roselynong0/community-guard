import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState } from "react";
import RegistrationForm from "./components/RegistrationForm";
import LoginForm from "./components/LoginForm";
import ForgotPassword from "./components/ForgotPassword";
import Layout from "./components/Layout";
import Home from "./components/Home";
import Reports from "./components/Reports";
import Profile from "./components/Profile";
import Notifications from "./components/Notifications";

function App() {
  const [session, setSession] = useState(null); // in-memory session

  return (
    <Router>
      <Routes>
        <Route path="/" element={<RegistrationForm />} />
        <Route path="/login" element={<LoginForm setSession={setSession} />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Protected routes */}
        <Route element={<Layout session={session} setSession={setSession} />}>
          <Route path="/home" element={<Home token={session?.token} />} />
          <Route path="/reports" element={<Reports token={session?.token} />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile token={session?.token} />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;