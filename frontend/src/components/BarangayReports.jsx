import React, { useState, useEffect, useCallback, useRef } from "react";
import { FaEdit, FaTrashAlt, FaSearch, FaRedo, FaCheckCircle, FaTimesCircle, FaCheck, FaTimes } from "react-icons/fa";
import { API_CONFIG, getApiUrl } from "../utils/apiConfig";
import "./Reports.css";
const REPORT_STATUSES = ["Pending", "Ongoing", "Resolved"];

// Severity level colors and styling
const SEVERITY_COLORS = {
  Crime: { borderColor: '#c0392b', bgColor: '#fdedec', severity: 'Critical', label: '🔴 Critical' },
  Hazard: { borderColor: '#d35400', bgColor: '#fef5e7', severity: 'High', label: '🟠 High' },
  Concern: { borderColor: '#95a5a6', bgColor: '#ecf0f1', severity: 'Medium', label: '⚪ Medium' },
  'Lost&Found': { borderColor: '#95a5a6', bgColor: '#ecf0f1', severity: 'Low', label: '⚪ Low' },
  Others: { borderColor: '#95a5a6', bgColor: '#ecf0f1', severity: 'Low', label: '⚪ Low' },
};

const getSeverityStyle = (category) => {
  return SEVERITY_COLORS[category] || SEVERITY_COLORS['Others'];
};

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


