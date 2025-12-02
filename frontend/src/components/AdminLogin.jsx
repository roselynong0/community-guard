import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash, FaArrowLeft, FaQuestionCircle } from "react-icons/fa";
import VerificationRenewalModal from "./VerificationRenewalModal";
import { API_CONFIG, getApiUrl } from "../utils/apiConfig";
import "./LoginForm.css";
import "./Notification.css";

export default function AdminLogin({ setSession, setNotification }) {
  const [showInfo, setShowInfo] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationData, setVerificationData] = useState({ email: "", user_id: "" });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const loginMode = "Admin"; // fixed role
  const navigate = useNavigate();

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
      setNotification?.({ message: "Please fill out all required fields.", type: "caution" });
      return;
    }

    Object.keys(formData).forEach((field) => {
      const el = document.querySelector(`input[name="${field}"]`);
      if (el) el.classList.remove("error-field");
    });

    setIsLoggingIn(true);
    try {
      const body = { ...formData, role: loginMode };
      const res = await fetch(getApiUrl(API_CONFIG.endpoints.login), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();

      if (res.ok && result.status === "success") {
        // Store session first
        localStorage.setItem("token", result.session.token);
        localStorage.setItem("session", JSON.stringify(result.session));
        const userRole = result.session.user?.role;
        const userFirstname = result.session.user?.firstname || "User";

        // Admin page: only allow Admin role
        const allowed = ["Admin"];
        if (!allowed.includes(userRole)) {
          // Clear session - don't keep wrong role logged in
          localStorage.removeItem("token");
          localStorage.removeItem("session");
          
          // Redirect to the correct login page for the user's role
          const roleToPath = {
            "Admin": "/login?role=admin",
            "Barangay Official": "/login?role=barangay",
            "Responder": "/login?role=responder",
            "Resident": "/login?role=resident"
          };
          const roleLabels = {
            "Admin": "Admin",
            "Barangay Official": "Barangay Official",
            "Responder": "Responder",
            "Resident": "Resident"
          };
          const target = roleToPath[userRole] || "/login?role=resident";
          const roleLabel = roleLabels[userRole] || "Resident";
          setNotification?.({ message: `Hi ${userFirstname}! You're a ${roleLabel}. Please login on the correct page.`, type: "caution" });
          setTimeout(() => navigate(target), 1500);
          return;
        }

        // Allowed: set session and continue to admin area
        setSession?.(result.session);
        const redirectPath = "/admin/users";
        setNotification?.({ message: "Admin access granted!", type: "success" });
        setTimeout(() => navigate(`${redirectPath}?showMissed=1`), 1200);
      } else if (result.status === "invalid_credentials") {
        setNotification?.({ message: "Incorrect email or password.", type: "error" });
        ["email", "password"].forEach((field) => {
          const el = document.querySelector(`input[name="${field}"]`);
          if (el) el.classList.add("error-field");
        });
      } else if (result.status === "not_found") {
        setNotification?.({ message: "No account found with this email.", type: "error" });
        const el = document.querySelector(`input[name="email"]`);
        if (el) el.classList.add("error-field");
      } else if (result.status === "not_verified") {
        setNotification?.({ message: result.message, type: "caution" });
        const el = document.querySelector(`input[name="email"]`);
        if (el) el.classList.add("error-field");
      } else if (result.status === "role_mismatch") {
        const userFirstname = result.user?.firstname || "User";
        const suggestedTab = result.suggested_role || "correct";
        const shortMessage = `${userFirstname} must use the ${suggestedTab} tab.`;
        setNotification?.({ message: shortMessage, type: "error" });
      } else if (result.status === "verification_renewal_required") {
        setVerificationData({ email: result.email, user_id: result.user_id });
        setShowVerificationModal(true);
      } else if (result.status === "verification_redirect_required") {
        if (result.verification_token) localStorage.setItem("verification_token", result.verification_token);
        setNotification?.({ message: result.message, type: "caution" });
        setTimeout(() => {
          navigate('/verify', { state: { email: result.email, user_id: result.user_id } });
        }, 1200);
      } else {
        setNotification?.({ message: "An unexpected error occurred.", type: "error" });
      }
    } catch {
      setNotification?.({ message: "Server error", type: "error" });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRenewVerification = async () => {
    try {
      const response = await fetch(getApiUrl('/api/email/send-code'), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verificationData.email, user_id: verificationData.user_id }),
      });
      const result = await response.json();
      if (response.ok && result.status === "success") {
        return { success: true, message: "Verification email sent successfully!" };
      }
      return { success: false, message: result.message || "Failed to send verification email." };
    } catch {
      return { success: false, message: "Network error. Please try again." };
    }
  };

  return (
    <>
      <div className="background login-role-admin">
        <button
          className="back-button-top-left"
          onClick={() => navigate('/')}
          title="Go to Homepage"
        >
          <FaArrowLeft />
          <span>Go to Homepage</span>
        </button>
        <div className="wrapper">
          <div className="top-section">
            <h1>Community Guard</h1>
            <p>Welcome Back, Admin.</p>
          </div>

          <div className="form-card">
            <h2>Admin Login</h2>
            <form onSubmit={handleSubmit}>
              <input type="email" name="email" placeholder="Email Address" value={formData.email} onChange={handleChange} />
              <div className="password-field-container">
                <input type={showPassword ? "text" : "password"} name="password" placeholder="Password" value={formData.password} onChange={handleChange} />
                <button type="button" className="password-toggle-btn" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <FaEyeSlash /> : <FaEye />}</button>
              </div>
              <button type="submit" className="form-submit-btn" disabled={isLoggingIn}>{isLoggingIn ? "Verifying Admin Access..." : "Login"}</button>
              <div className="forgot-row">
                <button
                  type="button"
                  className="info-icon"
                  aria-label="Why registration is disabled"
                  onClick={() => setShowInfo((s) => !s)}
                  onMouseEnter={() => setShowInfo(true)}
                  onMouseLeave={() => setShowInfo(false)}
                >
                  <FaQuestionCircle />
                </button>
                <Link to="/forgot-password?role=admin" className="forgot-password-link">Forgot Password?</Link>
                {showInfo && (
                  <div className="info-tooltip" role="dialog">
                    <strong>Unsupported Account Creation.</strong>
                    <div>Admin accounts must be provisioned by the system administrator.</div>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      <VerificationRenewalModal isOpen={showVerificationModal} onClose={() => setShowVerificationModal(false)} userEmail={verificationData.email} userID={verificationData.user_id} onRenewVerification={handleRenewVerification} />
    </>
  );
}
