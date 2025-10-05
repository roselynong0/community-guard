import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import TermsModal from "./TermsModal";
import "./RegistrationForm.css";
import "./Notification.css";

function RegistrationForm() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    email: "",
    password: "",
    confirmPassword: "",
    agree: false,
  });

  const [errors, setErrors] = useState({});
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [showTerms, setShowTerms] = useState(false);

  const [passwordStatus, setPasswordStatus] = useState({
    length: false,
    number: false,
    special: false,
    uppercase: false,
  });

  // Password rules functions
  const passwordRules = {
    length: (pw) => pw.length >= 8,
    number: (pw) => /\d/.test(pw),
    special: (pw) => /[!@#$%^&*(),.?":{}|<>]/.test(pw),
    uppercase: (pw) => /[A-Z]/.test(pw),
  };

  // Get live password validation status
  const getPasswordStatus = (pw) => ({
    length: passwordRules.length(pw),
    number: passwordRules.number(pw),
    special: passwordRules.special(pw),
    uppercase: passwordRules.uppercase(pw),
  });

  // Notification timeout
  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(
        () => setNotification({ message: "", type: "" }),
        4000
      );
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === "checkbox" ? checked : value;

    setFormData({ ...formData, [name]: newValue });

    if (errors[name]) setErrors({ ...errors, [name]: "" });

    if (name === "password") setPasswordStatus(getPasswordStatus(value));
  };

  // Form validation
  const validate = () => {
    const newErrors = {};

    if (!formData.firstname) newErrors.firstname = "First name is required";
    if (!formData.lastname) newErrors.lastname = "Last name is required";

    if (!formData.email) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email))
      newErrors.email = "Invalid email";

    if (!formData.password) newErrors.password = "Password is required";
    else {
      // Rules priority
      if (!passwordRules.length(formData.password))
        newErrors.password = "Password must be at least 8 characters";
      else if (!passwordRules.number(formData.password))
        newErrors.password = "Password must include at least one number";
      else if (!passwordRules.special(formData.password))
        newErrors.password =
          "Password must include at least one special character";
      else if (!passwordRules.uppercase(formData.password))
        newErrors.password =
          "Password must include at least one uppercase letter";
    }

    if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";

    if (!formData.agree) newErrors.agree = "You must agree to the terms";

    return newErrors;
  };

  const notify = (msg, type) => setNotification({ message: msg, type });

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      notify("Please fill out all required fields first.", "caution");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstname: formData.firstname,
          lastname: formData.lastname,
          email: formData.email,
          password: formData.password,
        }),
      });

      const result = await res.json();

      if (res.ok && result.status === "success") {
        notify("Account successfully registered! 🎉", "success");

        setFormData({
          firstname: "",
          lastname: "",
          email: "",
          password: "",
          confirmPassword: "",
          agree: false,
        });
        setErrors({});
        setPasswordStatus({
          length: false,
          number: false,
          special: false,
          uppercase: false,
        });

        setTimeout(() => navigate("/login"), 2000);
      } else if (result.status === "duplicate") {
        notify("This email is already registered!", "caution");
      } else {
        notify("❌ Something went wrong.", "error");
      }
    } catch (err) {
      notify("❌ Server error: " + err.message, "error");
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
          <p>Sign up and help keep your community safe.</p>
        </div>

        <div className="form-card">
          <h2>Create an Account</h2>

          <form onSubmit={handleSubmit}>
            <div className="name-row">
              <input
                type="text"
                name="firstname"
                placeholder="First Name"
                value={formData.firstname}
                onChange={handleChange}
              />
              <input
                type="text"
                name="lastname"
                placeholder="Last Name"
                value={formData.lastname}
                onChange={handleChange}
              />
            </div>
            <div className="error-row">
              {errors.firstname && <p className="error">{errors.firstname}</p>}
              {errors.lastname && <p className="error">{errors.lastname}</p>}
            </div>

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

            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={handleChange}
            />
            {errors.confirmPassword && (
              <p className="error">{errors.confirmPassword}</p>
            )}

            {/* Live password rules (after confirm password) */}
            <div className="password-rules">
              <p className={passwordStatus.length ? "valid" : ""}>
                • Minimum 8 characters
              </p>
              <p className={passwordStatus.number ? "valid" : ""}>
                • At least one number
              </p>
              <p className={passwordStatus.special ? "valid" : ""}>
                • At least one special character (!@#$%^&*...)
              </p>
              <p className={passwordStatus.uppercase ? "valid" : ""}>
                • At least one uppercase letter
              </p>
            </div>

            <label className="checkbox">
              <input
                type="checkbox"
                name="agree"
                checked={formData.agree}
                onChange={handleChange}
              />
              <span>
                I agree with{" "}
                <a
                  type="button"
                  className="terms-btn"
                  onClick={() => setShowTerms(true)}
                >
                  Terms & Conditions
                </a>
              </span>
            </label>
            {errors.agree && <p className="error">{errors.agree}</p>}

            <button type="submit">Sign Up</button>
            <Link to="/login?force=true" className="back-link">
              Go to Login
            </Link>
          </form>
        </div>
      </div>

      <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
    </div>
  );
}

export default RegistrationForm;