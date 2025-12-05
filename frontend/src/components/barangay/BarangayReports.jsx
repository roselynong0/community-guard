import React, { useState, useEffect, useCallback, useRef } from "react";
import { FaEdit, FaTrashAlt, FaSearch, FaRedo, FaCheckCircle, FaTimesCircle, FaCheck, FaTimes, FaSyncAlt, FaClock, FaFileCsv, FaFilePdf, FaThLarge, FaList, FaArchive, FaFileAlt, FaHeart, FaRegHeart, FaFire, FaPlus, FaMinus, FaMapPin, FaChartLine } from "react-icons/fa";
import { API_CONFIG, getApiUrl } from "../../utils/apiConfig";
import ModalPortal from "../shared/ModalPortal";
import "./BarangayReports.css";
import "../shared/Notification.css";
import LoadingScreen from "../shared/LoadingScreen";
const REPORT_STATUSES = ["Pending", "Ongoing", "Resolved"];

// Priority level colors and styling
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

// Category keywords used for deterministic confidence scoring (mirror of backend heuristics)
const CATEGORY_KEYWORDS = {
    Crime: ['theft','robbery','burglary','stolen','steal','assault','attack','violence','vandalism','mugging','robbed'],
    Hazard: ['fire','flood','explosion','smoke','hazard','danger','pothole','streetlight','electric','gas','collapsed'],
    Concern: ['suspicious','unknown','strange','loitering','accident','injured','emergency','witness','scam','threat'],
    'Lost&Found': ['lost','found','missing','wallet','phone','keys','pet','dog','cat'],
    Others: ['other','misc','issue','concern','help']
};

