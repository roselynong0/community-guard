import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaEdit, FaSignOutAlt, FaTrashAlt } from "react-icons/fa";
import "./Profile.css"; // Ensure this file contains the new CSS
import "./Notifications.css"; // This is the file with the notif classes
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css"
import { format, parseISO } from "date-fns";
import axios from "axios";


function Profile({ token }) {
    const navigate = useNavigate();

    // ------------------- STATES -------------------
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [profilePic, setProfilePic] = useState(null);
    const [fullScreenImage, setFullScreenImage] = useState(null);
    const [showModal, setShowModal] = useState(null); // "header", "about", "personal"
    const [showDeleteAccount, setShowDeleteAccount] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [reports, setReports] = useState([]);
    const [reportsSubmitted, setReportsSubmitted] = useState(0);
    const [reportsResolved, setReportsResolved] = useState(0);

    const [editProfileData, setEditProfileData] = useState({
      firstname: "",
      lastname: "",
      bio: "",
      phone: "",
      address_street: "",
      address_barangay: "",
      email: "",
      birthdate: "",
    });

    const API_URL = "http://localhost:5000/api"; // adjust as needed
    const barangays = [
      "All", "Barretto", "East Bajac-Bajac", "East Tapinac", "Gordon Heights",
      "Kalaklan", "Mabayuan", "New Asinan", "New Banicain", "New Cabalan",
      "New Ilalim", "New Kababae", "New Kalalake", "Old Cabalan", "Pag-Asa",
      "Santa Rita", "West Bajac-Bajac", "West Tapinac",
    ];

    const displayField = (field, placeholder) => field || placeholder;

    // MODIFIED: Adjusting notification type logic to match CSS
    const addNotification = (message, type = "error") => {
      const id = Date.now();
      setNotifications((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, 5000);
    };

  // ------------------- FETCH PROFILE -------------------
  useEffect(() => {
    if (!token) return;

    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API_URL}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.status === "success") {
          const profile = data.profile;
          setUser({
            ...profile,
            address_barangay: profile.address_barangay || "Barretto",
            address_city: profile.address_city || "Olongapo",
            role: "Resident",
            contact: profile.phone || "",
          });
          setEditProfileData({
            firstname: profile.firstname || "",
            lastname: profile.lastname || "",
            bio: profile.bio || "",
            phone: profile.phone || "",
            address_street: profile.address_street || "",
            address_barangay: profile.address_barangay || "Barretto",
            email: profile.email || "",
            birthdate: profile.birthdate || "",
          });
        }
      } catch (err) {
        console.error("Failed to fetch profile:", err);
        addNotification("Failed to load profile.", "error");
      } finally {
        setIsLoading(false);
      }
    };

    const fetchReports = async () => {
      try {
        const res = await fetch(`${API_URL}/reports`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.status === "success") {
          setReports(data.reports);
        } else {
          addNotification("Failed to fetch reports.", "error");
        }
      } catch (err) {
        console.error("Failed to fetch reports:", err);
      }
    };

    const fetchUserStats = async () => {
      try {
        const res = await axios.get(`${API_URL}/stats/user`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.status === "success") {
          setReportsSubmitted(res.data.totalReports);
          setReportsResolved(res.data.resolved);
        }
      } catch (err) {
        console.error("Failed to fetch user stats:", err);
      }
    };

    fetchProfile();
    fetchReports();
    fetchUserStats();
  }, [token]);

  // ------------------- UPDATE REPORTS STATS -------------------
  useEffect(() => {
    if (!user) return;
    const userReports = reports.filter(r => String(r.user_id) === String(user.id));
    setReportsSubmitted(userReports.length);
    setReportsResolved(userReports.filter(r => (r.status || "").toLowerCase() === "resolved").length);
  }, [reports, user]);

  // ------------------- PROFILE PICTURE -------------------
  const handlePicUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProfilePic(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append("avatar", file);
    try {
      const res = await fetch(`${API_URL}/profile/upload-avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.status === "success") {
        setProfilePic(null);
        setUser(prev => ({ ...prev, avatar_url: data.url || data.avatar_url }));
      }
    } catch (err) {
      console.error("Failed to upload avatar:", err);
    }
  };

  // ------------------- DELETE ACCOUNT -------------------
  const handleDeleteAccount = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/profile", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.status === "success") {
        navigate("/login"); // cascades to info & reports
      } else {
        addNotification("Failed to delete account. Please try again.", "error");
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    }
  };


// ------------------- UPDATE PROFILE -------------------
const handleProfileUpdate = async () => {
  if (!user) return;

  let updateFields = {};

  // ---------------- HEADER MODAL ----------------
  if (showModal === "header") {
    const { firstname, lastname, address_barangay } = editProfileData;
    if (firstname !== user.firstname) updateFields.firstname = firstname;
    if (lastname !== user.lastname) updateFields.lastname = lastname;
    if (address_barangay !== user.address_barangay)
      updateFields.address_barangay = address_barangay;

    // Optional: fixed city, send only if it differs
    if ((editProfileData.address_city || "Olongapo City") !== (user.address_city || "Olongapo City"))
      updateFields.address_city = editProfileData.address_city || "Olongapo City";
  }

  // ---------------- ABOUT MODAL ----------------
  else if (showModal === "about") {
    if (editProfileData.bio !== user.bio) updateFields.bio = editProfileData.bio;
  }

  // ---------------- PERSONAL MODAL ----------------
  else if (showModal === "personal") {
    const { email, phone, address_street, birthdate } = editProfileData;
    if (email !== user.email) updateFields.email = email;
    if (phone !== user.phone) updateFields.phone = phone;
    if (address_street !== user.address_street) updateFields.address_street = address_street;
    if (birthdate !== user.birthdate) updateFields.birthdate = birthdate;
  }

  // ---------------- NO CHANGES ----------------
  if (Object.keys(updateFields).length === 0) {
    addNotification("No changes detected.", "info");
    setShowModal(null);
    return;
  }

  try {
    const res = await fetch(`${API_URL}/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updateFields),
    });

    const data = await res.json();

    if (data.status === "success") {
      setUser((prev) => ({
        ...prev,
        ...data.profile,
        avatar_url: data.profile.avatar_url || prev.avatar_url,
        role: prev?.role || "Resident",
        phone: data.profile.phone ?? prev.phone ?? "",      // main contact field
        address_street: data.profile.address_street ?? prev.address_street ?? "",
        address_barangay: data.profile.address_barangay ?? prev.address_barangay ?? "",
        birthdate: data.profile.birthdate ?? prev.birthdate ?? "",
        email: data.profile.email ?? prev.email ?? "",
      }));

      setEditProfileData((prev) => ({
        ...prev,
        ...data.profile,
        phone: data.profile.phone ?? prev.phone ?? "",
        address_street: data.profile.address_street ?? prev.address_street ?? "",
        address_barangay: data.profile.address_barangay ?? prev.address_barangay ?? "",
        birthdate: data.profile.birthdate ?? prev.birthdate ?? "",
        email: data.profile.email ?? prev.email ?? "",
      }));

      setShowModal(null);
      addNotification("✓ Profile updated successfully!", "success");
    }
    else {
          addNotification("Failed to update profile.", "error");
          console.error(data);
        }
      } catch (err) {
        addNotification("Server error.", "error");
        console.error(err);
      }
    };

