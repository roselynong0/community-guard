import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaEdit, FaSignOutAlt, FaTrashAlt } from "react-icons/fa";
import "./Profile.css";

function Profile({ token }) {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [profilePic, setProfilePic] = useState(null);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showModal, setShowModal] = useState(null); // "header", "about", "personal"
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);

  const [reports, setReports] = useState([]);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [newReport, setNewReport] = useState({
    title: "",
    description: "",
    category: "Concern",
    addressStreet: "",
    barangay: "Barretto",
    images: [],
    date: new Date().toISOString(),
    user: null,
    status: "Pending",
  });
  const [editReportId, setEditReportId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [expandedReports, setExpandedReports] = useState([]);

  const [editProfileData, setEditProfileData] = useState({
    firstname: "",
    lastname: "",
    bio: "",
    phone: "",
    address_street: "",
    address_barangay: "Barretto",
    email: "",
  });

  const barangays = [
    "All", "Barretto", "East Bajac-Bajac", "East Tapinac", "Gordon Heights",
    "Kalaklan", "Mabayuan", "New Asinan", "New Banicain", "New Cabalan",
    "New Ilalim", "New Kababae", "New Kalalake", "Old Cabalan", "Pag-Asa",
    "Santa Rita", "West Bajac-Bajac", "West Tapinac",
  ];

  // ------------------- FETCH PROFILE -------------------
  useEffect(() => {
    if (!token) {
      setIsLoading(false); // Stop loading if no token
      return;
    }

    const fetchProfile = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.status === "success") {
          const profile = data.profile;
          setUser({
            id: profile.id,
            firstname: profile.firstname,
            lastname: profile.lastname,
            email: profile.email,
            address_street: profile.address_street || "",
            avatar_url: profile.avatar_url,
            role: "Resident",
            bio: profile.bio || "",
            contact: profile.phone || "",
            address_barangay: profile.address_barangay || "Barretto",
            address_city: profile.address_city || "Olongapo",
          });
          setEditProfileData({
            firstname: profile.firstname || "",
            lastname: profile.lastname || "",
            bio: profile.bio || "",
            phone: profile.phone || "",
            address_street: profile.address_street || "",
            address_barangay: profile.address_barangay || "Barretto",
            email: profile.email || "",
          });
        }
      } catch (err) {
        console.error("Failed to fetch profile:", err);
      } finally {
        setIsLoading(false); // 👈 Set to false after profile fetch attempt
      }
    };

    fetchProfile();
  }, [token]);

  // ------------------- FETCH REPORTS -------------------
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
            id: profile.id,
            firstname: profile.firstname,
            lastname: profile.lastname,
            email: profile.email,
            address_street: profile.address_street || "",
            barangay: profile.barangay || "Barretto",
            avatar_url: profile.avatar_url,
            role: "Resident",
            bio: profile.bio || "",
            contact: profile.phone || "",
            address_barangay: profile.address_barangay || "",
            address_city: profile.address_city || "Olongapo",
          });
          setEditProfileData({
            firstname: profile.firstname || "",
            lastname: profile.lastname || "",
            bio: profile.bio || "",
            phone: profile.phone || "",
            address_street: profile.address_street || "",
            address_barangay: profile.barangay || "Barretto",
          });
        }
      } catch (err) {
        console.error("Failed to fetch profile:", err);
      }
    };

    fetchProfile();
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

  // ------------------- REPORT HANDLERS -------------------
  const handleReportInputChange = (field, value) => {
    setNewReport((prev) => ({ ...prev, [field]: value }));
  };

  const resetNewReport = () => {
    setNewReport({
      title: "",
      description: "",
      category: "Concern",
      addressStreet: "",
      barangay: "Barretto",
      images: [],
      date: new Date().toISOString(),
      user: user?.id || null,
      status: "Pending",
    });
  };

  const handleAddOrUpdateReport = () => {
    if (editReportId) {
      setReports(
        reports.map((r) => (r.id === editReportId ? { ...r, ...newReport } : r))
      );
    } else {
      const newId = reports.length + 1;
      const report = { id: newId, ...newReport };
      setReports([report, ...reports]);
    }
    setIsReportModalOpen(false);
    setEditReportId(null);
    resetNewReport();
  };

  const handleEdit = (report) => {
    setNewReport(report);
    setEditReportId(report.id);
    setIsReportModalOpen(true);
  };

  const handleDelete = () => {
    setReports(reports.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
    setIsDeleteConfirmOpen(false);
  };

  const toggleExpand = (id) => {
    setExpandedReports((prev) =>
      prev.includes(id) ? prev.filter((rid) => rid !== id) : [...prev, id]
    );
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.status === "success") {
        navigate("/login");
      } else {
        alert("Failed to delete account. Please try again.");
      }
    } catch (err) {
      alert("Server error. Please try again later.");
    }
  };

  // ------------------- UPDATE PROFILE -------------------
  const handleProfileUpdate = async () => {
    let updateFields = {};
    if (showModal === "header") {
      updateFields = {
        firstname: editProfileData.firstname,
        lastname: editProfileData.lastname,
        address_barangay: editProfileData.address_barangay,
      };
    } else if (showModal === "about") {
      updateFields = {
        bio: editProfileData.bio,
      };
    } else if (showModal === "personal") {
      updateFields = {
        email: editProfileData.email,
        phone: editProfileData.phone,
        address_street: editProfileData.address_street,
      };
    }

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
        const updatedProfile = data.profile || editProfileData;

        setUser((prev) => ({
          ...prev,
          firstname: updatedProfile.firstname,
          lastname: updatedProfile.lastname,
          bio: updatedProfile.bio,
          contact: updatedProfile.phone,
          address_street: updatedProfile.address_street,
          barangay: updatedProfile.address_barangay,
          email: updatedProfile.email,
        }));

        setShowModal(null);
      } else {
        console.error("Failed to update:", data);
        alert("Failed to update profile. Please try again.");
      }
    } catch (err) {
      console.error("Error updating profile:", err);
      alert("Server error. Please try again later.");
    }
  };





  const displayField = (field, fallback) =>
    field !== undefined && field !== null && field !== "" ? field : fallback;

  const userReports = reports
    .filter((r) => String(r.user) === String(user?.id))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const reportsSubmitted = userReports.length || 0;
  const reportsResolved =
    userReports.filter((r) => r.status === "Resolved")?.length || 0;

  // 👈 LOADING FIX: Show loading indicator if still loading
  if (isLoading) return <p className="loading-message">Loading profile...</p>;

  // 👈 LOADING FIX: Show message if loading is done but no user data (e.g., failed to fetch or no token)
  if (!user) return <p className="error-message">Failed to load profile or unauthorized.</p>;

  return (
    <div className="profile-page">
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
            className="account-btn add-report-btn"
            onClick={() => {
              resetNewReport();
              setEditReportId(null);
              setIsReportModalOpen(true);
            }}
          >
            + Add Report
          </button>
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

        {/* POSTS */}
        <div className="profile-posts">
          {userReports.length === 0 && <p>No reports posted.</p>}
          {userReports.map((report, index) => {
            const isExpanded = expandedReports.includes(report.id);
            const displayDescription = isExpanded
              ? report.description
              : `${report.description.slice(0, 130)}${
                  report.description.length > 130 ? "..." : ""
                }`;

            return (
              // Individual report cards with further staggered delay
              <div 
                key={report.id} 
                className="profile-card post report-card fade-in-up" 
                style={{ animationDelay: `${0.4 + index * 0.05}s` }}
              >
                <div className="report-header">
                  <div className="report-header-left">
                    <img
                      src={profilePic || "/default-avatar.png"}
                      alt="profile"
                      className="profile-pic"
                    />
                    <div className="report-header-text">
                      <p className="report-user">
                        {displayField(user.firstname, "No Name")} {displayField(user.lastname, "")}
                      </p>
                      <p className="report-subinfo">
                        {new Date(report.date).toLocaleString()} · {report.category}
                      </p>
                      <p className="report-address-info">
                        {report.addressStreet || "No location"} , {report.barangay}
                      </p>
                    </div>
                  </div>

                  <div className="report-header-actions">
                    <button onClick={() => handleEdit(report)}>
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => {
                        setDeleteTarget(report);
                        setIsDeleteConfirmOpen(true);
                      }}
                    >
                      <FaTrashAlt />
                    </button>
                  </div>
                </div>

                <div className="report-body">
                  <p>{displayDescription}</p>
                  {report.description.length > 130 && (
                    <button onClick={() => toggleExpand(report.id)}>
                      {isExpanded ? "Show Less" : "Read More"}
                    </button>
                  )}
                  {report.images.map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt="report"
                      className="report-image"
                      onClick={() => setFullScreenImage(img)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODALS (omitted for brevity, as they don't affect main content) */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Edit Profile</h2>

            {/* HEADER */}
            {showModal === "header" && (
              <>
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
                  value={editProfileData.address_barangay}
                  onChange={(e) =>
                    setEditProfileData({ ...editProfileData, address_barangay: e.target.value })
                  }
                >
                  {barangays
                    .filter((b) => b !== "All")
                    .map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                </select>
                <input
                  value="Olongapo City"
                  disabled
                  style={{ background: "#f5f5f5", color: "#888" }}
                />
              </>
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
              <>
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
                <input
                  value="Olongapo City"
                  disabled
                  style={{ background: "#f5f5f5", color: "#888" }}
                />
              </>
            )}

            <div className="modal-actions">
              <button onClick={handleProfileUpdate}>Save</button>
              <button onClick={() => setShowModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}


      {fullScreenImage && (
        <div className="modal-overlay" onClick={() => setFullScreenImage(null)}>
          <img src={fullScreenImage} alt="fullscreen" className="fullscreen-image" />
        </div>
      )}

      {isDeleteConfirmOpen && deleteTarget && (
        <div className="modal-overlay">
          <div className="modal-content">
            <p>Are you sure you want to delete this report?</p>
            <div className="modal-actions">
              <button onClick={handleDelete}>Yes, Delete</button>
              <button
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  setDeleteTarget(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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

      {isReportModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{editReportId ? "Edit Report" : "Add Report"}</h2>
            <input
              placeholder="Title"
              value={newReport.title}
              onChange={(e) => handleReportInputChange("title", e.target.value)}
            />
            <textarea
              placeholder="Description"
              value={newReport.description}
              onChange={(e) => handleReportInputChange("description", e.target.value)}
            />
            <select
              value={newReport.category}
              onChange={(e) => handleReportInputChange("category", e.target.value)}
            >
              <option value="Concern">Concern</option>
              <option value="Complaint">Complaint</option>
            </select>
            <input
              placeholder="Address"
              value={newReport.addressStreet}
              onChange={(e) => handleReportInputChange("addressStreet", e.target.value)}
            />
            <select
              value={newReport.barangay}
              onChange={(e) => handleReportInputChange("barangay", e.target.value)}
            >
              {barangays.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <div className="modal-actions">
              <button onClick={handleAddOrUpdateReport}>
                {editReportId ? "Update" : "Submit"}
              </button>
              <button
                onClick={() => {
                  setIsReportModalOpen(false);
                  setEditReportId(null);
                  resetNewReport();
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAccount && (
        <div className="modal-overlay">
          <div className="modal-content">
            <p>Are you sure you want to delete your account? This cannot be undone.</p>
            <div className="modal-actions">
              <button
                onClick={handleDeleteAccount}
                style={{ background: "#e74c3c", color: "#fff" }}
              >
                Yes, Delete
              </button>
              <button onClick={() => setShowDeleteAccount(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;