const computeConfidence = (description = '', category = 'Others', numImages = 0) => {
    try {
        const text = (description || '').toLowerCase();
        const keywords = CATEGORY_KEYWORDS[category] || CATEGORY_KEYWORDS['Others'];
        if (!text || keywords.length === 0) return 60;

        let matches = 0;
        for (const kw of keywords) {
            if (text.includes(kw)) matches += 1;
        }

        const normalized = Math.min(1, matches / Math.max(1, keywords.length));
        const imageBonus = numImages > 0 ? 5 : 0;
        const base = 65;
        const score = Math.round(base + normalized * 30 + imageBonus);
        return Math.max(55, Math.min(98, score));
    } catch {
        return 65;
    }
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


function BarangayReports({ token }) {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All"); 
    const [sort, setSort] = useState("latest");
    const [smartSort, setSmartSort] = useState("latest"); // When smart filter active, controls primary date ordering
    const [priorityFilter, setPriorityFilter] = useState("All");
    const [userBarangay, setUserBarangay] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);
    const [notification, setNotification] = useState(null);
    const [highlightedReportId, setHighlightedReportId] = useState(null);
    const [showCommunityHelper] = useState(true); // Toggle for Community Helper visibility
    const [showSmartFilter, setShowSmartFilter] = useState(false); // Smart Filter toggle - starts GREY (inactive)
    const [aiUsagePercent, setAiUsagePercent] = useState(0); // AI usage percentage (0-100)
    const [timeRemainingHMS, setTimeRemainingHMS] = useState('48:00:00'); // HH:MM:SS format
    const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(172800); // 48 hours in seconds
    const [showUsageModal, setShowUsageModal] = useState(false); // Show usage details modal
    const [isPremiumUser, setIsPremiumUser] = useState(false); // Premium user status for golden UI
    const [viewMode, setViewMode] = useState("card"); // "card" or "list" view

    // States for the Status Update Modal
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);
    const [newStatus, setNewStatus] = useState("");
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false); // Prevent double submissions

    const [expandedPosts, setExpandedPosts] = useState([]);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [, setOverlayExited] = useState(false);
    
    // States for Smart Filter time tracking and warning
    const [smartFilterStartTime, setSmartFilterStartTime] = useState(null);
    const [hasAcceptedAiWarning, setHasAcceptedAiWarning] = useState(false);
    const [showSmartFilterWarning, setShowSmartFilterWarning] = useState(false);
    const [liveSessionSeconds, setLiveSessionSeconds] = useState(0); // Real-time session duration
    
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

    // Export modal states
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportType, setExportType] = useState(null); // 'csv' or 'pdf'

    // ⭐ NEW: Trending reports states
    const [trendingReports, setTrendingReports] = useState([]);
    const [trendingExpanded, setTrendingExpanded] = useState(true);
    const [trendingTimeFilter, setTrendingTimeFilter] = useState("this-month"); // today, yesterday, this-month

    // --- REFS for Keyboard Navigation ---
    const filterContainerRef = useRef(null);
    // Elements we want to navigate between with arrow keys
    const filterSelector = 'input.barangay-search-input, .barangay-top-controls .barangay-filter-select, .reports-list button:first-child'; 
    useKeyboardNavigation(filterContainerRef, filterSelector);

    // Mount animation / cinematic intro state (matches Reports.jsx behavior)
    const [showMountAnimation, setShowMountAnimation] = useState(false);
    const [mountStage, setMountStage] = useState("exit");
    const loadingRef = useRef(loading);

    // Notification handler
    const showNotification = useCallback((message, type = "success") => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    }, []);

    // Component initialization logging
    useEffect(() => {
        console.log('🔷 BarangayReports component mounted');
        console.log('[Smart Filter Init] 🟢 Component Initialized:');
        console.log('  - showSmartFilter:', false);
        console.log('  - hasAcceptedAiWarning:', false);
        console.log('  - smartFilterStartTime:', null);
        console.log('[Smart Filter Init] ⏳ Now fetching current AI usage from backend...');
        
        return () => {
            console.log('🔴 BarangayReports component unmounting');
        };
    }, []);

    // Log aiUsagePercent changes separately to avoid requiring it in the mount-only effect
    useEffect(() => {
        console.log('[Smart Filter Init] aiUsagePercent updated:', aiUsagePercent);
    }, [aiUsagePercent]);

    // Keep a ref of the current loading state for the mount animation logic
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

    // Track AI smart filter usage - logs duration when Smart Filter turns off
    const trackAiUsage = useCallback(async (durationSeconds = 0) => {
        if (!token) {
            console.warn('[Smart Filter] ⚠️ No token available - skipping usage tracking');
            showNotification('Authentication required', 'error');
            return;
        }

        console.log(`[Smart Filter] 📊 Session ended - Duration: ${durationSeconds}s (${(durationSeconds / 60).toFixed(2)} minutes)`);

        try {
            console.log('[Smart Filter] 📤 Sending to backend: POST /api/ai/log-usage');
            console.log(`[Smart Filter] Payload:`, {
                interaction_type: 'smart_filter_session',
                duration_seconds: durationSeconds,
                metadata: { timestamp: new Date().toISOString() }
            });

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
                console.error(`[Smart Filter] ❌ API error: ${response.status}`);
                if (response.status === 404) {
                    console.warn('[Smart Filter] ⚠️ Endpoint not found - Migration may not be applied yet');
                } else if (response.status === 500) {
                    console.error('[Smart Filter] ❌ Server error - Check backend logs');
                    const errorData = await response.json().catch(() => ({}));
                    console.error('[Smart Filter] Server response:', errorData);
                }
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            console.log('[Smart Filter] ✅ Backend response:', data);

            if (data.status === 'success') {
                // Update local state with backend-persisted usage percent
                const { usage_percent, hours_remaining, is_premium, total_seconds, time_remaining_hms, time_remaining_seconds } = data.data;
                setAiUsagePercent(usage_percent);
                setTimeRemainingHMS(time_remaining_hms || '48:00:00');
                setTimeRemainingSeconds(time_remaining_seconds ?? 172800); // Update base for next live countdown
                setIsPremiumUser(is_premium || false); // Track premium status for golden UI
                
                console.log(`[Smart Filter] 📈 Usage Updated:`);
                console.log(`  Total this week: ${total_seconds}s (${(total_seconds / 3600).toFixed(2)}h)`);
                console.log(`  Usage percent: ${usage_percent}%`);
                console.log(`  Hours remaining: ${hours_remaining}h`);
                console.log(`  Premium: ${is_premium ? 'Yes (unlimited)' : 'No (48h/week limit)'}`);
                
                // Show feedback
                if (is_premium) {
                    showNotification('✨ Smart Filter session logged (Premium - unlimited)', 'success');
                } else {
                    const hoursUsedThisWeek = (total_seconds / 3600).toFixed(1);
                    showNotification(`📊 Session logged: ${hoursUsedThisWeek}h used this week, ${hours_remaining.toFixed(1)}h remaining`, 'success');
                }
            } else {
                console.error('[Smart Filter] Backend error:', data.message);
                showNotification(data.message || 'Failed to log usage', 'error');
            }
        } catch (error) {
            console.error('[Smart Filter] ❌ Error tracking AI usage:', error);
            showNotification('Failed to log session - will retry on next sync', 'warning');
            // Fallback: Don't modify local state on error, let user retry
        }
    }, [token, showNotification]);

    // Handle Smart Filter toggle with warning and time tracking
    const handleSmartFilterToggle = useCallback(() => {
        console.log('[Smart Filter Toggle] Current state:', {
            showSmartFilter,
            hasAcceptedAiWarning,
            smartFilterStartTime: smartFilterStartTime ? new Date(smartFilterStartTime).toISOString() : null,
            liveSessionSeconds
        });

        // If turning ON for the first time, show warning
        if (!showSmartFilter && !hasAcceptedAiWarning) {
            console.log('[Smart Filter] 🔔 First time activation - showing warning modal');
            setShowSmartFilterWarning(true);
            return;
        }

        // If turning OFF, log the duration
        if (showSmartFilter && smartFilterStartTime && hasAcceptedAiWarning) {
            const durationSeconds = Math.floor((Date.now() - smartFilterStartTime) / 1000);
            console.log(`[Smart Filter] 🛑 Turning OFF - Duration: ${durationSeconds}s (${(durationSeconds / 60).toFixed(2)}m)`);
            trackAiUsage(durationSeconds);
            setSmartFilterStartTime(null);
            setLiveSessionSeconds(0);
        }
        // If turning ON and already accepted warning, start timer
        else if (!showSmartFilter && hasAcceptedAiWarning) {
            const startTime = Date.now();
            console.log(`[Smart Filter] 🟢 Turning ON - Start time: ${new Date(startTime).toISOString()}`);
            setSmartFilterStartTime(startTime);
        }

        setShowSmartFilter(!showSmartFilter);
    }, [showSmartFilter, smartFilterStartTime, hasAcceptedAiWarning, liveSessionSeconds, trackAiUsage]);

    // Handle Smart Filter warning acceptance
    const handleAcceptSmartFilterWarning = useCallback(() => {
        const startTime = Date.now();
        console.log('[Smart Filter] ✅ Warning accepted');
        console.log('[Smart Filter] 🕐 Session timer started at:', new Date(startTime).toISOString());
        
        setHasAcceptedAiWarning(true);
        setShowSmartFilterWarning(false);
        setShowSmartFilter(true);
        setSmartFilterStartTime(startTime);
        setLiveSessionSeconds(0); // Reset timer to 0
    }, []);

    // Handle Smart Filter warning rejection
    const handleRejectSmartFilterWarning = useCallback(() => {
        console.log('[Smart Filter] ❌ Warning rejected - Smart Filter OFF');
        setShowSmartFilterWarning(false);
        // Don't turn on Smart Filter, keep it OFF
    }, []);

    // Real-time countdown timer for active Smart Filter session
    // Updates: liveSessionSeconds, live aiUsagePercent, live timeRemainingHMS
    const WEEK_LIMIT_SECONDS = 172800; // 48 hours
    
    useEffect(() => {
        if (!showSmartFilter || !smartFilterStartTime) {
            setLiveSessionSeconds(0);
            return;
        }

        // Log session start
        console.log('[Smart Filter] ⏱️ Session timer started - tracking real-time usage');

        const timer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - smartFilterStartTime) / 1000);
            setLiveSessionSeconds(elapsed);
            
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

        return () => {
            clearInterval(timer);
            console.log('[Smart Filter] ⏱️ Session timer interval cleared');
        };
    }, [showSmartFilter, smartFilterStartTime, timeRemainingSeconds]);

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
                // Try batch ML annotate via backend
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
                        console.log('[AI Batch Response] Full results:', results);
                        const annotated = transformedReports.map(r => {
                            const res = results[r.id] || {};
                            console.log(`[AI Batch] Report ${r.id}: priority="${res.priority}" score=${res.priority_score} label="${res.priority_label}"`);
                            return {
                                ...r,
                                ai_confidence: typeof res.confidence === 'number' ? Math.round(res.confidence * 100) : computeConfidence(r.description, r.category, r.images?.length || 0),
                                ai_category: res.category || r.category,
                                ai_method: res.method || 'batch',
                                // AI priority data for filtering (capitalized to match filter options: Critical/High/Medium/Low)
                                ai_priority: res.priority || 'Low',
                                ai_priority_score: res.priority_score || 1,
                                ai_priority_label: res.priority_label || '⚪ Low'
                            };
                        });
                        setReports(annotated);
                    } else {
                        const fallback = transformedReports.map(r => {
                            // Fallback priority based on category
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
                        // Fallback priority based on category
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
                throw new Error(data.message || 'Failed to fetch barangay reports');
            }
        } catch (error) {
            console.error('Error fetching barangay reports:', error);  
            setReports([]);
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    // Fetch current week AI usage on component mount
    useEffect(() => {
        const fetchAiUsage = async () => {
            if (!token) {
                console.log('[Smart Filter Init] ⏭️  Skipping AI usage fetch - no token');
                return;
            }
            
            console.log('[Smart Filter Init] 📊 Fetching current AI usage from backend...');
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
                        const usagePercent = data.data.usage_percent || 0;
                        const totalSeconds = data.data.total_seconds || 0;
                        const isPremium = data.data.is_premium || false;
                        const timeHMS = data.data.time_remaining_hms || '48:00:00';
                        const timeSeconds = data.data.time_remaining_seconds ?? 172800;
                        
                        console.log('[Smart Filter Init] ✅ Successfully fetched AI usage:');
                        console.log(`  Usage: ${usagePercent}%`);
                        console.log(`  Total seconds this week: ${totalSeconds}s (${(totalSeconds / 3600).toFixed(2)}h)`);
                        console.log(`  Time remaining: ${timeHMS} (${timeSeconds}s)`);
                        console.log(`  Premium: ${isPremium ? 'Yes (unlimited)' : 'No (48h/week limit)'}`);
                        
                        setAiUsagePercent(usagePercent);
                        setTimeRemainingHMS(timeHMS);
                        setTimeRemainingSeconds(timeSeconds);
                        setIsPremiumUser(isPremium); // Set premium status for golden UI
                    }
                } else if (response.status === 404) {
                    console.warn('[Smart Filter Init] ⚠️  Endpoint not found - Migration may not be applied');
                    console.log('[Smart Filter Init] ℹ️  AI usage tracking not yet available');
                    setAiUsagePercent(0);
                } else if (response.status === 500) {
                    console.error('[Smart Filter Init] ❌ Server error fetching AI usage (500)');
                    setAiUsagePercent(0);
                } else {
                    console.warn(`[Smart Filter Init] ⚠️  Unexpected status: ${response.status}`);
                    setAiUsagePercent(0);
                }
            } catch (error) {
                console.warn('[Smart Filter Init] ⚠️  Failed to fetch current AI usage:', error.message);
                console.log('[Smart Filter Init] ℹ️  Will continue without AI usage data');
                // Continue with default 0% if fetch fails - Smart Filter starts grey
                setAiUsagePercent(0);
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

    // ⭐ NEW: Compute trending reports using newsfeed algorithm
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

        // Filter approved reports that are not resolved
        const eligibleReports = reports.filter((r) => 
            r.is_approved === true &&
            r.status !== "Resolved" &&
            r.deleted_at === null &&
            r.is_rejected !== true &&
            filterByTime(r.created_at)
        );

        // Apply trending algorithm: reactions + engagement + recency
        // Score = (reactions * 2 + category_weight) / (hours_old + 2)^1.5
        const scored = eligibleReports.map((r) => {
            const createdAt = new Date(r.created_at || 0);
            const hoursOld = Math.max(0, (now - createdAt) / (1000 * 60 * 60));
            
            // Engagement: reactions + severity weight
            const severityWeight = { Crime: 3, Hazard: 2.5, Concern: 2, 'Lost&Found': 1, Others: 1 };
            const reactionBoost = (r.reaction_count || 0) * 2;
            const engagement = reactionBoost + (severityWeight[r.category] || 1) * 2;
            
            // Time decay factor
            const timeFactor = Math.pow(hoursOld + 2, 1.5);
            const trendingScore = engagement / timeFactor;
            
            return { ...r, trendingScore };
        });

        // Sort by trending score descending, limit to 5
        const trending = scored
            .sort((a, b) => b.trendingScore - a.trendingScore)
            .slice(0, 5);

        setTrendingReports(trending);
        console.log(`🔥 ${trending.length} trending reports for barangay`);
    }, [reports, trendingTimeFilter]);

    const toggleExpand = (id) => {
        setExpandedPosts((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
    };

    // Handle heart/like toggle for reports
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

    // Priority scoring function for sorting
    const getPriorityScore = (category) => {
        const scores = { Crime: 4, Hazard: 3, Concern: 2, 'Lost&Found': 1, Others: 1 };
        return scores[category] || 0;
    };

    // Map priority label (Critical/High/Medium/Low) to numeric rank for smart sorting
    const priorityRank = (priorityLabel) => {
        if (!priorityLabel) return 0;
        switch (priorityLabel) {
            case 'Critical': return 3;
            case 'High': return 2;
            case 'Medium': return 1;
            default: return 0;
        }
    };

    // Helper to get priority label from AI or fallback to category-based
    const getReportPriority = (report) => {
        // Use AI priority if available (when Smart Filter is active)
        if (report.ai_priority) {
            // Normalize AI priority to match filter options (Critical/High/Medium/Low)
            const pri = String(report.ai_priority).toLowerCase().trim();
            console.log(`[Priority Debug] Report ${report.id}: ai_priority="${report.ai_priority}" normalized="${pri}"`);
            if (pri === 'critical') return 'Critical';
            if (pri === 'high') return 'High';
            if (pri === 'medium') return 'Medium';
            if (pri === 'low') return 'Low';
            return 'Low';
        }
        // Fallback to category-based priority
        const catPriority = getPriorityStyle(report.category);
        console.log(`[Priority Debug] Report ${report.id}: Using fallback category="${report.category}" priority="${catPriority.priority}"`);
        return catPriority.priority || 'Low';
    };

    // Helper to filter reports by time range
    const filterReportsByTime = (reportsToFilter, timeRange) => {
        if (timeRange === 'all') return reportsToFilter;
        
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        return reportsToFilter.filter(report => {
            const reportDate = new Date(report.created_at);
            
            switch (timeRange) {
                case 'today':
                    return reportDate >= startOfToday;
                case 'this-week': {
                    const startOfWeek = new Date(startOfToday);
                    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
                    return reportDate >= startOfWeek;
                }
                case 'this-month': {
                    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    return reportDate >= startOfMonth;
                }
                default:
                    return true;
            }
        });
    };

    // Export to CSV with time filter
    const exportToCSV = (timeFilter = 'all') => {
        const reportsToExport = filterReportsByTime(filteredReports, timeFilter);
        
        const headers = ["ID", "Title", "Category", "Status", "Barangay", "Address", "Reporter", "Priority", "Created At", "Description"];
        const rows = reportsToExport.map((r) => [
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
        
        const timeLabel = timeFilter === 'all' ? 'all' : timeFilter.replace('-', '_');
        const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${userBarangay || 'barangay'}_reports_${timeLabel}_${new Date().toISOString().split("T")[0]}.csv`;
        link.click();
        
        setShowExportModal(false);
        showNotification(`Exported ${reportsToExport.length} reports to CSV`, 'success');
    };

    // Export to PDF with Community Helper AI Analytics
    const exportToPDF = async (timeFilter = 'all') => {
        const reportsToExport = filterReportsByTime(filteredReports, timeFilter);
        const timeLabel = timeFilter === 'all' ? 'All Time' : timeFilter === 'today' ? 'Today' : timeFilter === 'this-week' ? 'This Week' : 'This Month';
        
        const reportDate = new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });
        
        const totalReports = reportsToExport.length;
        const categoryStats = {};
        const statusStats = { Pending: 0, Ongoing: 0, Resolved: 0 };
        const priorityStats = { Critical: 0, High: 0, Medium: 0, Low: 0 };
        
        reportsToExport.forEach((report) => {
            const cat = report.category || "Unknown";
            categoryStats[cat] = (categoryStats[cat] || 0) + 1;
            
            const status = report.status || "Pending";
            statusStats[status] = (statusStats[status] || 0) + 1;
            
            const priority = getReportPriority(report);
            priorityStats[priority] = (priorityStats[priority] || 0) + 1;
        });
        
        const sortedCategories = Object.entries(categoryStats).sort((a, b) => b[1] - a[1]);
        const logoPath = new URL('../assets/logo.png', import.meta.url).href;
        
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Community Guard - ${userBarangay || 'Barangay'} Reports</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2d3b8f; padding-bottom: 20px; }
                    .header-logo { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 10px; }
                    .header-logo img { width: 48px; height: 48px; object-fit: contain; }
                    .header h1 { color: #2d3b8f; font-size: 28px; margin-bottom: 5px; }
                    .header .subtitle { color: #666; font-size: 14px; }
                    .header .role-badge { background: #10b981; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; margin-top: 8px; display: inline-block; }
                    .ai-badge { background: linear-gradient(135deg, #2d3b8f, #1e2966); color: white; padding: 10px 20px; border-radius: 20px; display: inline-flex; align-items: center; gap: 10px; margin: 15px 0; font-size: 14px; font-weight: 500; }
                    .ai-badge img { width: 24px; height: 24px; object-fit: contain; border-radius: 4px; }
                    .section { margin-bottom: 30px; }
                    .section-title { font-size: 18px; color: #2d3b8f; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
                    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
                    .stat-card { background: #f8fafc; padding: 20px; border-radius: 10px; text-align: center; border: 1px solid #e5e7eb; }
                    .stat-card .number { font-size: 32px; font-weight: bold; color: #2d3b8f; }
                    .stat-card .label { font-size: 12px; color: #666; margin-top: 5px; }
                    .analytics-card { background: #f8fafc; padding: 20px; border-radius: 10px; border: 1px solid #e5e7eb; margin-bottom: 20px; }
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
                    @media print { body { padding: 20px; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="header-logo">
                        <img src="${logoPath}" alt="Community Guard Logo" onerror="this.style.display='none'" />
                        <h1>Community Guard</h1>
                    </div>
                    <p class="subtitle">${userBarangay || 'Barangay'} Reports - Analytics Report</p>
                    <div class="ai-badge">
                        <span>💡 Community Helper</span>
                    </div>
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
                
                <div class="analytics-card">
                    <h3>📁 Reports by Category</h3>
                    ${sortedCategories.map(([name, count]) => `
                        <div class="analytics-item">
                            <span class="name">${name}</span>
                            <span class="count">${count}</span>
                        </div>
                    `).join("")}
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
                                <th>Priority</th>
                                <th>Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reportsToExport.slice(0, 50).map((report) => `
                                <tr>
                                    <td>${report.id}</td>
                                    <td>${report.title || "Untitled"}</td>
                                    <td>${report.category || "N/A"}</td>
                                    <td>${report.status || "N/A"}</td>
                                    <td class="priority-${getReportPriority(report).toLowerCase()}">${getReportPriority(report)}</td>
                                    <td>${new Date(report.created_at).toLocaleDateString()}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                    ${reportsToExport.length > 50 ? `<p style="margin-top: 15px; color: #666; font-size: 12px; text-align: center;">Showing first 50 of ${reportsToExport.length} reports</p>` : ""}
                </div>
                
                <div class="footer">
                    <div class="footer-brand">
                        <img src="${logoPath}" alt="Community Guard Logo" onerror="this.style.display='none'" />
                        <span>Community Guard</span>
                    </div>
                    <p>Protecting Communities Together</p>
                    <p style="margin-top: 5px; font-size: 11px; color: #888;">Time Range: ${timeLabel}</p>
                </div>
            </body>
            </html>
        `;
        
        const printWindow = window.open("", "_blank");
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
        
        setShowExportModal(false);
        showNotification(`Exported ${reportsToExport.length} reports to PDF`, 'success');
    };

    // Filtered reports (removed barangay filter - fetched from backend already filtered)
    const filteredReports = reports
        .filter((r) => !r.is_rejected) // Hide rejected reports from barangay view
        .filter((r) => r.status !== "Resolved") // Exclude resolved reports - they go to Archived
        .filter((r) => (category === "All" ? true : r.category === category))
        .filter((r) => (statusFilter === "All" ? true : r.status === statusFilter))
        .filter((r) => {
            // Priority filter only applies when Smart Filter is ON
            if (!showSmartFilter) return true;
            if (!priorityFilter || priorityFilter === 'All') return true;
            // Use AI-generated priority for filtering
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
            // Always prioritize unapproved/pending reports on top
            const aApproved = !!a.is_approved;
            const bApproved = !!b.is_approved;
            if (aApproved !== bApproved) return aApproved ? 1 : -1;

            // If Smart Filter is active, use smart prioritization within the approval group
            if (showSmartFilter) {
                // Use priority label mapping (Critical > High > Medium > Low)
                const aPri = priorityRank(getPriorityStyle(a.category).priority);
                const bPri = priorityRank(getPriorityStyle(b.category).priority);
                if (aPri !== bPri) return bPri - aPri;

                // Within same priority, order by confidence (higher first)
                const aConf = (typeof a.ai_confidence === 'number') ? a.ai_confidence : computeConfidence(a.description || '', a.category, (a.images || []).length);
                const bConf = (typeof b.ai_confidence === 'number') ? b.ai_confidence : computeConfidence(b.description || '', b.category, (b.images || []).length);
                if (aConf !== bConf) return bConf - aConf;

                // Fallback to date based on smartSort
                const aT = new Date(a.timestamp || a.created_at).getTime() || 0;
                const bT = new Date(b.timestamp || b.created_at).getTime() || 0;
                return smartSort === 'latest' ? bT - aT : aT - bT;
            }

            // Default behavior when Smart Filter is not active: priority then date
            const aPriority = getPriorityScore(a.category);
            const bPriority = getPriorityScore(b.category);
            if (aPriority !== bPriority) return bPriority - aPriority;

            const aTime = new Date(a.timestamp || a.created_at).getTime() || 0;
            const bTime = new Date(b.timestamp || b.created_at).getTime() || 0;
            return sort === 'latest' ? bTime - aTime : aTime - bTime;
        });

    // `address_barangay`, then a generic label.
    const headerBase = 'Barangay';

    // Loading / mount animation features (cards shown during mount/loading)
    const loadingFeatures = [
        { title: "Incident Triage", description: "Fast structured intake for actionable follow-up." },
        { title: "Smart Filter", description: "Optional Smart-assisted categorization for faster triage." },
        { title: "Responder Assignment", description: "Assign responders quickly from your barangay team." },
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
            title={loading ? `${headerBase} Reports` : undefined}
            subtitle={loading ? "Fetching latest barangay reports and resources" : undefined}
            stage={effectiveStage}
            onExited={handleLoadingExited}
            inlineOffset="20vh"
            successDuration={700}
            successTitle={`${headerBase} Reports Ready`}
        >
            <div className="admin-container">
                <div className="barangay-reports-header">
                    <h2>{`${headerBase} Reports`}</h2>
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
                                onClick={() => { setExportType('csv'); setShowExportModal(true); }}
                                title="Export to CSV"
                                aria-label="Export reports to CSV"
                            >
                                <FaFileCsv /> CSV
                            </button>
                            <button
                                className="export-btn pdf"
                                onClick={() => { setExportType('pdf'); setShowExportModal(true); }}
                                title="Export to PDF with Analytics"
                                aria-label="Export reports to PDF with AI analytics"
                            >
                                <FaFilePdf /> PDF
                            </button>
                        </div>
                    </div>
                </div>

            {/* IMPROVEMENT: Added ref to the filter container for keyboard navigation */}
            <div className="barangay-top-controls" ref={filterContainerRef}>
                <div className="barangay-search-container">
                    <label htmlFor="search-input" className="sr-only">Search reports by title or reporter name</label>
                    <input
                        id="search-input"
                        type="text"
                        placeholder="Search reports..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)} 
                        className="barangay-search-input" 
                    />
                    <FaSearch className="barangay-search-icon" aria-hidden="true" />
                </div>
                
                <label htmlFor="category-filter" className="sr-only">Filter by Category</label>
                <select 
                    id="category-filter"
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)}
                    className="barangay-filter-select"
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
                    className="barangay-filter-select"
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
                            className="barangay-filter-select"
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
                        className="barangay-filter-select"
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
                        className="barangay-filter-select"
                        aria-label="Sort reports by date"
                    >
                        <option value="latest">Latest → Oldest</option>
                        <option value="oldest">Oldest → Latest</option>
                    </select>
                )}

                {/* Smart Filter Toggle Button with Premium Indicator & Full-Width Timer */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%'
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
                        className={`barangay-smart-filter-btn ${isPremiumUser ? 'premium' : ''}`}
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
                            position: 'relative',
                            whiteSpace: 'nowrap',
                            boxShadow: isPremiumUser ? '0 2px 8px rgba(243, 156, 18, 0.4)' : 'none'
                        }}
                        title={isPremiumUser ? 'Premium - Unlimited AI Access' : (aiUsagePercent >= 100 ? 'Premium feature - Upgrade now' : (showSmartFilter ? 'Disable Smart Filter' : 'Enable Smart Filter'))}
                        aria-pressed={showSmartFilter}
                    >
                        <span>{isPremiumUser ? '👑' : '✨'}</span>
                        {isPremiumUser ? 'Premium' : (aiUsagePercent >= 100 ? 'Premium' : 'Smart Filter')}
                    </button>

                    {/* AI Usage Timer Bar - Full Width with Live Countdown */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flex: 1,
                        flexDirection: 'column'
                    }}>
                        {/* Progress bar with real-time update */}
                        <div style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <div 
                                className={`barangay-progress-bar ${isPremiumUser ? 'premium' : ''}`}
                                style={{
                                    flex: 1,
                                    height: isPremiumUser ? '10px' : '8px',
                                    backgroundColor: isPremiumUser ? undefined : '#e0e0e0',
                                    borderRadius: isPremiumUser ? '6px' : '4px',
                                    overflow: 'hidden',
                                    position: 'relative'
                                }}
                            >
                                <div 
                                    className={`barangay-progress-fill ${isPremiumUser ? 'premium' : ''}`}
                                    style={{
                                        height: '100%',
                                        width: isPremiumUser ? '100%' : `${aiUsagePercent}%`,
                                        backgroundColor: isPremiumUser ? undefined : (aiUsagePercent >= 100 ? '#f39c12' : '#2d3b8f'),
                                        transition: showSmartFilter && !isPremiumUser ? 'none' : 'width 0.3s ease',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }} 
                                />
                            </div>
                            
                            {/* Usage Info Button */}
                            <button
                                onClick={() => setShowUsageModal(true)}
                                className={`barangay-usage-btn ${isPremiumUser ? 'premium' : ''}`}
                                style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '50%',
                                    border: `2px solid ${isPremiumUser ? '#f39c12' : (aiUsagePercent >= 100 ? '#f39c12' : '#2d3b8f')}`,
                                    backgroundColor: 'white',
                                    color: isPremiumUser ? '#f39c12' : (aiUsagePercent >= 100 ? '#f39c12' : '#2d3b8f'),
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

                        {/* Live countdown timer - shows when Smart Filter is ON (not for premium users) */}
                        {showSmartFilter && hasAcceptedAiWarning && !isPremiumUser && (
                            <div style={{
                                width: '100%',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                fontSize: '0.85em',
                                fontWeight: '500',
                                color: '#2d3b8f',
                                padding: '4px 0'
                            }}>
                                <span>🕐 Session: {Math.floor(liveSessionSeconds / 60)}m {liveSessionSeconds % 60}s</span>
                            </div>
                        )}
                        
                        {/* Premium unlimited indicator */}
                        {isPremiumUser && showSmartFilter && hasAcceptedAiWarning && (
                            <div style={{
                                width: '100%',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                fontSize: '0.85em',
                                fontWeight: '600',
                                color: '#f39c12',
                                padding: '4px 0'
                            }}>
                                <span>👑 Premium - Unlimited AI Access</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

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

            {/* AI Usage Modal */}
            {showUsageModal && (
                <ModalPortal>
                <div 
                    className="modal-overlay"
                    onClick={() => setShowUsageModal(false)}
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
                            {/* Live Session Timer - shows when Smart Filter is ON */}
                            {showSmartFilter && hasAcceptedAiWarning && (
                                <div style={{
                                    padding: '12px',
                                    backgroundColor: '#e8f4ff',
                                    borderRadius: '6px',
                                    borderLeft: '4px solid #2d3b8f'
                                }}>
                                    <div style={{ fontWeight: '600', color: '#2d3b8f', marginBottom: '6px' }}>
                                        🕐 Live Session Timer
                                    </div>
                                    <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#2d3b8f', marginBottom: '6px' }}>
                                        {Math.floor(liveSessionSeconds / 60)}m {liveSessionSeconds % 60}s
                                    </div>
                                    <div style={{ fontSize: '0.9em', color: '#666' }}>
                                        This session is being tracked in real-time and will be logged when you disable Smart Filter.
                                    </div>
                                </div>
                            )}

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
                                        {typeof aiUsagePercent === 'number' ? aiUsagePercent.toFixed(1) : aiUsagePercent}%
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
                                        transition: showSmartFilter ? 'none' : 'width 0.3s ease'
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
                                        {timeRemainingHMS}
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
                </ModalPortal>
            )}

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
            `}</style>

            {/* ⭐ Trending Pill Button Row - Always visible, shows count */}
            <div className="trending-pill-row">
                <button
                    className={`trending-pill-btn ${trendingReports.length === 0 ? 'empty' : ''}`}
                    onClick={() => setTrendingExpanded(!trendingExpanded)}
                    title={trendingExpanded ? 'Hide trending reports' : 'Show trending reports'}
                >
                    <FaFire className="trending-pill-icon" />
                    Trending ({trendingReports.length})
                    {trendingExpanded ? <FaMinus className="trending-pill-toggle" /> : <FaPlus className="trending-pill-toggle" />}
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
                {reports.length === 0 ? (
                    <div className="no-reports" role="status">
                        <FaChartLine style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem' }} />
                        <p>No reports found.</p>
                        <p className="muted">Active incidents will appear here.</p>
                    </div>
                ) : filteredReports.length > 0 ? (
                    viewMode === "card" ? (
                    filteredReports.map((report, index) => {
                        const isExpanded = expandedPosts.includes(report.id);
                        const isPending = !report.is_approved;
                        
                        // DEBUG: Log is_approved value for first 3 reports
                        if (index < 3) {
                            console.log(`[BarangayReports] Report ${report.id}: is_approved=${report.is_approved}, isPending=${isPending}, status=${report.status}`);
                        }

                        const cardClasses = ["report-card"];
                        if (isPending) {
                            cardClasses.push("report-pending");
                        }
                        if (highlightedReportId === report.id) {
                            cardClasses.push("highlighted-report");
                        }

                        return (
                            <div
                                key={report.id}
                                id={`report-${report.id}`}
                                className={cardClasses.join(' ')}
                                style={{
                                    animationDelay: `${index * 0.1}s`,
                                    position: 'relative',
                                    // Smart Filter ON: Show priority border | OFF: Hide border for accepted posts
                                    border: `2px solid ${!isPending ? (showSmartFilter ? getPriorityStyle(report.category).borderColor : 'transparent') : 'transparent'}`,
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
                                        {!(report.is_approved === true && report.status === "Pending Approval") && (
                                            <span className={`barangay-status-badge barangay-status-${report.status.toLowerCase()}`}>
                                                {getStatusIcon(report.status)}
                                                {report.status}
                                            </span>
                                        )}
                                        {isPending ? (
                                            <>
                                                <button 
                                                    className="barangay-action-btn barangay-approve-btn" 
                                                    onClick={() => handleApproveReport(report.id)}
                                                    disabled={isApprovingReport}
                                                    aria-label={`Approve report: ${report.title}`}
                                                    title="Approve Report"
                                                >
                                                    {isApprovingReport ? (
                                                        <>
                                                            <span className="barangay-btn-spinner" aria-hidden="true"></span>
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
                                                    className="barangay-action-btn barangay-reject-btn" 
                                                    onClick={() => handleRejectReport(report.id)}
                                                    disabled={isRejectingReport}
                                                    aria-label={`Reject report: ${report.title}`}
                                                    title="Reject Report"
                                                >
                                                    {isRejectingReport ? (
                                                        <>
                                                            <span className="barangay-btn-spinner" aria-hidden="true"></span>
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
                                                    className="barangay-action-btn barangay-update-btn" 
                                                    onClick={() => openStatusModal(report)}
                                                    aria-label={`Update status for report: ${report.title}`}
                                                    title="Update Status"
                                                >
                                                    <FaEdit aria-hidden="true" />
                                                    <span>Update</span>
                                                </button>
                                                {report.status === "Ongoing" && (
                                                    <button 
                                                        className="barangay-action-btn barangay-assign-btn" 
                                                        onClick={() => openAssignResponderModal(report)}
                                                        aria-label={`Assign responder for report: ${report.title}`}
                                                        title="Assign Responder"
                                                    >
                                                        👤
                                                        <span>Assign</span>
                                                    </button>
                                                )}
                                                <button 
                                                    className="barangay-action-btn barangay-delete-btn" 
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
                                        backgroundColor: `${getPriorityStyle(report.category).bgColor}`,
                                        border: `1px solid ${getPriorityStyle(report.category).borderColor}`,
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
                                        
                                        {/* Category Information with Priority & Confidence */}
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
                                                <span style={{ fontWeight: '600', color: getPriorityStyle(report.category).borderColor }}>
                                                    {report.category}
                                                </span>
                                                <span style={{ color: '#888' }}>·</span>
                                                <span style={{
                                                    padding: '2px 8px',
                                                    backgroundColor: getPriorityStyle(report.category).borderColor,
                                                    color: 'white',
                                                    borderRadius: '12px',
                                                    fontSize: '0.85em',
                                                    fontWeight: '600'
                                                }}>
                                                    {getPriorityStyle(report.category).label}
                                                </span>
                                                <span style={{ marginLeft: 'auto', fontWeight: '600', color: getPriorityStyle(report.category).borderColor }}>
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

                                {/* Heart/Like Button - Disabled for pending reports */}
                                <div className="report-reactions">
                                    <button
                                        className={`reaction-btn heart-btn ${report.user_liked ? 'liked' : ''} ${isPending ? 'disabled' : ''}`}
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            if (!isPending) handleToggleLike(report.id); 
                                        }}
                                        disabled={isPending}
                                        aria-label={isPending ? 'Cannot like pending report' : (report.user_liked ? 'Unlike this report' : 'Like this report')}
                                        title={isPending ? 'Cannot like pending report' : (report.user_liked ? 'Unlike' : 'Like')}
                                        style={isPending ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
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
                    // List View
                    <div className="barangay-list-table">
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
                                        <span className={`priority-tag priority-${(getReportPriority(report) || "low").toLowerCase()}`}>
                                            {getReportPriority(report) || "N/A"}
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
                                        {!(report.is_approved === true && report.status === "Pending") && (
                                            <span className={`barangay-status-badge barangay-status-${report.status.toLowerCase()}`}>
                                                {getStatusIcon(report.status)} {report.status}
                                            </span>
                                        )}
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
                    <div className="no-reports" role="status">
                        <FaChartLine style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem' }} />
                        <p>No reports match your current filters.</p>
                        <p className="muted">Try adjusting your search criteria.</p>
                        <button 
                            onClick={() => {
                                setSearch("");
                                setCategory("All");
                                setStatusFilter("All");
                                setPriorityFilter("All");
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
                    <div 
                        className="modal" 
                        onClick={(e) => e.stopPropagation()}
                    >
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

            {/* Rejection Info Modal - Shows when barangay official views a rejected report */}
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
            
            {/* Assign Responder Modal */}
            {isAssignResponderModalOpen && selectedReportForResponder && (
                <ModalPortal>
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
                </ModalPortal>
            )}

            {/* Export Modal with Time Range Options */}
            {showExportModal && (
                <ModalPortal>
                    <div 
                        className="modal-overlay"
                        onClick={() => setShowExportModal(false)}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="export-modal-title"
                    >
                        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                            <h3 id="export-modal-title">📊 Export Reports</h3>
                            <p style={{ marginBottom: '20px', color: '#666' }}>
                                Select a time range for your {exportType === 'csv' ? 'CSV' : 'PDF'} export:
                            </p>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                                <button 
                                    onClick={() => exportType === 'csv' ? exportToCSV('today') : exportToPDF('today')}
                                    style={{ 
                                        padding: '12px 20px', 
                                        borderRadius: '8px', 
                                        border: '1px solid #e5e7eb',
                                        background: '#f8fafc',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px'
                                    }}
                                >
                                    <span style={{ fontSize: '18px' }}>📅</span>
                                    <span><strong>Today</strong> - Reports from today only</span>
                                </button>
                                
                                <button 
                                    onClick={() => exportType === 'csv' ? exportToCSV('this-week') : exportToPDF('this-week')}
                                    style={{ 
                                        padding: '12px 20px', 
                                        borderRadius: '8px', 
                                        border: '1px solid #e5e7eb',
                                        background: '#f8fafc',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px'
                                    }}
                                >
                                    <span style={{ fontSize: '18px' }}>📆</span>
                                    <span><strong>This Week</strong> - Reports from this week</span>
                                </button>
                                
                                <button 
                                    onClick={() => exportType === 'csv' ? exportToCSV('this-month') : exportToPDF('this-month')}
                                    style={{ 
                                        padding: '12px 20px', 
                                        borderRadius: '8px', 
                                        border: '1px solid #e5e7eb',
                                        background: '#f8fafc',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px'
                                    }}
                                >
                                    <span style={{ fontSize: '18px' }}>🗓️</span>
                                    <span><strong>This Month</strong> - Reports from this month</span>
                                </button>
                                
                                <button 
                                    onClick={() => exportType === 'csv' ? exportToCSV('all') : exportToPDF('all')}
                                    style={{ 
                                        padding: '12px 20px', 
                                        borderRadius: '8px', 
                                        border: '1px solid #2d3b8f',
                                        background: '#2d3b8f',
                                        color: 'white',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px'
                                    }}
                                >
                                    <span style={{ fontSize: '18px' }}>📋</span>
                                    <span><strong>All Time</strong> - Export all reports</span>
                                </button>
                            </div>
                            
                            <button 
                                onClick={() => setShowExportModal(false)}
                                style={{ 
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '8px',
                                    border: '1px solid #e5e7eb',
                                    background: 'white',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* Notification - wrapped in ModalPortal for proper z-index display */}
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
        </LoadingScreen>
    );
}

export default BarangayReports;