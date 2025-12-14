import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    FaEdit,
    FaTrashAlt,
    FaSearch,
    FaRedo, FaCheckCircle, FaTimesCircle, FaCheck, FaTimes,
    FaSyncAlt, FaClock, FaFileCsv, FaFilePdf, FaThLarge, FaList, FaArchive, FaFileAlt, FaHeart, FaRegHeart, FaFire, FaPlus, FaMinus, FaMapPin, FaChartLine, FaStar } from "react-icons/fa";
import { API_CONFIG, getApiUrl } from "../../utils/apiConfig";
import "./Admin-Reports.css";
import "../shared/Notification.css";
import ModalPortal from "../shared/ModalPortal";
import LoadingScreen from "../shared/LoadingScreen";
const logoImg = /* @vite-ignore */ new URL('../../assets/logo.png', import.meta.url).href;
const REPORT_STATUSES = ["Pending", "Ongoing", "Resolved"];

// Priority level colors
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

const CATEGORY_KEYWORDS = {
    Crime: ['theft', 'robbery', 'assault', 'violence', 'vandalism'],
    Hazard: ['fire', 'flood', 'explosion', 'gas leak', 'collapse'],
    Concern: ['emergency', 'accident', 'suspicious', 'disturbance'],
    'Lost&Found': ['lost', 'found', 'missing', 'wallet', 'phone'],
    Others: ['other', 'misc', 'general']
};

