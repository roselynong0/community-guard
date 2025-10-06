import React, { useState, useEffect, useCallback } from "react";
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
  const [loading, setLoading] = useState(false); // ✅ added loading state
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [barangay, setBarangay] = useState("All");
  const [sort, setSort] = useState("latest");
  const [showHistory, setShowHistory] = useState(false); 
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

  const barangays = [
    "All", "Barretto", "East Bajac-Bajac", "East Tapinac", "Gordon Heights",
    "Kalaklan", "Mabayuan", "New Asinan", "New Banicain", "New Cabalan",
    "New Ilalim", "New Kababae", "New Kalalake", "Old Cabalan", "Pag-Asa",
    "Santa Rita", "West Bajac-Bajac", "West Tapinac",
  ];

  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedCategory, setAppliedCategory] = useState("All");
  const [appliedBarangay, setAppliedBarangay] = useState("All");
  const token = session?.token;

  // ✅ Fetch reports
  const fetchReports = useCallback(async () => {
    if (!token) return;
    setLoading(true); // start loading
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
      setLoading(false); // end loading
    }
  }, [token, sort]);

  // ✅ Run on mount & whenever token/sort changes
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Add or update report
  const handleAddOrUpdateReport = async () => {
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
      } else {
        await axios.post(`${API_URL}/reports`, formData, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
        });
      }

      resetNewReport();
      setIsModalOpen(false);
      setEditReportId(null);
      fetchReports();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (report) => {
    setEditReportId(report.id);
    setNewReport({
      title: report.title || "",
      description: report.description || "",
      category: report.category || "Concern",
      barangay: report.barangay || "All",
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
      await axios.patch(`${API_URL}/reports/${deleteTarget.id}`,
        { deleted: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsDeleteConfirmOpen(false);
      setDeleteTarget(null);
      fetchReports();
    } catch (err) {
      console.error(err);
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

// Correct toggle logic
const filteredReports = reports
    .filter(r => showHistory
    ? String(r.user_id) === String(session?.user?.id) // My Reports
    : true                                            // All Reports
    )
    .filter(r => appliedCategory === "All" || r.category === appliedCategory)
    .filter(r => appliedBarangay === "All" || r.address_barangay === appliedBarangay)
    .filter(r => {
    if (!appliedSearch) return true;
    const searchLower = appliedSearch.toLowerCase();
    return (r.title || "").toLowerCase().includes(searchLower);
    });

      
  return (
    <div className="reports-container">
      {/* Header */}
      <div className="header-row">
        <h2>Community Reports</h2>
        <button className="history-btn" onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? "My Reports" : "All Reports"}
        </button>
      </div>


      {/* Filters */}
      <div className="top-controls">
        <input
          type="text"
          placeholder="Search reports..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        {/* Category filter - applies immediately */}
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setAppliedCategory(e.target.value); // apply immediately
          }}
        >
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

        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="latest">Latest → Oldest</option>
          <option value="oldest">Oldest → Latest</option>
        </select>

        {/* Buttons Group */}
        <div className="filter-btns">
          <button
            className="filter-icon-btn"
            title="Search"
            onClick={() => {
              setAppliedSearch(search);
              setAppliedCategory(category);
              setAppliedBarangay(barangay);
            }}
          >
            <FaSearch />
          </button>
          <button
            className="filter-icon-btn"
            title="Reset"
            onClick={() => {
              setSearch("");
              setCategory("All");
              setBarangay("All");
              setAppliedSearch("");
              setAppliedCategory("All");
              setAppliedBarangay("All");
            }}
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

      {/* ✅ Loading Indicator */}
      {loading && (
      <div className="loading-overlay loading-compact"> <div className="spinner" /> <p>Loading reports...</p> </div>
      )}
      
      {/* Reports List */}
      <div className="reports-list">
        {!loading && filteredReports.length > 0 ? (
          filteredReports.map((report) => {
            const isExpanded = expandedPosts.includes(report.id);
            const displayDescription = isExpanded
              ? report.description
              : `${(report.description || "").slice(0, 130)}${(report.description?.length || 0) > 130 ? "..." : ""}`;

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
                        {report.reporter ? (
                          <>
                            {`${report.reporter.firstname || ""} ${report.reporter.lastname || ""}`.trim()}
                            <span
                              className={`user-verified-badge ${
                                report.reporter.isverified ? "verified" : "unverified"
                              }`}
                            >
                              {report.reporter.isverified ? "Verified" : "Unverified"}
                            </span>
                          </>
                        ) : (
                          <>
                            Unknown User
                            <span className="user-verified-badge unverified">Unverified</span>
                          </>
                        )}
                      </p>
                      <p className="report-subinfo">
                        {report.created_at ? new Date(report.created_at).toLocaleString() : ""} ·{" "}
                        {report.category || "N/A"}
                      </p>
                      <p className="report-address-info">
                        {(report.address_street || "")}, {(report.address_barangay || "")}, Olongapo City
                      </p>
                    </div>
                  </div>

                  <div className="report-header-actions">
                    <span className={`status-badge status-${(report.status || "pending").toLowerCase()}`}>
                      {report.status || "Pending"}
                    </span>

                  {session?.user && String(report.user_id) === String(session.user.id) && (
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
                {report.images?.length > 0 && (
                  <div className="report-images">
                    {report.images.map((imgObj, idx) =>
                      imgObj?.url ? (
                        <img
                          key={idx}
                          src={`${API_URL}${imgObj.url}`}
                          alt="report"
                          className="report-image"
                          onClick={() => {
                            setPreviewImage(`${API_URL}${imgObj.url}`);
                          }}
                        />
                      ) : null
                    )}
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