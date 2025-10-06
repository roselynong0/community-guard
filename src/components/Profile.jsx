import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaEdit, FaSignOutAlt, FaTrashAlt } from "react-icons/fa";
import "./Profile.css";
import "./Notifications.css";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css"
import { format, parseISO } from "date-fns";


function Profile({ token }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);

  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profilePic, setProfilePic] = useState(null);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showModal, setShowModal] = useState(null); // "header", "about", "personal"
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const displayField = (field, placeholder) => field || placeholder;

  const [reports, setReports] = useState([]);

  const [editProfileData, setEditProfileData] = useState({
    firstname: "",
    lastname: "",
    bio: "",
    phone: "",
    address_street: "",
    address_barangay: "",
    email: "",
  });

  const barangays = [
    "All", "Barretto", "East Bajac-Bajac", "East Tapinac", "Gordon Heights",
    "Kalaklan", "Mabayuan", "New Asinan", "New Banicain", "New Cabalan",
    "New Ilalim", "New Kababae", "New Kalalake", "Old Cabalan", "Pag-Asa",
    "Santa Rita", "West Bajac-Bajac", "West Tapinac",
  ];

  const addNotification = (message, type = "error") => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);
    // auto remove after 5s
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  // ------------------- FETCH PROFILE -------------------
useEffect(() => {
  if (!token) return;

  const fetchProfile = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/profile", {
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
    } finally {
      setIsLoading(false);
    }
  };

  fetchProfile();
}, [token]);

useEffect(() => {
  if (!token) return;

  const fetchReports = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/reports", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.status === "success") {
        setReports(data.reports); // assuming backend returns an array in data.reports
      } else {
        addNotification("Failed to fetch reports", "error");
      }
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    }
  };

  fetchReports();
}, [token]);


  // ------------------- PROFILE PICTURE -------------------
  const handlePicUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setProfilePic(url);

    const formData = new FormData();
    formData.append("avatar", file);
    try {
      const res = await fetch("http://localhost:5000/api/profile/upload-avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.status === "success") {
        setProfilePic(null); // clear preview
        setUser((prev) => ({
          ...prev,
          avatar_url: data.url || data.avatar_url,
        }));
      }
    } catch (err) {
      console.error("Failed to upload avatar:", err);
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    navigate("/login");
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
  const updateFields = {
    firstname: editProfileData.firstname,
    lastname: editProfileData.lastname,
    bio: editProfileData.bio,
    phone: editProfileData.phone,
    address_street: editProfileData.address_street,
    address_barangay: editProfileData.address_barangay,
    email: editProfileData.email,
    birthdate: editProfileData.birthdate || null,
  };

  try {
    const res = await fetch("http://localhost:5000/api/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updateFields),
    });
    const data = await res.json();

    if (data.status === "success") {
      setUser(data.profile); // always update from backend
      setEditProfileData(data.profile); 
      setShowModal(null);
      addNotification("Profile updated successfully!", "success");
    } else {
      addNotification("Failed to update profile.", "error");
      console.error(data);
    }
  } catch (err) {
    addNotification("Server error.", "error");
    console.error(err);
  }
};

const userReports = reports.filter(r => String(r.user) === String(user?.id));

const reportsSubmitted = userReports.length;
const reportsResolved = userReports.filter(r => r.status === "Resolved").length;

if (isLoading) return <p className="loading-message">Loading profile...</p>;
if (!user) return <p className="error-message">Failed to load profile or unauthorized.</p>;

return (
  <div className="profile-page">
    <div className="notifications-page">
      {notifications.map((notif) => (
        <div key={notif.id} className={`notification-item ${notif.type === "error" ? "unread" : ""}`}>
          {notif.message}
        </div>
      ))}
    </div>

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
          <button
            className="account-btn logout-btn-mobile"
            onClick={() => setShowLogoutConfirm(true)}
          >
            <FaSignOutAlt /> Logout
          </button>
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

          {/* Card 3 - Apply stagger delay */}
          <div className="profile-card fade-in-up" style={{ animationDelay: '0.3s' }}>
            <h3>Activity</h3>
            <p>
              📌 Reports Submitted: <strong>{reportsSubmitted}</strong>
            </p>
            <p>
              ✅ Reports Resolved: <strong>{reportsResolved}</strong>
            </p>
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
                <input
                  placeholder="First Name"
                  value={editProfileData.firstname}
                  onChange={(e) =>
                    setEditProfileData({ ...editProfileData, firstname: e.target.value })
                  }
                />
                <input
                  placeholder="Last Name"
                  value={editProfileData.lastname}
                  onChange={(e) =>
                    setEditProfileData({ ...editProfileData, lastname: e.target.value })
                  }
                />
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
                <input
                  placeholder="Email"
                  value={editProfileData.email}
                  onChange={(e) =>
                    setEditProfileData({ ...editProfileData, email: e.target.value })
                  }
                />
                <input
                  placeholder="Phone"
                  value={editProfileData.phone}
                  onChange={(e) =>
                    setEditProfileData({ ...editProfileData, phone: e.target.value })
                  }
                />
                <input
                  placeholder="Address"
                  value={editProfileData.address_street}
                  onChange={(e) =>
                    setEditProfileData({ ...editProfileData, address_street: e.target.value })
                  }
                />
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

      {/* ------------------- LOGOUT CONFIRM MODAL ------------------- */}
      {showLogoutConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <p>Are you sure you want to logout?</p>
            <div className="modal-actions">
              <button onClick={handleLogout}>Yes, Logout</button>
              <button onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
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