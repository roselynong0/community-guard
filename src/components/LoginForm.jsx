import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./RegistrationForm.css";
import "./Notification.css";

function LoginForm({ setSession }) {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [notification, setNotification] = useState({ message: "", type: "" });
  const navigate = useNavigate();

  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => setNotification({ message: "", type: "" }), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) setErrors({ ...errors, [name]: "" });
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = "Email is required";
    if (!formData.password) newErrors.password = "Password is required";
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await res.json();

      if (res.ok && result.status === "success") {
        // ✅ Save session in App state
        setSession(result.session);

        setNotification({ message: "✅ Login successful!", type: "success" });

        // Redirect to Home after short delay
        setTimeout(() => navigate("/home"), 1000);
      } else if (result.status === "invalid_credentials") {
        setNotification({ message: "Incorrect email or password.", type: "error" });
      } else if (result.status === "not_found") {
        setNotification({ message: "No account found with this email.", type: "error" });
      } else {
        setNotification({ message: "❌ An unexpected error occurred.", type: "error" });
      }
    } catch (err) {
      setNotification({ message: "❌ Server error: " + err.message, type: "error" });
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
            {errors.email && <p className="error">{errors.email}</p>}

            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
            />
            {errors.password && <p className="error">{errors.password}</p>}

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
