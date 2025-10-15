import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { FaEdit, FaTrashAlt, FaSearch, FaRedo, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import "./Reports.css";
import RealtimeStatus from "./RealtimeStatus"; 

const API_URL = "http://localhost:5000/api";
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

// --- NEW Hook for Arrow Key Navigation in Filter Controls ---
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
                    // If no element is currently focused in the list, focus the first one
                    focusableElements[0]?.focus();
                } else if (currentIndex < focusableElements.length - 1) {
                    // Move to the next element
                    focusableElements[currentIndex + 1].focus();
                } else {
                    // Loop to the first element (optional, but often helpful)
                    focusableElements[0].focus();
                }
                event.preventDefault(); // Prevent default scroll/behavior
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                if (currentIndex === -1) {
                    // If no element is currently focused in the list, focus the last one
                    focusableElements[focusableElements.length - 1]?.focus();
                } else if (currentIndex > 0) {
                    // Move to the previous element
                    focusableElements[currentIndex - 1].focus();
                } else {
                    // Loop to the last element (optional)
                    focusableElements[focusableElements.length - 1].focus();
                }
                event.preventDefault(); // Prevent default scroll/behavior
            }
        };

        window.addEventListener('keydown', handleArrowNavigation);
        return () => window.removeEventListener('keydown', handleArrowNavigation);
    }, [containerRef, selector]);
};
// -------------------------------------------------------------


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
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false); // Prevent double submissions

    const [expandedPosts, setExpandedPosts] = useState([]);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    
    const barangays = [
        "All Barangay", "Barretto", "East Bajac-Bajac", "East Tapinac", "Gordon Heights",
        "Kalaklan", "Mabayuan", "New Asinan", "New Banicain", "New Cabalan",
        "New Ilalim", "New Kababae", "New Kalalake", "Old Cabalan", "Pag-Asa",
        "Santa Rita", "West Bajac-Bajac", "West Tapinac",
    ];

    // --- REFS for Keyboard Navigation ---
    const filterContainerRef = useRef(null);
    // Elements we want to navigate between with arrow keys
    const filterSelector = 'input.admin-search-input, .admin-top-controls .admin-filter-select, .reports-list button:first-child'; 
    useKeyboardNavigation(filterContainerRef, filterSelector);
    // -----------------------------------

    // Notification handler
    const showNotification = useCallback((message, type = "success") => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    }, []);

    // --- Modal Control Functions for Accessibility ---
    const closeStatusModal = useCallback(() => {
        if (!isUpdatingStatus) { // Only allow closing if not updating
            setIsStatusModalOpen(false);
            setSelectedReport(null);
            setNewStatus("");
            setIsUpdatingStatus(false); // Reset state
        }
    }, [isUpdatingStatus]);

    const openStatusModal = (report) => {
        setSelectedReport(report);
        setNewStatus(report.status);
        setIsStatusModalOpen(true);
    };

    const closeDeleteConfirm = useCallback(() => {
        setIsDeleteConfirmOpen(false);
        setDeleteTarget(null);
    }, []);

    const openDeleteConfirm = (report) => {
        setDeleteTarget(report);
        setIsDeleteConfirmOpen(true);
    };

    // Use the custom hook to handle focus trapping and ESC key for both modals
    const statusRef = useAriaModal(isStatusModalOpen, closeStatusModal);
    const deleteRef = useAriaModal(isDeleteConfirmOpen, closeDeleteConfirm);
    // --------------------------------------------------

    // Fetch reports from API (kept original logic)
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
                        images: report.images || []
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

    // 🔄 SMART REAL-TIME UPDATES FOR ADMIN - Only fetch when needed
    const [lastUpdateTime, setLastUpdateTime] = useState(null);
    const [isConnected, setIsConnected] = useState(true);
    const [changeType, setChangeType] = useState(null);

    // ✅ SORTING VALIDATION: Ensure reports maintain correct created_at order
    const validateReportSorting = useCallback((reports, currentSort) => {
        // Add defensive checks
        if (!reports || !Array.isArray(reports)) {
            console.warn("⚠️ Admin validation: Invalid reports array", reports);
            return false;
        }
        
        if (reports.length < 2) return true;
        
        try {
            for (let i = 0; i < reports.length - 1; i++) {
                const currentReport = reports[i];
                const nextReport = reports[i + 1];
                
                // Check if reports have valid created_at fields
                if (!currentReport?.created_at || !nextReport?.created_at) {
                    console.warn("⚠️ Admin validation: Reports missing created_at field", { currentReport, nextReport });
                    // Allow the update if some reports don't have created_at (better to show data than blank page)
                    continue;
                }
                
                const current = new Date(currentReport.created_at);
                const next = new Date(nextReport.created_at);
                
                // Check for invalid dates
                if (isNaN(current.getTime()) || isNaN(next.getTime())) {
                    console.warn("⚠️ Admin validation: Invalid date format", { 
                        current: currentReport.created_at, 
                        next: nextReport.created_at 
                    });
                    continue;
                }
                
                if (currentSort === "latest") {
                    // For "latest", newer reports should come first (DESC order)
                    if (current < next) {
                        console.warn("⚠️ Admin sort validation failed: Reports not in DESC order", {
                            index: i,
                            current: currentReport.created_at,
                            next: nextReport.created_at
                        });
                        return false;
                    }
                } else {
                    // For "oldest", older reports should come first (ASC order)  
                    if (current > next) {
                        console.warn("⚠️ Admin sort validation failed: Reports not in ASC order", {
                            index: i,
                            current: currentReport.created_at,
                            next: nextReport.created_at
                        });
                        return false;
                    }
                }
            }
            return true;
        } catch (error) {
            console.error("❌ Admin sort validation error:", error);
            // Return true to allow the update rather than causing a blank page
            return true;
        }
    }, []);

    useEffect(() => {
        if (!token) return;

        let pollInterval;
        
        // Smart polling - only fetch if we haven't made recent changes
        const smartPoll = async () => {
            const now = Date.now();
            
            // Skip polling if we just made a change (within last 10 seconds)
            if (lastUpdateTime && (now - lastUpdateTime) < 10000) {
                console.log("⏭️ Admin skipping poll - recent update detected");
                return;
            }

            try {
                console.log(`🔄 Admin smart polling for updates... (sort: ${sort} → ${sort === "latest" ? "desc" : "asc"})`);
                const response = await fetch(`${API_URL}/reports?sort=${sort === "latest" ? "desc" : "asc"}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data?.reports) {
                        const newReports = data.reports;
                        
                        // ✅ UPDATE WITH DEFENSIVE VALIDATION - Prevent blank pages
                        setReports(prevReports => {
                            // Defensive checks
                            if (!newReports || !Array.isArray(newReports)) {
                                console.warn("❌ Admin: Invalid reports data received", newReports);
                                return prevReports;
                            }
                            
                            const hasChanges = JSON.stringify(prevReports) !== JSON.stringify(newReports);
                            
                            if (!hasChanges) {
                                return prevReports; // No changes, keep existing state
                            }
                            
                            // Only validate sorting if we have valid data
                            const isSortingCorrect = validateReportSorting(newReports, sort);
                            
                            if (isSortingCorrect) {
                                console.log(`✅ Admin updates detected - applying changes (${sort} order validated)`);
                                return newReports;
                            } else {
                                // If sorting is incorrect but we have data, log warning but still update to prevent blank page
                                console.warn(`⚠️ Admin: Sorting validation failed but applying update to prevent blank page (${sort})`);
                                return newReports;
                            }
                        });
                    }
                    setIsConnected(true);
                } else {
                    console.error("❌ Admin poll failed:", response.status);
                    setIsConnected(false);
                }
            } catch (error) {
                console.error("❌ Admin smart poll error:", error);
                setIsConnected(false);
            }
        };

        // Start smart polling every 8 seconds
        pollInterval = setInterval(smartPoll, 8000);

        return () => {
            clearInterval(pollInterval);
            console.log("🛑 Admin smart polling stopped");
        };
    }, [token, sort, lastUpdateTime, validateReportSorting]);

    // Handle highlight parameter from URL (kept original logic)
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

        // Prevent double submissions
        if (isUpdatingStatus) {
            console.log("⚠️ Already updating status, ignoring duplicate request");
            return;
        }

        if (newStatus === selectedReport.status) {
            showNotification(`Status is already set to ${newStatus}.`, 'info');
            closeStatusModal();
            return;
        }

        setIsUpdatingStatus(true);

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
                // ✅ DEFENSIVE STATUS UPDATE - Ensure we don't break the reports list
                setReports(prevReports => {
                    if (!prevReports || !Array.isArray(prevReports)) {
                        console.error("❌ Admin: Invalid reports state during status update");
                        return prevReports;
                    }
                    
                    const updatedReports = prevReports.map(r =>
                        r.id === selectedReport.id ? { ...r, status: newStatus } : r
                    );
                    
                    console.log(`✅ Admin status update: Report ${selectedReport.id} status changed to ${newStatus}`);
                    return updatedReports;
                });
                
                setLastUpdateTime(Date.now()); // Mark that we made a change
                setChangeType('status'); // Set the change type for status indicator
                
                showNotification(
                    `✅ Report status updated: ${selectedReport.status} → ${newStatus}. User has been notified.`, 
                    'success'
                );
                
                closeStatusModal();
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
                setReports(prevReports => 
                    prevReports.filter(r => r.id !== deleteTarget.id)
                );
                setLastUpdateTime(Date.now()); // Mark that we made a change
                setChangeType('delete'); // Set the change type for status indicator
                
                showNotification('Report deleted successfully!', 'success');
                
                closeDeleteConfirm();
            } else {
                throw new Error(data.message || 'Failed for delete report');
            }
        } catch (error) {
            console.error('Error deleting report:', error);
            showNotification(`Delete failed: ${error.message}`, 'error');
        }
    };

    // Filtered reports with defensive error handling
    const filteredReports = useMemo(() => {
        try {
            if (!reports || !Array.isArray(reports)) {
                console.warn("⚠️ Admin: Reports is not a valid array", reports);
                return [];
            }
            
            const filtered = reports
                .filter((r) => {
                    // Defensive check for each report
                    if (!r || typeof r !== 'object') {
                        console.warn("⚠️ Admin: Invalid report object", r);
                        return false;
                    }
                    return category === "All" ? true : r.category === category;
                })
                .filter((r) => (barangay === "All" ? true : r.barangay === barangay))
                .filter((r) => (statusFilter === "All" ? true : r.status === statusFilter))
                .filter((r) => {
                    try {
                        const reporterName = r.reporter 
                            ? `${r.reporter.firstname || ""} ${r.reporter.lastname || ""}`.trim()
                            : "Unknown User";
                        const title = r.title || "";
                        return title.toLowerCase().includes(search.toLowerCase()) ||
                               reporterName.toLowerCase().includes(search.toLowerCase());
                    } catch (error) {
                        console.warn("⚠️ Admin: Error filtering report", r, error);
                        return false;
                    }
                });
                
            console.log(`📊 Admin filtered reports: ${filtered.length} of ${reports.length} total`);
            return filtered;
        } catch (error) {
            console.error("❌ Admin: Error filtering reports", error);
            return [];
        }
    }, [reports, category, barangay, statusFilter, search]);

    return (
        <div className="admin-container">
            <div className="admin-header-row">
                <h2>All Community Reports</h2>
            </div>

            {/* IMPROVEMENT: Added ref to the filter container for keyboard navigation */}
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
                
                <label htmlFor="barangay-filter" className="sr-only">Filter by Barangay</label>
                <select 
                    id="barangay-filter"
                    value={barangay} 
                    onChange={(e) => setBarangay(e.target.value)}
                    className="admin-filter-select"
                    aria-label="Filter reports by barangay"
                >
                    {barangays.map((b) => (
                        <option key={b} value={b === "All Barangay" ? "All" : b}>{b}</option>
                    ))}
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

            <div className="reports-list">
                {(() => {
                    console.log(`🔍 Admin render debug: loading=${loading}, reports.length=${reports?.length}, filteredReports.length=${filteredReports?.length}`);
                    return null;
                })()}
                {loading ? (
                    <div className="loading-container" role="status" aria-live="polite">
                        <div className="spinner"></div>
                        <p>Loading reports...</p>
                    </div>
                ) : reports.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center' }}>
                        <p>No reports found.</p>
                        <button onClick={fetchReports} style={{ marginTop: '10px' }}>
                            <FaRedo aria-hidden="true" /> Retry Loading Reports
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
                                        <span className={`status-badge status-${report.status?.toLowerCase() || 'pending'}`}>
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
                                            onClick={() => openDeleteConfirm(report)}
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
                                        {report.images.map((imgObj, idx) => (
                                            <img
                                                key={idx}
                                                src={`${API_URL}${imgObj.url}`}
                                                alt={`Report evidence photo ${idx + 1}`}
                                                className="report-collage-img"
                                                onClick={() => setPreviewImage(`${API_URL}${imgObj.url}`)}
                                                tabIndex="0"
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPreviewImage(`${API_URL}${imgObj.url}`); }}
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
                                <span 
                                    className={`status-badge status-${selectedReport.status?.toLowerCase() || 'pending'}`} 
                                    style={{ marginLeft: '10px' }}
                                >
                                    {selectedReport.status || 'Unknown'} 
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
                    onClick={closeDeleteConfirm}
                    role="dialog" 
                    aria-modal="true" 
                    aria-labelledby="delete-modal-title"
                    tabIndex="-1" 
                    ref={deleteRef}
                >
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3 id="delete-modal-title">Delete Report</h3>
                        <p>Are you sure you want to delete report: "<strong>{deleteTarget?.title}</strong>" from user: {
                            deleteTarget?.reporter 
                                ? `${deleteTarget.reporter.firstname || ""} ${deleteTarget.reporter.lastname || ""}`.trim()
                                : "Unknown User"
                            }?</p>
                        <div className="delete-actions">
                            <button onClick={handleDelete}>Yes, Delete Permanently</button>
                            <button onClick={closeDeleteConfirm}>Cancel</button>
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

            {/* Real-time Status Indicator */}
            <RealtimeStatus 
                isConnected={isConnected}
                lastUpdate={lastUpdateTime}
                changeType={changeType}
            />
        </div>
    );
}

export default AdminReports;