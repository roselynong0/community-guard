import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import "./RegistrationForm.css";
import "./Notification.css";

function LoginForm({ setSession, setNotification }) {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // ----------------- CHECK EXISTING SESSION -----------------
  useEffect(() => {
    const fetchSession = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        return null;
      }

      try {
        const res = await fetch("http://localhost:5000/api/sessions", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const result = await res.json();

        if (res.ok && result.status === "success") {
          setSession(result.sessions[0]);
          setNotification({ message: "Session active — welcome back! 🎉", type: "success" });
          navigate("/home", { replace: true });
          return result.sessions[0];
        } else {
          // Session invalid or expired
          localStorage.removeItem("token");
          setSession(null);
          setNotification({ message: "Your session has expired. Please log in again.", type: "caution" });
          if (location.pathname !== "/login") navigate("/login", { replace: true });
          return null;
        }
      } catch (err) {
        console.error("Session check error:", err);
        localStorage.removeItem("token");
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [location, navigate, setSession, setNotification]);
  // ----------------- HANDLE FORM INPUT -----------------
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    if (errors[name]) setErrors({ ...errors, [name]: false });
    const el = e.target;
    if (el.classList.contains("error-field")) el.classList.remove("error-field");
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = true;
    if (!formData.password) newErrors.password = true;
    return newErrors;
  };

  // ----------------- HANDLE LOGIN -----------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      Object.keys(validationErrors).forEach((field) => {
        const el = document.querySelector(`input[name="${field}"]`);
        if (el) el.classList.add("error-field");
      });
      setNotification({ message: "Please fill out all required fields.", type: "caution" });
      return;
    }

    Object.keys(formData).forEach((field) => {
      const el = document.querySelector(`input[name="${field}"]`);
      if (el) el.classList.remove("error-field");
    });

    try {
      const res = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await res.json();

      if (res.ok && result.status === "success") {
        localStorage.setItem("token", result.session.token);
        setSession(result.session);
        setNotification({ message: "Login successful! 🎉", type: "success" });
        setTimeout(() => navigate("/home"), 2000);
      } else if (result.status === "invalid_credentials") {
        setNotification({ message: "Incorrect email or password.", type: "error" });
        ["email", "password"].forEach((field) => {
          const el = document.querySelector(`input[name="${field}"]`);
          if (el) el.classList.add("error-field");
        });
      } else if (result.status === "not_found") {
        setNotification({ message: "No account found with this email.", type: "error" });
        const el = document.querySelector(`input[name='email']`);
        if (el) el.classList.add("error-field");
      } else {
        setNotification({ message: "An unexpected error occurred.", type: "error" });
      }
    } catch (err) {
      console.error("Login error:", err);
      setNotification({ message: "Server error", type: "error" });
    }
  };

  if (loading) return null; // Avoid flashing login before session check

  // ----------------- UI -----------------
  return (
    <div className="background">
      <div className="wrapper">
        <div className="top-section">
          <h1>Community Guard</h1>
          <p>Welcome Back, Resident.</p>
        </div>

        <div className="form-card">
          <h2>Login</h2>
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              name="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={handleChange}
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
            />
            <button type="submit">Login</button>

            <Link to="/forgot-password" className="forgot-password-link">
              Forgot Password?
            </Link>
            <Link to="/register" className="back-link">
              Don't have an account? Register
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginForm;