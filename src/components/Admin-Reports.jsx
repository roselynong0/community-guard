import React, { useState, useEffect, useCallback } from "react";
import { FaEdit, FaTrashAlt, FaSearch, FaRedo } from "react-icons/fa";
import "./Reports.css";
import "./admin-report.css"; 

const API_URL = "http://localhost:5000/api";
const REPORT_STATUSES = ["Pending", "Ongoing", "Resolved"];

function AdminReports({ token }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [barangay, setBarangay] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All"); 
  const [sort, setSort] = useState("latest");
  const [previewImage, setPreviewImage] = useState(null);
  const [notification, setNotification] = useState(null);
  const [highlightedReportId, setHighlightedReportId] = useState(null);

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

  // Notification handler
  const showNotification = useCallback((message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // Fetch reports from API
  const fetchReports = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/reports?limit=50&sort=${sort}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch reports');
      }

      const data = await response.json();
      if (data.status === "success") {
        // Transform the data to match our component structure
        const transformedReports = data.reports.map(report => ({
          id: report.id,
          user: `${report.reporter?.firstname || 'Unknown'} ${report.reporter?.lastname || ''}`.trim(),
          user_verified: report.reporter?.isverified || false,
          user_id: report.user_id,
          date: report.created_at,
          category: report.category,
          addressStreet: report.address_street || '',
          barangay: report.address_barangay || 'Unknown',
          title: report.title,
          description: report.description,
          status: report.status,
          images: report.images?.map(img => img.url) || []
        }));
        setReports(transformedReports);
      } else {
        throw new Error(data.message || 'Failed to fetch reports');
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      showNotification('Failed to load reports. Please try again.', 'error');
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [token, sort, showNotification]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Handle highlight parameter from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const highlightId = urlParams.get('highlight');
    if (highlightId) {
      setHighlightedReportId(parseInt(highlightId));
      // Scroll to the highlighted report after a short delay
      setTimeout(() => {
        const reportElement = document.getElementById(`report-${highlightId}`);
        if (reportElement) {
          reportElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Remove highlight after 3 seconds
          setTimeout(() => {
            setHighlightedReportId(null);
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
          }, 3000);
        }
      }, 500);
    }
  }, [reports]); // Depend on reports so it runs after reports are loaded

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

  const handleUpdateStatus = async () => {
    if (!selectedReport || !newStatus || !token) return;

    try {
      const response = await fetch(`${API_URL}/reports/${selectedReport.id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          status: newStatus
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update status');
      }

      const data = await response.json();
      if (data.status === "success") {
        // Update local state
        setReports(prevReports =>
          prevReports.map(r =>
            r.id === selectedReport.id ? { ...r, status: newStatus } : r
          )
        );
        
        showNotification(`Report status updated to ${newStatus}`, 'success');
        
        // Close modal
        setIsStatusModalOpen(false);
        setSelectedReport(null);
        setNewStatus("");
        
        // Backend handles sending notification to the user
      } else {
        throw new Error(data.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating report status:', error);
      showNotification(`Failed to update status: ${error.message}`, 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !token) return;

    try {
      const response = await fetch(`${API_URL}/reports/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete report');
      }

      const data = await response.json();
      if (data.status === "success") {
        // Update local state
        setReports(prevReports => 
          prevReports.filter(r => r.id !== deleteTarget.id)
        );
        
        showNotification('Report deleted successfully', 'success');
        
        // Close modal
        setIsDeleteConfirmOpen(false);
        setDeleteTarget(null);
        
        // Backend handles sending notification to the user about deletion
      } else {
        throw new Error(data.message || 'Failed to delete report');
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      showNotification(`Failed to delete report: ${error.message}`, 'error');
    }
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
    <div className="admin-container">
      <div className="admin-header-row">
        <h2>All Community Reports</h2>
      </div>

      <div className="admin-top-controls">
        <div className="admin-search-container">
          <input
            type="text"
            placeholder="Search reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)} 
            className="admin-search-input" 
          />
          <FaSearch className="admin-search-icon" />
        </div>
        <select 
          value={category} 
          onChange={(e) => setCategory(e.target.value)}
          className="admin-filter-select"
        >
          <option value="All">All Categories</option>
          <option value="Concern">Concern</option>
          <option value="Crime">Crime</option>
          <option value="Hazard">Hazard</option>
          <option value="Lost&Found">Lost & Found</option>
          <option value="Others">Others</option>
        </select>
        <select 
          value={barangay} 
          onChange={(e) => setBarangay(e.target.value)}
          className="admin-filter-select"
        >
          {barangays.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
          className="admin-filter-select"
        >
          <option value="All">All Statuses</option>
          {REPORT_STATUSES.map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        <select 
          value={sort} 
          onChange={(e) => setSort(e.target.value)}
          className="admin-filter-select"
        >
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

            return (
              <div
                key={report.id}
                id={`report-${report.id}`}
                className={`report-card fade-in ${highlightedReportId === report.id ? 'highlighted-report' : ''}`}
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

      {/* Notification */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
}

export default AdminReports;