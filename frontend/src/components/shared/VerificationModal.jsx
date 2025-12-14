import React from 'react';
import { useNavigate } from 'react-router-dom';
import './VerificationModal.css';

export default function VerificationModal({ open, onClose, user }) {
  const navigate = useNavigate();
  if (!open || !user) return null;

  const handleEditProfile = () => {
    onClose();
    navigate('/profile');
  };

  const handleVerifyNow = () => {
    onClose();
    try {
      navigate('/verify');
    } catch {
      navigate('/profile');
    }
  };

  return (
    <div className="verify-overlay">
      <div className="verify-modal">
        <header className="verify-header">
          <h3>Community Helper noticed your verification status</h3>
          <p className="muted">We see your account is partially verified. Completing verification helps your barangay trust reports you send.</p>
        </header>

        <div className="verify-body">
          <div className="verify-info">
            <div className="row"><strong>Name:</strong> {user.firstname} {user.lastname}</div>
            <div className="row"><strong>Email:</strong> {user.email || '—'}</div>
            <div className="row"><strong>Barangay:</strong> {user.address_barangay || '—'}</div>
            <div className="row"><strong>Phone:</strong> {user.phone || '—'}</div>
          </div>

          <div className="verify-actions">
            <button className="primary" onClick={handleVerifyNow}>Verify Now</button>
            <button onClick={handleEditProfile}>Edit Profile</button>
            <button className="ghost" onClick={onClose}>Skip for now</button>
          </div>
        </div>
      </div>
    </div>
  );
}