import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./LoginForm.css";
import "./RegistrationForm.css";
import "../shared/Notification.css";

function ForgotPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const roleParam = (params.get("role") || "resident").toLowerCase();
  const roleClassMap = {
    resident: "login-role-resident",
    admin: "login-role-admin",
    responder: "login-role-responder",
    barangay: "login-role-barangay-official",
    "barangay-official": "login-role-barangay-official",
  };
  const roleClass = roleClassMap[roleParam] || "login-role-resident";
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [notification, setNotification] = useState({ message: "", type: "" });

  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => setNotification({ message: "", type: "" }), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleChange = (e) => {
    setEmail(e.target.value);
    if (errors.email) setErrors({ ...errors, email: false });
  };

  const validate = () => {
    const newErrors = {};
    if (!email) newErrors.email = true;
    else if (!/^\S+@\S+\.\S+$/.test(email)) newErrors.email = true;
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setNotification({ message: "Enter a valid email address.", type: "caution" });
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const result = await res.json();

      if (res.ok && result.status === "success") {
        setNotification({ message: "Reset code sent! Check your email.", type: "success" });
        // Pass email and role to reset page
        setTimeout(() => navigate(`/reset-password?role=${roleParam}`, { state: { email } }), 1500);
      } else if (result.status === "not_found") {
        setNotification({ message: "No account found with this email.", type: "error" });
      } else {
        setNotification({ message: "An unexpected error occurred.", type: "error" });
      }
    } catch {
      setNotification({ message: "Server error", type: "error" });
    }
  };

  return (
    <div className={`background ${roleClass}`}>
      <button
        className="back-button-top-left"
        onClick={() => navigate('/')}
        title="Go to Homepage"
      >
        <span style={{display:'inline-flex', alignItems:'center', gap:6}}>&#x2190; Go to Homepage</span>
      </button>
      {notification.message && (
        <div className={`notif notif-${notification.type}`}>{notification.message}</div>
      )}
      <div className="wrapper">
        <div className="top-section">
          <h1>Community Guard</h1>
          <p>Reset your password {roleParam === 'resident' ? '' : `for ${roleParam}`}</p>
        </div>

        <div className="form-card">
          <h2>Enter your Email</h2>
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              name="email"
              placeholder="Email Address"
              value={email}
              onChange={handleChange}
            />
            <button type="submit" className="form-submit-btn">Send Reset Code</button>
          </form>

          <span className="back-link" onClick={() => navigate(`/login?role=${roleParam}`) }>
            Back to Login
          </span>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;