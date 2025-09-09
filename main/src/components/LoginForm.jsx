import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // ✅ import useNavigate
import './RegistrationForm.css'; // or AuthForm.css

function LoginForm() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState({});

  const navigate = useNavigate(); // ✅ create navigate instance

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.password) newErrors.password = 'Password is required';
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length === 0) {
      alert('Login successful!');
      // ✅ Navigate to Home after successful login
      navigate('/home'); // Replace '/home' with your actual Home route
    } else {
      setErrors(validationErrors);
    }
  };

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
