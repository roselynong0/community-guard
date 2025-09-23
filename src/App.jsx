// App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import RegistrationForm from "./components/RegistrationForm";
import LoginForm from "./components/LoginForm";
import ForgotPassword from "./components/ForgotPassword";
import Layout from "./components/Layout";
import Home from "./components/Home";
import Reports from "./components/Reports";
import Profile from "./components/Profile";

function App() {
  return (
    <Router>
      <Routes>
        {/* No sidebar layout */}
        <Route path="/" element={<RegistrationForm />} />
        <Route path="/login" element={<LoginForm />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* With sidebar layout */}
        <Route element={<Layout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/notifications" element={<div>Notifications</div>} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
