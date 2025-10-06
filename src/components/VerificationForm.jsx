import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./RegistrationForm.css";
import "./Notification.css";

function VerificationForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const { email, user_id } = location.state || {};

  console.log("VerificationForm mounted");
  console.log("location.state:", location.state);
  console.log("email:", email, "user_id:", user_id);

  const [code, setCode] = useState("");
  const [errors, setErrors] = useState({});
  const [notification, setNotification] = useState({ message: "", type: "" });

  // Redirect if state is missing
  useEffect(() => {
    if (!email || !user_id) {
      navigate("/login", {
        replace: true,
        state: { notification: "Verification link expired or invalid. Please log in and try again." }
      });
    }
  }, [email, user_id, navigate]);
  
  // ----------------- CLEAR NOTIFICATIONS -----------------
  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => setNotification({ message: "", type: "" }), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // ----------------- INPUT HANDLER -----------------
  const handleChange = (e) => {
    setCode(e.target.value);
    if (errors.code) setErrors({ ...errors, code: false });
    const el = e.target;
    if (el.classList.contains("error-field")) el.classList.remove("error-field");
  };

  // ----------------- VALIDATION -----------------
  const validate = () => {
    const newErrors = {};
    if (!code) newErrors.code = true;
    else if (!/^\d{6}$/.test(code)) newErrors.code = true;
    return newErrors;
  };

  // ----------------- SUBMIT VERIFICATION -----------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      const el = document.querySelector(`input[name="code"]`);
      if (el) el.classList.add("error-field");
      setNotification({ message: "Enter a valid 6-digit code.", type: "caution" });
      return;
    }
    try {
      // Add this console log to see what's being sent
      console.log("Submitting verify:", { email, code, user_id });
      
      const res = await fetch("http://localhost:5000/api/email/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, user_id })
      });

      const result = await res.json();
      console.log("Verify response:", result); // Also log the response

      if (res.ok && result.status === "success") {
        setNotification({ message: "Email verified successfully! 🎉", type: "success" });
        setTimeout(() => navigate("/login"), 1000);
      } else if (result.status === "invalid_code") {
        setNotification({ message: "Invalid verification code.", type: "error" });
        const el = document.querySelector(`input[name="code"]`);
        if (el) el.classList.add("error-field");
      } else if (result.status === "expired") {
        setNotification({ message: "Verification code expired. Request a new one.", type: "error" });
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
          <h1>GapoTravels</h1>
          <p>Verify your email address</p>
        </div>

        <div className="form-card">
          <h2>Enter Verification Code</h2>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              name="code"
              placeholder="6-digit code"
              value={code}
              onChange={handleChange}
              maxLength={6}
            />
            <button type="submit">Verify</button>
          </form>

          <p className="resend-text">
            Didn't receive the code?{" "}
            <span
              className="back-link"
              onClick={async () => {
                try {
                  const res = await fetch("http://localhost:5000/api/email/send-code", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, user_id }),
                  });
                  if (res.ok) {
                    setNotification({ message: "Verification code resent!", type: "success" });
                  } else {
                    setNotification({ message: "Failed to resend code.", type: "error" });
                  }
                } catch {
                  setNotification({ message: "Network error", type: "error" });
                }
              }}
            >
              Resend
            </span>
          </p>

          <span
            className="back-link"
            onClick={() => navigate("/login")}
          >
            Back to Login
          </span>
        </div>
      </div>
    </div>
  );
}

export default VerificationForm;