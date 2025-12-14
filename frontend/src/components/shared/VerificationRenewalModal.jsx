import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './VerificationRenewalModal.css';

function VerificationRenewalModal({ isOpen, onClose, userEmail, onRenewVerification, userID }) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleRenewVerification = async () => {
    setIsLoading(true);
    setMessage('');
    
    try {
      const response = await onRenewVerification();
      if (response.success) {
        setMessage('Verification email sent! Redirecting to verification page...');
        setTimeout(() => {
          onClose();
          navigate('/verify', {
            state: {
              email: userEmail,
              user_id: userID
            }
          });
        }, 1500);
      } else {
        setMessage(response.message || 'Failed to send verification email.');
      }
    } catch {
      setMessage('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2>Account Verification Required</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        
        <div className="modal-body">
          <div className="verification-icon">
            ⚠️
          </div>
          <p className="verification-message">
            Your account is not verified and your session has expired. 
            To continue using Community Guard, please verify your email address.
          </p>
          
          {userEmail && (
            <p className="email-display">
              We'll send a verification code to: <strong>{userEmail}</strong>
            </p>
          )}
          
          {message && (
            <div className={`message ${message.includes('sent') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}
        </div>
        
        <div className="modal-actions">
          <button 
            className="btn-secondary" 
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button 
            className="btn-primary" 
            onClick={handleRenewVerification}
            disabled={isLoading}
          >
            {isLoading ? 'Sending...' : 'Renew Verification'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default VerificationRenewalModal;