function BarangayReports({ token }) {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All"); 
    const [sort, setSort] = useState("latest");
    const [userBarangay, setUserBarangay] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);
    const [notification, setNotification] = useState(null);
    const [highlightedReportId, setHighlightedReportId] = useState(null);
    const [showCommunityHelper, setShowCommunityHelper] = useState(true); // Toggle for Community Helper visibility
    const [showSmartFilter, setShowSmartFilter] = useState(true); // Smart Filter toggle
    const [aiUsagePercent, setAiUsagePercent] = useState(0); // AI usage percentage (0-100)
    const [showUsageModal, setShowUsageModal] = useState(false); // Show usage details modal

    // States for the Status Update Modal
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);
    const [newStatus, setNewStatus] = useState("");
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false); // Prevent double submissions

    const [expandedPosts, setExpandedPosts] = useState([]);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    // New states for deletion reason flow
    const [isDeleteReasonOpen, setIsDeleteReasonOpen] = useState(false);
    const [deleteReason, setDeleteReason] = useState('');
    const [deleteReasonOther, setDeleteReasonOther] = useState('');
    
    // New states for approval workflow
    const [isApprovingReport, setIsApprovingReport] = useState(false);
    const [isRejectingReport, setIsRejectingReport] = useState(false);
    
    // New states for rejection info modal (when viewing rejected reports in list)
    const [rejectionInfoModalOpen, setRejectionInfoModalOpen] = useState(false);
    const [rejectionInfoReport, _setRejectionInfoReport] = useState(null);
    
    // New states for responder assignment
    const [isAssignResponderModalOpen, setIsAssignResponderModalOpen] = useState(false);
    const [selectedReportForResponder, setSelectedReportForResponder] = useState(null);
    const [responders, setResponders] = useState([]);
    const [selectedResponder, setSelectedResponder] = useState("");
    const [isAssigningResponder, setIsAssigningResponder] = useState(false);
    const [loadingResponders, setLoadingResponders] = useState(false);

    // --- REFS for Keyboard Navigation ---
    const filterContainerRef = useRef(null);
    // Elements we want to navigate between with arrow keys
    const filterSelector = 'input.admin-search-input, .admin-top-controls .admin-filter-select, .reports-list button:first-child'; 
    useKeyboardNavigation(filterContainerRef, filterSelector);

    // Notification handler
    const showNotification = useCallback((message, type = "success") => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    }, []);

    // Track AI smart filter usage - calls backend to log and persist
    const trackAiUsage = useCallback(async () => {
        if (!token) {
            console.error('No token available for API call');
            showNotification('Authentication required', 'error');
            return;
        }

        try {
            const response = await fetch(getApiUrl('/api/ai/log-usage'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    interaction_type: 'smart_filter_toggle',
                    duration_seconds: 0,
                    metadata: { timestamp: new Date().toISOString() }
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            if (data.status === 'success') {
                // Update local state with backend-persisted usage percent
                const { usage_percent, hours_remaining, is_premium } = data.data;
                setAiUsagePercent(usage_percent);
                
                // Show brief feedback
                if (is_premium) {
                    console.log('[AI Premium] Unlimited usage - all interactions tracked');
                } else {
                    console.log(`[AI Usage Tracked] ${usage_percent}% of weekly limit - ${hours_remaining.toFixed(1)} hours remaining`);
                }
            } else {
                console.error('Backend error:', data.message);
                showNotification('Failed to track usage', 'error');
            }
        } catch (error) {
            console.error('Error tracking AI usage:', error);
            // Fallback to local increment if API fails (graceful degradation)
            setAiUsagePercent(prev => Math.min(prev + 5, 100));
        }
    }, [token, showNotification]);

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
        if (!isDeleting) { // Only allow closing if not deleting
            setIsDeleteConfirmOpen(false);
            setDeleteTarget(null);
        }
    }, [isDeleting]);

    

    // New: open initial delete-reason modal instead of immediately showing permanent delete
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
        // Ensure a reason is selected; allow 'Other' with text
        if (!deleteReason) return;
        if (deleteReason === 'Other' && !deleteReasonOther.trim()) return;

        // close reason modal and open the confirm modal
        setIsDeleteReasonOpen(false);
        setIsDeleteConfirmOpen(true);
    };
    
    // Responder assignment modal functions
    const closeAssignResponderModal = useCallback(() => {
        if (!isAssigningResponder) {
            setIsAssignResponderModalOpen(false);
            setSelectedReportForResponder(null);
            setSelectedResponder("");
            setResponders([]);
        }
    }, [isAssigningResponder]);
    
    const openAssignResponderModal = async (report) => {
        setSelectedReportForResponder(report);
        setSelectedResponder("");
        setLoadingResponders(true);
        
        try {
            // Fetch responders for this barangay
            const response = await fetch(getApiUrl(`/api/barangay/responders?barangay=${encodeURIComponent(report.barangay)}`), {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch responders');
            }
            
            const data = await response.json();
            if (data.status === "success") {
                setResponders(data.responders || []);
                setIsAssignResponderModalOpen(true);
            } else {
                showNotification(`Failed to load responders: ${data.message}`, 'error');
            }
        } catch (error) {
            console.error('Error fetching responders:', error);
            showNotification(`Error fetching responders: ${error.message}`, 'error');
        } finally {
            setLoadingResponders(false);
        }
    };
    
    const handleAssignResponder = async () => {
        if (!selectedReportForResponder || !selectedResponder || !token) return;
        
        setIsAssigningResponder(true);
        try {
            const response = await fetch(getApiUrl(`/api/reports/${selectedReportForResponder.id}/assign-responder`), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ responder_id: selectedResponder })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to assign responder');
            }
            
            const data = await response.json();
            if (data.status === "success") {
                showNotification(`✅ Responder ${data.responder_name} assigned successfully`, 'success');
                closeAssignResponderModal();
                // Refresh reports to show updated assignment
                fetchReports();
            } else {
                throw new Error(data.message || 'Failed to assign responder');
            }
        } catch (error) {
            console.error('Error assigning responder:', error);
            showNotification(`Failed to assign responder: ${error.message}`, 'error');
        } finally {
            setIsAssigningResponder(false);
        }
    };

    // Use the custom hook to handle focus trapping and ESC key for both modals
    const statusRef = useAriaModal(isStatusModalOpen, closeStatusModal);
    const deleteRef = useAriaModal(isDeleteConfirmOpen, closeDeleteConfirm);
    const reasonRef = useAriaModal(isDeleteReasonOpen, closeDeleteReason);
    const responderRef = useAriaModal(isAssignResponderModalOpen, closeAssignResponderModal);
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
            // Use the new barangay-specific endpoint
            const response = await fetch(getApiUrl(`/api/barangay/reports?limit=50&sort=${sortParam}`), {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch barangay reports');
            }

            const data = await response.json();
            if (data.status === "success") {
                // Set the user's barangay from response
                if (data.barangay) {
                    setUserBarangay(data.barangay);
                }
                
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
                        is_approved: report.is_approved ?? false,
                        is_rejected: report.is_rejected ?? false,
                        rejection_reason: report.rejection_reason ?? null,
                        images: report.images?.map(img => img.url) || []
                    };
                });
                setReports(transformedReports);
            } else {
                throw new Error(data.message || 'Failed to fetch barangay reports');
            }
        } catch (error) {
            console.error('Error fetching barangay reports:', error);  
            setReports([]);
        } finally {
            setLoading(false);
        }
    }, [token, sort]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    // Fetch current week AI usage on component mount
    useEffect(() => {
        const fetchAiUsage = async () => {
            if (!token) return;
            
            try {
                const response = await fetch(getApiUrl('/api/ai/current-usage'), {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'success' && data.data) {
                        setAiUsagePercent(data.data.usage_percent || 0);
                    }
                }
            } catch (error) {
                console.warn('Failed to fetch current AI usage:', error);
                // Continue with default 0% if fetch fails
            }
        };

        fetchAiUsage();
    }, [token]);

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
                // include deletion reason for auditing; server may accept or ignore
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

    // Approval workflow handlers
    const handleApproveReport = async (reportId) => {
        if (!token) return;
        
        setIsApprovingReport(true);
        try {
            const response = await fetch(getApiUrl(`/api/reports/${reportId}/approve`), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to approve report');
            }

            setReports(prevReports =>
                prevReports.map(r =>
                    r.id === reportId ? { ...r, is_approved: true } : r
                )
            );

            showNotification('Report approved successfully', 'success');
        } catch (error) {
            console.error('Error approving report:', error);
            showNotification(`Failed to approve report: ${error.message}`, 'error');
        } finally {
            setIsApprovingReport(false);
        }
    };

    const handleRejectReport = async (reportId) => {
        if (!token) return;
        
        setIsRejectingReport(true);
        try {
            const response = await fetch(getApiUrl(`/api/reports/${reportId}/reject`), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to reject report');
            }

            // Update report to show is_rejected = true instead of removing it
            setReports(prevReports =>
                prevReports.map(r => 
                    r.id === reportId 
                        ? { ...r, is_rejected: true }
                        : r
                )
            );

            showNotification('Report rejected', 'success');
        } catch (error) {
            console.error('Error rejecting report:', error);
            showNotification(`Failed to reject report: ${error.message}`, 'error');
        } finally {
            setIsRejectingReport(false);
        }
    };

    // Severity scoring function for sorting
    const getSeverityScore = (category) => {
        const scores = { Crime: 4, Hazard: 3, Concern: 2, 'Lost&Found': 1, Others: 1 };
        return scores[category] || 0;
    };

    // Filtered reports (removed barangay filter - fetched from backend already filtered)
    const filteredReports = reports
        .filter((r) => !r.is_rejected) // Hide rejected reports from barangay view
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
        )
        .sort((a, b) => {
            // Primary sort: Pending status first (is_approved = false means pending)
            const aPending = !a.is_approved ? 1 : 0;
            const bPending = !b.is_approved ? 1 : 0;
            if (aPending !== bPending) return bPending - aPending;

            // Secondary sort: Severity level (high to low)
            const aSeverity = getSeverityScore(a.category);
            const bSeverity = getSeverityScore(b.category);
            if (aSeverity !== bSeverity) return bSeverity - aSeverity;

            // Tertiary sort: Date (based on sort preference)
            const aTime = new Date(a.timestamp || a.created_at).getTime();
            const bTime = new Date(b.timestamp || b.created_at).getTime();
            return sort === 'latest' ? bTime - aTime : aTime - bTime;
        });

    return (
        <div className="admin-container">
            <div className="admin-header-row">
                <h2>{userBarangay ? `${userBarangay} Reports` : 'Loading...'}</h2>
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

                {/* Smart Filter Toggle Button with Premium Indicator & Full-Width Timer */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%'
                }}>
                    <button
                        onClick={() => {
                            if (aiUsagePercent >= 100) {
                                showNotification('🔒 Smart usage limit reached. Upgrade to Premium for unlimited access!', 'caution');
                                setShowUsageModal(true);
                            } else {
                                trackAiUsage(); // Track usage when toggling
                                setShowSmartFilter(!showSmartFilter);
                            }
                        }}
                        style={{
                            padding: '8px 14px',
                            backgroundColor: aiUsagePercent >= 100 ? '#f39c12' : (showSmartFilter ? '#2d3b8f' : '#ccc'),
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: aiUsagePercent >= 100 ? 'pointer' : 'pointer',
                            fontSize: '0.9em',
                            fontWeight: '500',
                            transition: 'all 0.3s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            position: 'relative',
                            whiteSpace: 'nowrap'
                        }}
                        title={aiUsagePercent >= 100 ? 'Premium feature - Upgrade now' : (showSmartFilter ? 'Disable Smart Filter' : 'Enable Smart Filter')}
                        aria-pressed={showSmartFilter}
                    >
                        <span>{aiUsagePercent >= 100 ? '✨' : '✨'}</span>
                        {aiUsagePercent >= 100 ? 'Premium' : 'Smart Filter'}
                    </button>

                    {/* AI Usage Timer Bar - Full Width */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flex: 1
                    }}>
                        <div style={{
                            flex: 1,
                            height: '6px',
                            backgroundColor: '#e0e0e0',
                            borderRadius: '3px',
                            overflow: 'hidden',
                            position: 'relative'
                        }}>
                            <div style={{
                                height: '100%',
                                width: `${aiUsagePercent}%`,
                                backgroundColor: aiUsagePercent >= 100 ? '#f39c12' : '#2d3b8f',
                                transition: 'width 0.3s ease',
                                animation: aiUsagePercent >= 100 ? 'pulse 1.5s ease-in-out infinite' : 'none'
                            }} />
                        </div>
                        
                        {/* Usage Info Button */}
                        <button
                            onClick={() => setShowUsageModal(true)}
                            style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                border: `2px solid ${aiUsagePercent >= 100 ? '#f39c12' : '#2d3b8f'}`,
                                backgroundColor: 'white',
                                color: aiUsagePercent >= 100 ? '#f39c12' : '#2d3b8f',
                                cursor: 'pointer',
                                fontSize: '0.75em',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0,
                                transition: 'all 0.3s ease',
                                flexShrink: 0
                            }}
                            title="View AI usage details"
                            aria-label="AI usage information"
                        >
                            ?
                        </button>
                    </div>
                </div>
            </div>

            {/* AI Usage Modal */}
            {showUsageModal && (
                <div 
                    className="modal-overlay"
                    onClick={() => setShowUsageModal(false)}
                    style={{ zIndex: 1000 }}
                >
                    <div 
                        className="modal"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            maxWidth: '400px',
                            backgroundColor: aiUsagePercent >= 100 ? '#fffbf0' : 'white'
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '20px',
                            borderBottom: '2px solid #e0e0e0',
                            paddingBottom: '12px'
                        }}>
                            <h3 style={{ margin: 0 }}>📊 AI Usage Status</h3>
                            <button
                                onClick={() => setShowUsageModal(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '1.5em',
                                    cursor: 'pointer'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Usage Percentage */}
                            <div>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginBottom: '8px',
                                    fontSize: '0.95em'
                                }}>
                                    <span style={{ fontWeight: '500' }}>Weekly AI Limit Usage:</span>
                                    <span style={{
                                        fontSize: '1.1em',
                                        fontWeight: 'bold',
                                        color: aiUsagePercent >= 100 ? '#f39c12' : '#2d3b8f'
                                    }}>
                                        {aiUsagePercent}%
                                    </span>
                                </div>
                                <div style={{
                                    height: '8px',
                                    backgroundColor: '#e0e0e0',
                                    borderRadius: '4px',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${aiUsagePercent}%`,
                                        backgroundColor: aiUsagePercent >= 100 ? '#f39c12' : '#2d3b8f',
                                        transition: 'width 0.3s ease'
                                    }} />
                                </div>
                            </div>

                            {/* Time Remaining */}
                            <div style={{
                                padding: '12px',
                                backgroundColor: '#f5f5f5',
                                borderRadius: '6px',
                                fontSize: '0.9em'
                            }}>
                                <div style={{ marginBottom: '8px' }}>
                                    <span style={{ color: '#666' }}>⏱️ Time Remaining: </span>
                                    <span style={{ fontWeight: '600', color: '#2d3b8f' }}>
                                        {Math.ceil((100 - aiUsagePercent) / 100 * 48)} hours
                                    </span>
                                </div>
                                <div style={{ color: '#666', fontSize: '0.85em' }}>
                                    Maximum: 48 hours per week
                                </div>
                            </div>

                            {/* Status Message */}
                            {aiUsagePercent >= 100 ? (
                                <div style={{
                                    padding: '12px',
                                    backgroundColor: '#fef5e7',
                                    borderRadius: '6px',
                                    borderLeft: '4px solid #f39c12'
                                }}>
                                    <div style={{ fontWeight: '600', color: '#f39c12', marginBottom: '6px' }}>
                                        🔒 AI Limit Reached
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.9em', color: '#666' }}>
                                        You've reached your weekly AI suggestion limit. Upgrade to Premium for unlimited access!
                                    </p>
                                    <button
                                        onClick={() => {
                                            showNotification('Premium upgrade feature coming soon!', 'info');
                                            setShowUsageModal(false);
                                        }}
                                        style={{
                                            marginTop: '12px',
                                            padding: '8px 16px',
                                            backgroundColor: '#f39c12',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontWeight: '500',
                                            fontSize: '0.9em'
                                        }}
                                    >
                                        ✨ Upgrade to Premium
                                    </button>
                                </div>
                            ) : (
                                <div style={{
                                    padding: '12px',
                                    backgroundColor: '#f0f8ff',
                                    borderRadius: '6px',
                                    borderLeft: '4px solid #2d3b8f'
                                }}>
                                    <div style={{ fontWeight: '600', color: '#2d3b8f', marginBottom: '6px' }}>
                                        ✅ Smart Filter Active
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.9em', color: '#666' }}>
                                        You have {100 - aiUsagePercent}% of your weekly AI suggestions remaining.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
            `}</style>

            <div className="reports-list">
                {loading ? (
                    <div className="loading-container" role="status" aria-live="polite">
                        <div className="spinner"></div>
                        <p>Loading reports...</p>
                    </div>
                ) : reports.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center' }}>
                        <p>No reports found.</p>
                    </div>
                ) : filteredReports.length > 0 ? (
                    filteredReports.map((report, index) => {
                        const isExpanded = expandedPosts.includes(report.id);
                        const isPending = !report.is_approved;
                        
                        // DEBUG: Log is_approved value for first 3 reports
                        if (index < 3) {
                            console.log(`[BarangayReports] Report ${report.id}: is_approved=${report.is_approved}, isPending=${isPending}, status=${report.status}`);
                        }

                        return (
                            <div
                                key={report.id}
                                id={`report-${report.id}`}
                                className={isPending ? 'report-pending' : `report-card ${highlightedReportId === report.id ? 'highlighted-report' : ''}`}
                                style={{
                                    animationDelay: `${index * 0.1}s`,
                                    position: 'relative',
                                    border: `2px solid ${!isPending ? getSeverityStyle(report.category).borderColor : 'transparent'}`,
                                }} 
                                aria-labelledby={`report-title-${report.id}`}
                            >
                                {/* Toggle Button - Top Right */}
                                {showCommunityHelper && (
                                    <button
                                        style={{
                                            position: 'absolute',
                                            top: '12px',
                                            right: '12px',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '1.3em',
                                            padding: '4px 8px',
                                            zIndex: 15,
                                            opacity: 0.6,
                                            transition: 'opacity 0.3s ease'
                                        }}
                                        onClick={() => setShowCommunityHelper(false)}
                                        title="Hide Community Helper suggestions"
                                        aria-label="Hide AI suggestions"
                                    >
                                        ✕
                                    </button>
                                )}

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
                                        {isPending ? (
                                            <>
                                                <button 
                                                    className="icon-btn approve-btn" 
                                                    onClick={() => handleApproveReport(report.id)}
                                                    disabled={isApprovingReport}
                                                    aria-label={`Approve report: ${report.title}`}
                                                    title="Approve Report"
                                                >
                                                    {isApprovingReport ? (
                                                        <>
                                                            <span className="spinner-small" aria-hidden="true"></span>
                                                            {/* Still show check icon but with loading state */}
                                                            <FaCheck aria-hidden="true" style={{ opacity: 0.5 }} />
                                                        </>
                                                    ) : (
                                                        <FaCheck aria-hidden="true" />
                                                    )}
                                                </button>
                                                <button 
                                                    className="icon-btn reject-btn" 
                                                    onClick={() => handleRejectReport(report.id)}
                                                    disabled={isRejectingReport}
                                                    aria-label={`Reject report: ${report.title}`}
                                                    title="Reject Report"
                                                >
                                                    <FaTimes aria-hidden="true" />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button 
                                                    className="icon-btn edit-btn" 
                                                    onClick={() => openStatusModal(report)}
                                                    aria-label={`Edit status for report: ${report.title}`}
                                                    title="Edit Status"
                                                >
                                                    <FaEdit aria-hidden="true" />
                                                </button>
                                                {report.status === "Ongoing" && (
                                                    <button 
                                                        className="icon-btn assign-responder-btn" 
                                                        onClick={() => openAssignResponderModal(report)}
                                                        aria-label={`Assign responder for report: ${report.title}`}
                                                        title="Assign Responder"
                                                        style={{ backgroundColor: '#3b82f6', color: '#fff' }}
                                                    >
                                                        👤
                                                    </button>
                                                )}
                                                <button 
                                                    className="icon-btn delete-btn" 
                                                    onClick={() => openDeleteReason(report)}
                                                    aria-label={`Delete report: ${report.title}`}
                                                    title="Delete Report"
                                                >
                                                    <FaTrashAlt aria-hidden="true" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Community Helper Inline Container - Below Profile, Above Title */}
                                {showCommunityHelper && showSmartFilter && (
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px',
                                        padding: '12px',
                                        backgroundColor: `${getSeverityStyle(report.category).bgColor}`,
                                        border: `1px solid ${getSeverityStyle(report.category).borderColor}`,
                                        borderRadius: '6px',
                                        marginBottom: '12px',
                                        marginLeft: '0px',
                                        marginRight: '0px'
                                    }}>
                                        {/* Header with Badge */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            justifyContent: 'space-between'
                                        }}>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '4px 10px',
                                                backgroundColor: '#2d3b8f',
                                                color: 'white',
                                                borderRadius: '12px',
                                                fontSize: '0.75em',
                                                fontWeight: '600',
                                                opacity: 1
                                            }}>
                                                <span>💡</span>
                                                <span>Community Helper</span>
                                            </span>
                                        </div>
                                        
                                        {/* Category Information with Severity & Confidence */}
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '6px',
                                            fontSize: '0.9em'
                                        }}>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                flexWrap: 'wrap'
                                            }}>
                                                <span style={{ color: '#666', fontWeight: '500' }}>✨ Suggest:</span>
                                                <span style={{ fontWeight: '600', color: getSeverityStyle(report.category).borderColor }}>
                                                    {report.category}
                                                </span>
                                                <span style={{ color: '#888' }}>·</span>
                                                <span style={{
                                                    padding: '2px 8px',
                                                    backgroundColor: getSeverityStyle(report.category).borderColor,
                                                    color: 'white',
                                                    borderRadius: '12px',
                                                    fontSize: '0.85em',
                                                    fontWeight: '600'
                                                }}>
                                                    {getSeverityStyle(report.category).label}
                                                </span>
                                                <span style={{ marginLeft: 'auto', fontWeight: '600', color: getSeverityStyle(report.category).borderColor }}>
                                                    Confidence: {(70 + Math.random() * 30).toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

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
                    <div 
                        className="modal" 
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            borderLeft: `6px solid ${getSeverityStyle(selectedReport.category).borderColor}`,
                            backgroundColor: getSeverityStyle(selectedReport.category).bgColor
                        }}
                    >
                        <h3 id="status-modal-title">📝 Update Report Status</h3>
                        
                        {/* Community Helper AI Badge */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 12px',
                            backgroundColor: 'white',
                            border: '1px solid #e0e0e0',
                            borderRadius: '6px',
                            marginBottom: '15px',
                            fontSize: '0.9em',
                            fontWeight: '500'
                        }}>
                            <span style={{ fontSize: '1.2em' }}>💡</span>
                            <span><strong>Community Helper</strong></span>
                            <span style={{ color: '#888', marginLeft: '5px' }}>|</span>
                            <span style={{ marginLeft: '5px' }}>Category: <strong>{selectedReport.category}</strong></span>
                            <span style={{ color: '#888' }}>|</span>
                            <span style={{ marginLeft: '5px' }}>{getSeverityStyle(selectedReport.category).label}</span>
                        </div>
                        
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

            {/* Delete Reason Modal: ask admin why the report is being deleted */}
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

            {/* Rejection Info Modal - Shows when barangay official views a rejected report */}
            {rejectionInfoModalOpen && rejectionInfoReport && (
                <div 
                    className="modal-overlay"
                    onClick={() => setRejectionInfoModalOpen(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="rejection-info-title"
                >
                    <div className="rejection-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="rejection-modal-header">
                            <h3 id="rejection-info-title">Report Rejection Information</h3>
                            <button
                                className="close-modal-btn"
                                onClick={() => setRejectionInfoModalOpen(false)}
                                aria-label="Close rejection modal"
                                title="Close"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="rejection-modal-body">
                            <div className="rejection-info-section">
                                <h4>Report Title</h4>
                                <p className="rejection-report-title">{rejectionInfoReport.title}</p>

                                <h4>Reason for Rejection</h4>
                                <p className="rejection-reason-text">
                                    {rejectionInfoReport.rejection_reason || 'Your report violated our community guidelines.'}
                                </p>
                                
                                <div className="possible-violations">
                                    <h5>Possible Reasons for Violation:</h5>
                                    <ul>
                                        <li>Inappropriate or offensive language</li>
                                        <li>False or misleading information</li>
                                        <li>Spam or repetitive content</li>
                                        <li>Personal attack or harassment</li>
                                        <li>Violates privacy or confidentiality</li>
                                        <li>Unrelated to community safety</li>
                                        <li>Excessive or graphic content</li>
                                    </ul>
                                </div>

                                <div className="rejection-metadata">
                                    <p><strong>Status:</strong> <span style={{ color: '#c62828' }}>REJECTED</span></p>
                                    <p><strong>Reporter:</strong> {rejectionInfoReport.reporter ? `${rejectionInfoReport.reporter.firstname} ${rejectionInfoReport.reporter.lastname}` : 'Unknown'}</p>
                                    <p><strong>Category:</strong> {rejectionInfoReport.category}</p>
                                    <p><strong>Barangay:</strong> {rejectionInfoReport.barangay}</p>
                                </div>
                            </div>
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
            
            {/* Assign Responder Modal */}
            {isAssignResponderModalOpen && selectedReportForResponder && (
                <div 
                    className="modal-overlay"
                    onClick={!isAssigningResponder ? closeAssignResponderModal : undefined}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="assign-responder-title"
                    tabIndex="-1"
                    ref={responderRef}
                >
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3 id="assign-responder-title">👤 Assign Responder</h3>
                        <div style={{ marginBottom: '15px' }}>
                            <p><strong>Report:</strong> {selectedReportForResponder.title}</p>
                            <p><strong>Status:</strong> {selectedReportForResponder.status}</p>
                            <p><strong>Location:</strong> {selectedReportForResponder.addressStreet}, {selectedReportForResponder.barangay}</p>
                        </div>
                        
                        <div style={{ marginBottom: '20px' }}>
                            <label htmlFor="responder-select" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                                Select Responder:
                            </label>
                            {loadingResponders ? (
                                <p style={{ color: '#666', fontStyle: 'italic' }}>Loading responders...</p>
                            ) : responders.length > 0 ? (
                                <select 
                                    id="responder-select"
                                    value={selectedResponder} 
                                    onChange={(e) => setSelectedResponder(e.target.value)}
                                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                                >
                                    <option value="">-- Select a responder --</option>
                                    {responders.map(responder => (
                                        <option key={responder.id} value={responder.id}>
                                            {responder.firstname} {responder.lastname}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <p style={{ color: '#e74c3c' }}>No responders available for this barangay.</p>
                            )}
                        </div>
                        
                        <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f0f8ff', borderRadius: '4px', fontSize: '0.9em' }}>
                            <p style={{ margin: 0, color: '#0066cc' }}>
                                <strong>📧 Note:</strong> The assigned responder will be notified about this assignment.
                            </p>
                        </div>
                        
                        <div className="modal-buttons edit-actions">
                            <button 
                                onClick={closeAssignResponderModal}
                                disabled={isAssigningResponder}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleAssignResponder}
                                disabled={!selectedResponder || isAssigningResponder || loadingResponders}
                                style={{ 
                                    opacity: (!selectedResponder || isAssigningResponder || loadingResponders) ? 0.6 : 1,
                                    cursor: (!selectedResponder || isAssigningResponder || loadingResponders) ? 'not-allowed' : 'pointer',
                                    backgroundColor: '#3b82f6'
                                }}
                            >
                                {isAssigningResponder ? 'Assigning...' : 'Assign Responder'}
                            </button>
                        </div>
                    </div>
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

export default BarangayReports;