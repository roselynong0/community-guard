import React, { useState, useEffect, useCallback, useRef } from "react";
import { FaEdit, FaTrashAlt, FaSearch, FaRedo, FaCheckCircle, FaTimesCircle, FaCheck, FaTimes } from "react-icons/fa";
import { API_CONFIG, getApiUrl } from "../utils/apiConfig";
import "./Reports.css";

const REPORT_STATUSES = ["Pending", "Ongoing", "Resolved"];

// Utility Hook for Modal Accessibility (Focus trap and Esc key)
const useAriaModal = (isOpen, onClose) => {
    const modalRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;

        const modalElement = modalRef.current;
        if (!modalElement) return;

        // 1. Focus the modal container on open
        const focusTimeout = setTimeout(() => {
            modalElement.focus();
        }, 0);

        // 2. Trap focus within the modal
        const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        
        const handleTabKeyPress = (e) => {
            if (e.key === 'Tab') {
                const focusableModalElements = [...modalElement.querySelectorAll(focusableElements)]
                    .filter(el => !el.disabled && el.offsetParent !== null);

                if (focusableModalElements.length === 0) return;

                const firstElement = focusableModalElements[0];
                const lastElement = focusableModalElements[focusableModalElements.length - 1];

                if (e.shiftKey) { // Shift + Tab
                    if (document.activeElement === firstElement) {
                        lastElement.focus();
                        e.preventDefault();
                    }
                } else { // Tab
                    if (document.activeElement === lastElement) {
                        firstElement.focus();
                        e.preventDefault();
                    }
                }
            }
        };

        // 3. Close on Escape key press
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        modalElement.addEventListener('keydown', handleKeyDown);
        modalElement.addEventListener('keydown', handleTabKeyPress);

        return () => {
            clearTimeout(focusTimeout);
            modalElement.removeEventListener('keydown', handleKeyDown);
            modalElement.removeEventListener('keydown', handleTabKeyPress);
        };
    }, [isOpen, onClose]);

    return modalRef;
};

// --- Hook for Arrow Key Navigation in Filter Controls ---
const useKeyboardNavigation = (containerRef, selector) => {
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleArrowNavigation = (event) => {
            // Only capture arrows if the current focus is within the filter container
            if (!container.contains(document.activeElement) && event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
                return;
            }

            const focusableElements = Array.from(container.querySelectorAll(selector))
                .filter(el => !el.disabled && el.offsetParent !== null);

            let currentIndex = focusableElements.indexOf(document.activeElement);

            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                if (currentIndex === -1) {
                    focusableElements[0]?.focus();
                } else if (currentIndex < focusableElements.length - 1) {
                    focusableElements[currentIndex + 1].focus();
                } else {
                    focusableElements[0].focus();
                }
                event.preventDefault();
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                if (currentIndex === -1) {
                    focusableElements[focusableElements.length - 1]?.focus();
                } else if (currentIndex > 0) {
                    focusableElements[currentIndex - 1].focus();
                } else {
                    focusableElements[focusableElements.length - 1].focus();
                }
                event.preventDefault();
            }
        };

        window.addEventListener('keydown', handleArrowNavigation);
        return () => window.removeEventListener('keydown', handleArrowNavigation);
    }, [containerRef, selector]);
};
// -----------------------------------------------

