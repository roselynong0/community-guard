import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./RegistrationForm.css";
import "./Notification.css";

function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const { email } = location.state || {};
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [notification, setNotification] = useState({ message: "", type: "" });

  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => setNotification({ message: "", type: "" }), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const validate = () => {
    const newErrors = {};
    if (!password || password.length < 6) newErrors.password = true;
    if (password !== confirmPassword) newErrors.confirmPassword = true;
    if (!code) newErrors.code = true;
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setNotification({ message: "Fix the errors before submitting.", type: "caution" });
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, new_password: password }), // send code, not token
      });
      const result = await res.json();

      if (res.ok && result.status === "success") {
        setNotification({ message: "Password reset successfully! 🎉", type: "success" });
        setTimeout(() => navigate("/login"), 1000);
      } else {
        setNotification({ message: result.message || "Invalid or expired code.", type: "error" });
      }
    } catch {
      setNotification({ message: "Server error", type: "error" });
    }
  };

  return (
    <div className="background">
      {notification.message && (
        <div className={`notif notif-${notification.type}`}>{notification.message}</div>
      )}

      <div className="wrapper">
        <div className="top-section">
          <h1>Community Guard</h1>
          <p>Reset your password</p>
        </div>

        <div className="form-card">
          <h2>Enter Reset Code & New Password</h2>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              name="code"
              placeholder="Enter code from email"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <input
              type="password"
              name="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button type="submit" className="form-submit-btn">Reset Password</button>
          </form>

          <span className="back-link" onClick={() => navigate("/login")}>
            Back to Login
          </span>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;