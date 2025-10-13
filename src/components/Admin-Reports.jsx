import React, { useState, useEffect, useCallback } from "react";
import { FaEdit, FaTrashAlt, FaSearch, FaRedo, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import "./Reports.css"; 

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
      const sortParam = sort === "latest" ? "desc" : "asc";
      const response = await fetch(`${API_URL}/reports?limit=50&sort=${sortParam}`, {
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
        // Ensure data.reports is an array
        const reports = Array.isArray(data.reports) ? data.reports : [];
        
        // Transform the data to match our component structure
        const transformedReports = reports.map(report => {
          // Create a fallback reporter if none exists
          const fallbackReporter = {
            id: 0,
            firstname: "Unknown",
            lastname: "User",
            verified: false,
            isverified: false,
            avatar_url: null
          };
          
          return {
            id: report.id,
            reporter: report.reporter || fallbackReporter,
            user_id: report.user_id,
            date: report.created_at,
            created_at: report.created_at,
            category: report.category || 'N/A',
            addressStreet: report.address_street || 'No address',
            barangay: report.address_barangay || 'Unknown',
            address_barangay: report.address_barangay || 'Unknown',
            title: report.title || 'Untitled Report',
            description: report.description || 'No description provided',
            status: report.status || 'Pending',
            images: report.images?.map(img => img.url) || []
          };
        });
        setReports(transformedReports);
      } else {
        throw new Error(data.message || 'Failed to fetch reports');
      }
    } catch (error) {
      console.error('Error fetching reports:', error);  
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [token, sort]);

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

    // Prevent updating if status hasn't changed
    if (newStatus === selectedReport.status) {
      showNotification('Status is already set to ' + newStatus, 'info');
      setIsStatusModalOpen(false);
      return;
    }

    try {
      console.log(`Updating report ${selectedReport.id} status: ${selectedReport.status} → ${newStatus}`);
      
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
        // Real-time update: Update the specific report status in the list
        setReports(prevReports =>
          prevReports.map(r =>
            r.id === selectedReport.id ? { ...r, status: newStatus } : r
          )
        );
        
        showNotification(
          `✅ Report status updated: ${selectedReport.status} → ${newStatus}. User has been notified.`, 
          'success'
        );
        
        // Close modal
        setIsStatusModalOpen(false);
        setSelectedReport(null);
        setNewStatus("");
        
        console.log('Status update successful:', data);
      } else {
        throw new Error(data.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating report status:', error);
      showNotification(`❌ Failed to update status: ${error.message}`, 'error');
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
        // Real-time update: Remove the deleted report from the list
        setReports(prevReports => 
          prevReports.filter(r => r.id !== deleteTarget.id)
        );
        
        showNotification('Report deleted successfully', 'success');
        
        // Close modal
        setIsDeleteConfirmOpen(false);
        setDeleteTarget(null);
        
        // Backend handles sending notification to the user about deletion
      } else {
        throw new Error(data.message || 'Failed for delete report');
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
      (r) => {
        const reporterName = r.reporter 
          ? `${r.reporter.firstname || ""} ${r.reporter.lastname || ""}`.trim()
          : "Unknown User";
        return r.title.toLowerCase().includes(search.toLowerCase()) ||
               reporterName.toLowerCase().includes(search.toLowerCase());
      }
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
        ) : reports.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p>No reports found.</p>
            <button onClick={fetchReports} style={{ marginTop: '10px' }}>
              Retry Loading Reports
            </button>
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
                    <img 
                      src={report.reporter?.avatar_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E"} 
                      alt="profile" 
                      className="profile-pic" 
                      onError={(e) => {
                        e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
                      }}
                    />
                    <div className="report-header-text">
                      <p className="report-user">
                        {report.reporter ? (
                          <>
                            {`${report.reporter.firstname || ""} ${
                              report.reporter.lastname || ""
                            }`.trim()}{" "}
                            <span
                              className={`admin-verification-status ${
                                report.reporter.verified ? "fully-verified" : "unverified"
                              }`}
                            >
                              {report.reporter.verified ? (
                                <><FaCheckCircle />Verified</>
                              ) : (
                                <><FaTimesCircle />Unverified</>
                              )}
                            </span>
                          </>
                        ) : (
                          <>
                            Unknown User{" "}
                            <span className="admin-verification-status unverified">
                              <FaTimesCircle />Unverified
                            </span>
                          </>
                        )}
                      </p>
                      <p className="report-subinfo">
                        {report.date
                          ? new Date(report.date).toLocaleString()
                          : ""}{" "}
                        · {report.category}
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
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p>No reports match your current filters.</p>
            <button 
              onClick={() => {
                setSearch("");
                setCategory("All");
                setBarangay("All");
                setStatusFilter("All");
              }}
              style={{ marginTop: '10px' }}
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Status Modal */}
      {isStatusModalOpen && selectedReport && (
        <div className="modal-overlay" onClick={() => setIsStatusModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>📝 Update Report Status</h3>
            <div style={{ marginBottom: '15px' }}>
              <p><strong>Report:</strong> {selectedReport.title}</p>
              <p><strong>Reporter:</strong> {
                selectedReport.reporter 
                  ? `${selectedReport.reporter.firstname || ""} ${selectedReport.reporter.lastname || ""}`.trim()
                  : "Unknown User"
              }</p>
              <p><strong>Category:</strong> {selectedReport.category}</p>
              <p><strong>Location:</strong> {selectedReport.addressStreet}, {selectedReport.barangay}</p>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <p><strong>Current Status:</strong> 
                <span className={`status-badge status-${selectedReport.status.toLowerCase()}`} style={{ marginLeft: '10px' }}>
                  {selectedReport.status}
                </span>
              </p>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Select New Status:
              </label>
              <select 
                value={newStatus} 
                onChange={(e) => setNewStatus(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                {REPORT_STATUSES.map(status => (
                  <option key={status} value={status}>
                    {status} {status === selectedReport.status ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            </div>
            
            {newStatus !== selectedReport.status && (
              <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f0f8ff', borderRadius: '4px', fontSize: '0.9em' }}>
                <p style={{ margin: 0, color: '#0066cc' }}>
                  <strong>📧 Note:</strong> The user will receive a notification about this status change.
                </p>
              </div>
            )}
            
            <div className="modal-buttons edit-actions">
              <button onClick={() => setIsStatusModalOpen(false)}>Cancel</button>
              <button 
                onClick={handleUpdateStatus}
                disabled={newStatus === selectedReport.status}
                style={{ 
                  opacity: newStatus === selectedReport.status ? 0.6 : 1,
                  cursor: newStatus === selectedReport.status ? 'not-allowed' : 'pointer'
                }}
              >
                {newStatus === selectedReport.status ? 'No Change' : 'Update Status'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteConfirmOpen && (
        <div className="modal-overlay" onClick={() => setIsDeleteConfirmOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Report</h3>
            <p>Are you sure you want to delete report: "<strong>{deleteTarget?.title}</strong>" from user: {
              deleteTarget?.reporter 
                ? `${deleteTarget.reporter.firstname || ""} ${deleteTarget.reporter.lastname || ""}`.trim()
                : "Unknown User"
            }?</p>
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