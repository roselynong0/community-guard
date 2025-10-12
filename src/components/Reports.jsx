import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { FaEdit, FaTrashAlt, FaSearch, FaRedo } from "react-icons/fa";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./Reports.css";
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

function Reports({ session }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [barangay, setBarangay] = useState("All");
  const [sort, setSort] = useState("latest");
  const [showMyReports, setShowMyReports] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

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
  // ⭐ NEW STATE FOR NOTIFICATION
  const [notification, setNotification] = useState(null); // { message: string, type: 'success' | 'error' | 'caution' }

  // ⭐ NEW REFS FOR KEYBOARD NAVIGATION
  const modalRef = useRef(null);
  const focusableElementsRef = useRef([]);

  const barangays = [
    "All Barangays",
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

  // The 'applied' states will now track the current filter values directly (real-time).
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedCategory, setAppliedCategory] = useState("All");
  const [appliedBarangay, setAppliedBarangay] = useState("All");
  const token = session?.token;

  // ⭐ NOTIFICATION HANDLER FUNCTION
  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3000); // Notification disappears after 3 seconds
  };

  // ✅ Fetch reports
  const fetchReports = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/reports?sort=${sort === "latest" ? "desc" : "asc"}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.status === "success") {
        setReports(res.data.reports || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, sort]);

  // ✅ Run on mount & whenever token/sort changes
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // ⭐ KEYBOARD NAVIGATION EFFECT
  useEffect(() => {
    if (isModalOpen && modalRef.current) {
      // Get all focusable elements in the modal
      const focusableElements = modalRef.current.querySelectorAll(
        'input:not([type="file"]), textarea, select, button:not([type="button"]), [tabindex]:not([tabindex="-1"])'
      );
      
      focusableElementsRef.current = Array.from(focusableElements);
      
      // Set focus to first element when modal opens
      if (focusableElementsRef.current.length > 0) {
        focusableElementsRef.current[0].focus();
      }

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          setIsModalOpen(false);
          return;
        }

        // Only handle arrow keys when modal is open
        if (!isModalOpen) return;

        const currentIndex = focusableElementsRef.current.indexOf(document.activeElement);
        
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const nextIndex = (currentIndex + 1) % focusableElementsRef.current.length;
          focusableElementsRef.current[nextIndex]?.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : focusableElementsRef.current.length - 1;
          focusableElementsRef.current[prevIndex]?.focus();
        } else if (e.key === 'Tab') {
          // Enhance default tab behavior with cycling
          if (!e.shiftKey && currentIndex === focusableElementsRef.current.length - 1) {
            e.preventDefault();
            focusableElementsRef.current[0]?.focus();
          } else if (e.shiftKey && currentIndex === 0) {
            e.preventDefault();
            focusableElementsRef.current[focusableElementsRef.current.length - 1]?.focus();
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isModalOpen]);

  // Add or update report
  const handleAddOrUpdateReport = async () => {
    if (
      !newReport.title ||
      !newReport.description ||
      !newReport.barangay ||
      newReport.barangay === "All"
    ) {
      showNotification(
        "Please fill in the Title, Description, and select a Barangay.",
        "caution"
      );
      return;
    }

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
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });
        showNotification("✓ Report updated successfully!", "success");
      } else {
        await axios.post(`${API_URL}/reports`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });
        showNotification("✓ Report submitted successfully!", "success");
      }

      resetNewReport();
      setIsModalOpen(false);
      setEditReportId(null);
      fetchReports();
    } catch (err) {
      console.error("Add/Update Error:", err);
      showNotification(
        "Failed to save report. Please check your connection and data.",
        "error"
      );
    }
  };

  const handleEdit = (report) => {
    setEditReportId(report.id);
    setNewReport({
      title: report.title || "",
      description: report.description || "",
      category: report.category || "Concern",
      barangay: report.address_barangay || "All", // Use address_barangay from the report object
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
    try {
      await axios.patch(
        `${API_URL}/reports/${deleteTarget.id}`,
        { deleted: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showNotification("🗑️ Report deleted successfully!", "success");
      setIsDeleteConfirmOpen(false);
      setDeleteTarget(null);
      fetchReports();
    } catch (err) {
      console.error("Delete Error:", err);
      showNotification("Failed to delete report. Please try again.", "error");
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
      barangay: "Barretto", // Set a default barangay other than "All" for form
      addressStreet: "",
      images: [],
      lat: null,
      lng: null,
      date: new Date(),
    });
  };

  // Correct toggle logic
  const filteredReports = reports
    .filter((r) => r.deleted !== true) 
    .filter((r) =>
      showMyReports
        ? String(r.user_id) === String(session?.user?.id) // My Reports
        : true // All Reports
    )
    .filter((r) => appliedCategory === "All" || r.category === appliedCategory)
    .filter(
      (r) => appliedBarangay === "All" || r.address_barangay === appliedBarangay
    )
    .filter((r) => {
      if (!appliedSearch) return true;
      const searchLower = appliedSearch.toLowerCase();
      return (
        (r.title || "").toLowerCase().includes(searchLower)
      );
    });

  // 👇 NEW HANDLER TO RESET ALL FILTERS
  const handleResetFilters = () => {
    setSearch("");
    setCategory("All");
    setBarangay("All");
    setAppliedSearch("");
    setAppliedCategory("All");
    setAppliedBarangay("All");
    setSort("latest");
  };

  useEffect(() => {
    setAppliedSearch(search);
  }, [search]);

  useEffect(() => {
    setAppliedCategory(category);
  }, [category]);

  useEffect(() => {
    setAppliedBarangay(barangay);
  }, [barangay]);

  return (
    <div className="reports-container">
      {notification && (
        <div className={`notif notif-${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="header-row">
        <h2>Community Reports</h2>
        <button
          className="history-btn"
          onClick={() => setShowMyReports(!showMyReports)}
        >
          {showMyReports ? "My Reports" : "All Reports"}
        </button>
      </div>

      {/* Filters */}
      <div className="top-controls">
        <div className="search-bar-container">
          <FaSearch className="search-icon" /> {/* Visual Search Icon */}
          <input
            type="text"
            placeholder="Search reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)} // State update triggers useEffect to update appliedSearch
            className="search-input real-time-search-input" // Add a class for styling the input part
          />
        </div>

        {/* Category filter - Now uses useEffect for real-time application */}
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            // setAppliedCategory(e.target.value); // REMOVED: Now handled by useEffect
          }}
        >
          <option value="All">All Categories</option>
          <option value="Concern">Concern</option>
          <option value="Crime">Crime</option>
          <option value="Hazard">Hazard</option>
          <option value="Lost&Found">Lost & Found</option>
          <option value="Others">Others</option>
        </select>
        {/* Barangay filter - Now uses useEffect for real-time application */}
        <select
          value={barangay}
          onChange={(e) => {
            setBarangay(e.target.value);
            // setAppliedBarangay(e.target.value); // REMOVED: Now handled by useEffect
          }}
        >
          {barangays.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="latest">Latest → Oldest</option>
          <option value="oldest">Oldest → Latest</option>
        </select>

        {/* Buttons Group for Flex Layout */}
        <div className="action-buttons-group">
          <div className="filter-btns">
            <button
              className="filter-icon-btn"
              title="Reset"
              onClick={handleResetFilters}
            >
              <FaRedo />
            </button>
          </div>

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
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="loading-overlay loading-compact">
          {" "}
          <div className="spinner" /> <p>Loading reports...</p>{" "}
        </div>
      )}

      {/* Reports List */}
      <div className="reports-list">
        {!loading && filteredReports.length > 0 ? (
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
                      src={
                        report.reporter?.avatar_url || "/src/assets/profile.png"
                      }
                      alt="profile"
                      className="profile-pic"
                    />
                    <div className="report-header-text">
                      <p className="report-user">
                        {report.reporter ? (
                          <>
                            {`${report.reporter.firstname || ""} ${
                              report.reporter.lastname || ""
                            }`.trim()}
                            <span
                              className={`user-verified-badge ${
                                report.reporter.isverified
                                  ? "verified"
                                  : "unverified"
                              }`}
                            >
                              {report.reporter.isverified
                                ? "Verified"
                                : "Unverified"}
                            </span>
                          </>
                        ) : (
                          <>
                            Unknown User
                            <span className="user-verified-badge unverified">
                              Unverified
                            </span>
                          </>
                        )}
                      </p>
                      <p className="report-subinfo">
                        {report.created_at
                          ? new Date(report.created_at).toLocaleString()
                          : ""}{" "}
                        · {report.category || "N/A"}
                      </p>
                      <p className="report-address-info">
                        {(report.address_street || "")},{" "}
                        {(report.address_barangay || "")}, Olongapo City
                      </p>
                    </div>
                  </div>

                  <div className="report-header-actions">
                    <span
                      className={`status-badge status-${(
                        report.status || "pending"
                      ).toLowerCase()}`}
                    >
                      {report.status || "Pending"}
                    </span>

                    {session?.user &&
                      String(report.user_id) === String(session.user.id) && (
                        <>
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
                      <span
                        className="more-link"
                        onClick={() => toggleExpand(report.id)}
                      >
                        {isExpanded ? " Show less" : " ...more"}
                      </span>
                    )}
                  </p>
                </div>

                {/* Images */}
                {report.images?.length > 0 && (
                  <div className={`report-images images-${report.images.length}`}>
                    {report.images.map((imgObj, idx) => (
                      <img
                        key={idx}
                        src={`${API_URL}${imgObj.url}`}
                        alt="report"
                        className="report-collage-img"
                        onClick={() => setPreviewImage(`${API_URL}${imgObj.url}`)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          !loading && <p className="no-report-msg">No reports found.</p>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            ref={modalRef}
          >
            <div className="modal-scrollable">
              <h3>{editReportId ? "Edit Report" : "Add New Report"}</h3>

              <label>Title:</label>
              <input
                type="text"
                placeholder="Title"
                value={newReport.title}
                onChange={(e) =>
                  setNewReport({ ...newReport, title: e.target.value })
                }
                tabIndex="0"
              />

              <label>Description:</label>
              <textarea
                placeholder="Description"
                value={newReport.description}
                onChange={(e) =>
                  setNewReport({ ...newReport, description: e.target.value })
                }
                tabIndex="0"
              />

              <div className="address-fields">
                <label>Street Address:</label>
                <input
                  type="text"
                  placeholder="e.g. 45 Rizal Avenue"
                  value={newReport.addressStreet}
                  onChange={(e) =>
                    setNewReport({ ...newReport, addressStreet: e.target.value })
                  }
                  tabIndex="0"
                />
                <label>Barangay:</label>
                <select
                  value={newReport.barangay}
                  onChange={(e) =>
                    setNewReport({ ...newReport, barangay: e.target.value })
                  }
                  tabIndex="0"
                >
                  {/* Filter "All" out of the form dropdown */}
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
                onChange={(e) =>
                  setNewReport({ ...newReport, category: e.target.value })
                }
                tabIndex="0"
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
                  // Use the report's current location if editing, otherwise default to Olongapo
                  center={[
                    newReport.lat || 14.8477,
                    newReport.lng || 120.2879,
                  ]}
                  zoom={newReport.lat ? 16 : 13}
                  style={{ height: 250, width: "100%", marginBottom: 10 }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap contributors"
                  />
                  {/* Marker will show if location is picked/exists */}
                  {newReport.lat && newReport.lng && (
                    <Marker position={[newReport.lat, newReport.lng]} />
                  )}
                  <LocationPicker
                    setLocation={(latlng) =>
                      setNewReport({
                        ...newReport,
                        lat: latlng.lat,
                        lng: latlng.lng,
                      })
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
                    // Limit to 5 images
                    const files = Array.from(e.target.files).slice(0, 5);
                    setNewReport((prev) => ({ ...prev, images: files }));
                  }}
                  hidden
                />
              </label>

              {newReport.images && newReport.images.length > 0 && (
                <div
                  className={`report-images images-${newReport.images.length}`}
                >
                  {newReport.images.map((file, idx) => (
                    <img
                      key={idx}
                      src={
                        typeof file === "string"
                          ? file
                          : URL.createObjectURL(file)
                      }
                      alt={`preview-${idx}`}
                      className="report-collage-img"
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
                  resetNewReport(); // Reset fields on cancel
                }}
                tabIndex="0"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddOrUpdateReport}
                tabIndex="0"
              >
                {editReportId ? "Update" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {isDeleteConfirmOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Delete Report</h3>
            <p>
              Are you sure you want to delete "{deleteTarget?.title}"?
            </p>
            <div className="delete-actions">
              <button onClick={handleDelete}>Yes, Delete</button>
              <button onClick={() => setIsDeleteConfirmOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Preview */}
      {previewImage && (
        <div className="fullscreen-modal" onClick={() => setPreviewImage(null)}>
          <img
            src={previewImage}
            alt="Full screen"
            className="fullscreen-image"
          />
        </div>
      )}
    </div>
  );
}

export default Reports;