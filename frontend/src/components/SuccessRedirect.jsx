import React from 'react';
import { FaCheckCircle } from 'react-icons/fa';
import './LoadingScreen.css';

export default function SuccessRedirect({ message = 'Success! Redirecting you now...' }) {
  return (
    <div className="loading-screen success-screen" role="status" aria-live="polite">
      <div className="loading-backdrop" />
      <div className="loading-content">
        <FaCheckCircle className="success-icon" />
        <h2 className="loading-title">{message}</h2>
      </div>
    </div>
  );
}
