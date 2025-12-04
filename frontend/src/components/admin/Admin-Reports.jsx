import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    FaEdit,
    FaTrashAlt,
    FaSearch,
    FaRedo, FaCheckCircle, FaTimesCircle, FaCheck, FaTimes,
    FaSyncAlt, FaClock, FaFileCsv, FaFilePdf, FaThLarge, FaList, FaArchive, FaFileAlt } from "react-icons/fa";
import { API_CONFIG, getApiUrl } from "../../utils/apiConfig";
import "./Admin-Reports.css";
import "../shared/Notification.css";
import ModalPortal from "../shared/ModalPortal";
import LoadingScreen from "../shared/LoadingScreen";
const REPORT_STATUSES = ["Pending", "Ongoing", "Resolved"];

// Priority level colors and styling (copied from BarangayReports)
const PRIORITY_COLORS = {
    Crime: { borderColor: '#c0392b', bgColor: '#fdedec', priority: 'Critical', label: '🔴 Critical' },
    Hazard: { borderColor: '#d35400', bgColor: '#fef5e7', priority: 'High', label: '🟠 High' },
    Concern: { borderColor: '#95a5a6', bgColor: '#ecf0f1', priority: 'Medium', label: '⚪ Medium' },
    'Lost&Found': { borderColor: '#95a5a6', bgColor: '#ecf0f1', priority: 'Low', label: '⚪ Low' },
    Others: { borderColor: '#95a5a6', bgColor: '#ecf0f1', priority: 'Low', label: '⚪ Low' },
};

const getPriorityStyle = (category) => {
    return PRIORITY_COLORS[category] || PRIORITY_COLORS['Others'];
};

// Category keywords - kept for reference only, actual confidence is computed by backend AI
// The backend ml_categorizer.py uses weighted keyword matching for accurate confidence scoring
const CATEGORY_KEYWORDS = {
    Crime: ['theft', 'robbery', 'assault', 'violence', 'vandalism'],
    Hazard: ['fire', 'flood', 'explosion', 'gas leak', 'collapse'],
    Concern: ['emergency', 'accident', 'suspicious', 'disturbance'],
    'Lost&Found': ['lost', 'found', 'missing', 'wallet', 'phone'],
    Others: ['other', 'misc', 'general']
};

// Fallback confidence computation - only used when backend AI is unavailable
// The primary confidence comes from backend's weighted keyword matching algorithm
const computeConfidence = (description = '', numImages = 0) => {
    // Simple fallback - returns baseline confidence
    // Real confidence is calculated by backend AI using weighted keyword matching
    const text = (description || '').toLowerCase().trim();
    if (!text) return 55;
    
    // Basic length and image bonus for fallback
    const wordCount = text.split(/\s+/).length;
    const lengthBonus = Math.min(10, Math.floor(wordCount / 5));
    const imageBonus = Math.min(7, numImages * 2.5);
    
    // Base confidence with simple bonuses
    return Math.max(55, Math.min(75, 58 + lengthBonus + imageBonus));
};

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