const computeConfidence = (description = '', numImages = 0) => {
    const text = (description || '').toLowerCase().trim();
    if (!text) return 55;

    const wordCount = text.split(/\s+/).length;
    const lengthBonus = Math.min(10, Math.floor(wordCount / 5));
    const imageBonus = Math.min(7, numImages * 2.5);

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

// Utility Hook for Modal Accessibility
const useAriaModal = (isOpen, onClose) => {
    const modalRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;

        const modalElement = modalRef.current;
        if (!modalElement) return;

        const focusTimeout = setTimeout(() => {
            modalElement.focus();
        }, 0);

        const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        
        const handleTabKeyPress = (e) => {
            if (e.key === 'Tab') {
                const focusableModalElements = [...modalElement.querySelectorAll(focusableElements)]
                    .filter(el => !el.disabled && el.offsetParent !== null);

                if (focusableModalElements.length === 0) return;

                const firstElement = focusableModalElements[0];
                const lastElement = focusableModalElements[focusableModalElements.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        lastElement.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        firstElement.focus();
                        e.preventDefault();
                    }
                }
            }
        };

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

const useKeyboardNavigation = (containerRef, selector) => {
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleArrowNavigation = (event) => {
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

function AdminReports({ token, reportTitle = 'All Community Reports', showTitle = true }) {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("All");
    const [priorityFilter, setPriorityFilter] = useState("All");
    const [barangay, setBarangay] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All"); 
    const [sort, setSort] = useState("latest");
    const [smartSort, setSmartSort] = useState("latest");
    const [previewImage, setPreviewImage] = useState(null);
    const [notification, setNotification] = useState(null);
    const [highlightedReportId, setHighlightedReportId] = useState(null);
    const [viewMode, setViewMode] = useState("card");
    const [showSmartFilter, setShowSmartFilter] = useState(false);
    const [aiUsagePercent, setAiUsagePercent] = useState(0);
    const [timeRemainingHMS, setTimeRemainingHMS] = useState('48:00:00');
    const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(172800);
    const [showUsageModal, setShowUsageModal] = useState(false);
    const [smartFilterStartTime, setSmartFilterStartTime] = useState(null);
    const [hasAcceptedAiWarning, setHasAcceptedAiWarning] = useState(false);
    const [showSmartFilterWarning, setShowSmartFilterWarning] = useState(false);
    const [liveSessionSeconds, setLiveSessionSeconds] = useState(0);
    const [showCommunityHelper] = useState(true);
    const [isPremium, setIsPremium] = useState(false);

    const [trendingReports, setTrendingReports] = useState([]);
    const [trendingExpanded, setTrendingExpanded] = useState(false);
    const [trendingTimeFilter, setTrendingTimeFilter] = useState("all");
    const [pendingReports, setPendingReports] = useState([]);
    const [pendingExpanded, setPendingExpanded] = useState(false); 

    // Export modal states
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportType, setExportType] = useState(null);
    const [exportColorMode, setExportColorMode] = useState('color');
    const [exportPageSize, setExportPageSize] = useState('A4');

    // Loading animation states
    const [showMountAnimation, setShowMountAnimation] = useState(false);
    const [mountStage, setMountStage] = useState("exit");
    const loadingRef = useRef(loading);

    useEffect(() => {
        loadingRef.current = loading;
    }, [loading]);

    useEffect(() => {
        let startTimer = null;
        let exitTimer = null;

        if (!loadingRef.current) {
            startTimer = setTimeout(() => {
                if (loadingRef.current) return;
                setShowMountAnimation(true);
                setMountStage("loading");

                exitTimer = setTimeout(() => {
                    setMountStage("exit");
                }, 700);
            }, 180);
        }

        return () => {
            if (startTimer) clearTimeout(startTimer);
            if (exitTimer) clearTimeout(exitTimer);
        };
    }, []);

    useEffect(() => {
        if (loading) {
            setShowMountAnimation(false);
        }
    }, [loading]);

    // Smart Filter helpers
    const trackAiUsage = useCallback(async (durationSeconds = 0) => {
        if (isPremium) {
            console.log('[Smart Filter] ✨ Premium user - skipping usage tracking');
            return;
        }
        
        if (!token || token.length < 10) {
            console.warn('[Smart Filter] No valid token - skipping usage tracking');
            return;
        }

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
                setHasAcceptedAiWarning(true);
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

    const WEEK_LIMIT_SECONDS = 172800;
    
    useEffect(() => {
        if (!showSmartFilter || !smartFilterStartTime) {
            setLiveSessionSeconds(0);
            return;
        }

        console.log('[Smart Filter] ⏱️ Session timer started - tracking real-time usage');

        const timer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - smartFilterStartTime) / 1000);
            setLiveSessionSeconds(elapsed);
            
            if (isPremium) {
                if (elapsed > 0 && elapsed % 30 === 0) {
                    const minutes = Math.floor(elapsed / 60);
                    const seconds = elapsed % 60;
                    console.log(`[Smart Filter] ✨ Premium session: ${minutes}m ${seconds}s (Unlimited)`);
                }
                return;
            }
            
            const baseUsedSeconds = WEEK_LIMIT_SECONDS - timeRemainingSeconds;
            const totalUsedNow = baseUsedSeconds + elapsed;
            const livePercent = Math.min(100, Math.round((totalUsedNow / WEEK_LIMIT_SECONDS) * 100));
            const liveRemaining = Math.max(0, WEEK_LIMIT_SECONDS - totalUsedNow);
            
            setAiUsagePercent(livePercent);
            
            const hrs = Math.floor(liveRemaining / 3600);
            const mins = Math.floor((liveRemaining % 3600) / 60);
            const secs = liveRemaining % 60;
            setTimeRemainingHMS(`${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
            
            if (elapsed > 0 && elapsed % 30 === 0) {
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                console.log(`[Smart Filter] ⏳ Session: ${minutes}m ${seconds}s | Usage: ${livePercent}% | Remaining: ${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [showSmartFilter, smartFilterStartTime, timeRemainingSeconds, isPremium]);
    // ---------------------------------------------------------------------

    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);
    const [newStatus, setNewStatus] = useState("");
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false); // Prevent double submissions

    const [expandedPosts, setExpandedPosts] = useState([]);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [isDeleteReasonOpen, setIsDeleteReasonOpen] = useState(false);
    const [deleteReason, setDeleteReason] = useState('');
    const [deleteReasonOther, setDeleteReasonOther] = useState('');

    const [isApprovingReport, setIsApprovingReport] = useState(false);
    const [isRejectingReport, setIsRejectingReport] = useState(false);
    
    const [rejectionInfoModalOpen, setRejectionInfoModalOpen] = useState(false);
    const [rejectionInfoReport, setRejectionInfoReport] = useState(null);
    
    const barangays = [
        "All Barangay", "Barretto", "East Bajac-Bajac", "East Tapinac", "Gordon Heights",
        "Kalaklan", "Mabayuan", "New Asinan", "New Banicain", "New Cabalan",
        "New Ilalim", "New Kababae", "New Kalalake", "Old Cabalan", "Pag-Asa",
        "Santa Rita", "West Bajac-Bajac", "West Tapinac",
    ];

    const filterContainerRef = useRef(null);
    const filterSelector = 'input.admin-search-input, .admin-top-controls .admin-filter-select, .reports-list button:first-child'; 
    useKeyboardNavigation(filterContainerRef, filterSelector);

    // Notification handler
    const showNotification = useCallback((message, type = "success") => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    }, []);

    // Modal Control Functions
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

    const statusRef = useAriaModal(isStatusModalOpen, closeStatusModal);
    const deleteRef = useAriaModal(isDeleteConfirmOpen, closeDeleteConfirm);
    const reasonRef = useAriaModal(isDeleteReasonOpen, closeDeleteReason);

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
                        images: report.images?.map(img => img.url) || [],
                        reaction_count: report.reaction_count || 0,
                        user_liked: report.user_liked ?? false,
                        deleted_at: report.deleted_at || null
                    };
                });
                
                console.log("📥 Admin fetched reports:", reports.length, "reports");
                console.log("📊 Admin report reaction stats:", reports.slice(0, 5).map(r => ({
                    id: r.id,
                    title: r.title?.substring(0, 30),
                    reaction_count: r.reaction_count,
                    user_liked: r.user_liked,
                    is_approved: r.is_approved
                })));
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
                            const aiConfidence = res.confidence_percent 
                                ?? (typeof res.confidence === 'number' ? Math.round(res.confidence * 100) : null)
                                ?? computeConfidence(r.description, r.category, r.images?.length || 0);
                            return {
                                ...r,
                                ai_confidence: aiConfidence,
                                ai_category: res.category || r.category,
                                ai_method: res.method || 'batch',
                                ai_reason: res.reason || '',
                                ai_priority: res.priority || 'Low',
                                ai_priority_score: res.priority_score || 1,
                                ai_priority_label: res.priority_label || '⚪ Low'
                            };
                        });
                        setReports(annotated);
                    } else {
                        const fallback = transformedReports.map(r => {
                            const catPriority = getPriorityStyle(r.category);
                            return {
                                ...r,
                                ai_confidence: computeConfidence(r.description, r.category, r.images?.length || 0),
                                ai_category: r.category,
                                ai_method: 'heuristic',
                                ai_priority: catPriority.priority,
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
                            ai_priority: catPriority.priority,
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
    }, [token, sort]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

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

    useEffect(() => {
        if (!reports.length) {
            setTrendingReports([]);
            return;
        }

        const now = new Date();
        const filterByTime = (createdAt) => {
            if (trendingTimeFilter === "all") return true; // Show all reports
            
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

        const eligibleReports = reports.filter((r) => 
            r.is_approved === true &&
            r.status !== "Resolved" &&
            r.deleted_at === null &&
            r.is_rejected !== true &&
            (r.reaction_count || 0) > 0 &&
            filterByTime(r.created_at)
        );

        const scored = eligibleReports.map((r) => {
            const createdAt = new Date(r.created_at || 0);
            const daysOld = Math.max(0, (now - createdAt) / (1000 * 60 * 60 * 24));
    
            const severityWeight = { Crime: 4, Hazard: 3.5, Concern: 3, 'Lost&Found': 2, Others: 2 };
            const reactionBoost = (r.reaction_count || 0) * 15;
            const baseScore = 5;
            const engagement = reactionBoost + (severityWeight[r.category] || 2) + baseScore;
            
            const timeFactor = Math.pow(daysOld + 1, 0.8);
            const trendingScore = engagement / timeFactor;
            
            return { ...r, trendingScore };
        });

        const trending = scored
            .sort((a, b) => b.trendingScore - a.trendingScore)
            .slice(0, 5);

        setTrendingReports(trending);
        console.log(`🔥 ${trending.length} trending reports (admin view - all barangays)`);
    }, [reports, trendingTimeFilter]);

    useEffect(() => {
        if (!reports.length) {
            setPendingReports([]);
            return;
        }

        const pending = reports.filter((r) => 
            r.is_approved === false &&
            r.is_rejected !== true &&
            r.deleted_at === null &&
            r.status !== "Resolved"
        ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        setPendingReports(pending);
        console.log(`⏳ ${pending.length} pending reports awaiting approval`);
    }, [reports]);

    const toggleExpand = (id) => {
        setExpandedPosts((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
    };

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
        const aApproved = !!a.is_approved;
        const bApproved = !!b.is_approved;
        if (aApproved !== bApproved) return aApproved ? 1 : -1;

        const aPri = priorityRank(getPriorityStyle(a.category).priority);
        const bPri = priorityRank(getPriorityStyle(b.category).priority);
        if (aPri !== bPri) return bPri - aPri;

        const aConf = (typeof a.ai_confidence === 'number') ? a.ai_confidence : computeConfidence(a.description || '', a.category, (a.images || []).length);
        const bConf = (typeof b.ai_confidence === 'number') ? b.ai_confidence : computeConfidence(b.description || '', b.category, (b.images || []).length);
        if (aConf !== bConf) return bConf - aConf;

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

    const getReportPriority = (report) => {
        if (report.ai_priority) {
            const pri = String(report.ai_priority).toLowerCase().trim();
            console.log(`[Admin Priority Debug] Report ${report.id}: ai_priority="${report.ai_priority}" normalized="${pri}"`);
            if (pri === 'critical') return 'Critical';
            if (pri === 'high') return 'High';
            if (pri === 'medium') return 'Medium';
            if (pri === 'low') return 'Low';
            return 'Low';
        }
        const catPriority = getPriorityStyle(report.category);
        console.log(`[Admin Priority Debug] Report ${report.id}: Using fallback category="${report.category}" priority="${catPriority.priority}"`);
        return catPriority.priority || 'Low';
    };

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

    // Export to CSV
    const exportToCSV = (timeFilter = 'all') => {
        const reportsToExport = filterReportsByTime(filteredReports, timeFilter);
        
        const headers = ["ID", "Title", "Category", "Status", "Barangay", "Address", "Reporter", "Priority", "Likes", "Trending Score", "Created At", "Description"];
        const rows = reportsToExport.map((r) => {
            const now = new Date();
            const createdAt = new Date(r.created_at || 0);
            const daysOld = Math.max(0, (now - createdAt) / (1000 * 60 * 60 * 24));
            const severityWeight = { Crime: 4, Hazard: 3.5, Concern: 3, 'Lost&Found': 2, Others: 2 };
            const reactionBoost = (r.reaction_count || 0) * 15;
            const baseScore = 5;
            const engagement = reactionBoost + (severityWeight[r.category] || 2) + baseScore;
            const timeFactor = Math.pow(daysOld + 1, 0.8);
            const trendingScore = (engagement / timeFactor).toFixed(2);
            
            return [
                r.id,
                `"${(r.title || "").replace(/"/g, '""')}"`,
                r.category || "N/A",
                r.status || "N/A",
                r.barangay || r.address_barangay || "N/A",
                `"${(r.addressStreet || r.address_street || "").replace(/"/g, '""')}"`,
                r.reporter ? `${r.reporter.firstname || ""} ${r.reporter.lastname || ""}`.trim() : "Unknown",
                getReportPriority(r),
                r.reaction_count || 0,
                trendingScore,
                r.created_at ? new Date(r.created_at).toLocaleString() : "N/A",
                `"${(r.description || "").replace(/"/g, '""').substring(0, 200)}..."`
            ];
        });
        
        const timeLabel = timeFilter === 'all' ? 'all' : timeFilter.replace('-', '_');
        const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `admin_reports_${timeLabel}_${new Date().toISOString().split("T")[0]}.csv`;
        link.click();
        
        setShowExportModal(false);
        showNotification(`Exported ${reportsToExport.length} reports to CSV`, 'success');
    };

    // Export to PDF
    const exportToPDF = async (timeFilter = 'all', colorMode = 'color', pageSize = 'A4') => {
        const reportsToExport = filterReportsByTime(filteredReports, timeFilter);
        const timeLabel = timeFilter === 'all' ? 'All Time' : timeFilter === 'today' ? 'Today' : timeFilter === 'this-week' ? 'This Week' : 'This Month';
        
        const reportDate = new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });
        
        // Calculate analytics
        const totalReports = reportsToExport.length;
        const categoryStats = {};
        const barangayStats = {};
        const statusStats = { Pending: 0, Ongoing: 0, Resolved: 0 };
        const priorityStats = { Critical: 0, High: 0, Medium: 0, Low: 0 };
        
        // Engagement analytics
        let totalLikes = 0;
        let topLikedReports = [];
        
        reportsToExport.forEach((report) => {
            const cat = report.category || "Unknown";
            categoryStats[cat] = (categoryStats[cat] || 0) + 1;
            
            const brgy = report.barangay || report.address_barangay || "Unknown";
            barangayStats[brgy] = (barangayStats[brgy] || 0) + 1;
            
            const status = report.status || "Pending";
            statusStats[status] = (statusStats[status] || 0) + 1;
            
            const priority = getReportPriority(report);
            priorityStats[priority] = (priorityStats[priority] || 0) + 1;
            
            totalLikes += (report.reaction_count || 0);
        });
        
        // Get top 5 most liked reports
        topLikedReports = [...reportsToExport]
            .sort((a, b) => (b.reaction_count || 0) - (a.reaction_count || 0))
            .slice(0, 5)
            .filter(r => (r.reaction_count || 0) > 0);
        
        const sortedCategories = Object.entries(categoryStats).sort((a, b) => b[1] - a[1]);
        const sortedBarangays = Object.entries(barangayStats).sort((a, b) => b[1] - a[1]);

        const logoPath = logoImg;
        
        const colorCss = colorMode === 'bw' ? 'html { filter: grayscale(100%); }' : '';
        let pageCss = '';
        switch ((pageSize || 'A4').toLowerCase()) {
            case 'letter':
                pageCss = '@page { size: 8.5in 11in; margin: 20mm; }';
                break;
            case 'legal':
                pageCss = '@page { size: 8.5in 14in; margin: 20mm; }';
                break;
            case 'long':
                pageCss = '@page { size: 8.5in 22in; margin: 20mm; }';
                break;
            default:
                pageCss = '@page { size: A4; margin: 20mm; }';
        }

        // Safezones & Hotspots
        let safezoneCount = 0;
        let hotspotCount = 0;
        const monthsArr = (() => {
            const now = new Date();
            const months = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });
                months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label, count: 0 });
            }
            reportsToExport.forEach(r => {
                try {
                    const d = new Date(r.created_at || r.date || 0);
                    const key = `${d.getFullYear()}-${d.getMonth()}`;
                    const m = months.find(x => x.key === key);
                    if (m) m.count++;
                } catch (e) { /* ignore parse errors */ }
            });
            return months;
        })();

        const pieData = sortedBarangays.map(([name, count]) => ({ name, value: count }));

        const userBarangayLabel = (barangay && barangay !== 'All') ? barangay : 'All Barangays';

        const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Community Guard - ${userBarangayLabel || 'Barangay'} Reports Summary</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; }

                /* HEADER */
                .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2d3b8f; padding-bottom: 20px; }
                .header-logo { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 10px; }
                .header-logo img { width: 48px; height: 48px; object-fit: contain; }
                .header h1 { color: #2d3b8f; font-size: 30px; font-weight: 700; }
                .header .subtitle { color: #666; font-size: 14px; margin-top: 5px; }

                /* SECTION TITLE */
                .section-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #2d3b8f;
                    margin: 25px 0 10px 0;
                    border-bottom: 2px solid #e2e8f0;
                    padding-bottom: 6px;
                }

                /* TABLES */
                table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
                th { background: #2d3b8f; color: white; padding: 8px; font-size: 12px; text-align: left; }
                td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
                tr:nth-child(even) { background: #f8fafc; }
                .totals-row { background: #e7f0ff; font-weight: bold; color: #1e293b; }

                /* PRIORITY COLORS */
                .priority-critical, .priority-high { color: #dc2626; font-weight: bold; }
                .priority-medium { color: #f59e0b; font-weight: bold; }
                .priority-low { color: #22c55e; font-weight: bold; }

                /* FOOTER */
                .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; padding-top: 20px; border-top: 2px solid #2d3b8f; }
                .footer-brand img { width: 26px; margin-bottom: 5px; }
                @media print { body { padding: 20px; } }
                ${colorCss}
            </style>
        </head>
        <body>

            <!-- HEADER -->
            <div class="header">
                <div class="header-logo">
                    <img src="${logoPath}" onerror="this.style.display='none'"/>
                    <h1>Community Guard</h1>
                </div>
                <p class="subtitle">${userBarangayLabel} • Consolidated Report Summary</p>
                <p class="subtitle">Generated: ${reportDate}</p>
            </div>


            <!-- REPORT SUMMARY TABLE -->
            <h2 class="section-title">Summary Overview</h2>
            <table>
                <thead>
                    <tr>
                        <th>Total Reports</th>
                        <th>Pending</th>
                        <th>Ongoing</th>
                        <th>Total Likes</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="totals-row">
                        <td>${totalReports}</td>
                        <td>${statusStats.Pending}</td>
                        <td>${statusStats.Ongoing}</td>
                        <td>${totalLikes}</td>
                    </tr>
                </tbody>
            </table>


            <!-- TRENDING -->
            ${trendingReports.length > 0 ? `
            <h2 class="section-title">Trending Report</h2>
            <table>
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Title</th>
                        <th>Likes</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>1</td>
                        <td>${trendingReports[0].title || 'Untitled'}</td>
                        <td>❤️ ${trendingReports[0].reaction_count || 0}</td>
                    </tr>
                </tbody>
            </table>
            ` : ''}


            <!-- CATEGORY BREAKDOWN -->
            <h2 class="section-title">Reports by Category</h2>
            <table>
                <thead>
                    <tr>
                        <th>Category</th>
                        <th>Total Reports</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedCategories.map(([name, count]) => `
                        <tr>
                            <td>${name}</td>
                            <td>${count}</td>
                        </tr>
                    `).join("")}
                    <tr class="totals-row">
                        <td>Total</td>
                        <td>${totalReports}</td>
                    </tr>
                </tbody>
            </table>


            <!-- MONTHLY TREND -->
            <h2 class="section-title">Monthly Report Trend</h2>
            <table>
                <thead>
                    <tr>
                        <th>Month</th>
                        <th>Report Count</th>
                    </tr>
                </thead>
                <tbody>
                    ${monthsArr.map(m => `
                        <tr>
                            <td>${m.label}</td>
                            <td>${m.count}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>


            <!-- TOP BARANGAYS -->
            <h2 class="section-title">Top Barangays (Report Volume)</h2>
            <table>
                <thead>
                    <tr>
                        <th>Barangay</th>
                        <th>Total Reports</th>
                    </tr>
                </thead>
                <tbody>
                    ${pieData.map(p => `
                        <tr>
                            <td>${p.name}</td>
                            <td>${p.value}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>


            <!-- DETAILED LIST -->
            <h2 class="section-title">Detailed Report List</h2>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Title</th>
                        <th>Category</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Likes</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody>
                    ${reportsToExport.slice(0, 50).map(r => `
                        <tr>
                            <td>${r.id}</td>
                            <td>${r.title || 'Untitled'}</td>
                            <td>${r.category || 'N/A'}</td>
                            <td>${r.status || 'N/A'}</td>
                            <td class="priority-${getReportPriority(r).toLowerCase()}">${getReportPriority(r)}</td>
                            <td>❤️ ${r.reaction_count || 0}</td>
                            <td>${new Date(r.created_at).toLocaleDateString()}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
            ${reportsToExport.length > 50 ? `<p style="font-size:11px;text-align:center;margin-top:10px;color:#666;">Showing first 50 of ${reportsToExport.length} records</p>` : ""}


            <!-- ANALYSIS & RECOMMENDATIONS -->
            <h2 class="section-title">Analysis & Recommendations</h2>
            <table>
                <thead>
                    <tr>
                        <th>Assessment</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>

                    <tr>
                        <td><strong>Risk Assessment</strong></td>
                        <td>
                            ${priorityStats.Critical > 0 ? `${priorityStats.Critical} critical-priority reports identified requiring immediate attention. ` : ''}
                            ${priorityStats.High > 0 ? `${priorityStats.High} high-priority reports noted and should be acted on promptly. ` : ''}
                            ${(priorityStats.Critical === 0 && priorityStats.High === 0)
                                ? `No critical or high-risk reports detected at this time.`
                                : ''}
                        </td>
                    </tr>

                    <tr>
                        <td><strong>Trend Observations</strong></td>
                        <td>
                            ${sortedCategories.length > 0 ? `Most reported category: <strong>${sortedCategories[0][0]}</strong> (${sortedCategories[0][1]} reports). ` : ''}
                            ${trendingReports.length > 0 ? `Total community reactions: ${totalLikes}. Highest engagement report has ${trendingReports[0].reaction_count} likes.` : ''}
                        </td>
                    </tr>

                    <tr>
                        <td><strong>Recommendations</strong></td>
                        <td>
                            <ul style="margin-left:18px;line-height:1.6;">
                                ${statusStats.Pending > totalReports * 0.3 ? `<li>High pending workload (${statusStats.Pending}). Consider increasing review frequency.</li>` : ''}
                                ${categoryStats['Crime'] > totalReports * 0.2 ? `<li>Crime-related reports are elevated. Strengthen barangay patrol visibility.</li>` : ''}
                                ${categoryStats['Hazard'] > totalReports * 0.2 ? `<li>Infrastructure and hazard concerns require coordination with city maintenance teams.</li>` : ''}
                                <li>Maintain regular follow-ups on ongoing reports to uphold public trust.</li>
                            </ul>
                        </td>
                    </tr>

                </tbody>
            </table>


            <!-- FOOTER -->
            <div class="footer">
                <img src="${logoPath}" height="26" onerror="this.style.display='none'">
                <p><strong>Generated by Community Guard</strong> • ${reportDate}</p>
                <p>Time Range: ${timeLabel}</p>
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

    const filteredReports = reports
        .filter((r) => !r.is_rejected)
        .filter((r) => r.status !== "Resolved")
        .filter((r) => (category === "All" ? true : r.category === category))
        .filter((r) => (barangay === "All" ? true : r.barangay === barangay))
        .filter((r) => (statusFilter === "All" ? true : r.status === statusFilter))
        .filter((r) => {
            // Priority filter
            if (!showSmartFilter) return true;
            if (priorityFilter === "All") return true;
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
        .filter((r) => {
            if (sort === 'top') return r.is_approved === true;
            return true;
        })
        .sort((a, b) => {
            if (sort === 'top') {
                const aLikes = a.reaction_count || 0;
                const bLikes = b.reaction_count || 0;
                if (aLikes !== bLikes) return bLikes - aLikes;
                const aT = new Date(a.created_at).getTime() || 0;
                const bT = new Date(b.created_at).getTime() || 0;
                return bT - aT;
            }

            const aApproved = !!a.is_approved;
            const bApproved = !!b.is_approved;
            if (aApproved !== bApproved) return aApproved ? 1 : -1;
            if (showSmartFilter) return smartComparator(a, b);
            return dateComparator(a, b);
        });

    // Loading features
    const loadingFeatures = [
        { title: "Report Management", description: "View, approve, reject, and manage all community reports." },
        { title: "Smart Filter", description: "Smart-assisted categorization and priority-based sorting." },
        { title: "Export Tools", description: "Export reports to CSV or PDF with analytics." },
    ];

    const effectiveStage = showMountAnimation ? mountStage : (loading ? "loading" : "exit");

    const handleLoadingExited = () => {
        setShowMountAnimation(false);
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
                
                {/* Priority Filter */}
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
                {/* Smart Filter Toggle */}
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

                        {/* Session timer*/}
                        {!isPremium && showSmartFilter && hasAcceptedAiWarning && (
                            <div className="admin-session-timer">
                                <span>🕐 Session: {Math.floor(liveSessionSeconds / 60)}m {liveSessionSeconds % 60}s</span>
                                <span>{aiUsagePercent}% used | {timeRemainingHMS}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Smart Filter Modal */}
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

            {/* AI Usage Modal */}
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

                            {/* Live Session Timer */}
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

                            {/* Usage Bar */}
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

                            {/* Time Remaining */}
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

            {/* ⭐ Pill Button Row */}
            <div className="trending-pill-row">
                {/* Trending Pill - Toggle sort */}
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

                {/* Pending Pill */}
                <button
                    className={`pending-pill-btn ${pendingExpanded ? 'active' : ''} ${pendingReports.length === 0 ? 'empty' : ''}`}
                    data-count={pendingReports.length}
                    onClick={() => setPendingExpanded(!pendingExpanded)}
                    title={pendingExpanded ? 'Hide pending reports' : 'Show reports awaiting approval'}
                >
                    <FaClock className="pending-pill-icon" />
                    <span className="pill-text">Pending ({pendingReports.length})</span>
                    {pendingExpanded ? <FaMinus className="pending-pill-toggle" /> : <FaPlus className="pending-pill-toggle" />}
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

            {/* Trending Reports Section */}
            {trendingExpanded && (
                <div className={`feed-trending-container expanded ${trendingReports.length === 0 ? 'empty' : ''}`}>
                    <div className="feed-trending-header">
                        <h3><FaMapPin className="feed-trending-pin" /> Trending Reports</h3>
                        <select
                            className="trending-time-filter"
                            value={trendingTimeFilter}
                            onChange={(e) => setTrendingTimeFilter(e.target.value)}
                        >
                            <option value="all">All Time</option>
                            <option value="today">Today</option>
                            <option value="yesterday">Yesterday</option>
                            <option value="this-month">This Month</option>
                        </select>
                    </div>
                    
                    {trendingReports.length > 0 ? (
                        <div className="feed-trending-list">
                            {trendingReports.map((report) => (
                                <div 
                                    key={`trending-${report.id}`} 
                                    className="feed-trending-card"
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
                                    <div className="feed-trending-type" data-type={report.category}>
                                        {report.category}
                                    </div>
                                    <div className="feed-trending-title">{report.title}</div>
                                    <div className="feed-trending-location">
                                        📍 {report.address_barangay}
                                    </div>
                                    <div className="feed-trending-meta">
                                        <span className="feed-trending-status" data-status={report.status?.toLowerCase()}>
                                            {report.status}
                                        </span>
                                        <span className="feed-trending-time">
                                            {new Date(report.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="feed-trending-engagement">
                                        <span className="feed-trending-likes">
                                            <FaHeart className="heart-icon-small" aria-hidden="true" />
                                            <span>{report.reaction_count || 0}</span>
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="feed-trending-empty">
                            <FaFire className="empty-icon" />
                            <p>No trending reports for this period</p>
                            <span>Reports with likes will appear here</span>
                        </div>
                    )}
                </div>
            )}

            {/* Pending Reports Section */}
            {pendingExpanded && pendingReports.length > 0 && (
                <div className="feed-pending-container expanded">
                    <div className="feed-pending-header">
                        <h3><FaClock className="feed-pending-icon" /> Reports Awaiting Approval</h3>
                    </div>
                    <div className="feed-pending-list">
                        {pendingReports.map((report) => (
                            <div 
                                key={`pending-${report.id}`} 
                                className="feed-pending-card"
                                onClick={() => {
                                    const element = document.getElementById(`report-${report.id}`);
                                    if (element) {
                                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        setHighlightedReportId(report.id);
                                        setTimeout(() => setHighlightedReportId(null), 3000);
                                    }
                                }}
                            >
                                <div className="feed-pending-type" data-type={report.category}>
                                    {report.category}
                                </div>
                                <div className="feed-pending-title">{report.title}</div>
                                <div className="feed-pending-location">
                                    📍 {report.address_barangay}
                                </div>
                                <div className="feed-pending-meta">
                                    <span className="feed-pending-status">⏳ Awaiting Approval</span>
                                    <span className="feed-pending-time">
                                        {new Date(report.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Pending Empty State */}
            {pendingExpanded && pendingReports.length === 0 && (
                <div className="feed-pending-container expanded empty">
                    <div className="feed-pending-empty">
                        <FaClock className="empty-icon" />
                        <p>No pending reports</p>
                        <span>All reports have been reviewed</span>
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
                        <p className="muted">Active incidents will appear here.</p>
                    </div>
                ) : filteredReports.length > 0 ? (
                    viewMode === "card" ? (
                    filteredReports.map((report, index) => {
                        const isExpanded = expandedPosts.includes(report.id);
                        const isPending = !report.is_approved;
                        
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

                                {/* Heart/Like Button */}
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
                    <div className="admin-list-table">
                        <div className="list-header">
                            <div className="list-col col-image">Image</div>
                            <div className="list-col col-title">Title</div>
                            <div className="list-col col-category">Category</div>
                            <div className="list-col col-barangay">Barangay</div>
                            <div className="list-col col-priority">Priority</div>
                            <div className="list-col col-likes">Likes</div>
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
                                    <div className="list-col col-likes">
                                        <button
                                            className={`list-like-btn ${report.user_liked ? 'liked' : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!isPending) handleToggleLike(report.id);
                                            }}
                                            disabled={isPending}
                                            title={isPending ? "Approve report first" : (report.user_liked ? "Unlike" : "Like")}
                                        >
                                            {report.user_liked ? <FaHeart className="heart-icon filled" /> : <FaRegHeart className="heart-icon" />}
                                            <span>{report.reaction_count || 0}</span>
                                        </button>
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
                                            <span className={`admin-status-badge admin-status-${report.status.toLowerCase()}`}>
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
                                setBarangay("All");
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

            {/* Delete Reason Modal */}
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

            {/* Rejection Info Modal */}
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

            {/* Export Modal */}
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
                            <p style={{ marginBottom: '12px', color: '#666' }}>
                                Select a time range for your {exportType === 'csv' ? 'CSV' : 'PDF'} export:
                            </p>

                            {exportType === 'pdf' && (
                                <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <label htmlFor="export-color-mode" style={{ fontSize: '13px', color: '#444' }}>PDF Color Mode:</label>
                                    <select id="export-color-mode" value={exportColorMode} onChange={(e) => setExportColorMode(e.target.value)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                                        <option value="color">Colored</option>
                                        <option value="bw">Black &amp; White</option>
                                    </select>
                                    <label htmlFor="export-page-size" style={{ fontSize: '13px', color: '#444', marginLeft: 8 }}>Page Size:</label>
                                    <select id="export-page-size" value={exportPageSize} onChange={(e) => setExportPageSize(e.target.value)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                                        <option value="A4">A4</option>
                                        <option value="Letter">Letter</option>
                                        <option value="Legal">Legal</option>
                                        <option value="Long">Long</option>
                                    </select>
                                </div>
                            )}
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                                <button 
                                    onClick={() => exportType === 'csv' ? exportToCSV('today') : exportToPDF('today', exportColorMode, exportPageSize)}
                                    style={{ 
                                        padding: '12px 20px', 
                                        borderRadius: '8px', 
                                        border: '1px solid #e5e7eb',
                                        background: '#f8fafc',
                                        color: '#333',
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
                                    onClick={() => exportType === 'csv' ? exportToCSV('this-week') : exportToPDF('this-week', exportColorMode, exportPageSize)}
                                    style={{ 
                                        padding: '12px 20px', 
                                        borderRadius: '8px', 
                                        border: '1px solid #e5e7eb',
                                        background: '#f8fafc',
                                        color: '#333',
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
                                    onClick={() => exportType === 'csv' ? exportToCSV('this-month') : exportToPDF('this-month', exportColorMode, exportPageSize)}
                                    style={{ 
                                        padding: '12px 20px', 
                                        borderRadius: '8px', 
                                        border: '1px solid #e5e7eb',
                                        background: '#f8fafc',
                                        color: '#333',
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
                                    onClick={() => exportType === 'csv' ? exportToCSV('all') : exportToPDF('all', exportColorMode, exportPageSize)}
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

            {/* Notification */}
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

export default AdminReports;