// Filter reports for the logged-in user
if (isLoading) return (
  <div className="loading-container">
    <div className="spinner"></div>
    <p>Loading profile...</p>
  </div>
);

if (!user) return <p className="error-message">Failed to load profile or unauthorized.</p>;

return (
  <div className="profile-page">
    {/* MODIFIED: Adjusted notification JSX to use provided CSS classes */}
      {notifications.map((notif) => (
        <div key={notif.id} className={`notif notif-${notif.type}`}>
          {notif.message}
        </div>
      ))}

      {/* HEADER - Apply fade-in-up animation and stagger delay */}
      <div className="profile-header-card fade-in-up" style={{ animationDelay: '0s' }}>
        <div className="profile-header-info">
          <img
            src={profilePic ? profilePic : user?.avatar_url || "/default-avatar.png"}
            alt="Profile"
            className="profile-avatar"
          />
          <div className="profile-name">
          <h2>
            {displayField(user.firstname, "No Name")} {displayField(user.lastname, "")}
            <FaEdit className="edit-icon" onClick={() => setShowModal("header")} />
          </h2>
          <p>
            {displayField(user.address_barangay, "No barangay selected")}, Olongapo City
          </p>
          <span className="role-badge">{user.role}</span>
        </div>
        </div>

        <div className="profile-header-actions">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label className="upload-btn flex-grow">
              Change Photo
              <input type="file" accept="image/*" onChange={handlePicUpload} hidden />
            </label>
            <button
              className="icon-btn trash-btn"
              onClick={() => setShowDeleteAccount(true)}
              title="Delete Account"
            >
              <FaTrashAlt />
            </button>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="profile-content">
        {/* SIDEBAR */}
        <div className="profile-sidebar">
          {/* Card 1 - Apply stagger delay */}
          <div className="profile-card fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="card-header">
              <h3>
                About <FaEdit className="edit-icon" onClick={() => setShowModal("about")} />
              </h3>
            </div>
            <p>{displayField(user.bio, "No information added yet.")}</p>
          </div>

          {/* Card 2 - Apply stagger delay */}
          <div className="profile-card fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="card-header">
              <h3>
                Personal Info{" "}
                <FaEdit className="edit-icon" onClick={() => setShowModal("personal")} />
              </h3>
            </div>
            <p>
              <strong>Email:</strong> {displayField(user.email, "No info")}
            </p>
            <p>
              <strong>Contact:</strong> {displayField(user.contact, "No info")}
            </p>
            <p>
              <strong>Address:</strong> {displayField(user.address_street, "No location")}
            </p>
            <p>
              <strong>City:</strong> Olongapo City
            </p>
            <p>
              <strong>Birthday:</strong>{" "}
              {user.birthdate
                ? format(parseISO(user.birthdate), "MMMM d, yyyy") // "1999-07-15" → "July 15, 1999"
                : "No birthday set"}
            </p>
            </div>

          {/* Profile Card */}
            <div className="profile-card fade-in-up" style={{ animationDelay: '0.3s' }}>
              <h3>Activity</h3>
              <p>📌 Reports Submitted: <strong>{reportsSubmitted}</strong></p>
              <p>✅ Reports Resolved: <strong>{reportsResolved}</strong></p>
            </div>
        </div>


      </div>

      {/* ------------------- PROFILE MODAL ------------------- */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Edit Profile</h2>

            {/* HEADER EDIT */}
            {showModal === "header" && (
              <div className="address-fields">
                <label htmlFor="firstname">First Name:</label>
                <input
                  placeholder="First Name"
                  value={editProfileData.firstname}
                  onChange={(e) =>
                    setEditProfileData({ ...editProfileData, firstname: e.target.value })
                  }
                />
                <label htmlFor="lastname">Last Name:</label>
                <input
                  placeholder="Last Name"
                  value={editProfileData.lastname}
                  onChange={(e) =>
                    setEditProfileData({ ...editProfileData, lastname: e.target.value })
                  }
                />
                <label htmlFor="barangay">Barangay:</label>
                <select
                  value={editProfileData.address_barangay || "No barangay set"}
                  onChange={(e) =>
                    setEditProfileData({ ...editProfileData, address_barangay: e.target.value })
                  }
                >
                  <option value="No barangay set" disabled>Select barangay</option>
                  {barangays.filter((b) => b !== "All").map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <label htmlFor="city">City:</label>
                <input value="Olongapo City" disabled className="readonly-field" />
              </div> 
            )}

            {/* ABOUT */}
            {showModal === "about" && (
              <textarea
                placeholder="About Me"
                value={editProfileData.bio}
                onChange={(e) =>
                  setEditProfileData({ ...editProfileData, bio: e.target.value })
                }
              />
            )}

            {/* PERSONAL */}
            {showModal === "personal" && (
              <div className="address-fields">
                <label htmlFor="email">Email:</label>
                <input
                  placeholder="Email"
                  value={editProfileData.email}
                  onChange={(e) =>
                    setEditProfileData({ ...editProfileData, email: e.target.value })
                  }
                />
                <label htmlFor="phone">Phone:</label>
                <input
                  placeholder="Phone"
                  value={editProfileData.phone}
                  onChange={(e) =>
                    setEditProfileData({ ...editProfileData, phone: e.target.value })
                  }
                />
                <label htmlFor="address">Address:</label>
                <input
                  placeholder="Address"
                  value={editProfileData.address_street}
                  onChange={(e) =>
                    setEditProfileData({ ...editProfileData, address_street: e.target.value })
                  }
                />
                <label htmlFor="city">City</label>
                <input value="Olongapo City" disabled className="readonly-field" />
                <label>Birthdate:</label>
                <DatePicker
                  selected={
                    editProfileData.birthdate
                      ? parseISO(editProfileData.birthdate)
                      : null
                  }
                  onChange={(date) =>
                    setEditProfileData({
                      ...editProfileData,
                      birthdate: format(date, "yyyy-MM-dd"),
                    })
                  }
                  dateFormat="yyyy-MM-dd"
                  showYearDropdown
                  scrollableYearDropdown
                />
              </div>
            )}

            {/* MODAL ACTIONS */}
            <div className="modal-buttons">
              <button onClick={() => setShowModal(null)}>Cancel</button>
              <button onClick={handleProfileUpdate}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------- DELETE ACCOUNT MODAL ------------------- */}
        {showDeleteAccount && (
          <div className="modal-overlay">
            <div className="modal-content">
              <p>Are you sure you want to delete your account? This cannot be undone.</p>
              <div className="modal-actions">
                <button onClick={handleDeleteAccount} style={{ background: "#e74c3c", color: "#fff" }}>
                  Yes, Delete
                </button>
                <button onClick={() => setShowDeleteAccount(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

      {/* ------------------- FULLSCREEN IMAGE MODAL ------------------- */}
      {fullScreenImage && (
        <div
          className="fullscreen-modal"
          onClick={() => setFullScreenImage(null)}
        >
          <img src={fullScreenImage} alt="fullscreen" className="fullscreen-image" />
        </div>
      )}

    </div>
  );
}

export default Profile;