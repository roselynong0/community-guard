import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { FaEdit, FaTrashAlt, FaSearch, FaRedo, FaBell } from "react-icons/fa";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./Reports.css"; 
import "./notification.css"; // <<-- IMPORTING THE NOTIFICATION STYLES

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const API_URL = "http://localhost:5000/api";

// Fix Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// New Loading Component
const LoadingSpinner = () => (
    <div className="loading-container">
        <div className="spinner"></div>
        <p>Fetching reports...</p>
    </div>
);

function LocationPicker({ setLocation }) {
  const [position, setPosition] = useState(null);

  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      setLocation(e.latlng);
    },
  });

  return position ? <Marker position={position} /> : null;
}

// Custom Notification Component (uses the .notif CSS class)
const Notification = ({ message, type, setNotification }) => {
    useEffect(() => {
        // Automatically clear the notification after 4 seconds
        const timer = setTimeout(() => {
            setNotification(null);
        }, 4000); 
        
        return () => clearTimeout(timer);
    }, [setNotification]);

    if (!message) return null;

    return (
        <div className={`notif notif-${type}`}>
            {message}
        </div>
    );
};

function Reports({ session }) {
  const [reports, setReports] = useState([]);
  
  // States holding the current dropdown/input values (pre-applied)
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [barangay, setBarangay] = useState("All");
  const [sort, setSort] = useState("latest");
  const [view, setView] = useState("all"); 
  
  const [previewImage, setPreviewImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false); 

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newReport, setNewReport] = useState({
    title: "",
    description: "",
    category: "Concern",
    barangay: "All",
    addressStreet: "",
    images: [],
    lat: null,
    lng: null,
    date: new Date(),
  });
  const [editReportId, setEditReportId] = useState(null);
  const [expandedPosts, setExpandedPosts] = useState([]);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
    
  // NEW: Notification State
  const [notification, setNotification] = useState(null); // { message: '...', type: 'success'|'error' }

  const barangays = [
    "All", "Barretto", "East Bajac-Bajac", "East Tapinac", "Gordon Heights",
    "Kalaklan", "Mabayuan", "New Asinan", "New Banicain", "New Cabalan",
    "New Ilalim", "New Kababae", "New Kalalake", "Old Cabalan", "Pag-Asa",
    "Santa Rita", "West Bajac-Bajac", "West Tapinac",
  ];

  // States holding the actively applied filters (used for client-side filtering)
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedCategory, setAppliedCategory] = useState("All");
  const [appliedBarangay, setAppliedBarangay] = useState("All");
  const token = session?.token;
  
  // Fetch reports from backend (handles sort and view filters)
  const fetchReports = async (currentView = view) => {
    if (!token) return;
    setIsLoading(true); 
    try {
      const filterParam = currentView === "my" ? "&filter=my" : ""; 
      const res = await axios.get(
        `${API_URL}/reports?sort=${sort === "latest" ? "desc" : "asc"}${filterParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.status === "success") setReports(res.data.reports);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // useEffect: Triggers a fetch when sort or view changes.
  useEffect(() => {
    if (token) {
        fetchReports(view);
        // Ensure the current category/barangay filters are applied to the new data set
        setAppliedCategory(category);
        setAppliedBarangay(barangay);
    } 
  }, [token, sort, view]);

  // Add or update report
  const handleAddOrUpdateReport = async () => {
    const isEditing = !!editReportId;
    
    try {
      const formData = new FormData();
      formData.append("title", newReport.title);
      formData.append("description", newReport.description);
      formData.append("category", newReport.category);
      formData.append("barangay", newReport.barangay);
      formData.append("addressStreet", newReport.addressStreet);
      if (newReport.lat && newReport.lng) {
        formData.append("lat", newReport.lat);
        formData.append("lng", newReport.lng);
      }
      newReport.images.forEach((file) => formData.append("images", file));

      if (editReportId) {
        await axios.put(`${API_URL}/reports/${editReportId}`, formData, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
        });
        // NEW: Update notification
        setNotification({ message: 'Report successfully updated!', type: 'success' });
      } else {
        await axios.post(`${API_URL}/reports`, formData, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
        });
        // NEW: Add notification
        setNotification({ message: 'New report successfully added!', type: 'success' });
      }

      resetNewReport();
      setIsModalOpen(false);
      setEditReportId(null);
      fetchReports(view);
    } catch (err) {
      console.error(err);
      // NEW: Error notification
      setNotification({ 
          message: `Failed to ${isEditing ? 'update' : 'add'} report. Please try again.`, 
          type: 'error' 
      });
    }
  };

  const handleEdit = (report) => {
    setEditReportId(report.id);
    setNewReport({
      title: report.title || "",
      description: report.description || "",
      category: report.category || "Concern",
      barangay: report.address_barangay || report.barangay || "All",
      addressStreet: report.address_street || "",
      images: [],
      lat: report.latitude || null,
      lng: report.longitude || null,
      date: report.created_at ? new Date(report.created_at) : new Date(),
    });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const reportTitle = deleteTarget.title;

    try {
      await axios.patch(`${API_URL}/reports/${deleteTarget.id}`, 
        { deleted: true }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsDeleteConfirmOpen(false);
      setDeleteTarget(null);
      fetchReports(view);
      // NEW: Delete notification
      setNotification({ message: `Report "${reportTitle}" successfully removed.`, type: 'success' });
    } catch (err) {
      console.error(err);
      // NEW: Delete error notification
      setNotification({ message: `Failed to remove report "${reportTitle}".`, type: 'error' });
    }
  };

  const toggleExpand = (id) => {
    setExpandedPosts((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const resetNewReport = () => {
    setNewReport({
      title: "",
      description: "",
      category: "Concern",
      barangay: "All",
      addressStreet: "",
      images: [],
      lat: null,
      lng: null,
      date: new Date(),
    });
  };

  // Client-side filtering logic: uses the 'applied' states
  const filteredReports = reports
    .filter((r) => (appliedCategory === "All" ? true : r.category === appliedCategory))
    .filter((r) => (appliedBarangay === "All" ? true : (r.barangay || r.address_barangay) === appliedBarangay))
    .filter(
      (r) =>
        (r.title || "").toLowerCase().includes(appliedSearch.toLowerCase()) ||
        (r.description || "").toLowerCase().includes(appliedSearch.toLowerCase())
    );

  return (
    <div className="reports-container">
      {/* NEW: Notification Display Component */}
      {notification && (
          <Notification 
              message={notification.message} 
              type={notification.type} 
              setNotification={setNotification} 
          />
      )}

      {/* Header */}
      <div className="header-row">
        <h2>{view === "all" ? "Community Reports" : "My Reports"}</h2>
        <button 
          className="history-btn" 
          onClick={() => setView(view === "all" ? "my" : "all")}
        >
          {view === "all" ? "My Reports" : "All Reports"}
        </button>
      </div>

      {/* Filters */}
      <div className="top-controls">
        {/* NEW CONTAINER: search-group (Input and Icons) */}
        <div className="search-group"> 
          <input
            type="text"
            placeholder="Search reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
          
          {/* Search Button: Applies search, category, AND barangay filters */}
          <button
            className="filter-icon-btn search-btn"
            title="Search"
            onClick={() => {
              setAppliedSearch(search);
              // Apply the currently selected dropdown values as well
              setAppliedCategory(category);
              setAppliedBarangay(barangay);
            }}
          >
            <FaSearch />
          </button>

          {/* Reset Button: Resets all filters and fetches base data */}
          <button
            className="filter-icon-btn reset-btn"
            title="Reset"
            onClick={() => {
              // Reset the control states
              setSearch("");
              setCategory("All");
              setBarangay("All");
              
              // Reset the applied filter states (to clear client-side filter instantly)
              setAppliedSearch("");
              setAppliedCategory("All");
              setAppliedBarangay("All");
              
              // Re-fetch data using the current sort/view
              fetchReports(); 
            }}
          >
            <FaRedo />
          </button>
        </div>
        {/* END search-group */}

        {/* Category Filter */}
        <select 
          value={category} 
          onChange={(e) => {
            const newCategory = e.target.value;
            setCategory(newCategory);
            // Immediately apply the filter for instant client-side update
            setAppliedCategory(newCategory);
          }}
        >
          <option value="All">All Categories</option>
          <option value="Concern">Concern</option>
          <option value="Crime">Crime</option>
          <option value="Hazard">Hazard</option>
          <option value="Lost&Found">Lost & Found</option>
          <option value="Others">Others</option>
        </select>

        {/* Barangay Filter */}
        <select 
          value={barangay} 
          onChange={(e) => {
            const newBarangay = e.target.value;
            setBarangay(newBarangay);
            // Immediately apply the filter for instant client-side update
            setAppliedBarangay(newBarangay);
          }}
        >
          {barangays.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        {/* Sort Filter */}
        <select 
          value={sort} 
          onChange={(e) => {
            setSort(e.target.value);
            // Changing sort triggers the API re-fetch in the useEffect hook.
          }}
        >
          <option value="latest">Latest → Oldest</option>
          <option value="oldest">Oldest → Latest</option>
        </select>

        {/* Add Report Button */}
        <button
          className="add-btn"
          onClick={() => {
            resetNewReport();
            setEditReportId(null);
            setIsModalOpen(true);
          }}
        >
          + Add Report
        </button>
      </div>

      {/* Reports List */}
      <div className="reports-list">
        {isLoading ? (
            <LoadingSpinner />
        ) : filteredReports.length > 0 ? (
          filteredReports.map((report) => {
            const isExpanded = expandedPosts.includes(report.id);
            const displayDescription = isExpanded
              ? report.description
              : `${(report.description || "").slice(0, 130)}${
                  (report.description?.length || 0) > 130 ? "..." : ""
                }`;

            return (
              <div key={report.id} className="report-card">
                {/* Header */}
                <div className="report-header">
                  <div className="report-header-left">
                    <img
                      src={report.reporter?.avatar_url || "/src/assets/profile.png"}
                      alt="profile"
                      className="profile-pic"
                    />
                    <div className="report-header-text">
                      <p className="report-user">
                        {report.reporter
                          ? `${report.reporter.firstname || ""} ${report.reporter.lastname || ""}`.trim()
                          : "Unknown User"}{" "}
                        <span className={`user-verified-badge ${report.user_verified ? "verified" : "unverified"}`}>
                          {report.user_verified ? "Verified" : "Unverified"}
                        </span>
                      </p>
                      <p className="report-subinfo">
                        {report.created_at ? new Date(report.created_at).toLocaleString() : ""} · {report.category || "N/A"}
                      </p>
                      <p className="report-address-info">
                        {(report.address_street || "")}, {(report.address_barangay || report.barangay || "")}, Olongapo City
                      </p>
                    </div>
                  </div>

                  <div className="report-header-actions">
                    <span className={`status-badge status-${(report.status || "pending").toLowerCase()}`}>
                      {report.status || "Pending"}
                    </span>

                    {session?.user?.id && String(report.user_id) === String(session.user.id) && (
                      <>
                        <button className="icon-btn edit-btn" onClick={() => handleEdit(report)}>
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
                      </>
                    )}
                  </div>
                </div>

                {/* Caption */}
                <div className="report-caption">
                  <strong>{report.title || ""}</strong>
                  <p className="report-description-text">
                    {displayDescription}
                    {report.description?.length > 130 && (
                      <span className="more-link" onClick={() => toggleExpand(report.id)}>
                        {isExpanded ? " Show less" : " ...more"}
                      </span>
                    )}
                  </p>
                </div>

                {/* Images */}
                {report.images && report.images.length > 0 && (
                  <div className={`report-images images-${report.images.length}`}>
                    {report.images.map((imgObj, idx) => (
                      <img
                        key={idx}
                        src={`${API_URL}${imgObj.url}`}
                        alt={`report-${idx}`}
                        className="report-collage-img"
                        onClick={() => setPreviewImage(`${API_URL}${imgObj.url}`)}
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
          <p className="no-report-msg">No reports found.</p>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-scrollable">
              <h3>{editReportId ? "Edit Report" : "Add New Report"}</h3>

              <label>Title:</label>
              <input
                type="text"
                placeholder="Title"
                value={newReport.title}
                onChange={(e) => setNewReport({ ...newReport, title: e.target.value })}
              />

              <label>Description:</label>
              <textarea
                placeholder="Description"
                value={newReport.description}
                onChange={(e) => setNewReport({ ...newReport, description: e.target.value })}
              />

              <div className="address-fields">
                <label>Street Address:</label>
                <input
                  type="text"
                  placeholder="e.g. 45 Rizal Avenue"
                  value={newReport.addressStreet}
                  onChange={(e) => setNewReport({ ...newReport, addressStreet: e.target.value })}
                />
                <label>Barangay:</label>
                <select
                  value={newReport.barangay}
                  onChange={(e) => setNewReport({ ...newReport, barangay: e.target.value })}
                >
                  {barangays.filter((b) => b !== "All").map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <label>Category:</label>
              <select
                value={newReport.category}
                onChange={(e) => setNewReport({ ...newReport, category: e.target.value })}
              >
                <option value="Concern">Concern</option>
                <option value="Crime">Crime</option>
                <option value="Hazard">Hazard</option>
                <option value="Lost&Found">Lost & Found</option>
                <option value="Others">Others</option>
              </select>

              <div className="map-field">
                <label>Pick Location on Map:</label>
                <MapContainer
                  center={[14.8477, 120.2879]}
                  zoom={13}
                  style={{ height: 250, width: "100%", marginBottom: 10 }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap contributors"
                  />
                  <LocationPicker
                    setLocation={(latlng) =>
                      setNewReport({ ...newReport, lat: latlng.lat, lng: latlng.lng })
                    }
                  />
                </MapContainer>
              </div>


              <label className="upload-btn">
                Upload Image(s)
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files).slice(0, 5);
                    setNewReport((prev) => ({ ...prev, images: files }));
                  }}
                  hidden
                />
              </label>

              {newReport.images && newReport.images.length > 0 && (
                <div className={`report-images images-${newReport.images.length}`}>
                  {newReport.images.map((file, idx) => (
                    <img
                      key={idx}
                      src={typeof file === "string" ? file : URL.createObjectURL(file)}
                      alt={`preview-${idx}`}
                      className="report-collage-img"
                      style={{ maxWidth: 80, maxHeight: 80, margin: 4 }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="modal-buttons">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditReportId(null);
                }}
              >
                Cancel
              </button>
              <button onClick={handleAddOrUpdateReport}>{editReportId ? "Update" : "Submit"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
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

      {/* Fullscreen Image Preview */}
      {previewImage && (
        <div className="fullscreen-modal" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Full screen" className="fullscreen-image" />
        </div>
      )}
    </div>
  );
}

export default Reports;