import React, { useState, useEffect, useCallback, useRef } from "react";
import { FaEdit, FaTrashAlt, FaSearch, FaRedo, FaCheckCircle, FaTimesCircle, FaHeart, FaRegHeart, FaFire, FaPlus, FaMinus, FaMapPin, FaClock, FaSyncAlt, FaChartLine, FaStar } from "react-icons/fa";
import "../resident/Reports.css"; 
import ModalPortal from "../shared/ModalPortal";

import { API_CONFIG, getApiUrl } from "../../utils/apiConfig";
// ... existing code ...
const API_URL = getApiUrl(API_CONFIG.endpoints.reports);
const REPORT_STATUSES = ["Pending", "Ongoing", "Resolved"];

// Status badge icon helper
const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
        case 'pending':
            return <FaClock aria-hidden="true" />;
        case 'ongoing':
            return <FaSyncAlt aria-hidden="true" />;
        case 'resolved':
            return <FaCheckCircle aria-hidden="true" />;
        default:
            return null;
    }
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


function RespondersReports({ token }) {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("All");
    const [barangay, setBarangay] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All"); 
    const [sort, setSort] = useState("latest");
    const [userBarangay, setUserBarangay] = useState(null); // User's address_barangay from info table
    const [smartSort, setSmartSort] = useState("latest"); // When smart filter active
    const [previewImage, setPreviewImage] = useState(null);
    const [notification, setNotification] = useState(null);
    const [highlightedReportId, setHighlightedReportId] = useState(null);
    
    // Smart Filter states
    const [showSmartFilter, setShowSmartFilter] = useState(false);
    const [aiUsagePercent, setAiUsagePercent] = useState(0);
    const [timeRemainingHMS, setTimeRemainingHMS] = useState('48:00:00');
    const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(172800); // 48 hours
    const [, setShowUsageModal] = useState(false);
    const [smartFilterStartTime, setSmartFilterStartTime] = useState(null);
    const [hasAcceptedAiWarning, setHasAcceptedAiWarning] = useState(false);
    const [showSmartFilterWarning, setShowSmartFilterWarning] = useState(false);
    const [liveSessionSeconds, setLiveSessionSeconds] = useState(0);
    const [isPremiumUser, setIsPremiumUser] = useState(false);
    const [priorityFilter, setPriorityFilter] = useState("All");

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

    // ⭐ NEW: Trending reports states
    const [trendingReports, setTrendingReports] = useState([]);
    const [trendingExpanded, setTrendingExpanded] = useState(true);
    const [trendingTimeFilter, setTrendingTimeFilter] = useState("this-month"); // today, yesterday, this-month
    
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

    // --- Smart Filter AI Usage Tracking ---
    const WEEK_LIMIT_SECONDS = 172800; // 48 hours

    const trackAiUsage = useCallback(async (durationSeconds = 0) => {
        if (!token) {
            console.warn('[Smart Filter] ⚠️ No token available - skipping usage tracking');
            return;
        }

        console.log(`[Smart Filter] 📊 Session ended - Duration: ${durationSeconds}s`);

        try {
            const response = await fetch(getApiUrl('/api/ai/log-usage'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    interaction_type: 'smart_filter_session',
                    duration_seconds: durationSeconds,
                    metadata: { timestamp: new Date().toISOString() }
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success') {
                    const { usage_percent, time_remaining_hms, time_remaining_seconds, is_premium, total_seconds, hours_remaining } = data.data;
                    setAiUsagePercent(usage_percent);
                    setTimeRemainingHMS(time_remaining_hms || '48:00:00');
                    setTimeRemainingSeconds(time_remaining_seconds ?? 172800);
                    setIsPremiumUser(is_premium || false);
                    
                    if (is_premium) {
                        showNotification('✨ Smart Filter session logged (Premium - unlimited)', 'success');
                    } else {
                        const hoursUsedThisWeek = (total_seconds / 3600).toFixed(1);
                        showNotification(`📊 Session logged: ${hoursUsedThisWeek}h used this week, ${hours_remaining.toFixed(1)}h remaining`, 'success');
                    }
                }
            }
        } catch (error) {
            console.error('[Smart Filter] ❌ Error tracking AI usage:', error);
        }
    }, [token, showNotification]);

    // Handle Smart Filter toggle with warning and time tracking
    const handleSmartFilterToggle = useCallback(() => {
        // If turning ON for the first time, show warning
        if (!showSmartFilter && !hasAcceptedAiWarning) {
            setShowSmartFilterWarning(true);
            return;
        }

        // If turning OFF, log the duration
        if (showSmartFilter && smartFilterStartTime && hasAcceptedAiWarning) {
            const durationSeconds = Math.floor((Date.now() - smartFilterStartTime) / 1000);
            trackAiUsage(durationSeconds);
            setSmartFilterStartTime(null);
            setLiveSessionSeconds(0);
        }
        // If turning ON and already accepted warning, start timer
        else if (!showSmartFilter && hasAcceptedAiWarning) {
            setSmartFilterStartTime(Date.now());
        }

        setShowSmartFilter(!showSmartFilter);
    }, [showSmartFilter, smartFilterStartTime, hasAcceptedAiWarning, trackAiUsage]);

    // Handle Smart Filter warning acceptance
    const handleAcceptSmartFilterWarning = useCallback(() => {
        const startTime = Date.now();
        setHasAcceptedAiWarning(true);
        setShowSmartFilterWarning(false);
        setShowSmartFilter(true);
        setSmartFilterStartTime(startTime);
        setLiveSessionSeconds(0);
        
        // Show appropriate notification based on premium status
        if (isPremiumUser) {
            showNotification('✨ Unlimited Smart Filter activated. Enjoy premium AI-powered prioritization!', 'premium');
        } else {
            showNotification('We detected you have no Premium. Free Smart Filter has been activated.', 'caution');
        }
    }, [isPremiumUser, showNotification]);

    // Handle Smart Filter warning rejection
    const handleRejectSmartFilterWarning = useCallback(() => {
        setShowSmartFilterWarning(false);
    }, []);

    // Real-time countdown timer for active Smart Filter session
    useEffect(() => {
        if (!showSmartFilter || !smartFilterStartTime) {
            setLiveSessionSeconds(0);
            return;
        }

        const timer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - smartFilterStartTime) / 1000);
            setLiveSessionSeconds(elapsed);
            
            // Calculate real-time usage
            const baseUsedSeconds = WEEK_LIMIT_SECONDS - timeRemainingSeconds;
            const totalUsedNow = baseUsedSeconds + elapsed;
            const livePercent = Math.min(100, Math.round((totalUsedNow / WEEK_LIMIT_SECONDS) * 100));
            const liveRemaining = Math.max(0, WEEK_LIMIT_SECONDS - totalUsedNow);
            
            setAiUsagePercent(livePercent);
            
            // Format live time remaining as HH:MM:SS
            const hrs = Math.floor(liveRemaining / 3600);
            const mins = Math.floor((liveRemaining % 3600) / 60);
            const secs = liveRemaining % 60;
            setTimeRemainingHMS(`${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
        }, 1000);

        return () => clearInterval(timer);
    }, [showSmartFilter, smartFilterStartTime, timeRemainingSeconds]);

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
                        setTimeRemainingHMS(data.data.time_remaining_hms || '48:00:00');
                        setTimeRemainingSeconds(data.data.time_remaining_seconds ?? 172800);
                        setIsPremiumUser(data.data.is_premium || false);
                    }
                }
            } catch (error) {
                console.warn('[Smart Filter] Failed to fetch AI usage:', error.message);
            }
        };

        fetchAiUsage();
    }, [token]);

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

    // Use the custom hook to handle focus trapping and ESC key for both modals
    const statusRef = useAriaModal(isStatusModalOpen, closeStatusModal);
    const deleteRef = useAriaModal(isDeleteConfirmOpen, closeDeleteConfirm);
    const reasonRef = useAriaModal(isDeleteReasonOpen, closeDeleteReason);
    // --------------------------------------------------

    // Fetch reports from API - uses responder endpoint that filters by barangay and excludes rejected
    const fetchReports = useCallback(async () => {
        if (!token) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const sortParam = sort === "latest" ? "desc" : "asc";
            // Use responder-specific endpoint that filters by barangay and excludes rejected reports
            const responderEndpoint = getApiUrl(`/api/responder/reports?limit=50`);
            let response = await fetch(responderEndpoint, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            // Fallback to regular reports endpoint if responder endpoint fails
            if (!response.ok) {
                console.warn("Responder reports endpoint failed, falling back to regular reports");
                response = await fetch(`${API_URL}/reports?limit=50&sort=${sortParam}`, {
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                if (!response.ok) {
                    throw new Error('Failed to fetch reports');
                }
            }

            const data = await response.json();
            if (data.status === "success") {
                // Set the user's barangay from response (from info table)
                if (data.barangay) {
                    setUserBarangay(data.barangay);
                }
                
                // Use reports from responder endpoint or fallback
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
                    
                    const fallbackPriority = getPriorityStyle(report.category);
                    return {
                        id: report.id,
                                                // AI priority fields (if backend has run AI annotator - else derive from category mapping)
                                                ai_priority: report.ai_priority || fallbackPriority.priority,
                                                ai_priority_score: report.ai_priority_score || fallbackPriority.score,
                                                ai_priority_label: report.ai_priority_label || fallbackPriority.label,
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
                        images: report.images?.map(img => img.url) || [],
                        reaction_count: report.reaction_count || 0,
                        is_approved: report.is_approved,
                        is_rejected: report.is_rejected,
                        deleted_at: report.deleted_at
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

    // ⭐ Compute trending reports using newsfeed algorithm - filtered by responder's barangay
    useEffect(() => {
        if (!reports.length) {
            setTrendingReports([]);
            return;
        }

        // Time filter logic
        const now = new Date();
        const filterByTime = (createdAt) => {
            const reportDate = new Date(createdAt);
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            
            switch (trendingTimeFilter) {
                case "today":
                    return reportDate >= today;
                case "yesterday":
                    return reportDate >= yesterday && reportDate < today;
                case "this-month":
                    return reportDate >= thisMonthStart;
                default:
                    return true;
            }
        };

        // Filter approved reports that are not resolved AND have likes > 0
        // Also filter by responder's address_barangay if available
        const eligibleReports = reports.filter((r) => 
            r.is_approved === true &&
            r.status !== "Resolved" &&
            r.deleted_at === null &&
            r.is_rejected !== true &&
            (r.reaction_count || 0) > 0 &&
            filterByTime(r.created_at) &&
            // Filter by user's barangay if set
            (!userBarangay || userBarangay === "No barangay selected" || r.address_barangay === userBarangay)
        );

        // Apply trending algorithm: Community Awareness & Involvement
        // Score = (reactions * 15 + category_weight + base_score) / (days_old + 1)^0.8
        // Gentler decay keeps reports visible longer for stable trending
        const scored = eligibleReports.map((r) => {
            const createdAt = new Date(r.created_at || 0);
            const daysOld = Math.max(0, (now - createdAt) / (1000 * 60 * 60 * 24));
            
            // Engagement weights - higher for community interaction
            const severityWeight = { Crime: 4, Hazard: 3.5, Concern: 3, 'Lost&Found': 2, Others: 2 };
            const reactionBoost = (r.reaction_count || 0) * 15; // High weight for community engagement
            const baseScore = 5; // Base score ensures reports don't vanish suddenly
            const engagement = reactionBoost + (severityWeight[r.category] || 2) + baseScore;
            
            // Very gentle time decay (0.8 exponent) - keeps trending stable
            const timeFactor = Math.pow(daysOld + 1, 0.8);
            const trendingScore = engagement / timeFactor;
            
            return { ...r, trendingScore };
        });

        // Sort by trending score descending, limit to 5
        const trending = scored
            .sort((a, b) => b.trendingScore - a.trendingScore)
            .slice(0, 5);

        setTrendingReports(trending);
        console.log(`🔥 ${trending.length} trending reports for responder (${userBarangay || 'all'})`);
    }, [reports, trendingTimeFilter, userBarangay]);

    const toggleExpand = (id) => {
        setExpandedPosts((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
    };

    // ⭐ NEW: Handle heart/like toggle for reports
    const handleToggleLike = async (reportId) => {
        if (!token) {
            showNotification("Please log in to like reports", "error");
            return;
        }

        try {
            const response = await fetch(getApiUrl(`/api/reports/${reportId}/react`), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reaction_type: 'heart' })
            });

            const data = await response.json();
            
            if (data.status === 'success') {
                // Update the report's reaction data in state
                // Backend returns 'liked' or 'unliked' for action
                setReports(prevReports => 
                    prevReports.map(report => 
                        report.id === reportId 
                            ? { 
                                ...report, 
                                user_liked: data.user_liked ?? (data.action === 'liked'),
                                reaction_count: data.reaction_count
                            }
                            : report
                    )
                );
            } else {
                showNotification("Failed to update reaction", "error");
            }
        } catch (error) {
            console.error("Error toggling like:", error);
            showNotification("Failed to update reaction", "error");
        }
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
            const response = await fetch(`${API_URL}/reports/${deleteTarget.id}`, {
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

    // Priority calculation helpers for Smart Filter
    const getPriorityStyle = (category) => {
        const PRIORITY_COLORS = {
            Crime: { priority: 'Critical', label: '🔴 Critical' },
            Hazard: { priority: 'High', label: '🟠 High' },
            Concern: { priority: 'Medium', label: '⚪ Medium' },
            'Lost&Found': { priority: 'Low', label: '⚪ Low' },
            Others: { priority: 'Low', label: '⚪ Low' },
        };
        return PRIORITY_COLORS[category] || PRIORITY_COLORS['Others'];
    };

    const priorityRank = (priority) => {
        const ranks = { Critical: 4, High: 3, Medium: 2, Low: 1 };
        return ranks[priority] || 0;
    };

    const getReportPriority = (report) => {
        if (report.ai_priority) {
            const pri = String(report.ai_priority).toLowerCase().trim();
            if (pri === 'critical') return 'Critical';
            if (pri === 'high') return 'High';
            if (pri === 'medium') return 'Medium';
            if (pri === 'low') return 'Low';
        }
        return getPriorityStyle(report.category).priority || 'Low';
    };

    // Filtered reports with Smart Filter support
    const filteredReports = reports
        .filter((r) => (category === "All" ? true : r.category === category))
        .filter((r) => (barangay === "All" ? true : r.barangay === barangay))
        .filter((r) => (statusFilter === "All" ? true : r.status === statusFilter))
        .filter((r) => {
            // Priority filter only applies when Smart Filter is ON
            if (!showSmartFilter) return true;
            if (!priorityFilter || priorityFilter === 'All') return true;
            const reportPriority = getReportPriority(r);
            return reportPriority === priorityFilter;
        })
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
            // If Smart Filter is active, use smart prioritization
            if (showSmartFilter) {
                const aPri = priorityRank(getPriorityStyle(a.category).priority);
                const bPri = priorityRank(getPriorityStyle(b.category).priority);
                if (aPri !== bPri) return bPri - aPri;

                // Fallback to date based on smartSort
                const aT = new Date(a.created_at).getTime() || 0;
                const bT = new Date(b.created_at).getTime() || 0;
                return smartSort === 'latest' ? bT - aT : aT - bT;
            }

            // Default behavior: date sort
            const aTime = new Date(a.created_at).getTime() || 0;
            const bTime = new Date(b.created_at).getTime() || 0;
            return sort === 'latest' ? bTime - aTime : aTime - bTime;
        });

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
                
                {/* Priority Filter - Only visible when Smart Filter is ON */}
                {showSmartFilter && (
                    <>
                        <label htmlFor="priority-filter" className="sr-only">Filter by Priority</label>
                        <select
                            id="priority-filter"
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className="admin-filter-select"
                            aria-label="Filter reports by priority"
                        >
                            <option value="All">All Priorities</option>
                            <option value="Critical">Critical</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                        </select>
                    </>
                )}
                
                <label htmlFor="sort-order" className="sr-only">Sort Order</label>
                {showSmartFilter ? (
                    <select
                        id="smart-sort-order"
                        value={smartSort}
                        onChange={(e) => setSmartSort(e.target.value)}
                        className="admin-filter-select"
                        aria-label="Smart sort reports by priority/date"
                    >
                        <option value="latest">Smart: Latest → Oldest</option>
                        <option value="oldest">Smart: Oldest → Latest</option>
                    </select>
                ) : (
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
                )}
            </div>

            {/* Smart Filter Toggle with Usage Timer */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 0',
                flexWrap: 'wrap'
            }}>
                <button
                    onClick={() => {
                        if (aiUsagePercent >= 100 && !isPremiumUser) {
                            showNotification('🔒 Smart usage limit reached. Upgrade to Premium for unlimited access!', 'caution');
                            setShowUsageModal(true);
                        } else {
                            handleSmartFilterToggle();
                        }
                    }}
                    style={{
                        padding: '8px 14px',
                        background: isPremiumUser 
                            ? 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)' 
                            : (aiUsagePercent >= 100 ? '#f39c12' : (showSmartFilter ? '#2d3b8f' : '#ccc')),
                        color: 'white',
                        border: isPremiumUser ? '2px solid #d4881f' : 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.9em',
                        fontWeight: isPremiumUser ? '600' : '500',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap',
                        boxShadow: isPremiumUser ? '0 2px 8px rgba(243, 156, 18, 0.4)' : 'none'
                    }}
                    title={isPremiumUser ? 'Premium - Unlimited AI Access' : (aiUsagePercent >= 100 ? 'Premium feature - Upgrade now' : (showSmartFilter ? 'Disable Smart Filter' : 'Enable Smart Filter'))}
                    aria-pressed={showSmartFilter}
                >
                    <span>{isPremiumUser ? '👑' : '✨'}</span>
                    {isPremiumUser ? 'Premium' : (aiUsagePercent >= 100 ? 'Premium' : 'Smart Filter')}
                </button>

                {/* AI Usage Timer Bar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flex: 1,
                    minWidth: '200px'
                }}>
                    <div style={{
                        flex: 1,
                        height: isPremiumUser ? '10px' : '8px',
                        backgroundColor: isPremiumUser ? '#ffd700' : '#e0e0e0',
                        borderRadius: isPremiumUser ? '6px' : '4px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            height: '100%',
                            width: isPremiumUser ? '100%' : `${aiUsagePercent}%`,
                            backgroundColor: isPremiumUser ? 'linear-gradient(90deg, #f39c12, #e67e22)' : (aiUsagePercent >= 100 ? '#f39c12' : '#2d3b8f'),
                            background: isPremiumUser ? 'linear-gradient(90deg, #f39c12, #e67e22)' : undefined,
                            transition: showSmartFilter && !isPremiumUser ? 'none' : 'width 0.3s ease'
                        }} />
                    </div>
                    <span style={{
                        fontSize: '0.85em',
                        color: isPremiumUser ? '#f39c12' : '#666',
                        fontWeight: isPremiumUser ? '600' : '400',
                        whiteSpace: 'nowrap'
                    }}>
                        {isPremiumUser ? '∞ Unlimited' : `${aiUsagePercent}% • ${timeRemainingHMS}`}
                    </span>
                </div>

                {/* Live Session Timer when Smart Filter is active */}
                {showSmartFilter && liveSessionSeconds > 0 && (
                    <span style={{
                        fontSize: '0.85em',
                        color: '#2d3b8f',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}>
                        <FaClock style={{ fontSize: '0.9em' }} />
                        Session: {Math.floor(liveSessionSeconds / 60)}m {liveSessionSeconds % 60}s
                    </span>
                )}
            </div>

            {/* ⭐ Trending Pill Button Row - Always visible, shows count */}
            <div className="trending-pill-row">
                <button
                    className={`trending-pill-btn ${sort === 'trending' ? 'active' : ''} ${trendingReports.length === 0 ? 'empty' : ''}`}
                    data-count={trendingReports.length}
                    onClick={() => {
                        if (sort === 'trending') {
                            setSort('latest');
                            setTrendingExpanded(false);
                        } else {
                            setSort('trending');
                            setTrendingExpanded(true);
                        }
                    }}
                    title={sort === 'trending' ? 'Turn off trending sort' : 'Sort by trending'}
                >
                    <FaFire className="trending-pill-icon" />
                    <span className="pill-text">Trending ({trendingReports.length})</span>
                    {sort === 'trending' ? <FaMinus className="trending-pill-toggle" /> : <FaPlus className="trending-pill-toggle" />}
                </button>

                {/* Top Pill - Toggle sort */}
                <button
                    className={`top-pill-btn ${sort === 'top' ? 'active' : ''}`}
                    onClick={() => setSort(sort === 'top' ? 'latest' : 'top')}
                    title={sort === 'top' ? 'Turn off top sort' : 'Sort by most engagement'}
                >
                    <FaStar className="top-pill-icon" />
                    <span className="pill-text">Top</span>
                </button>
            </div>

            {/* ⭐ Trending Reports Section - Collapsible */}
            {trendingExpanded && (
                <div className="trending-reports-container expanded">
                    <div className="trending-reports-header">
                        <div className="trending-header-left">
                            <h3><FaMapPin className="trending-pin-icon" /> Current Trending Reports</h3>
                        </div>
                        <div className="trending-header-right">
                            <select
                                className="trending-time-filter"
                                value={trendingTimeFilter}
                                onChange={(e) => setTrendingTimeFilter(e.target.value)}
                            >
                                <option value="today">Today</option>
                                <option value="yesterday">Yesterday</option>
                                <option value="this-month">This Month</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="trending-reports-list">
                        {trendingReports.map((report) => (
                            <div 
                                key={`trending-${report.id}`} 
                                className="trending-report-card"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const element = document.getElementById(`report-${report.id}`);
                                    if (element) {
                                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        setHighlightedReportId(report.id);
                                        setTimeout(() => setHighlightedReportId(null), 3000);
                                    }
                                }}
                            >
                                <div className="trending-report-category" data-category={report.category}>
                                    {report.category}
                                </div>
                                <div className="trending-report-title">{report.title}</div>
                                <div className="trending-report-location">
                                    📍 {report.address_barangay}
                                </div>
                                <div className="trending-report-meta">
                                    <span className="trending-report-status" data-status={report.status?.toLowerCase()}>
                                        {report.status}
                                    </span>
                                    <span className="trending-report-time">
                                        {new Date(report.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="trending-report-likes">
                                    <FaHeart className="heart-icon-small" aria-hidden="true" />
                                    <span>{report.reaction_count || 0}</span>
                                </div>
                            </div>
                        ))}
                        
                        {trendingReports.length === 0 && (
                            <div className="no-trending-reports">
                                <p>No trending reports for this time period.</p>
                                <p className="trending-criteria">
                                    Reports become trending based on: reactions, category (Crime → Hazard → Concern), and recency.
                                    Try selecting "This Month" to see more results.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="reports-list">
                {loading ? (
                    <div className="loading-container" role="status" aria-live="polite">
                        <div className="spinner"></div>
                        <p>Loading reports...</p>
                    </div>
                ) : reports.length === 0 ? (
                    <div className="no-reports" role="status">
                        <FaChartLine style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem' }} />
                        <p>No reports found.</p>
                        <p className="muted">Assigned reports incidents will appear here.</p>
                    </div>
                ) : filteredReports.length > 0 ? (
                    filteredReports.map((report, index) => {
                        const isExpanded = expandedPosts.includes(report.id);
                        const priority = getReportPriority(report);

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
                                            {getStatusIcon(report.status)}
                                            {report.status}
                                        </span>
                                        {/* Display AI Smart Filter priority badge */}
                                        <span className={`priority-tag priority-${(priority || "low").toLowerCase()}`}>
                                            {priority}
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

                                {/* ⭐ NEW: Like/Heart Button */}
                                <div className="report-reactions">
                                    <button 
                                        className={`reaction-btn heart-btn ${report.user_liked ? 'liked' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); handleToggleLike(report.id); }}
                                        aria-label={report.user_liked ? 'Unlike this report' : 'Like this report'}
                                        title={report.user_liked ? 'Unlike' : 'Like'}
                                    >
                                        {report.user_liked ? (
                                            <FaHeart className="heart-icon filled" aria-hidden="true" />
                                        ) : (
                                            <FaRegHeart className="heart-icon" aria-hidden="true" />
                                        )}
                                        <span className="reaction-count">{report.reaction_count || 0}</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="no-reports" role="status">
                        <FaChartLine style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem' }} />
                        <p>No reports match your current filters.</p>
                        <p className="muted">Try adjusting your search criteria.</p>
                        <button 
                            onClick={() => {
                                setSearch("");
                                setCategory("All");
                                setBarangay("All");
                                setStatusFilter("All");
                            }}
                            style={{ 
                                marginTop: '1rem',
                                padding: '10px 24px',
                                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseOver={(e) => {
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.4)';
                            }}
                            onMouseOut={(e) => {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.3)';
                            }}
                        >
                            Clear All Filters
                        </button>
                    </div>
                )}
            </div>

            {/* Status Modal */}
            {isStatusModalOpen && selectedReport && (
                <ModalPortal>
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
                                {REPORT_STATUSES.map(status => {
                                    const currentIndex = REPORT_STATUSES.indexOf(selectedReport.status);
                                    const statusIndex = REPORT_STATUSES.indexOf(status);
                                    const isDisabled = statusIndex < currentIndex;
                                    return (
                                        <option key={status} value={status} disabled={isDisabled}>
                                            {status} {status === selectedReport.status ? '(Current)' : ''} {isDisabled ? '(Cannot revert)' : ''}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        
                        {newStatus !== selectedReport.status && (
                            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f0f8ff', borderRadius: '4px', fontSize: '0.9em' }}>
                                <p style={{ margin: 0, color: '#0066cc' }}>
                                    <strong>📧 Note:</strong> The user will receive a notification about this status change.
                                </p>
                            </div>
                        )}
                        
                        <div className="modal-buttons">
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
                </ModalPortal>
            )}

            {/* Delete Modal */}
            {isDeleteConfirmOpen && (
                <ModalPortal>
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
                </ModalPortal>
            )}

            {/* Delete Reason Modal: ask admin why the report is being deleted */}
            {isDeleteReasonOpen && (
                <ModalPortal>
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
                </ModalPortal>
            )}

            {/* Fullscreen Image Preview */}
            {previewImage && (
                <ModalPortal>
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
                </ModalPortal>
            )}

            {/* Smart Filter Warning Modal - Show on first activation */}
            {showSmartFilterWarning && (
                <ModalPortal>
                <div 
                    className="modal-overlay"
                    onClick={handleRejectSmartFilterWarning}
                >
                    <div 
                        className="modal"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            maxWidth: '450px',
                            borderLeft: '6px solid #2d3b8f',
                            backgroundColor: '#f0f8ff'
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '16px',
                            borderBottom: '2px solid #2d3b8f',
                            paddingBottom: '12px'
                        }}>
                            <h3 style={{ margin: 0, color: '#2d3b8f' }}>✨ Smart Filter Usage Limit</h3>
                            <button
                                onClick={handleRejectSmartFilterWarning}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '1.5em',
                                    cursor: 'pointer',
                                    color: '#666'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
                            {/* Warning Header */}
                            <div style={{
                                padding: '14px',
                                backgroundColor: '#fff9e6',
                                borderRadius: '6px',
                                borderLeft: '4px solid #f39c12'
                            }}>
                                <div style={{ fontWeight: '600', color: '#f39c12', marginBottom: '8px' }}>
                                    ⏱️ Free Usage Policy
                                </div>
                                <p style={{ margin: 0, fontSize: '0.95em', color: '#666', lineHeight: '1.4' }}>
                                    You have <strong>48 free hours per week</strong> to use the Smart Filter for AI-powered incident categorization.
                                </p>
                            </div>

                            {/* How It Works */}
                            <div style={{
                                padding: '14px',
                                backgroundColor: '#f5f5f5',
                                borderRadius: '6px'
                            }}>
                                <div style={{ fontWeight: '600', marginBottom: '8px', color: '#333' }}>
                                    ⏲️ How It Works
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.95em', color: '#666', lineHeight: '1.5' }}>
                                    <li>Time counting starts when you turn ON Smart Filter (button turns blue)</li>
                                    <li>Time stops when you turn OFF Smart Filter (button turns gray)</li>
                                    <li>All usage is tracked and aggregated weekly</li>
                                    <li>Upgrade to Premium for unlimited access</li>
                                </ul>
                            </div>

                            {/* Current Usage */}
                            <div style={{
                                padding: '12px',
                                backgroundColor: '#e8f4f8',
                                borderRadius: '6px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <span style={{ fontWeight: '500' }}>Your Weekly Usage:</span>
                                    <span style={{ fontWeight: 'bold', color: '#2d3b8f' }}>{typeof aiUsagePercent === 'number' ? aiUsagePercent.toFixed(1) : aiUsagePercent}%</span>
                                </div>
                                <div style={{ height: '6px', backgroundColor: '#d0e0f0', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${aiUsagePercent}%`,
                                        backgroundColor: '#2d3b8f',
                                        transition: 'width 0.3s ease'
                                    }} />
                                </div>
                                <div style={{ marginTop: '6px', fontSize: '0.85em', color: '#666' }}>
                                    {timeRemainingHMS} remaining this week
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button 
                                onClick={handleRejectSmartFilterWarning}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#ccc',
                                    color: '#333',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: '500',
                                    fontSize: '0.95em',
                                    transition: 'all 0.3s ease'
                                }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = '#bbb'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = '#ccc'}
                            >
                                ✕ Cancel
                            </button>
                            <button 
                                onClick={handleAcceptSmartFilterWarning}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#2d3b8f',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                    fontSize: '0.95em',
                                    transition: 'all 0.3s ease'
                                }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = '#1a2555'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = '#2d3b8f'}
                            >
                                ✅ Accept & Enable Smart Filter
                            </button>
                        </div>
                    </div>
                </div>
                </ModalPortal>
            )}

            {/* Notification - wrapped in ModalPortal for proper z-index */}
            {notification && (
                <ModalPortal>
                    <div 
                        className={`notif notif-${notification.type}`}
                        role="alert" 
                        aria-live="assertive"
                    >
                        {notification.message}
                    </div>
                </ModalPortal>
            )}
        </div>
    );
}

export default RespondersReports;