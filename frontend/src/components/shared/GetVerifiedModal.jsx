import React, { useState } from 'react';
import { FaTimes, FaUserCheck } from 'react-icons/fa';
import '../resident/Profile.css';
import './ModalPortal.css';

const BARANGAYS = [
  "Barretto", "East Bajac-Bajac", "East Tapinac", "Gordon Heights",
  "Kalaklan", "Mabayuan", "New Asinan", "New Banicain", "New Cabalan",
  "New Ilalim", "New Kababae", "New Kalalake", "Old Cabalan", "Pag-Asa",
  "Santa Rita", "West Bajac-Bajac", "West Tapinac",
];

export default function GetVerifiedModal({ open, onSkip, onProfileUpdate, user = {} }) {
  const [form, setForm] = useState({
    firstname: user.firstname || '',
    lastname: user.lastname || '',
    email: user.email || '',
    phone: user.phone || '',
    address_street: user.address_street || '',
    address_barangay: user.address_barangay || '',
    bio: user.bio || '',
    birthdate: user.birthdate || ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  if (!open) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const ok = await onProfileUpdate(form);
      if (ok) {
        setSuccessMsg('Profile updated successfully — continuing...');
      } else {
        setSuccessMsg('Failed to update profile');
      }
    } catch (e) {
      console.error(e);
      setSuccessMsg('Failed to update profile');
    } finally {
      setSubmitting(false);
      setTimeout(() => setSuccessMsg(''), 1200);
    }
  };

  return (
    <div className="portal-modal-overlay" onClick={onSkip}>
      <div className="portal-modal" style={{ maxWidth: '520px', borderLeftColor: '#28a745' }} role="dialog" aria-modal="true" aria-labelledby="get-verified-title" onClick={(e) => e.stopPropagation()}>
        <div className="portal-modal-header">
          <h3 id="get-verified-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FaUserCheck style={{ color: '#28a745' }} /> Get Verified
          </h3>
          <button className="portal-modal-close" onClick={onSkip} aria-label="Close modal">
            <FaTimes />
          </button>
        </div>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>Only verified users can upload reports, create community posts, and update profiles. Please complete or confirm your profile details to get verified.</p>

        <div className="address-fields" style={{marginTop:12, maxHeight: 'calc(70vh - 180px)', overflowY: 'auto'}}>
          <label>First name</label>
          <input name="firstname" value={form.firstname} onChange={handleChange} placeholder="Enter your first name" />

          <label>Last name</label>
          <input name="lastname" value={form.lastname} onChange={handleChange} placeholder="Enter your last name" />

          <label>Email</label>
          <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="Enter your email" />

          <label>Phone</label>
          <input name="phone" value={form.phone} onChange={handleChange} placeholder="Enter your phone number" />

          <label>Street address</label>
          <input name="address_street" value={form.address_street} onChange={handleChange} placeholder="Enter your street address" />

          <label>Barangay</label>
          <select name="address_barangay" value={form.address_barangay} onChange={handleChange}>
            <option value="">Select barangay</option>
            {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          <label>Birthdate</label>
          <input type="date" name="birthdate" value={form.birthdate} onChange={handleChange} />

          <label>Short bio</label>
          <textarea name="bio" value={form.bio} onChange={handleChange} rows={3} placeholder="Tell us about yourself..." />
        </div>

        <div className="portal-modal-actions" style={{marginTop:12}}>
          <button className="cancel-btn" onClick={onSkip} disabled={submitting}>Skip for now</button>
          <button className="confirm-btn" onClick={handleSave} disabled={submitting} style={{background: 'linear-gradient(135deg, #28a745, #20c997)'}}>
            {submitting ? 'Saving…' : 'Update & Verify'}
          </button>
        </div>
        {successMsg && <div style={{marginTop:10,fontWeight:600, textAlign: 'center', color: successMsg.includes('success') ? '#28a745' : '#dc3545'}}>{successMsg}</div>}
      </div>
    </div>
  );
}
