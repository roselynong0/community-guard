import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./RegistrationForm.css";
import "./Notification.css";

function LoginForm({ session, setSession }) {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [notification, setNotification] = useState({ message: "", type: "" });
  const navigate = useNavigate();

  // ----------------- VERIFY TOKEN ON LOAD -----------------
  useEffect(() => {
    const verifyToken = async () => {
      if (!session?.token) return; // No session yet
      try {
        const res = await fetch("http://localhost:5000/api/profile", {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        if (!res.ok) {
          setSession(null);
          navigate("/login");
        }
      } catch {
        // Silently fail and reset session
        setSession(null);
        navigate("/login");
      }
    };
    verifyToken();
  }, [session, navigate, setSession]);

  // ----------------- CLEAR NOTIFICATIONS -----------------
  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => setNotification({ message: "", type: "" }), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

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
        // ✅ Use React state only, no localStorage
        setSession(result.session);
        setNotification({ message: "Login successful! 🎉", type: "success" });
        setTimeout(() => navigate("/home"), 1000);
      } else if (result.status === "invalid_credentials") {
        setNotification({ message: "Incorrect email or password.", type: "error" });
        ["email", "password"].forEach((field) => {
          const el = document.querySelector(`input[name="${field}"]`);
          if (el) el.classList.add("error-field");
        });
      } else if (result.status === "not_found") {
        setNotification({ message: "No account found with this email.", type: "error" });
        const el = document.querySelector(`input[name="email"]`);
        if (el) el.classList.add("error-field");
      } else {
        setNotification({ message: "An unexpected error occurred.", type: "error" });
      }
    } catch {
      setNotification({ message: "Server error", type: "error" });
    }
  };

  return (
    <div className="background">
      {notification.message && (
        <div className={`notif notif-${notification.type}`}>
          <span>{notification.message}</span>
        </div>
      )}

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
            <Link to="/" className="back-link">
              Don't have an account? Register
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginForm;