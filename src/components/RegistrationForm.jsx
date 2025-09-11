import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import TermsModal from './TermsModal';
import './RegistrationForm.css';

function RegistrationForm() {
  const [formData, setFormData] = useState({
    firstname: '',
    lastname: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    agree: false,
  });

  const [errors, setErrors] = useState({});
  const [showTerms, setShowTerms] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.firstname) newErrors.firstname = 'First name is required.';
    if (!formData.lastname) newErrors.lastname = 'Last name is required.';
    if (!formData.username) newErrors.username = 'Username is required.';
    if (!formData.email) newErrors.email = 'Email is required.';
    else if (!formData.email.includes('@')) newErrors.email = 'Email must contain @';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email format';
    if (!formData.password) newErrors.password = 'Password is required';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match.';
    if (!formData.agree) newErrors.agree = 'You must agree to the terms.';
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length === 0) {
      alert('Registration successful!');
      setFormData({
        firstname: '',
        lastname: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        agree: false,
      });
      setErrors({});
    } else {
      setErrors(validationErrors);
    }
  };

  return (
    <div className="background">
      <div className="wrapper">
        <div className="top-section">
          <h1>Community Guard</h1>
          <p>Sign up and help keep your community safe.</p>
        </div>

        <div className="form-card">
          <h2>Create an Account</h2>
          <form noValidate onSubmit={handleSubmit}>
            <div className="name-row">
              <input
                type="text"
                name="firstname"
                placeholder="First Name"
                value={formData.firstname}
                onChange={handleChange}
                className={errors.firstname ? 'is-invalid' : ''}
                required
              />

              <input
                type="text"
                name="lastname"
                placeholder="Last Name"
                value={formData.lastname}
                onChange={handleChange}
                className={errors.lastname ? 'is-invalid' : ''}
                required
              />
            </div>

            <div className="error-row">
              {errors.firstname && <p className="error-message">{errors.firstname}</p>}
              {errors.lastname && <p className="error-message">{errors.lastname}</p>}
            </div>

            <input
              type="text"
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleChange}
              className={errors.username ? 'is-invalid' : ''}
            />
            {errors.username && <p className="error-message">{errors.username}</p>}

            <input
              type="email"
              name="email"
              placeholder="Your Email Address"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? 'is-invalid' : ''}
            />
            {errors.email && <p className="error-message">{errors.email}</p>}

            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              className={errors.password ? 'is-invalid' : ''}
            />
            {errors.password && <p className="error-message">{errors.password}</p>}

            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={errors.confirmPassword ? 'is-invalid' : ''}
            />
            {errors.confirmPassword && <p className="error-message">{errors.confirmPassword}</p>}

            <label className="checkbox">
              <input
                type="checkbox"
                name="agree"
                checked={formData.agree}
                onChange={handleChange}
              />
              <span>
                I agree with{' '}
                <a
                  type="button"
                  className="terms-btn"
                  onClick={() => setShowTerms(true)}
                >
                  Terms & Conditions
                </a>
              </span>
            </label>

            {errors.agree && <p className="error-message">{errors.agree}</p>}

            <button type="submit">Sign Up</button>

            <Link to="/login" className="back-link">
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
