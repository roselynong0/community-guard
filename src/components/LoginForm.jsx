import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import VerificationRenewalModal from "./VerificationRenewalModal";
import "./RegistrationForm.css";
import "./Notification.css";

function LoginForm({ setSession, setNotification }) {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationData, setVerificationData] = useState({ email: "", user_id: "" });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  // loginMode: 'Resident' | 'Admin'
  const [loginMode, setLoginMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const role = params.get("role") || params.get("admin");
    if (role && role.toLowerCase() === "admin") return "Admin";
    return "Resident";
  });
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
      setNotification({ message: "Please fill out all required fields.", type: "caution" });
      return;
    }

    Object.keys(formData).forEach((field) => {
      const el = document.querySelector(`input[name="${field}"]`);
      if (el) el.classList.remove("error-field");
    });

    setIsLoggingIn(true);

    try {
      // include role hint in body when Admin login selected so backend can handle admin-specific auth
      const body = { ...formData, role: loginMode === "Admin" ? "Admin" : "Resident" };
      const res = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await res.json();

        if (res.ok && result.status === "success") {
          localStorage.setItem("token", result.session.token);
          setSession(result.session);
          const userRole = result.session.user?.role;
          const adminRoles = ["Admin", "Barangay Official", "Responder"];
          const redirectPath = adminRoles.includes(userRole) ? "/admin/dashboard" : "/home";

          if (adminRoles.includes(userRole)) {
            setNotification({ message: "Admin access granted!", type: "success" });
          } else {
            setNotification({ message: "Login successful! 🎉", type: "success" });
          }

          setTimeout(() => navigate(redirectPath), 2000);
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
      } else if (result.status === "not_verified") {
        setNotification({ message: result.message, type: "caution" });
        const el = document.querySelector(`input[name="email"]`);
        if (el) el.classList.add("error-field");
      } else if (result.status === "role_mismatch") {
        // Create personalized short message
        const userFirstname = result.user?.firstname || "User";
        const suggestedTab = result.suggested_role || "correct";
        const shortMessage = `${userFirstname} must use the ${suggestedTab} tab.`;
        
        setNotification({ message: shortMessage, type: "error" });
        // Auto-switch to suggested tab after a delay
        if (result.suggested_role && result.suggested_role !== loginMode) {
          setTimeout(() => {
            switchMode(result.suggested_role);
            setNotification({ 
              message: `Switched to ${result.suggested_role} login. Please try again.`, 
              type: "success" 
            });
          }, 2000);
        }
        // Highlight both fields for role mismatch
        ["email", "password"].forEach((field) => {
          const el = document.querySelector(`input[name="${field}"]`);
          if (el) el.classList.add("error-field");
        });
      } else if (result.status === "verification_renewal_required") {
        // Show verification renewal modal
        setVerificationData({
          email: result.email,
          user_id: result.user_id
        });
        setShowVerificationModal(true);
      } else if (result.status === "verification_redirect_required") {
        // Store temporary verification token and redirect
        if (result.verification_token) {
          localStorage.setItem("verification_token", result.verification_token);
        }
        setNotification({ message: result.message, type: "caution" });
        setTimeout(() => {
          navigate('/verify', {
            state: {
              email: result.email,
              user_id: result.user_id
            }
          });
        }, 2000);
      } else {
        setNotification({ message: "An unexpected error occurred.", type: "error" });
      }
    } catch {
      setNotification({ message: "Server error", type: "error" });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const switchMode = (mode) => {
    setLoginMode(mode);
    // Small UX: change welcome text based on mode
    const top = document.querySelector('.top-section p');
    if (top) top.textContent = mode === 'Admin' ? 'Welcome Back, Admin.' : 'Welcome Back, Resident.';
  };

  const handleRenewVerification = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/email/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: verificationData.email,
          user_id: verificationData.user_id
        }),
      });

      const result = await response.json();
      
      if (response.ok && result.status === "success") {
        return { success: true, message: "Verification email sent successfully!" };
      } else {
        return { success: false, message: result.message || "Failed to send verification email." };
      }
    } catch {
      return { success: false, message: "Network error. Please try again." };
    }
  };

  return (
    <>
      {/* Main content */}
      <div className="background">
        <div className="wrapper">
          <div className="top-section">
            <h1>Community Guard</h1>
            <p>{loginMode === 'Admin' ? 'Welcome Back, Admin.' : 'Welcome Back, Resident.'}</p>
          </div>

          <div className="form-card">
              <div className="tab-strip">
                <button type="button" onClick={() => switchMode('Resident')} className={`tab-btn ${loginMode==='Resident' ? 'active' : ''}`}>
                  Resident
                </button>
                <button type="button" onClick={() => switchMode('Admin')} className={`tab-btn ${loginMode==='Admin' ? 'active' : ''}`}>
                  Admin
                </button>
              </div>
              <h2>Login</h2>
              <form onSubmit={handleSubmit}>
              <input
                type="email"
                name="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={handleChange}
              />
              <div className="password-field-container">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              <button type="submit" disabled={isLoggingIn}>
                {isLoggingIn ? (
                  loginMode === "Admin" ? "Verifying Admin Access..." : "Logging in..."
                ) : (
                  "Login"
                )}
              </button>

              <Link to="/forgot-password" className="forgot-password-link">
                Forgot Password?
              </Link>
              <Link 
                to={loginMode === "Admin" ? "/register?role=admin" : "/register"} 
                className="back-link"
              >
                Don't have an account? Register
              </Link>
            </form>
          </div>
        </div>
      </div>

      {/* Verification Renewal Modal */}
      <VerificationRenewalModal
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        userEmail={verificationData.email}
        userID={verificationData.user_id}
        onRenewVerification={handleRenewVerification}
      />
    </>
  );
}

export default LoginForm; // ✅ export at top level