function AdminReports({ token, reportTitle = 'All Community Reports', showTitle = true }) {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("All");
    const [priorityFilter, setPriorityFilter] = useState("All");
    const [barangay, setBarangay] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All"); 
    const [sort, setSort] = useState("latest");
    const [smartSort, setSmartSort] = useState("latest"); // When Smart Filter active, controls date ordering for smart mode
    const [previewImage, setPreviewImage] = useState(null);
    const [notification, setNotification] = useState(null);
    const [highlightedReportId, setHighlightedReportId] = useState(null);
    const [viewMode, setViewMode] = useState("card"); // "card" or "list" view
    // Smart Filter states (copied from BarangayReports)
    const [showSmartFilter, setShowSmartFilter] = useState(false);
    const [aiUsagePercent, setAiUsagePercent] = useState(0);
    const [timeRemainingHMS, setTimeRemainingHMS] = useState('48:00:00'); // HH:MM:SS format
    const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(172800); // 48 hours in seconds
    const [showUsageModal, setShowUsageModal] = useState(false);
    const [smartFilterStartTime, setSmartFilterStartTime] = useState(null);
    const [hasAcceptedAiWarning, setHasAcceptedAiWarning] = useState(false);
    const [showSmartFilterWarning, setShowSmartFilterWarning] = useState(false);
    const [liveSessionSeconds, setLiveSessionSeconds] = useState(0);
    const [showCommunityHelper] = useState(true); // show inline category suggestion
    const [isPremium, setIsPremium] = useState(false); // Admin premium status - unlimited AI usage

    // Loading animation states
    const [overlayExited, setOverlayExited] = useState(false);
    const [showMountAnimation, setShowMountAnimation] = useState(false);
    const [mountStage, setMountStage] = useState("exit");
    const loadingRef = useRef(loading);

    // Keep loadingRef in sync with loading state
    useEffect(() => {
        loadingRef.current = loading;
    }, [loading]);

    // Start a cinematic mount animation only if a real loading fetch is not already running.
    useEffect(() => {
        let startTimer = null;
        let exitTimer = null;

        if (!loadingRef.current) {
            startTimer = setTimeout(() => {
                // If a fetch started while waiting, skip mount animation
                if (loadingRef.current) return;
                setShowMountAnimation(true);
                setMountStage("loading");

                // After a short display, transition to exit to play the exit animation
                exitTimer = setTimeout(() => {
                    setMountStage("exit");
                }, 700);
            }, 180);
        }

        return () => {
            if (startTimer) clearTimeout(startTimer);
            if (exitTimer) clearTimeout(exitTimer);
        };
        // Run on mount only
    }, []);

    // If a real loading starts while the mount animation is visible, cancel the cinematic
    useEffect(() => {
        if (loading) {
            setShowMountAnimation(false);
        }
    }, [loading]);

    // --- Smart Filter helpers (copied and adapted from BarangayReports) ---
    const trackAiUsage = useCallback(async (durationSeconds = 0) => {
        // Premium users bypass AI usage tracking completely
        if (isPremium) {
            console.log('[Smart Filter] ✨ Premium user - skipping usage tracking');
            return;
        }
        
        if (!token || token.length < 10) {
            console.warn('[Smart Filter] No valid token - skipping usage tracking');
            return;
        }

        // Don't track if duration is 0 or negative
        if (durationSeconds <= 0) {
            console.log('[Smart Filter] Skipping zero-duration tracking');
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
                    interaction_type: 'smart_filter_session',
                    duration_seconds: durationSeconds,
                    metadata: { timestamp: new Date().toISOString() }
                })
            });

            if (!response.ok) {
                console.error('[Smart Filter] API error', response.status);
                return;
            }

            const data = await response.json();
            if (data.status === 'success' && data.data) {
                const premiumStatus = data.data.is_premium || false;
                setIsPremium(premiumStatus);
                setAiUsagePercent(data.data.usage_percent || 0);
                setTimeRemainingHMS(data.data.time_remaining_hms || '48:00:00');
                setTimeRemainingSeconds(data.data.time_remaining_seconds ?? 172800);
                if (premiumStatus) {
                    console.log(`[Smart Filter] ✨ Premium admin - Unlimited access`);
                } else {
                    console.log(`[Smart Filter] ✅ Usage updated: ${data.data.usage_percent}% used, ${data.data.time_remaining_hms} remaining`);
                }
            }
        } catch (err) {
            console.error('[Smart Filter] Error logging usage', err);
        }
    }, [token, isPremium]);

    const handleSmartFilterToggle = useCallback(() => {
        // Premium users (Admin) skip the warning modal
        if (!showSmartFilter && !hasAcceptedAiWarning && !isPremium) {
            setShowSmartFilterWarning(true);
            return;
        }

        if (showSmartFilter && smartFilterStartTime && (hasAcceptedAiWarning || isPremium)) {
            const durationSeconds = Math.floor((Date.now() - smartFilterStartTime) / 1000);
            trackAiUsage(durationSeconds);
            setSmartFilterStartTime(null);
            setLiveSessionSeconds(0);
        } else if (!showSmartFilter && (hasAcceptedAiWarning || isPremium)) {
            setSmartFilterStartTime(Date.now());
            if (isPremium) {
                setHasAcceptedAiWarning(true); // Auto-accept for premium
            }
        }

        setShowSmartFilter(!showSmartFilter);
    }, [showSmartFilter, smartFilterStartTime, hasAcceptedAiWarning, isPremium, trackAiUsage]);

    const handleAcceptSmartFilterWarning = useCallback(() => {
        const startTime = Date.now();
        setHasAcceptedAiWarning(true);
        setShowSmartFilterWarning(false);
        setShowSmartFilter(true);
        setSmartFilterStartTime(startTime);
        setLiveSessionSeconds(0);
    }, []);

    const handleRejectSmartFilterWarning = useCallback(() => {
        setShowSmartFilterWarning(false);
    }, []);

    // Real-time countdown timer for active Smart Filter session
    // Updates: liveSessionSeconds, live aiUsagePercent, live timeRemainingHMS  
    const WEEK_LIMIT_SECONDS = 172800; // 48 hours
    
    useEffect(() => {
        if (!showSmartFilter || !smartFilterStartTime) {
            setLiveSessionSeconds(0);
            return;
        }

        console.log('[Smart Filter] ⏱️ Session timer started - tracking real-time usage');

        const timer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - smartFilterStartTime) / 1000);
            setLiveSessionSeconds(elapsed);
            
            // Premium users don't need countdown - always show unlimited
            if (isPremium) {
                // Just track session time, no percentage updates needed
                if (elapsed > 0 && elapsed % 30 === 0) {
                    const minutes = Math.floor(elapsed / 60);
                    const seconds = elapsed % 60;
                    console.log(`[Smart Filter] ✨ Premium session: ${minutes}m ${seconds}s (Unlimited)`);
                }
                return;
            }
            
            // Calculate real-time usage: base usage + current session elapsed time
            const baseUsedSeconds = WEEK_LIMIT_SECONDS - timeRemainingSeconds;
            const totalUsedNow = baseUsedSeconds + elapsed;
            const livePercent = Math.min(100, Math.round((totalUsedNow / WEEK_LIMIT_SECONDS) * 100));
            const liveRemaining = Math.max(0, WEEK_LIMIT_SECONDS - totalUsedNow);
            
            // Update usage percent in real-time
            setAiUsagePercent(livePercent);
            
            // Format live time remaining as HH:MM:SS
            const hrs = Math.floor(liveRemaining / 3600);
            const mins = Math.floor((liveRemaining % 3600) / 60);
            const secs = liveRemaining % 60;
            setTimeRemainingHMS(`${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
            
            // Log progress every 30 seconds
            if (elapsed > 0 && elapsed % 30 === 0) {
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                console.log(`[Smart Filter] ⏳ Session: ${minutes}m ${seconds}s | Usage: ${livePercent}% | Remaining: ${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
            }
        }, 1000); // Update every second for countdown display

        return () => clearInterval(timer);
    }, [showSmartFilter, smartFilterStartTime, timeRemainingSeconds, isPremium]);
    // ---------------------------------------------------------------------

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
    const [rejectionInfoReport, setRejectionInfoReport] = useState(null); // eslint-disable-line no-unused-vars
    
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
    // Keep a ref for timer updates (if needed elsewhere)
    const smartFilterTimerRef = useRef(null);
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

    // Fetch reports from API (kept original logic)
    const fetchReports = useCallback(async () => {
        if (!token) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const sortParam = sort === "latest" ? "desc" : "asc";
            const response = await fetch(getApiUrl(`/api/reports?limit=50&sort=${sortParam}`), {
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
                        is_approved: report.is_approved ?? false,
                        is_rejected: report.is_rejected ?? false,
                        rejection_reason: report.rejection_reason ?? null,
                        images: report.images?.map(img => img.url) || []
                    };
                });
                // Try to get ML-based confidences from backend in a single batch call.
                try {
                    const items = transformedReports.map(r => ({ id: r.id, description: r.description, images: r.images?.length || 0 }));
                    const resp = await fetch(getApiUrl('/api/ai/categorize/batch'), {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ items })
                    });

                    if (resp.ok) {
                        const json = await resp.json();
                        const results = json.results || {};
                        const annotated = transformedReports.map(r => {
                            const res = results[r.id] || {};
                            // Use backend's confidence_percent directly, or calculate from confidence, or fallback to local computation
                            const aiConfidence = res.confidence_percent 
                                ?? (typeof res.confidence === 'number' ? Math.round(res.confidence * 100) : null)
                                ?? computeConfidence(r.description, r.category, r.images?.length || 0);
                            return {
                                ...r,
                                ai_confidence: aiConfidence,
                                ai_category: res.category || r.category,
                                ai_method: res.method || 'batch',
                                ai_reason: res.reason || '',
                                // Include priority data from backend (capitalized: Critical/High/Medium/Low)
                                ai_priority: res.priority || 'Low',
                                ai_priority_score: res.priority_score || 1,
                                ai_priority_label: res.priority_label || '⚪ Low'
                            };
                        });
                        setReports(annotated);
                    } else {
                        // fallback to deterministic client-side heuristic
                        const fallback = transformedReports.map(r => {
                            const catPriority = getPriorityStyle(r.category);
                            return {
                                ...r,
                                ai_confidence: computeConfidence(r.description, r.category, r.images?.length || 0),
                                ai_category: r.category,
                                ai_method: 'heuristic',
                                ai_priority: catPriority.priority,  // Already capitalized: Critical/High/Medium/Low
                                ai_priority_score: catPriority.priority === 'Critical' ? 10 : (catPriority.priority === 'High' ? 8 : (catPriority.priority === 'Medium' ? 5 : 2)),
                                ai_priority_label: catPriority.label
                            };
                        });
                        setReports(fallback);
                    }
                } catch (err) {
                    console.error('AI batch classify failed, falling back to heuristic', err);
                    const fallback = transformedReports.map(r => {
                        const catPriority = getPriorityStyle(r.category);
                        return {
                            ...r,
                            ai_confidence: computeConfidence(r.description, r.category, r.images?.length || 0),
                            ai_category: r.category,
                            ai_method: 'error',
                            ai_priority: catPriority.priority,  // Already capitalized: Critical/High/Medium/Low
                            ai_priority_score: catPriority.priority === 'Critical' ? 10 : (catPriority.priority === 'High' ? 8 : (catPriority.priority === 'Medium' ? 5 : 2)),
                            ai_priority_label: catPriority.label
                        };
                    });
                    setReports(fallback);
                }
            } else {
                throw new Error(data.message || 'Failed to fetch reports');
            }
        } catch (error) {
            console.error('Error fetching reports:', error);  
            setReports([]);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    // Fetch current week AI usage on component mount
    useEffect(() => {
        if (!token) return;
        
        const fetchCurrentUsage = async () => {
            try {
                const response = await fetch(getApiUrl('/api/ai/current-usage'), {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'success' && data.data) {
                        const premiumStatus = data.data.is_premium || false;
                        setIsPremium(premiumStatus);
                        setAiUsagePercent(data.data.usage_percent || 0);
                        setTimeRemainingHMS(data.data.time_remaining_hms || '48:00:00');
                        setTimeRemainingSeconds(data.data.time_remaining_seconds ?? 172800);
                        
                        if (premiumStatus) {
                            console.log('[Admin-Reports] ✨ PREMIUM USER - Unlimited Smart Filter access');
                        } else {
                            console.log('[Admin-Reports] ✅ AI Usage loaded:', data.data.usage_percent + '% used, Time remaining:', data.data.time_remaining_hms, `(${data.data.time_remaining_seconds}s)`);
                        }
                    }
                }
            } catch (err) {
                console.warn('[Admin-Reports] Could not fetch AI usage:', err);
            }
        };

        fetchCurrentUsage();
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

    // Filtered reports with Smart Filter aware ordering
    const priorityRank = (priorityLabel) => {
        if (!priorityLabel) return 0;
        switch (priorityLabel) {
            case 'Critical': return 3;
            case 'High': return 2;
            case 'Medium': return 1;
            default: return 0;
        }
    };

    const smartComparator = (a, b) => {
        // 1) Unapproved/pending (is_approved === false) come first
        const aApproved = !!a.is_approved;
        const bApproved = !!b.is_approved;
        if (aApproved !== bApproved) return aApproved ? 1 : -1;

        // 2) Priority ranking: Critical > High > Medium > Low
        const aPri = priorityRank(getPriorityStyle(a.category).priority);
        const bPri = priorityRank(getPriorityStyle(b.category).priority);
        if (aPri !== bPri) return bPri - aPri; // higher priority first

        // 3) Within same priority, prioritize higher confidence percentage
        const aConf = (typeof a.ai_confidence === 'number') ? a.ai_confidence : computeConfidence(a.description || '', a.category, (a.images || []).length);
        const bConf = (typeof b.ai_confidence === 'number') ? b.ai_confidence : computeConfidence(b.description || '', b.category, (b.images || []).length);
        if (aConf !== bConf) return bConf - aConf; // higher confidence first

        // 4) Fallback to date ordering based on smartSort
        const aT = new Date(a.created_at).getTime() || 0;
        const bT = new Date(b.created_at).getTime() || 0;
        return smartSort === 'latest' ? bT - aT : aT - bT;
    };

    const dateComparator = (a, b) => {
        const aT = new Date(a.created_at).getTime() || 0;
        const bT = new Date(b.created_at).getTime() || 0;
        if (sort === 'latest') return bT - aT;
        return aT - bT;
    };

    // Helper to get priority label from AI or fallback to category-based
    const getReportPriority = (report) => {
        // Use AI priority if available
        if (report.ai_priority) {
            const pri = String(report.ai_priority).toLowerCase().trim();
            console.log(`[Admin Priority Debug] Report ${report.id}: ai_priority="${report.ai_priority}" normalized="${pri}"`);
            if (pri === 'critical') return 'Critical';
            if (pri === 'high') return 'High';
            if (pri === 'medium') return 'Medium';
            if (pri === 'low') return 'Low';
            return 'Low';
        }
        // Fallback to category-based priority
        const catPriority = getPriorityStyle(report.category);
        console.log(`[Admin Priority Debug] Report ${report.id}: Using fallback category="${report.category}" priority="${catPriority.priority}"`);
        return catPriority.priority || 'Low';
    };

    // Export to CSV
    const exportToCSV = () => {
        const headers = ["ID", "Title", "Category", "Status", "Barangay", "Address", "Reporter", "Priority", "Created At", "Description"];
        const rows = filteredReports.map((r) => [
            r.id,
            `"${(r.title || "").replace(/"/g, '""')}"`,
            r.category || "N/A",
            r.status || "N/A",
            r.barangay || r.address_barangay || "N/A",
            `"${(r.addressStreet || r.address_street || "").replace(/"/g, '""')}"`,
            r.reporter ? `${r.reporter.firstname || ""} ${r.reporter.lastname || ""}`.trim() : "Unknown",
            getReportPriority(r),
            r.created_at ? new Date(r.created_at).toLocaleString() : "N/A",
            `"${(r.description || "").replace(/"/g, '""').substring(0, 200)}..."`
        ]);
        
        const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `admin_reports_${new Date().toISOString().split("T")[0]}.csv`;
        link.click();
    };

    // Export to PDF with Community Helper AI Analytics
    const exportToPDF = async () => {
        const reportDate = new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });
        
        // Calculate analytics
        const totalReports = filteredReports.length;
        const categoryStats = {};
        const barangayStats = {};
        const statusStats = { Pending: 0, Ongoing: 0, Resolved: 0 };
        const priorityStats = { Critical: 0, High: 0, Medium: 0, Low: 0 };
        
        filteredReports.forEach((report) => {
            const cat = report.category || "Unknown";
            categoryStats[cat] = (categoryStats[cat] || 0) + 1;
            
            const brgy = report.barangay || report.address_barangay || "Unknown";
            barangayStats[brgy] = (barangayStats[brgy] || 0) + 1;
            
            const status = report.status || "Pending";
            statusStats[status] = (statusStats[status] || 0) + 1;
            
            const priority = getReportPriority(report);
            priorityStats[priority] = (priorityStats[priority] || 0) + 1;
        });
        
        const sortedCategories = Object.entries(categoryStats).sort((a, b) => b[1] - a[1]);
        const sortedBarangays = Object.entries(barangayStats).sort((a, b) => b[1] - a[1]);
        
        const logoPath = new URL('../assets/logo.png', import.meta.url).href;
        
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Community Guard - Admin Reports Analytics</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2d3b8f; padding-bottom: 20px; }
                    .header-logo { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 10px; }
                    .header-logo img { width: 48px; height: 48px; object-fit: contain; }
                    .header h1 { color: #2d3b8f; font-size: 28px; margin-bottom: 5px; }
                    .header .subtitle { color: #666; font-size: 14px; }
                    .header .role-badge { background: #2d3b8f; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; margin-top: 8px; display: inline-block; }
                    .ai-badge { background: linear-gradient(135deg, #2d3b8f, #1e2966); color: white; padding: 10px 20px; border-radius: 20px; display: inline-flex; align-items: center; gap: 10px; margin: 15px 0; font-size: 14px; font-weight: 500; }
                    .ai-badge img { width: 24px; height: 24px; object-fit: contain; border-radius: 4px; }
                    .section { margin-bottom: 30px; }
                    .section-title { font-size: 18px; color: #2d3b8f; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
                    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
                    .stat-card { background: #f8fafc; padding: 20px; border-radius: 10px; text-align: center; border: 1px solid #e5e7eb; }
                    .stat-card .number { font-size: 32px; font-weight: bold; color: #2d3b8f; }
                    .stat-card .label { font-size: 12px; color: #666; margin-top: 5px; }
                    .analytics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
                    .analytics-card { background: #f8fafc; padding: 20px; border-radius: 10px; border: 1px solid #e5e7eb; }
                    .analytics-card h3 { font-size: 14px; color: #2d3b8f; margin-bottom: 15px; }
                    .analytics-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
                    .analytics-item:last-child { border-bottom: none; }
                    .analytics-item .name { font-size: 13px; }
                    .analytics-item .count { font-weight: bold; color: #2d3b8f; }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 15px; }
                    th { background: #2d3b8f; color: white; padding: 10px 8px; text-align: left; }
                    td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
                    tr:nth-child(even) { background: #f8fafc; }
                    .priority-critical, .priority-high { color: #dc2626; font-weight: bold; }
                    .priority-medium { color: #f59e0b; font-weight: bold; }
                    .priority-low { color: #22c55e; }
                    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; padding-top: 20px; border-top: 2px solid #2d3b8f; }
                    .footer-brand { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 8px; }
                    .footer-brand img { width: 28px; height: 28px; object-fit: contain; }
                    .footer-brand span { font-weight: 600; color: #2d3b8f; font-size: 14px; }
                    .footer-subtitle { margin-top: 8px; font-size: 11px; color: #888; font-style: italic; }
                    @media print { body { padding: 20px; } .stats-grid { grid-template-columns: repeat(4, 1fr); } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="header-logo">
                        <img src="${logoPath}" alt="Community Guard Logo" onerror="this.style.display='none'" />
                        <h1>Community Guard</h1>
                    </div>
                    <p class="subtitle">Admin Reports - Complete Analytics Report</p>
                    <div class="ai-badge">💡 Community Helper</div>
                    <p style="margin-top: 10px; font-size: 13px; color: #666;">Generated: ${reportDate}</p>
                </div>
                
                <div class="section">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="number">${totalReports}</div>
                            <div class="label">Total Reports</div>
                        </div>
                        <div class="stat-card">
                            <div class="number" style="color: #f59e0b;">${statusStats.Pending}</div>
                            <div class="label">Pending</div>
                        </div>
                        <div class="stat-card">
                            <div class="number" style="color: #3b82f6;">${statusStats.Ongoing}</div>
                            <div class="label">Ongoing</div>
                        </div>
                        <div class="stat-card">
                            <div class="number" style="color: #22c55e;">${statusStats.Resolved}</div>
                            <div class="label">Resolved</div>
                        </div>
                    </div>
                </div>
                
                <div class="analytics-grid">
                    <div class="analytics-card">
                        <h3>📁 Reports by Category</h3>
                        ${sortedCategories.map(([name, count]) => `
                            <div class="analytics-item">
                                <span class="name">${name}</span>
                                <span class="count">${count}</span>
                            </div>
                        `).join("")}
                    </div>
                    <div class="analytics-card">
                        <h3>📍 Reports by Barangay</h3>
                        ${sortedBarangays.slice(0, 8).map(([name, count]) => `
                            <div class="analytics-item">
                                <span class="name">${name}</span>
                                <span class="count">${count}</span>
                            </div>
                        `).join("")}
                        ${sortedBarangays.length > 8 ? `<div class="analytics-item"><span class="name" style="color: #999;">... and ${sortedBarangays.length - 8} more</span><span></span></div>` : ""}
                    </div>
                </div>
                
                <div class="section">
                    <h2 class="section-title">📋 Detailed Report List</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Title</th>
                                <th>Category</th>
                                <th>Status</th>
                                <th>Barangay</th>
                                <th>Priority</th>
                                <th>Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredReports.slice(0, 50).map((report) => `
                                <tr>
                                    <td>${report.id}</td>
                                    <td>${report.title || "Untitled"}</td>
                                    <td>${report.category || "N/A"}</td>
                                    <td>${report.status || "N/A"}</td>
                                    <td>${report.barangay || report.address_barangay || "N/A"}</td>
                                    <td class="priority-${getReportPriority(report).toLowerCase()}">${getReportPriority(report)}</td>
                                    <td>${new Date(report.created_at).toLocaleDateString()}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                    ${filteredReports.length > 50 ? `<p style="margin-top: 15px; color: #666; font-size: 12px; text-align: center;">Showing first 50 of ${filteredReports.length} reports</p>` : ""}
                </div>
                
                <div class="footer">
                    <div class="footer-brand">
                        <img src="${logoPath}" alt="Community Guard Logo" onerror="this.style.display='none'" />
                        <span>Community Guard</span>
                    </div>
                    <p>Protecting Communities Together</p>
                    <p class="footer-subtitle">This report was generated with Community Helper Smart Analytics</p>
                </div>
            </body>
            </html>
        `;
        
        const printWindow = window.open("", "_blank");
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
    };

    const filteredReports = reports
        .filter((r) => !r.is_rejected)
        .filter((r) => r.status !== "Resolved") // Exclude resolved reports - they go to Archived
        .filter((r) => (category === "All" ? true : r.category === category))
        .filter((r) => (barangay === "All" ? true : r.barangay === barangay))
        .filter((r) => (statusFilter === "All" ? true : r.status === statusFilter))
        .filter((r) => {
            // Priority filter only applies when Smart Filter is ON
            if (!showSmartFilter) return true;
            if (priorityFilter === "All") return true;
            // Use AI-generated priority for filtering
            const reportPriority = getReportPriority(r);
            return reportPriority === priorityFilter;
        })
        .filter((r) => {
            const reporterName = r.reporter 
                ? `${r.reporter.firstname || ""} ${r.reporter.lastname || ""}`.trim()
                : "Unknown User";
            if (!search || search.trim() === '') return true;
            return r.title.toLowerCase().includes(search.toLowerCase()) ||
                    reporterName.toLowerCase().includes(search.toLowerCase());
        })
        .sort((a, b) => {
            // Always prioritize unapproved/pending reports on top
            const aApproved = !!a.is_approved;
            const bApproved = !!b.is_approved;
            if (aApproved !== bApproved) return aApproved ? 1 : -1;

            // If both have same approval status, apply smart ordering when enabled,
            // otherwise fallback to the regular date comparator.
            if (showSmartFilter) return smartComparator(a, b);
            return dateComparator(a, b);
        });

    // Loading / mount animation features (cards shown during mount/loading)
    const loadingFeatures = [
        { title: "Report Management", description: "View, approve, reject, and manage all community reports." },
        { title: "Smart Filter", description: "AI-assisted categorization and priority-based sorting." },
        { title: "Export Tools", description: "Export reports to CSV or PDF with analytics." },
    ];

    const effectiveStage = showMountAnimation ? mountStage : (loading ? "loading" : "exit");

    const handleLoadingExited = () => {
        setShowMountAnimation(false);
        setOverlayExited(true);
    };

    return (
        <LoadingScreen
            variant="inline"
            features={loadingFeatures}
            title={loading ? "Admin Reports" : undefined}
            subtitle={loading ? "Fetching all community reports and resources" : undefined}
            stage={effectiveStage}
            onExited={handleLoadingExited}
            inlineOffset="20vh"
            successDuration={700}
            successTitle="Admin Reports Ready"
        >
            <div className="admin-container">
                <div className="admin-header-row">
                    {showTitle && <h2>{loading ? reportTitle : reportTitle}</h2>}
                    <div className="header-right">
                        {/* View Toggle */}
                        <div className="view-toggle">
                            <button
                                className={`view-toggle-btn ${viewMode === 'card' ? 'active' : ''}`}
                                onClick={() => setViewMode('card')}
                                title="Card View"
                                aria-label="Switch to card view"
                            >
                                <FaThLarge />
                            </button>
                            <button
                                className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                                onClick={() => setViewMode('list')}
                                title="List View"
                                aria-label="Switch to list view"
                            >
                                <FaList />
                            </button>
                        </div>
                        
                        {/* Export Buttons */}
                        <div className="export-buttons">
                            <button
                                className="export-btn csv"
                                onClick={exportToCSV}
                                title="Export to CSV"
                                aria-label="Export reports to CSV"
                            >
                                <FaFileCsv /> CSV
                            </button>
                            <button
                                className="export-btn pdf"
                                onClick={exportToPDF}
                                title="Export to PDF with Analytics"
                                aria-label="Export reports to PDF with AI analytics"
                            >
                                <FaFilePdf /> PDF
                            </button>
                        </div>
                </div>
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
                {/* Smart Filter Toggle - Premium golden bar for Admin users */}
                <div className="admin-smart-filter-container">
                    <button
                        onClick={() => {
                            if (aiUsagePercent >= 100 && !isPremium) {
                                setShowUsageModal(true);
                            } else {
                                handleSmartFilterToggle();
                            }
                        }}
                        className={`admin-smart-filter-btn ${isPremium ? 'premium' : (aiUsagePercent >= 100 ? 'limit-reached' : (showSmartFilter ? 'active' : 'inactive'))}`}
                        title={isPremium ? (showSmartFilter ? 'Disable Smart Filter (Premium - Unlimited)' : 'Enable Smart Filter (Premium - Unlimited)') : (aiUsagePercent >= 100 ? 'Premium feature - Upgrade now' : (showSmartFilter ? 'Disable Smart Filter' : 'Enable Smart Filter'))}
                        aria-pressed={showSmartFilter}
                    >
                        <span>{isPremium ? '👑' : '✨'}</span>
                        {isPremium ? 'Smart Filter' : (aiUsagePercent >= 100 ? 'Premium' : 'Smart Filter')}
                    </button>

                    <div className="admin-progress-container">
                        <div className="admin-progress-row">
                            {/* Progress Bar */}
                            <div className={`admin-progress-bar ${isPremium ? 'premium' : ''}`}>
                                <div 
                                    className={`admin-progress-fill ${isPremium ? 'premium' : (aiUsagePercent >= 100 ? 'limit-reached' : '')} ${showSmartFilter && !isPremium ? 'active' : ''}`}
                                    style={{ width: isPremium ? '100%' : `${aiUsagePercent}%` }}
                                />
                            </div>
                            {/* Premium: Show infinity icon with Active label below, Non-premium: ? button */}
                            {isPremium ? (
                                <div className="admin-premium-btn-container">
                                    <button 
                                        onClick={() => setShowUsageModal(true)} 
                                        className="admin-usage-btn premium"
                                        title="Premium - Unlimited Access" 
                                        aria-label="Premium unlimited access"
                                    >∞</button>
                                    {showSmartFilter && hasAcceptedAiWarning && (
                                        <span className="admin-premium-active-label">Active</span>
                                    )}
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setShowUsageModal(true)} 
                                    className={`admin-usage-btn ${aiUsagePercent >= 100 ? 'limit-reached' : ''}`}
                                    title="View AI usage details" 
                                    aria-label="AI usage information"
                                >?</button>
                            )}
                        </div>

                        {/* Session timer - only for non-premium users */}
                        {!isPremium && showSmartFilter && hasAcceptedAiWarning && (
                            <div className="admin-session-timer">
                                <span>🕐 Session: {Math.floor(liveSessionSeconds / 60)}m {liveSessionSeconds % 60}s</span>
                                <span>{aiUsagePercent}% used | {timeRemainingHMS}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Smart Filter Warning Modal */}
            {showSmartFilterWarning && (
                <ModalPortal>
                <div className="modal-overlay" onClick={handleRejectSmartFilterWarning}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', borderLeft: '6px solid #2d3b8f', backgroundColor: '#f0f8ff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #2d3b8f', paddingBottom: '12px' }}>
                            <h3 style={{ margin: 0, color: '#2d3b8f' }}>✨ Smart Filter Usage Limit</h3>
                            <button onClick={handleRejectSmartFilterWarning} style={{ background: 'none', border: 'none', fontSize: '1.5em', cursor: 'pointer', color: '#666' }}>✕</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
                            <div style={{ padding: '14px', backgroundColor: '#fff9e6', borderRadius: '6px', borderLeft: '4px solid #f39c12' }}>
                                <div style={{ fontWeight: '600', color: '#f39c12', marginBottom: '8px' }}>⏱️ Free Usage Policy</div>
                                <p style={{ margin: 0, fontSize: '0.95em', color: '#666', lineHeight: '1.4' }}>You have <strong>48 free hours per week</strong> to use the Smart Filter for AI-powered incident categorization.</p>
                            </div>

                            <div style={{ padding: '12px', backgroundColor: '#e8f4f8', borderRadius: '6px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <span style={{ fontWeight: '500' }}>Your Weekly Usage:</span>
                                    <span style={{ fontWeight: 'bold', color: '#2d3b8f' }}>{aiUsagePercent}%</span>
                                </div>
                                <div style={{ height: '6px', backgroundColor: '#d0e0f0', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${aiUsagePercent}%`, backgroundColor: '#2d3b8f', transition: 'width 0.3s ease' }} />
                                </div>
                                <div style={{ marginTop: '6px', fontSize: '0.85em', color: '#666' }}>{Math.ceil((100 - aiUsagePercent) / 100 * 48)} hours remaining this week</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={handleRejectSmartFilterWarning} style={{ padding: '10px 20px', backgroundColor: '#ccc', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500', fontSize: '0.95em' }}>✕ Cancel</button>
                            <button onClick={handleAcceptSmartFilterWarning} style={{ padding: '10px 20px', backgroundColor: '#2d3b8f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.95em' }}>✅ Accept & Enable Smart Filter</button>
                        </div>
                    </div>
                </div>
                </ModalPortal>
            )}

            {/* AI Usage Modal - Premium-aware */}
            {showUsageModal && (
                <ModalPortal>
                <div className="modal-overlay" onClick={() => setShowUsageModal(false)}>
                    <div className={`modal ${isPremium ? 'admin-premium-modal' : ''}`} onClick={(e) => e.stopPropagation()} style={{ 
                        maxWidth: '420px', 
                        backgroundColor: isPremium ? 'var(--admin-premium-bg)' : (aiUsagePercent >= 100 ? 'var(--admin-premium-bg)' : 'white')
                    }}>
                        <div className={isPremium ? 'admin-premium-modal-header' : ''} style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            marginBottom: '20px', 
                            borderBottom: `2px solid ${isPremium ? 'var(--admin-premium-primary)' : '#e0e0e0'}`, 
                            paddingBottom: '12px' 
                        }}>
                            <h3 style={{ margin: 0, color: isPremium ? 'var(--admin-premium-secondary)' : '#333' }}>
                                {isPremium ? '👑 Premium AI Access' : '📊 AI Usage Status'}
                            </h3>
                            <button onClick={() => setShowUsageModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5em', cursor: 'pointer' }}>✕</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Premium Badge */}
                            {isPremium && (
                                <div className="admin-premium-status-card">
                                    <div className="admin-premium-status-icon">👑</div>
                                    <div className="admin-premium-status-title">Admin Premium Status</div>
                                    <div className="admin-premium-status-subtitle">Unlimited Smart Filter access</div>
                                </div>
                            )}

                            {/* Live Session Timer - only for non-premium users */}
                            {!isPremium && showSmartFilter && hasAcceptedAiWarning && (
                                <div className="admin-session-info">
                                    <div className="admin-session-info-title">🕐 Live Session Timer</div>
                                    <div className="admin-session-info-time">
                                        {Math.floor(liveSessionSeconds / 60)}m {liveSessionSeconds % 60}s
                                    </div>
                                    <div className="admin-session-info-desc">
                                        This session is being tracked in real-time and will be logged when you disable Smart Filter.
                                    </div>
                                </div>
                            )}

                            {/* Usage Bar - Premium shows golden full bar */}
                            <div className="admin-usage-bar-container">
                                <div className="admin-usage-bar-header">
                                    <span className="admin-usage-bar-label">
                                        {isPremium ? 'Access Level:' : 'Weekly AI Limit Usage:'}
                                    </span>
                                    {isPremium ? (
                                        <span className="admin-usage-bar-value premium">
                                            <span className="infinity-icon">∞</span> Unlimited
                                        </span>
                                    ) : (
                                        <span className={`admin-usage-bar-value ${aiUsagePercent >= 100 ? 'limit-reached' : ''}`}>
                                            {aiUsagePercent}%
                                        </span>
                                    )}
                                </div>
                                <div className={`admin-modal-progress-bar ${isPremium ? 'premium' : ''}`}>
                                    <div 
                                        className={`admin-modal-progress-fill ${isPremium ? 'premium' : (aiUsagePercent >= 100 ? 'limit-reached' : '')} ${showSmartFilter && !isPremium ? 'active' : ''}`}
                                        style={{ width: isPremium ? '100%' : `${aiUsagePercent}%` }}
                                    />
                                </div>
                            </div>

                            {/* Premium Benefits List */}
                            {isPremium && (
                                <div className="admin-premium-benefits">
                                    <div className="admin-premium-benefits-title">✨ Your Premium Benefits</div>
                                    <ul className="admin-premium-benefits-list">
                                        <li>📊 <strong>Unlimited</strong> Smart Filter usage</li>
                                        <li>⚡ AI-powered incident categorization</li>
                                        <li>🎯 Priority severity sorting</li>
                                        <li>📈 Real-time confidence scores</li>
                                        <li>🔄 No weekly time limits</li>
                                    </ul>
                                </div>
                            )}

                            {/* Time Remaining (only for non-premium) */}
                            {!isPremium && (
                                <div className="admin-time-remaining">
                                    <div style={{ marginBottom: '8px' }}>
                                        <span style={{ color: '#666' }}>⏱️ Time Remaining: </span>
                                        <span className="admin-time-remaining-value">{timeRemainingHMS}</span>
                                    </div>
                                    <div style={{ color: '#666', fontSize: '0.85em' }}>Maximum: 48 hours per week</div>
                                </div>
                            )}

                            {/* Status Message */}
                            {!isPremium && aiUsagePercent >= 100 ? (
                                <div className="admin-limit-warning">
                                    <div className="admin-limit-warning-title">🔒 AI Limit Reached</div>
                                    <p className="admin-limit-warning-text">
                                        You've reached your weekly AI suggestion limit. Upgrade to Premium for unlimited access!
                                    </p>
                                    <button onClick={() => { setShowUsageModal(false); }} className="admin-upgrade-btn">
                                        ✨ Upgrade to Premium
                                    </button>
                                </div>
                            ) : !isPremium && (
                                <div className="admin-available-status">
                                    <div className="admin-available-status-title">✅ Smart Filter Available</div>
                                    <p className="admin-available-status-text">
                                        You have {100 - aiUsagePercent}% of your weekly AI suggestions remaining.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                </ModalPortal>
            )}

            <div className="reports-list">
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
                    viewMode === "card" ? (
                    filteredReports.map((report, index) => {
                        const isExpanded = expandedPosts.includes(report.id);
                        const isPending = !report.is_approved;
                        
                        // DEBUG: Log is_approved value for first 3 reports
                        if (index < 3) {
                            console.log(`[Admin-Reports] Report ${report.id}: is_approved=${report.is_approved}, isPending=${isPending}, status=${report.status}`);
                        }

                        const cardClasses = ["report-card"];
                        if (isPending) {
                            cardClasses.push("report-pending");
                        }
                        if (highlightedReportId === report.id) {
                            cardClasses.push("highlighted-report");
                        }

                        // Determine border color when Smart Filter is ON and report is approved
                        const priorityStyle = getPriorityStyle(report.category);
                        const showPriorityBorder = showSmartFilter && report.is_approved;

                        return (
                            <div
                                key={report.id}
                                id={`report-${report.id}`}
                                className={cardClasses.join(' ')}
                                style={{
                                    animationDelay: `${index * 0.1}s`,
                                    border: showPriorityBorder ? `2px solid ${priorityStyle.borderColor}` : undefined
                                }} 
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
                                        {/* Inline priority label when Smart Filter active and report approved */}
                                        {showSmartFilter && report.is_approved && (
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '6px 10px',
                                                borderRadius: '999px',
                                                fontSize: '12px',
                                                fontWeight: 700,
                                                background: priorityStyle.bgColor,
                                                color: '#111',
                                                border: `1px solid ${priorityStyle.borderColor}`,
                                                marginRight: '8px'
                                            }}>
                                                <span aria-hidden="true">{priorityStyle.label}</span>
                                                <span style={{ fontSize: '11px', fontWeight: 600, marginLeft: 4 }}>{priorityStyle.priority}</span>
                                            </span>
                                        )}
                                        {!(report.is_approved === true && report.status === "Pending") && (
                                            <span className={`admin-status-badge admin-status-${report.status.toLowerCase()}`}>
                                                {getStatusIcon(report.status)}
                                                {report.status}
                                            </span>
                                        )}
                                        {isPending ? (
                                            <>
                                                <button 
                                                    className="admin-action-btn admin-approve-btn" 
                                                    onClick={() => handleApproveReport(report.id)}
                                                    disabled={isApprovingReport}
                                                    aria-label={`Approve report: ${report.title}`}
                                                    title="Approve Report"
                                                >
                                                    {isApprovingReport ? (
                                                        <>
                                                            <span className="admin-btn-spinner" aria-hidden="true"></span>
                                                            <span>Approving...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <FaCheck aria-hidden="true" />
                                                            <span>Accept</span>
                                                        </>
                                                    )}
                                                </button>
                                                <button 
                                                    className="admin-action-btn admin-reject-btn" 
                                                    onClick={() => handleRejectReport(report.id)}
                                                    disabled={isRejectingReport}
                                                    aria-label={`Reject report: ${report.title}`}
                                                    title="Reject Report"
                                                >
                                                    {isRejectingReport ? (
                                                        <>
                                                            <span className="admin-btn-spinner" aria-hidden="true"></span>
                                                            <span>Rejecting...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <FaTimes aria-hidden="true" />
                                                            <span>Reject</span>
                                                        </>
                                                    )}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button 
                                                    className="admin-action-btn admin-update-btn" 
                                                    onClick={() => openStatusModal(report)}
                                                    aria-label={`Update status for report: ${report.title}`}
                                                    title="Update Status"
                                                >
                                                    <FaEdit aria-hidden="true" />
                                                    <span>Update</span>
                                                </button>
                                                <button 
                                                    className="admin-action-btn admin-delete-btn" 
                                                    onClick={() => openDeleteReason(report)}
                                                    aria-label={`Delete report: ${report.title}`}
                                                    title="Delete Report"
                                                >
                                                    <FaTrashAlt aria-hidden="true" />
                                                    <span>Delete</span>
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
                                        backgroundColor: `${priorityStyle.bgColor}`,
                                        border: `1px solid ${priorityStyle.borderColor}`,
                                        borderRadius: '6px',
                                        marginBottom: '12px',
                                        marginLeft: '0px',
                                        marginRight: '0px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', backgroundColor: '#2d3b8f', color: 'white', borderRadius: '12px', fontSize: '0.75em', fontWeight: '600' }}>
                                                <span>💡</span>
                                                <span>Community Helper</span>
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9em' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span style={{ color: '#666', fontWeight: '500' }}>✨ Suggest:</span>
                                                <span
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => { setCategory(report.category); setPriorityFilter('All'); }}
                                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setCategory(report.category); setPriorityFilter('All'); } }}
                                                    style={{ fontWeight: '600', color: priorityStyle.borderColor, cursor: 'pointer', textDecoration: 'underline' }}
                                                    title={`Filter admin list by category: ${report.category}`}
                                                >
                                                    {report.category}
                                                </span>
                                                <span style={{ color: '#888' }}>·</span>
                                                <span style={{ padding: '2px 8px', backgroundColor: priorityStyle.borderColor, color: 'white', borderRadius: '12px', fontSize: '0.85em', fontWeight: '600' }}>
                                                    {priorityStyle.label}
                                                </span>
                                                <span style={{ marginLeft: 'auto', fontWeight: '600', color: priorityStyle.borderColor }}>
                                                    Confidence: {(typeof report.ai_confidence === 'number' ? report.ai_confidence : computeConfidence(report.description, report.category, report.images ? report.images.length : 0))}%
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
                    // List View
                    <div className="admin-list-table">
                        <div className="list-header">
                            <div className="list-col col-image">Image</div>
                            <div className="list-col col-title">Title</div>
                            <div className="list-col col-category">Category</div>
                            <div className="list-col col-barangay">Barangay</div>
                            <div className="list-col col-priority">Priority</div>
                            <div className="list-col col-reporter">Reporter</div>
                            <div className="list-col col-date">Date</div>
                            <div className="list-col col-status">Status</div>
                            <div className="list-col col-actions">Actions</div>
                        </div>
                        {filteredReports.map((report, index) => {
                            const isExpanded = expandedPosts.includes(report.id);
                            const isPending = !report.is_approved;
                            
                            return (
                                <div 
                                    key={report.id} 
                                    className={`list-row ${isPending ? 'list-row-pending' : ''}`}
                                    style={{ animationDelay: `${index * 0.05}s` }}
                                >
                                    <div className="list-col col-image">
                                        {report.images && report.images.length > 0 ? (
                                            <img
                                                src={report.images[0]}
                                                alt="Report thumbnail"
                                                className="list-thumbnail"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPreviewImage(report.images[0]);
                                                }}
                                            />
                                        ) : (
                                            <div className="no-thumbnail">
                                                <FaFileAlt />
                                            </div>
                                        )}
                                    </div>
                                    <div className="list-col col-title" onClick={() => toggleExpand(report.id)}>
                                        <span className="list-title">{report.title || "Untitled"}</span>
                                        {isExpanded && (
                                            <p className="list-description">{report.description}</p>
                                        )}
                                    </div>
                                    <div className="list-col col-category">
                                        <span className="category-tag">{report.category || "N/A"}</span>
                                    </div>
                                    <div className="list-col col-barangay">{report.barangay || report.address_barangay || "N/A"}</div>
                                    <div className="list-col col-priority">
                                        <span className={`priority-tag priority-${(report.ai_priority || getPriorityStyle(report.category).priority || "low").toLowerCase()}`}>
                                            {report.ai_priority || getPriorityStyle(report.category).priority || "N/A"}
                                        </span>
                                    </div>
                                    <div className="list-col col-reporter">
                                        <div className="reporter-info">
                                            <img
                                                src={report.reporter?.avatar_url || "/src/assets/profile.png"}
                                                alt=""
                                                className="reporter-avatar"
                                                onError={(e) => {
                                                    e.target.src = "/src/assets/profile.png";
                                                }}
                                            />
                                            <span>{report.reporter?.firstname || "Unknown"}</span>
                                        </div>
                                    </div>
                                    <div className="list-col col-date">
                                        {report.date || report.created_at
                                            ? new Date(report.date || report.created_at).toLocaleDateString()
                                            : "N/A"}
                                    </div>
                                    <div className="list-col col-status">
                                        <span className={`admin-status-badge admin-status-${report.status.toLowerCase()}`}>
                                            {getStatusIcon(report.status)} {report.status}
                                        </span>
                                    </div>
                                    <div className="list-col col-actions">
                                        {isPending ? (
                                            <div className="list-actions">
                                                <button 
                                                    className="list-action-btn accept"
                                                    onClick={() => handleApproveReport(report.id)}
                                                    disabled={isApprovingReport}
                                                    title="Accept"
                                                >
                                                    <FaCheck />
                                                </button>
                                                <button 
                                                    className="list-action-btn reject"
                                                    onClick={() => handleRejectReport(report.id)}
                                                    disabled={isRejectingReport}
                                                    title="Reject"
                                                >
                                                    <FaTimes />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="list-actions">
                                                <button 
                                                    className="list-action-btn edit"
                                                    onClick={() => openStatusModal(report)}
                                                    title="Update Status"
                                                >
                                                    <FaEdit />
                                                </button>
                                                <button 
                                                    className="list-action-btn delete"
                                                    onClick={() => openDeleteReason(report)}
                                                    title="Delete"
                                                >
                                                    <FaTrashAlt />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    )
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

            {/* Rejection Info Modal - Shows when admin views a rejected report */}
            {rejectionInfoModalOpen && rejectionInfoReport && (
                <ModalPortal>
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

            {/* Notification */}
            {notification && (
                <div 
                    className={`notif notif-${notification.type}`}
                    role="alert" 
                    aria-live="assertive"
                >
                    {notification.message}
                </div>
            )}
        </div>
        </LoadingScreen>
    );
}

export default AdminReports;