function ResponderReports({ token }) {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All"); 
    const [sort, setSort] = useState("latest");
    const [previewImage, setPreviewImage] = useState(null);
    const [notification, setNotification] = useState(null);
    const [highlightedReportId, setHighlightedReportId] = useState(null);
    const [responderBarangay, setResponderBarangay] = useState(null);
    const [responderUserId, setResponderUserId] = useState(null);

    // States for the Status Update Modal
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);
    const [newStatus, setNewStatus] = useState("");
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    const [expandedPosts, setExpandedPosts] = useState([]);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleteReasonOpen, setIsDeleteReasonOpen] = useState(false);
    const [deleteReason, setDeleteReason] = useState('');
    const [deleteReasonOther, setDeleteReasonOther] = useState('');

    const filterContainerRef = useRef(null);
    const filterSelector = 'input.admin-search-input, .admin-top-controls .admin-filter-select, .reports-list button:first-child'; 
    useKeyboardNavigation(filterContainerRef, filterSelector);
    // -----------------------------------

    // Notification handler
    const showNotification = useCallback((message, type = "success") => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    }, []);

    // --- Modal Control Functions ---
    const closeStatusModal = useCallback(() => {
        if (!isUpdatingStatus) {
            setIsStatusModalOpen(false);
            setSelectedReport(null);
            setNewStatus("");
            setIsUpdatingStatus(false);
        }
    }, [isUpdatingStatus]);

    const openStatusModal = (report) => {
        setSelectedReport(report);
        setNewStatus(report.status);
        setIsStatusModalOpen(true);
    };

    const closeDeleteConfirm = useCallback(() => {
        if (!isDeleting) {
            setIsDeleteConfirmOpen(false);
            setDeleteTarget(null);
        }
    }, [isDeleting]);

    const closeDeleteReason = useCallback(() => {
        if (!isDeleting) {
            setIsDeleteReasonOpen(false);
            setDeleteReason('');
            setDeleteReasonOther('');
        }
    }, [isDeleting]);

    const openDeleteReason = (report) => {
        setDeleteTarget(report);
        setDeleteReason('');
        setDeleteReasonOther('');
        setIsDeleteReasonOpen(true);
    };

    const proceedToConfirmDelete = () => {
        if (!deleteReason) return;
        if (deleteReason === 'Other' && !deleteReasonOther.trim()) return;

        setIsDeleteReasonOpen(false);
        setIsDeleteConfirmOpen(true);
    };

    // Use the custom hook to handle focus trapping
    const statusRef = useAriaModal(isStatusModalOpen, closeStatusModal);
    const deleteRef = useAriaModal(isDeleteConfirmOpen, closeDeleteConfirm);
    const reasonRef = useAriaModal(isDeleteReasonOpen, closeDeleteReason);
    // --------------------------------------------------

    // Fetch reports from API
    const fetchReports = useCallback(async () => {
        if (!token || !responderUserId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const sortParam = sort === "latest" ? "desc" : "asc";
            const response = await fetch(getApiUrl(`/api/reports?limit=50&sort=${sortParam}&responder_id=${responderUserId}`), {
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
                const reports = Array.isArray(data.reports) ? data.reports : [];
                
                const transformedReports = reports.map(report => {
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
    }, [token, sort, responderUserId]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    // Fetch responder's barangay and user ID
    useEffect(() => {
        const fetchResponderBarangay = async () => {
            if (!token) return;
            try {
                const response = await fetch(`${getApiUrl('/api/profile')}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await response.json();
                if (data.status === 'success' && data.profile) {
                    if (data.profile.address_barangay) {
                        setResponderBarangay(data.profile.address_barangay);
                    }
                    if (data.profile.id) {
                        setResponderUserId(data.profile.id);
                    }
                }
            } catch (error) {
                console.error('Error fetching responder barangay:', error);
            }
        };
        fetchResponderBarangay();
    }, [token]);

    // Handle highlight parameter from URL
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const highlightId = urlParams.get('highlight');
        if (highlightId) {
            setHighlightedReportId(parseInt(highlightId));
            setTimeout(() => {
                const reportElement = document.getElementById(`report-${highlightId}`);
                if (reportElement) {
                    reportElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => {
                        setHighlightedReportId(null);
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }, 3000);
                }
            }, 500);
        }
    }, [reports]);

    const toggleExpand = (id) => {
        setExpandedPosts((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
    };

    const handleUpdateStatus = async () => {
        if (!selectedReport || !newStatus || !token) return;

        if (isUpdatingStatus) {
            console.log("⚠️ Already updating status, ignoring duplicate request");
            return;
        }

        if (newStatus === selectedReport.status) {
            showNotification('Status is already set to ' + newStatus, 'info');
            closeStatusModal();
            return;
        }

        setIsUpdatingStatus(true);

        try {
            const response = await fetch(getApiUrl(`/api/reports/${selectedReport.id}/status`), {
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
                setReports(prevReports =>
                    prevReports.map(r =>
                        r.id === selectedReport.id ? { ...r, status: newStatus } : r
                    )
                );
                
                showNotification(
                    `✅ Status updated to ${newStatus}. User notified.`, 
                    'success'
                );
                
                closeStatusModal();
            } else {
                throw new Error(data.message || 'Failed to update status');
            }
        } catch (error) {
            console.error('Error updating report status:', error);
            showNotification(`❌ Failed to update status: ${error.message}`, 'error');
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget || !token) return;

        setIsDeleting(true);
        try {
            const response = await fetch(getApiUrl(`/api/reports/${deleteTarget.id}`), {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reason: deleteReason || null, reason_other: deleteReasonOther || null })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to delete report');
            }

            const data = await response.json();
            if (data.status === "success") {
                setReports(prevReports => 
                    prevReports.filter(r => r.id !== deleteTarget.id)
                );
                
                showNotification('Report deleted successfully', 'success');
                
                closeDeleteConfirm();
            } else {
                throw new Error(data.message || 'Failed for delete report');
            }
        } catch (error) {
            console.error('Error deleting report:', error);
            showNotification(`Failed to delete report: ${error.message}`, 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    // Filtered reports - Responders see approved reports + pending reports that are approved
    const filteredReports = reports
        .filter((r) => {
            // Show approved reports (Ongoing/Resolved status)
            if (r.is_approved === true) return true;
            // Show pending reports only if they are approved
            if (r.status === "Pending" && r.is_approved === true) return true;
            return false;
        })
        .filter((r) => (category === "All" ? true : r.category === category))
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
            <div className="header-row">
                <h2>{responderBarangay ? `${responderBarangay} Reports` : 'Loading...'}</h2>
            </div>

            {/* Filter Controls */}
            <div className="admin-top-controls" ref={filterContainerRef}>
                <div className="admin-search-container">
                    <label htmlFor="search-input" className="sr-only">Search reports by title or reporter name</label>
                    <input
                        id="search-input"
                        type="text"
                        placeholder="Search reports..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)} 
                        className="admin-search-input" 
                    />
                    <FaSearch className="admin-search-icon" aria-hidden="true" />
                </div>
                
                <label htmlFor="category-filter" className="sr-only">Filter by Category</label>
                <select 
                    id="category-filter"
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)}
                    className="admin-filter-select"
                    aria-label="Filter reports by category"
                >
                    <option value="All">All Categories</option>
                    <option value="Concern">Concern</option>
                    <option value="Crime">Crime</option>
                    <option value="Hazard">Hazard</option>
                    <option value="Lost&Found">Lost & Found</option>
                    <option value="Others">Others</option>
                </select>
                
                <label htmlFor="status-filter" className="sr-only">Filter by Status</label>
                <select 
                    id="status-filter"
                    value={statusFilter} 
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="admin-filter-select"
                    aria-label="Filter reports by status"
                >
                    <option value="All">All Statuses</option>
                    {REPORT_STATUSES.map(status => (
                        <option key={status} value={status}>{status}</option>
                    ))}
                </select>
                
                <label htmlFor="sort-order" className="sr-only">Sort Order</label>
                <select 
                    id="sort-order"
                    value={sort} 
                    onChange={(e) => setSort(e.target.value)}
                    className="admin-filter-select"
                    aria-label="Sort reports by date"
                >
                    <option value="latest">Latest → Oldest</option>
                    <option value="oldest">Oldest → Latest</option>
                </select>
            </div>

            {/* Reports List */}
            <div className="reports-list">
                {loading ? (
                    <div className="loading-container" role="status" aria-live="polite">
                        <div className="spinner"></div>
                        <p>Loading reports...</p>
                    </div>
                ) : reports.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                        <p style={{ fontSize: '1.1em', color: '#666' }}>No reports assigned</p>
                        <p style={{ color: '#999', marginTop: '10px' }}>You don't have any assigned reports yet.</p>
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
                                aria-labelledby={`report-title-${report.id}`}
                            >
                                <div className="report-header">
                                    <div className="report-header-left">
                                        <img 
                                            src={report.reporter?.avatar_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E"} 
                                            alt={`Profile picture of ${report.reporter?.firstname || "Unknown"}`} 
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
                                                                <><FaCheckCircle aria-hidden="true" />Verified</>
                                                            ) : (
                                                                <><FaTimesCircle aria-hidden="true" />Unverified</>
                                                            )}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <>
                                                        Unknown User{" "}
                                                        <span className="admin-verification-status unverified">
                                                            <FaTimesCircle aria-hidden="true" />Unverified
                                                        </span>
                                                    </>
                                                )}
                                            </p>
                                            <p className="report-subinfo">
                                                {report.date
                                                    ? new Date(report.date).toLocaleString()
                                                    : ""}
                                                {" "}· {report.category}
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
                                        <button 
                                            className="icon-btn edit-btn" 
                                            onClick={() => openStatusModal(report)}
                                            aria-label={`Edit status for report: ${report.title}`}
                                            title="Edit Status"
                                        >
                                            <FaEdit aria-hidden="true" />
                                        </button>
                                        <button 
                                            className="icon-btn delete-btn" 
                                            onClick={() => openDeleteReason(report)}
                                            aria-label={`Delete report: ${report.title}`}
                                            title="Delete Report"
                                        >
                                            <FaTrashAlt aria-hidden="true" />
                                        </button>
                                    </div>
                                </div>

                                <div className="report-caption">
                                    <strong id={`report-title-${report.id}`}>{report.title}</strong>
                                    <p className="report-description-text">
                                        {isExpanded
                                            ? report.description
                                            : `${report.description.slice(0, 150)}${report.description.length > 150 ? "..." : ""}`}
                                        {report.description.length > 150 && (
                                            <button 
                                                className="more-link"
                                                onClick={() => toggleExpand(report.id)}
                                                style={{ cursor: "pointer", color: "#007bff", marginLeft: "5px", background: 'none', border: 'none', padding: 0, textDecoration: 'underline' }}
                                                aria-expanded={isExpanded}
                                                aria-controls={`report-description-full-${report.id}`}
                                            >
                                                {isExpanded ? " Show less" : "...more"}
                                            </button>
                                        )}
                                    </p>
                                </div>

                                {report.images && report.images.length > 0 && (
                                    <div className={`report-images images-${report.images.length}`}>
                                        {report.images.map((img, idx) => (
                                            <img
                                                key={idx}
                                                src={img}
                                                alt={`Report evidence photo ${idx + 1}`}
                                                className="report-collage-img"
                                                onClick={() => setPreviewImage(img)}
                                                tabIndex="0"
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPreviewImage(img); }}
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
                <div 
                    className="modal-overlay" 
                    onClick={() => {
                        if (!isUpdatingStatus) {
                            closeStatusModal();
                        }
                    }}
                    role="dialog" 
                    aria-modal="true" 
                    aria-labelledby="status-modal-title"
                    tabIndex="-1" 
                    ref={statusRef} 
                >
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3 id="status-modal-title">📝 Update Report Status</h3>
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
                            <label htmlFor="new-status-select" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                                Select New Status:
                            </label>
                            <select 
                                id="new-status-select" 
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
                            <button 
                                onClick={closeStatusModal}
                                disabled={isUpdatingStatus}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleUpdateStatus}
                                disabled={newStatus === selectedReport.status || isUpdatingStatus}
                                style={{ 
                                    opacity: (newStatus === selectedReport.status || isUpdatingStatus) ? 0.6 : 1,
                                    cursor: (newStatus === selectedReport.status || isUpdatingStatus) ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {isUpdatingStatus ? 'Updating...' : (newStatus === selectedReport.status ? 'No Change' : 'Update Status')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {isDeleteConfirmOpen && (
                <div 
                    className="modal-overlay" 
                    onClick={!isDeleting ? closeDeleteConfirm : undefined}
                    role="dialog" 
                    aria-modal="true" 
                    aria-labelledby="delete-modal-title"
                    tabIndex="-1" 
                    ref={deleteRef}
                >
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3 id="delete-modal-title">Delete Report</h3>
                        <p>Are you sure you want to permanently delete report: "<strong>{deleteTarget?.title}</strong>" from user: {
                            deleteTarget?.reporter 
                                ? `${deleteTarget.reporter.firstname || ""} ${deleteTarget.reporter.lastname || ""}`.trim()
                                : "Unknown User"
                            }?</p>
                        {deleteReason ? (
                            <div style={{ margin: '8px 0', padding: '8px', background: '#fff7f7', borderRadius: 6 }}>
                                <strong>Reason for deletion:</strong> {deleteReason === 'Other' ? deleteReasonOther : deleteReason}
                            </div>
                        ) : null}
                        <div className="modal-actions">
                            <button 
                                className="cancel-btn" 
                                onClick={closeDeleteConfirm}
                                disabled={isDeleting}
                                style={{ opacity: isDeleting ? 0.6 : 1 }}
                            >
                                Cancel
                            </button>
                            <button 
                                className="confirm-btn" 
                                onClick={handleDelete}
                                disabled={isDeleting}
                                style={{ opacity: isDeleting ? 0.6 : 1 }}
                            >
                                {isDeleting ? 'Deleting...' : 'Yes, Delete Permanently'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Reason Modal */}
            {isDeleteReasonOpen && (
                <div
                    className="modal-overlay"
                    onClick={!isDeleting ? closeDeleteReason : undefined}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="delete-reason-title"
                    tabIndex="-1"
                    ref={reasonRef}
                >
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3 id="delete-reason-title">Report Deletion Reason</h3>
                        <p>Please select the reason why this report should be deleted. This helps auditing and prevents misuse.</p>

                        <label htmlFor="delete-reason-select" style={{ display: 'block', marginBottom: 8, fontWeight: '600' }}>Select reason</label>
                        <select
                            id="delete-reason-select"
                            value={deleteReason}
                            onChange={(e) => setDeleteReason(e.target.value)}
                            style={{ width: '100%', padding: 8, marginBottom: 12, borderRadius: 6, border: '1px solid #ddd' }}
                        >
                            <option value="">-- Select a reason --</option>
                            <option value="Fraudulent / False Report">Fraudulent / False Report</option>
                            <option value="Misinformation">Misinformation</option>
                            <option value="Duplicate">Duplicate Report</option>
                            <option value="Not Community Concern">Not a Community Concern</option>
                            <option value="Spam / Advertisement">Spam / Advertisement</option>
                            <option value="Other">Other (provide details)</option>
                        </select>

                        {deleteReason === 'Other' && (
                            <div style={{ marginBottom: 12 }}>
                                <label htmlFor="delete-reason-other" style={{ display: 'block', marginBottom: 6 }}>Details</label>
                                <input
                                    id="delete-reason-other"
                                    type="text"
                                    value={deleteReasonOther}
                                    onChange={(e) => setDeleteReasonOther(e.target.value)}
                                    placeholder="Provide brief details (required)"
                                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
                                />
                            </div>
                        )}

                        <div className="modal-buttons edit-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button onClick={closeDeleteReason} disabled={isDeleting}>Cancel</button>
                            <button
                                onClick={proceedToConfirmDelete}
                                disabled={isDeleting || !deleteReason || (deleteReason === 'Other' && !deleteReasonOther.trim())}
                                style={{ backgroundColor: '#ef4444', color: '#fff' }}
                            >
                                Continue to Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Fullscreen Image Preview */}
            {previewImage && (
                <div 
                    className="fullscreen-modal" 
                    onClick={() => setPreviewImage(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Full screen image preview. Press escape to close."
                    tabIndex="-1" 
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            setPreviewImage(null);
                        }
                    }}
                >
                    <img src={previewImage} alt="Full screen report image" className="fullscreen-image" />
                    <button 
                        className="close-fullscreen-btn" 
                        onClick={() => setPreviewImage(null)}
                        aria-label="Close image preview"
                        title="Close (Escape)"
                    >
                        &times;
                    </button>
                </div>
            )}

            {/* Notification */}
            {notification && (
                <div 
                    className={`notification ${notification.type}`}
                    role="alert" 
                    aria-live="assertive"
                >
                    {notification.message}
                </div>
            )}
        </div>
    );
}

export default ResponderReports;
