import React, { useState } from 'react';
import './Profile.css';

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
    <div className="modal-overlay">
      <div className="modal get-verified-modal" role="dialog" aria-modal="true" aria-labelledby="get-verified-title">
        <h2 id="get-verified-title">Get Verified</h2>
        <p className="muted">Only verified users can upload reports, create community posts, and update profiles. Please complete or confirm your profile details to get verified.</p>

        <div className="address-fields" style={{marginTop:12}}>
          <label>First name</label>
          <input name="firstname" value={form.firstname} onChange={handleChange} />

          <label>Last name</label>
          <input name="lastname" value={form.lastname} onChange={handleChange} />

          <label>Email</label>
          <input name="email" value={form.email} onChange={handleChange} />

          <label>Phone</label>
          <input name="phone" value={form.phone} onChange={handleChange} />

          <label>Street address</label>
          <input name="address_street" value={form.address_street} onChange={handleChange} />

          <label>Barangay</label>
          <select name="address_barangay" value={form.address_barangay} onChange={handleChange}>
            <option value="">Select barangay</option>
            {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          <label>Birthdate</label>
          <input type="date" name="birthdate" value={form.birthdate} onChange={handleChange} />

          <label>Short bio</label>
          <textarea name="bio" value={form.bio} onChange={handleChange} rows={3} />
        </div>

        <div className="modal-buttons" style={{marginTop:12}}>
          <button onClick={onSkip} disabled={submitting}>Proceed anyway.</button>
          <button onClick={handleSave} disabled={submitting} style={{background:'#2d2d73',color:'#fff'}}>{submitting ? 'Saving…' : 'Update & Verify'}</button>
        </div>
        {successMsg && <div style={{marginTop:10,fontWeight:600}}>{successMsg}</div>}
      </div>
    </div>
  );
}
