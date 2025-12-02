import React, { useState, useEffect, useCallback, useRef } from "react";
import { FaEdit, FaTrashAlt, FaSearch, FaRedo, FaCheckCircle, FaTimesCircle, FaCheck, FaTimes, FaSyncAlt, FaClock, FaFileCsv, FaFilePdf, FaThLarge, FaList, FaArchive, FaFileAlt } from "react-icons/fa";
import { API_CONFIG, getApiUrl } from "../utils/apiConfig";
import "./ResponderReports.css";

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
    const [barangay, setBarangay] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All"); 
    const [sort, setSort] = useState("latest");
    const [previewImage, setPreviewImage] = useState(null);
    const [notification, setNotification] = useState(null);
    const [highlightedReportId, setHighlightedReportId] = useState(null);
    const [responderBarangay, setResponderBarangay] = useState(null);
    const [viewMode, setViewMode] = useState("card"); // "card" or "list" view

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
    
    const barangays = [
        "All Barangay", "Barretto", "East Bajac-Bajac", "East Tapinac", "Gordon Heights",
        "Kalaklan", "Mabayuan", "New Asinan", "New Banicain", "New Cabalan",
        "New Ilalim", "New Kababae", "New Kalalake", "Old Cabalan", "Pag-Asa",
        "Santa Rita", "West Bajac-Bajac", "West Tapinac",
    ];

    // --- REFS for Keyboard Navigation ---
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
            let response = await fetch(getApiUrl(`/api/responder/reports?limit=50`), {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            // Fallback to regular reports endpoint if responder endpoint fails
            if (!response.ok) {
                console.warn("Responder reports endpoint failed, falling back to regular reports");
                response = await fetch(getApiUrl(`/api/reports?limit=50&sort=${sortParam}`), {
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
    }, [token, sort]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    // Fetch responder's barangay
    useEffect(() => {
        const fetchResponderBarangay = async () => {
            if (!token) return;
            try {
                const response = await fetch(`${getApiUrl('/api/profile')}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await response.json();
                if (data.status === 'success' && data.profile?.address_barangay) {
                    setResponderBarangay(data.profile.address_barangay);
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

    // Export to CSV
    const exportToCSV = () => {
        const headers = ["ID", "Title", "Category", "Status", "Barangay", "Address", "Reporter", "Created At", "Description"];
        const rows = filteredReports.map((r) => [
            r.id,
            `"${(r.title || "").replace(/"/g, '""')}"`,
            r.category || "N/A",
            r.status || "N/A",
            r.barangay || r.address_barangay || "N/A",
            `"${(r.addressStreet || r.address_street || "").replace(/"/g, '""')}"`,
            r.reporter ? `${r.reporter.firstname || ""} ${r.reporter.lastname || ""}`.trim() : "Unknown",
            r.created_at ? new Date(r.created_at).toLocaleString() : "N/A",
            `"${(r.description || "").replace(/"/g, '""').substring(0, 200)}..."`
        ]);
        
        const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${responderBarangay || 'responder'}_reports_${new Date().toISOString().split("T")[0]}.csv`;
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
        
        const totalReports = filteredReports.length;
        const categoryStats = {};
        const statusStats = { Pending: 0, Ongoing: 0, Resolved: 0 };
        
        filteredReports.forEach((report) => {
            const cat = report.category || "Unknown";
            categoryStats[cat] = (categoryStats[cat] || 0) + 1;
            
            const status = report.status || "Pending";
            statusStats[status] = (statusStats[status] || 0) + 1;
        });
        
        const sortedCategories = Object.entries(categoryStats).sort((a, b) => b[1] - a[1]);
        const logoPath = new URL('../assets/logo.png', import.meta.url).href;
        
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Community Guard - ${responderBarangay || 'Responder'} Reports</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2d3b8f; padding-bottom: 20px; }
                    .header-logo { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 10px; }
                    .header-logo img { width: 48px; height: 48px; object-fit: contain; }
                    .header h1 { color: #2d3b8f; font-size: 28px; margin-bottom: 5px; }
                    .header .subtitle { color: #666; font-size: 14px; }
                    .header .role-badge { background: #3b82f6; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; margin-top: 8px; display: inline-block; }
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
                    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 15px; }
                    th { background: #2d3b8f; color: white; padding: 10px 8px; text-align: left; }
                    td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
                    tr:nth-child(even) { background: #f8fafc; }
                    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; padding-top: 20px; border-top: 2px solid #2d3b8f; }
                    .footer-brand { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 8px; }
                    .footer-brand img { width: 28px; height: 28px; object-fit: contain; }
                    .footer-brand span { font-weight: 600; color: #2d3b8f; font-size: 14px; }
                    .footer-subtitle { margin-top: 8px; font-size: 11px; color: #888; font-style: italic; }
                    @media print { body { padding: 20px; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="header-logo">
                        <img src="${logoPath}" alt="Community Guard Logo" onerror="this.style.display='none'" />
                        <h1>Community Guard</h1>
                    </div>
                    <p class="subtitle">${responderBarangay || 'Responder'} Reports - Analytics Report</p>
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
            <div className="responder-header-row">
                <h2>{responderBarangay ? `${responderBarangay} Reports` : 'Loading...'}</h2>
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

            {/* Reports List */}
            <div className="reports-list">
                {loading ? (
                    <div className="loading-container" role="status" aria-live="polite">
                        <div className="spinner"></div>
                        <p>Loading reports...</p>
                    </div>
                ) : filteredReports.length > 0 ? (
                    viewMode === "card" ? (
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
                                        <span className={`responder-status-badge responder-status-${report.status.toLowerCase()}`}>
                                            {getStatusIcon(report.status)}
                                            {report.status}
                                        </span>
                                        <button 
                                            className="responder-action-btn responder-update-btn" 
                                            onClick={() => openStatusModal(report)}
                                            aria-label={`Update status for report: ${report.title}`}
                                            title="Update Status"
                                        >
                                            <FaEdit aria-hidden="true" />
                                            <span>Update</span>
                                        </button>
                                        <button 
                                            className="responder-action-btn responder-delete-btn" 
                                            onClick={() => openDeleteReason(report)}
                                            aria-label={`Delete report: ${report.title}`}
                                            title="Delete Report"
                                        >
                                            <FaTrashAlt aria-hidden="true" />
                                            <span>Delete</span>
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
                    // List View
                    <div className="responder-list-table">
                        <div className="list-header">
                            <div className="list-col col-image">Image</div>
                            <div className="list-col col-title">Title</div>
                            <div className="list-col col-category">Category</div>
                            <div className="list-col col-barangay">Barangay</div>
                            <div className="list-col col-reporter">Reporter</div>
                            <div className="list-col col-date">Date</div>
                            <div className="list-col col-status">Status</div>
                            <div className="list-col col-actions">Actions</div>
                        </div>
                        {filteredReports.map((report, index) => {
                            const isExpanded = expandedPosts.includes(report.id);
                            
                            return (
                                <div 
                                    key={report.id} 
                                    className="list-row"
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
                                        <span className={`responder-status-badge responder-status-${report.status.toLowerCase()}`}>
                                            {getStatusIcon(report.status)} {report.status}
                                        </span>
                                    </div>
                                    <div className="list-col col-actions">
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
