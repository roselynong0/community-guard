import React, { useState } from "react";
import { FaEdit, FaTrashAlt } from "react-icons/fa";
import "./Profile.css";

function Profile() {
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [profilePic, setProfilePic] = useState(null);
  const [showModal, setShowModal] = useState(null);
  const [user, setUser] = useState({
    firstname: "Juan",
    lastname: "Dela Cruz",
    role: "Resident",
    email: "juan@email.com",
    contact: "09123456789",
    address: "East Tapinac, Olongapo City",
    bio: "Active community member who loves helping others.",
    reportsSubmitted: 12,
    reportsResolved: 8
  });

  const [reports, setReports] = useState([
    {
      id: 1,
      title: "Pickpocket Incident",
      category: "Crime",
      addressStreet: "15 Mango St.",
      barangay: "East Tapinac",
      date: "2025-09-09T14:20:00",
      description:
        "A pickpocketing incident happened near the market. Multiple residents reported losing wallets and phones around 2PM.",
      user: "user2",
      image: "/src/assets/sample.jpg",
    },
    {
      id: 2,
      title: "Fallen Electric Post",
      category: "Hazard",
      addressStreet: "22-A National Highway",
      barangay: "Santa Rita",
      date: "2025-09-08T22:00:00",
      description:
        "An electric post fell after the heavy rains last night, blocking the main road and posing danger to vehicles and pedestrians.",
      user: "user1",
      image: "/src/assets/sample.jpg",
    },
    {
      id: 3,
      title: "Garbage Overflowing",
      category: "Concern",
      addressStreet: "55 Sampaguita St.",
      barangay: "New Cabalan",
      date: "2025-09-08T18:40:00",
      description:
        "The garbage bins along the main street have been overflowing for days, causing a foul smell and attracting stray animals.",
      user: "user1",
      image: "/src/assets/sample.jpg",
    },
    {
      id: 4,
      title: "Lost Wallet",
      category: "Lost&Found",
      addressStreet: "88 Church Rd.",
      barangay: "Barretto",
      date: "2025-09-07T10:15:00",
      description:
        "A black leather wallet was lost near the church. Contains IDs and some cash. Please return if found.",
      user: "user2",
      image: "/src/assets/sample.jpg",
    },
  ]);

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
    user: "user1",
  });
  const [editReportId, setEditReportId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [expandedReports, setExpandedReports] = useState([]);
  const currentUser = "user1";

  const barangays = [
    "All",
    "Barretto",
    "East Bajac-Bajac",
    "East Tapinac",
    "Gordon Heights",
    "Kalaklan",
    "Mabayuan",
    "New Asinan",
    "New Banicain",
    "New Cabalan",
    "New Ilalim",
    "New Kababae",
    "New Kalalake",
    "Old Cabalan",
    "Pag-Asa",
    "Santa Rita",
    "West Bajac-Bajac",
    "West Tapinac",
  ];

  const handlePicUpload = (e) => {
    const file = e.target.files[0];
    if (file) setProfilePic(URL.createObjectURL(file));
  };

  const handleInputChange = (field, value) => {
    setUser((prev) => ({ ...prev, [field]: value }));
  };

  const handleReportInputChange = (field, value) => {
    setNewReport((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddOrUpdateReport = () => {
    if (editReportId) {
      setReports(
        reports.map((r) =>
          r.id === editReportId ? { ...r, ...newReport } : r
        )
      );
    } else {
      const newId = reports.length + 1;
      const report = {
        id: newId,
        ...newReport,
        date: new Date().toISOString(),
        user: currentUser,
      };
      setReports([report, ...reports]);
    }
    setIsReportModalOpen(false);
    setEditReportId(null);
    resetNewReport();
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
      user: currentUser,
    });
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
      prev.includes(id) ? prev.filter((reportId) => reportId !== id) : [...prev, id]
    );
  };

  const userReports = reports
    .filter((r) => r.user === currentUser)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="profile-page">
      <div className="profile-header-card">
        <div className="profile-header-info">
          <img
            src={profilePic || "/default-avatar.png"}
            alt="Profile"
            className="profile-avatar"
          />
          <div className="profile-name">
            <h2>{user.firstname} {user.lastname}</h2>
            <p>{user.address}</p>
            <span className="role-badge">{user.role}</span>
          </div>
          <button className="edit-icon" onClick={() => setShowModal("header")}><FaEdit /></button>
        </div>
        <div className="profile-header-actions">
          <label className="upload-btn">
            Change Picture
            <input type="file" accept="image/*" onChange={handlePicUpload} hidden />
          </label>
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
        </div>
      </div>

      <div className="profile-content">
        <div className="profile-sidebar">
          <div className="profile-card">
            <div className="card-header">
              <h3>About</h3>
              <button className="section-edit" onClick={() => setShowModal("about")}><FaEdit /></button>
            </div>
            <p>{user.bio}</p>
          </div>
          <div className="profile-card">
            <div className="card-header">
              <h3>Personal Info</h3>
              <button className="section-edit" onClick={() => setShowModal("personal")}><FaEdit /></button>
            </div>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Contact:</strong> {user.contact}</p>
            <p><strong>Address:</strong> {user.address}</p>
          </div>
          <div className="profile-card">
            <h3>Activity</h3>
            <p>📌 Reports Submitted: <strong>{user.reportsSubmitted}</strong></p>
            <p>✅ Reports Resolved: <strong>{user.reportsResolved}</strong></p>
          </div>
        </div>

        <div className="profile-posts">
          <div className="reports-list">
            {userReports.length > 0 ? (
              userReports.map((report) => {
                const isExpanded = expandedReports.includes(report.id);
                const displayDescription = isExpanded
                  ? report.description
                  : `${report.description.slice(0, 130)}${
                      report.description.length > 130 ? "..." : ""
                    }`;

                return (
                  <div key={report.id} className="profile-card post report-card">
                    <div className="report-header">
                      <div className="report-header-left">
                        <img
                          src="/src/assets/profile.png"
                          alt="profile"
                          className="profile-pic"
                        />
                        <div className="report-header-text">
                          <p className="report-user">{report.user}</p>
                          <p className="report-subinfo">
                            {new Date(report.date).toLocaleString()} · {report.category}
                          </p>
                          <p className="report-address-info">
                            {report.addressStreet}, {report.barangay}, Olongapo City
                          </p>
                        </div>
                      </div>
                      <div className="report-header-actions">
                        <button
                          className="icon-btn edit-btn"
                          onClick={() => handleEdit(report)}
                        >
                          <FaEdit />
                        </button>
                        <button
                          className="icon-btn delete-btn"
                          onClick={() => {
                            setDeleteTarget(report);
                            setIsDeleteConfirmOpen(true);
                          }}
                        >
                          <FaTrashAlt />
                        </button>
                      </div>
                    </div>
                    <div className="report-caption">
                      <strong>{report.title}</strong> <br />
                      {displayDescription}
                      {report.description.length > 130 && (
                        <span
                          className="more-link"
                          onClick={() => toggleExpand(report.id)}
                        >
                          {isExpanded ? " Show less" : " more"}
                        </span>
                      )}
                    </div>
                    {report.image && (
                      <img
                        src={report.image}
                        alt={report.title}
                        className="report-thumbnail"
                        onClick={() => setFullScreenImage(report.image)}
                      />
                    )}
                    {report.images && report.images.length > 0 && (
                      <div className={`report-images images-${report.images.length}`}>
                        {report.images.map((img, idx) => (
                          <img
                            key={idx}
                            src={img}
                            alt={`report-${idx}`}
                            className="report-thumbnail"
                            onClick={() => setFullScreenImage(img)}
                          />
                        ))}
                      </div>
                    )}
                    <div className="report-actions">
                      <button className="like-btn">Like</button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p>No reports found.</p>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Edit {showModal === "header" ? "Profile" : showModal === "about" ? "About" : "Personal Info"}</h3>
            {showModal === "header" && (
              <>
                First Name
                <input
                  type="text"
                  value={user.firstname}
                  onChange={e => handleInputChange("firstname", e.target.value)}
                  placeholder="First Name"
                />
                Last Name
                <input
                  type="text"
                  value={user.lastname}
                  onChange={e => handleInputChange("lastname", e.target.value)}
                  placeholder="Last Name"
                />
                Role:
                <p className="readonly-field"> {user.role}</p>
              </>
            )}
            {showModal === "about" && (
              <textarea value={user.bio} onChange={e => handleInputChange("bio", e.target.value)} rows="4" />
            )}
            {showModal === "personal" && (
              <>
                Email:
                <input
                  type="email"
                  value={user.email}
                  onChange={e => handleInputChange("email", e.target.value)}
                  placeholder="Email"
                />
                Contact:
                <input
                  type="text"
                  value={user.contact}
                  onChange={e => handleInputChange("contact", e.target.value)}
                  placeholder="Contact"
                />
                Address:
                <select
                  value={user.address.replace(", Olongapo City", "")}
                  onChange={e => handleInputChange("address", e.target.value + ", Olongapo City")}
                >
                  <option value="">-- Select Barangay --</option>
                  {barangays.filter((b) => b !== "All").map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </>
            )}
            <div className="modal-buttons">
              <button onClick={() => setShowModal(null)}>Cancel</button>
              <button onClick={() => setShowModal(null)}>Save</button>
            </div>
          </div>
        </div>
      )}

      {isReportModalOpen && (
        <div className="modal-overlay" onClick={() => setIsReportModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{editReportId ? "Edit Report" : "Add New Report"}</h3>
            <p><strong>Resident:</strong> {currentUser}</p>
            <p><strong>Date:</strong> {new Date(newReport.date).toLocaleDateString()}</p>
            <input
              type="text"
              placeholder="Title"
              value={newReport.title}
              onChange={(e) => handleReportInputChange("title", e.target.value)}
            />
            <textarea
              placeholder="Description"
              value={newReport.description}
              onChange={(e) => handleReportInputChange("description", e.target.value)}
              rows="4"
            />
            <div className="address-fields">
              <label>Street Address:</label>
              <input
                type="text"
                value={newReport.addressStreet}
                onChange={(e) => handleReportInputChange("addressStreet", e.target.value)}
                placeholder="e.g. 15 Mango St."
              />
              <label>Barangay:</label>
              <select
                value={newReport.barangay}
                onChange={(e) => handleReportInputChange("barangay", e.target.value)}
              >
                {barangays.filter((b) => b !== "All").map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <p className="readonly-field">Olongapo City</p>
            </div>
            <label>Category:</label>
            <select
              value={newReport.category}
              onChange={(e) => handleReportInputChange("category", e.target.value)}
            >
              <option value="Concern">Concern</option>
              <option value="Crime">Crime</option>
              <option value="Hazard">Hazard</option>
              <option value="Lost&Found">Lost &amp; Found</option>
              <option value="Others">Others</option>
            </select>
            <label className="upload-btn">
              Upload Image(s)
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files).slice(0, 5);
                  const urls = files.map((file) => URL.createObjectURL(file));
                  setNewReport({ ...newReport, images: urls });
                }}
                hidden
              />
            </label>
            <div className="modal-buttons">
              <button onClick={() => { setIsReportModalOpen(false); setEditReportId(null); }}>Cancel</button>
              <button onClick={handleAddOrUpdateReport}>{editReportId ? "Update" : "Submit"}</button>
            </div>
          </div>
        </div>
      )}

      {isDeleteConfirmOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Delete Report</h3>
            <p>Are you sure you want to delete "{deleteTarget?.title}"?</p>
            <div className="delete-actions">
              <button onClick={handleDelete}>Yes, Delete</button>
              <button onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen image modal */}
      {fullScreenImage && (
        <div className="fullscreen-modal" onClick={() => setFullScreenImage(null)}>
          <img src={fullScreenImage} alt="Full screen" className="fullscreen-image" />
        </div>
      )}
    </div>
  );
}

export default Profile;