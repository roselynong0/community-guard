import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './RegistrationForm.css'; 

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(''); 
    setMessage(''); 

    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    console.log('Password reset request for:', email);

    setMessage('If your email is registered, you will receive a password reset link shortly.');
    setEmail(''); 
  };

  return (
    <div className="background">
      <div className="wrapper">
        <div className="top-section">
          <h1>Community Guard</h1>
          <p>Reset Your Password</p>
        </div>

        <div className="form-card">
          <h2>Forgot Password</h2>
          <form onSubmit={handleSubmit}>
            <p>Enter your email address to receive a password reset link.</p>
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className="error">{error}</p>}
            {message && <p className="success-message">{message}</p>}

            <button type="submit">Send Reset Link</button>

            <Link to="/login" className="back-link">
              Back to Login
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;