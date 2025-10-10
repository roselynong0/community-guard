import React, { useState, useEffect } from "react";
import { FaEdit, FaTrashAlt, FaSearch } from "react-icons/fa";
import "./Reports.css"; 

const REPORT_STATUSES = ["Pending", "Ongoing", "Resolved"];

function AdminReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true); // <-- new loading state
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [barangay, setBarangay] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All"); 
  const [sort, setSort] = useState("latest");
  const [previewImage, setPreviewImage] = useState(null);

  // States for the Status Update Modal
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [newStatus, setNewStatus] = useState("");

  const [expandedPosts, setExpandedPosts] = useState([]);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  
  const barangays = [
    "All Barangay", "Barretto", "East Bajac-Bajac", "East Tapinac", "Gordon Heights",
    "Kalaklan", "Mabayuan", "New Asinan", "New Banicain", "New Cabalan",
    "New Ilalim", "New Kababae", "New Kalalake", "Old Cabalan", "Pag-Asa",
    "Santa Rita", "West Bajac-Bajac", "West Tapinac",
  ];

  useEffect(() => {
    // Simulate fetching reports
    setTimeout(() => {
      const sampleReports = [
        {
          id: 1,
          user: "Juan Dela Cruz",
          user_verified: true,
          date: new Date().toISOString(),
          category: "Crime",
          addressStreet: "123 Rizal St",
          barangay: "Barretto",
          title: "Robbery at Night",
          description: "There was a robbery incident near the corner of Rizal St. Be careful when passing by the area at night.",
          status: "Pending",
          images: ["/src/assets/sample.jpg", "/src/assets/sample.jpg"],
        },
        {
          id: 2,
          user: "Maria Clara",
          user_verified: false,
          date: new Date().toISOString(),
          category: "Hazard",
          addressStreet: "456 Mabini St",
          barangay: "New Banicain",
          title: "Fallen Tree Blocking Road",
          description: "A big tree fell and is blocking the road near Mabini St. Vehicles cannot pass. Request immediate cleanup.",
          status: "Ongoing",
          images: ["/src/assets/sample.jpg"],
        },
        {
          id: 3,
          user: "Jose Rizal",
          user_verified: true,
          date: new Date().toISOString(),
          category: "Concern",
          addressStreet: "789 Magsaysay Ave",
          barangay: "Gordon Heights",
          title: "Street Light Not Working",
          description: "The street light near Magsaysay Ave is not functioning for over a week. This poses a safety risk for pedestrians.",
          status: "Resolved",
          images: ["/src/assets/sample.jpg", "/src/assets/sample.jpg", "/src/assets/sample.jpg", "/src/assets/sample.jpg"],
        },
      ];

      setReports(sampleReports);
      setLoading(false); // stop loading
    }, 1500); // simulate 1.5s loading
  }, []);

  const toggleExpand = (id) => {
    setExpandedPosts((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const openStatusModal = (report) => {
    setSelectedReport(report);
    setNewStatus(report.status);
    setIsStatusModalOpen(true);
  };

  const handleUpdateStatus = () => {
    if (!selectedReport || !newStatus) return;
    setReports(reports.map(r =>
      r.id === selectedReport.id ? { ...r, status: newStatus } : r
    ));
    setIsStatusModalOpen(false);
    setSelectedReport(null);
    setNewStatus("");
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setReports(reports.filter(r => r.id !== deleteTarget.id));
    setIsDeleteConfirmOpen(false);
    setDeleteTarget(null);
  };

  // Filtered reports
  const filteredReports = reports
    .filter((r) => (category === "All" ? true : r.category === category))
    .filter((r) => (barangay === "All" ? true : r.barangay === barangay))
    .filter((r) => (statusFilter === "All" ? true : r.status === statusFilter))
    .filter(
      (r) =>
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.user.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="reports-container">
      <div className="header-row">
        <h2>All Community Reports</h2>
      </div>

      <div className="top-controls">
        <div className="search-bar-container">
            <FaSearch className="search-icon" /> 
            <input
              type="text"
              placeholder="Search reports..."
              value={search}
              onChange={(e) => setSearch(e.target.value)} 
              className="search-input real-time-search-input" 
            />
          </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="All">All Categories</option>
          <option value="Concern">Concern</option>
          <option value="Crime">Crime</option>
          <option value="Hazard">Hazard</option>
          <option value="Lost&Found">Lost & Found</option>
          <option value="Others">Others</option>
        </select>
        <select value={barangay} onChange={(e) => setBarangay(e.target.value)}>
          {barangays.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="All">All Statuses</option>
          {REPORT_STATUSES.map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="latest">Latest → Oldest</option>
          <option value="oldest">Oldest → Latest</option>
        </select>
      </div>

      <div className="reports-list">
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading reports...</p>
          </div>
        ) : filteredReports.length > 0 ? (
          filteredReports.map((report, index) => {
            const isExpanded = expandedPosts.includes(report.id);
            const displayDescription = isExpanded
              ? report.description
              : `${report.description.slice(0, 130)}${
                  report.description.length > 130 ? "..." : ""
                }`;

            return (
              <div
                key={report.id}
                className="report-card fade-in"
                style={{ animationDelay: `${index * 0.1}s` }} 
              >
                <div className="report-header">
                  <div className="report-header-left">
                    <img src="/src/assets/profile.png" alt="profile" className="profile-pic" />
                    <div className="report-header-text">
                      <p className="report-user">
                        {report.user}{" "}
                        <span
                          className={`user-verified-badge ${report.user_verified ? "verified" : "unverified"}`}
                        >
                          {report.user_verified ? "Verified" : "Unverified"}
                        </span>
                      </p>
                      <p className="report-subinfo">
                        {new Date(report.date).toLocaleDateString()} · {new Date(report.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {report.category}
                      </p>
                      <p className="report-address-info">
                        {report.addressStreet}, {report.barangay}, Olongapo City
                      </p>
                    </div>
                  </div>

                  <div className="report-header-actions">
                    <span className={`status-badge status-${report.status.toLowerCase()}`}>
                      {report.status}
                    </span>
                    <button className="icon-btn edit-btn" onClick={() => openStatusModal(report)}>
                      <FaEdit />
                    </button>
                    <button className="icon-btn delete-btn" onClick={() => {
                      setDeleteTarget(report);
                      setIsDeleteConfirmOpen(true);
                    }}>
                      <FaTrashAlt />
                    </button>
                  </div>
                </div>

                <div className="report-caption">
                  <strong>{report.title}</strong>
                  <p className="report-description-text">
                    {isExpanded
                      ? report.description
                      : `${report.description.slice(0, 150)}${report.description.length > 150 ? "..." : ""}`}
                    {report.description.length > 150 && (
                      <span
                        className="more-link"
                        onClick={() => toggleExpand(report.id)}
                        style={{ cursor: "pointer", color: "#007bff", marginLeft: "5px" }}
                      >
                        {isExpanded ? " Show less" : "...more"}
                      </span>
                    )}
                  </p>
                </div>

                {report.images && report.images.length > 0 && (
                  <div className={`report-images images-${report.images.length}`}>
                    {report.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt={`report-${idx}`}
                        className="report-collage-img"
                        onClick={() => setPreviewImage(img)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p>No reports found matching your criteria.</p>
        )}
      </div>

      {/* Status Modal */}
      {isStatusModalOpen && selectedReport && (
        <div className="modal-overlay" onClick={() => setIsStatusModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Update Report Status</h3>
            <p><strong>Report:</strong> {selectedReport.title}</p>
            <p><strong>Current Status:</strong> 
              <span className={`status-badge status-${selectedReport.status.toLowerCase()}`}>
                {selectedReport.status}
              </span>
            </p>
            <label>New Status:</label>
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
              {REPORT_STATUSES.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <div className="modal-buttons edit-actions">
              <button onClick={() => setIsStatusModalOpen(false)}>Cancel</button>
              <button onClick={handleUpdateStatus}>Update Status</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteConfirmOpen && (
        <div className="modal-overlay" onClick={() => setIsDeleteConfirmOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Report</h3>
            <p>Are you sure you want to delete report: "<strong>{deleteTarget?.title}</strong>" from user: {deleteTarget?.user}?</p>
            <div className="delete-actions">
              <button onClick={handleDelete}>Yes, Delete Permanently</button>
              <button onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Preview */}
      {previewImage && (
        <div className="fullscreen-modal" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Full screen" className="fullscreen-image" />
        </div>
      )}
    </div>
  );
}

export default AdminReports;