import React, { useState, useEffect, useCallback } from "react";
import { FaSearch, FaUserPlus, FaCheck, FaTimes, FaFileAlt, FaCheckCircle, FaClock, FaSyncAlt, FaUserShield, FaRedo } from "react-icons/fa";
import { API_CONFIG, getApiUrl } from "../../utils/apiConfig";
import LoadingScreen from "../shared/LoadingScreen";
import ModalPortal from "../shared/ModalPortal";
import "./AssignResponders.css";
import "../shared/Notification.css";

// Status icon helper
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

const getStatusLabel = (status) => {
    switch (status?.toLowerCase()) {
        case 'pending':
            return 'Pending';
        case 'ongoing':
            return 'Ongoing';
        case 'resolved':
            return 'Resolved';
        default:
            return status || 'Unknown';
    }
};

function AssignResponders({ token }) {
    const [reports, setReports] = useState([]);
    const [responders, setResponders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [overlayExited, setOverlayExited] = useState(false);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [userBarangay, setUserBarangay] = useState(null);
    const [notification, setNotification] = useState(null);
    
    // Assignment modal states
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);
    const [selectedResponder, setSelectedResponder] = useState("");
    const [isAssigning, setIsAssigning] = useState(false);
    
    // Confirm removal modal
    const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
    const [reportToRemove, setReportToRemove] = useState(null);
    const [isRemoving, setIsRemoving] = useState(false);

    const loadingFeatures = [
        {
            title: "Reports Inventory",
            description: "Loading all assigned reports requiring responder assignment."
        },
        {
            title: "Available Responders",
            description: "Fetching certified responders in your barangay."
        },
        {
            title: "Assignment Status",
            description: "Syncing current responder assignments and availability."
        },
        {
            title: "Dashboard Ready",
            description: "Preparing your responder management dashboard."
        },
    ];
    const loadingTitle = "Loading Assignments";
    const successTitle = "Assignments Ready!";

    // Notification handler
    const showNotification = useCallback((message, type = "success") => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    }, []);

    // Fetch user profile to get barangay
    useEffect(() => {
        const fetchProfile = async () => {
            if (!token) return;
            try {
                const response = await fetch(`${getApiUrl('/api/profile')}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await response.json();
                if (data.status === 'success' && data.profile?.address_barangay) {
                    setUserBarangay(data.profile.address_barangay);
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
            }
        };
        fetchProfile();
    }, [token]);

    // Fetch reports for the user's barangay
    const fetchReports = useCallback(async () => {
        if (!token) return;
        
        try {
            const response = await fetch(`${getApiUrl('/api/reports')}?sort=latest`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            
            if (data.status === 'success' && Array.isArray(data.reports)) {
                // Transform and filter reports for the user's barangay
                const transformedReports = data.reports
                    .filter(report => report.is_approved === true) // Only approved reports
                    .map((report) => ({
                        id: report.id,
                        title: report.title || 'Untitled Report',
                        description: report.description || '',
                        category: report.category || 'N/A',
                        status: report.status || 'Pending',
                        barangay: report.address_barangay || 'Unknown',
                        address_street: report.address_street || '',
                        created_at: report.created_at,
                        images: report.images?.map(img => img.url) || [],
                        reporter: report.reporter || { firstname: 'Unknown', lastname: '' },
                        assigned_responder: report.assigned_responder || null,
                        assigned_responder_id: report.assigned_responder_id || null,
                    }));
                setReports(transformedReports);
            }
        } catch (error) {
            console.error('Error fetching reports:', error);
            showNotification('Failed to fetch reports', 'error');
        } finally {
            setLoading(false);
        }
    }, [token, showNotification]);

    // Fetch responders for the user's barangay
    const fetchResponders = useCallback(async () => {
        if (!token || !userBarangay) return;
        
        try {
            const response = await fetch(`${getApiUrl('/api/users/responders')}?barangay=${encodeURIComponent(userBarangay)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            
            if (data.status === 'success' && Array.isArray(data.responders)) {
                setResponders(data.responders);
            }
        } catch (error) {
            console.error('Error fetching responders:', error);
        }
    }, [token, userBarangay]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    useEffect(() => {
        if (userBarangay) {
            fetchResponders();
        }
    }, [userBarangay, fetchResponders]);

    // Filter reports - only show reports from user's barangay
    const filteredReports = reports
        .filter(r => !userBarangay || r.barangay === userBarangay)
        .filter(r => statusFilter === "All" ? true : r.status === statusFilter)
        .filter(r => {
            const searchLower = search.toLowerCase();
            return r.title.toLowerCase().includes(searchLower) ||
                   r.description.toLowerCase().includes(searchLower) ||
                   (r.reporter?.firstname?.toLowerCase() || '').includes(searchLower);
        });

    // Open assignment modal
    const openAssignModal = (report) => {
        setSelectedReport(report);
        setSelectedResponder(report.assigned_responder_id || "");
        setIsAssignModalOpen(true);
    };

    // Handle assignment
    const handleAssign = async () => {
        if (!selectedReport || !selectedResponder) return;
        
        setIsAssigning(true);
        try {
            const response = await fetch(`${getApiUrl(`/api/reports/${selectedReport.id}/assign`)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ responder_id: selectedResponder })
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                showNotification('Responder assigned successfully!', 'success');
                setIsAssignModalOpen(false);
                setSelectedReport(null);
                setSelectedResponder("");
                fetchReports(); // Refresh the list
            } else {
                throw new Error(data.message || 'Failed to assign responder');
            }
        } catch (error) {
            console.error('Error assigning responder:', error);
            showNotification(error.message || 'Failed to assign responder', 'error');
        } finally {
            setIsAssigning(false);
        }
    };

    // Open remove confirmation modal
    const openRemoveModal = (report) => {
        setReportToRemove(report);
        setIsRemoveModalOpen(true);
    };

    // Handle unassignment
    const handleRemoveAssignment = async () => {
        if (!reportToRemove) return;
        
        setIsRemoving(true);
        try {
            const response = await fetch(`${getApiUrl(`/api/reports/${reportToRemove.id}/unassign`)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                showNotification('Responder unassigned successfully!', 'success');
                setIsRemoveModalOpen(false);
                setReportToRemove(null);
                fetchReports(); // Refresh the list
            } else {
                throw new Error(data.message || 'Failed to unassign responder');
            }
        } catch (error) {
            console.error('Error unassigning responder:', error);
            showNotification(error.message || 'Failed to unassign responder', 'error');
        } finally {
            setIsRemoving(false);
        }
    };

    return (
        <LoadingScreen
            variant="inline"
            inlineOffset="20vh"
            stage={loading ? "loading" : "exit"}
            features={loadingFeatures}
            title={loadingTitle}
            successTitle={successTitle}
            onExited={() => setOverlayExited(true)}
        >
        <div className={`assign-responders-page ${overlayExited ? 'loading-revealed' : 'loading-hidden'}`}>
            {/* Header */}
            <div className="assign-header">
                <div className="assign-header-left">
                    <h2><FaUserShield /> Assign Responders</h2>
                    <p className="muted">
                        {userBarangay ? `${userBarangay} · ` : ''}
                        Manage responder assignments for reports
                    </p>
                </div>
                <button 
                    className="refresh-btn"
                    onClick={() => {
                        setLoading(true);
                        fetchReports();
                        fetchResponders();
                    }}
                    title="Refresh"
                >
                    <FaRedo /> Refresh
                </button>
            </div>

            {/* Filter Controls */}
            <div className="assign-top-controls">
                <div className="assign-search-container">
                    <label htmlFor="search-input" className="sr-only">Search reports</label>
                    <input
                        id="search-input"
                        type="text"
                        placeholder="Search reports..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="assign-search-input"
                    />
                    <FaSearch className="assign-search-icon" aria-hidden="true" />
                </div>
                
                <label htmlFor="status-filter" className="sr-only">Filter by Status</label>
                <select 
                    id="status-filter"
                    value={statusFilter} 
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="assign-filter-select"
                >
                    <option value="All">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Resolved">Resolved</option>
                </select>
            </div>

            {/* Reports List Table */}
            <div className="assign-list-table">
                <div className="list-header">
                    <div className="list-col col-image">Image</div>
                    <div className="list-col col-title">Report</div>
                    <div className="list-col col-category">Category</div>
                    <div className="list-col col-reporter">Reporter</div>
                    <div className="list-col col-date">Date</div>
                    <div className="list-col col-assigned">Assigned To</div>
                    <div className="list-col col-status">Status</div>
                    <div className="list-col col-actions">Actions</div>
                </div>
                
                {filteredReports.length > 0 ? (
                    filteredReports.map((report, index) => (
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
                                    />
                                ) : (
                                    <div className="no-thumbnail">
                                        <FaFileAlt />
                                    </div>
                                )}
                            </div>
                            <div className="list-col col-title">
                                <span className="list-title">{report.title}</span>
                                <span className="list-address">{report.address_street}, {report.barangay}</span>
                            </div>
                            <div className="list-col col-category">
                                <span className="category-tag">{report.category}</span>
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
                                {report.created_at
                                    ? new Date(report.created_at).toLocaleDateString()
                                    : "N/A"}
                            </div>
                            <div className="list-col col-assigned">
                                {report.assigned_responder ? (
                                    <div className="assigned-responder">
                                        <span className="responder-name">
                                            {report.assigned_responder.firstname} {report.assigned_responder.lastname}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="unassigned-text">Not Assigned</span>
                                )}
                            </div>
                            <div className="list-col col-status">
                                <span className={`status-badge status-${report.status.toLowerCase()}`}>
                                    {getStatusIcon(report.status)} {getStatusLabel(report.status)}
                                </span>
                            </div>
                            <div className="list-col col-actions">
                                <div className="list-actions">
                                    {report.assigned_responder ? (
                                        <>
                                            <button 
                                                className="list-action-btn edit"
                                                onClick={() => openAssignModal(report)}
                                                title="Change Responder"
                                            >
                                                <FaUserPlus />
                                            </button>
                                            <button 
                                                className="list-action-btn remove"
                                                onClick={() => openRemoveModal(report)}
                                                title="Remove Assignment"
                                            >
                                                <FaTimes />
                                            </button>
                                        </>
                                    ) : (
                                        <button 
                                            className="list-action-btn assign"
                                            onClick={() => openAssignModal(report)}
                                            title="Assign Responder"
                                        >
                                            <FaUserPlus /> Assign
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="no-reports">
                        <FaFileAlt />
                        <p>No reports found</p>
                        <span>Reports from your barangay will appear here</span>
                    </div>
                )}
            </div>

            {/* Assignment Modal - wrapped in ModalPortal for proper z-index */}
            {isAssignModalOpen && (
                <ModalPortal>
                <div className="modal-backdrop" onClick={() => !isAssigning && setIsAssignModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><FaUserPlus /> Assign Responder</h3>
                            <button 
                                className="close-modal-btn" 
                                onClick={() => !isAssigning && setIsAssignModalOpen(false)}
                                disabled={isAssigning}
                                aria-label="Close modal"
                                title="Close"
                            >
                                <FaTimes aria-hidden="true" />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p className="modal-report-title">
                                <strong>Report:</strong> {selectedReport?.title}
                            </p>
                            <div className="form-group">
                                <label htmlFor="responder-select">Select Responder</label>
                                <select
                                    id="responder-select"
                                    value={selectedResponder}
                                    onChange={(e) => setSelectedResponder(e.target.value)}
                                    className="responder-select"
                                    disabled={isAssigning}
                                >
                                    <option value="">-- Select a Responder --</option>
                                    {responders.map((responder) => (
                                        <option key={responder.id} value={responder.id}>
                                            {responder.firstname} {responder.lastname}
                                            {responder.phone_number ? ` (${responder.phone_number})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {responders.length === 0 && (
                                <p className="no-responders-msg">
                                    No responders available in {userBarangay || 'this barangay'}
                                </p>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button 
                                className="btn-cancel"
                                onClick={() => setIsAssignModalOpen(false)}
                                disabled={isAssigning}
                            >
                                Cancel
                            </button>
                            <button 
                                className="btn-assign"
                                onClick={handleAssign}
                                disabled={isAssigning || !selectedResponder}
                            >
                                {isAssigning ? 'Assigning...' : 'Assign'}
                            </button>
                        </div>
                    </div>
                </div>
                </ModalPortal>
            )}

            {/* Remove Assignment Confirmation Modal */}
            {isRemoveModalOpen && (
                <ModalPortal>
                <div className="modal-backdrop" onClick={() => !isRemoving && setIsRemoveModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Remove Assignment</h3>
                            <button 
                                className="close-modal-btn" 
                                onClick={() => !isRemoving && setIsRemoveModalOpen(false)}
                                disabled={isRemoving}
                                aria-label="Close modal"
                                title="Close"
                            >
                                <FaTimes aria-hidden="true" />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p>
                                Are you sure you want to remove the responder assignment from 
                                <strong> "{reportToRemove?.title}"</strong>?
                            </p>
                            {reportToRemove?.assigned_responder && (
                                <p className="current-assignment">
                                    Currently assigned to: <strong>
                                        {reportToRemove.assigned_responder.firstname} {reportToRemove.assigned_responder.lastname}
                                    </strong>
                                </p>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button 
                                className="btn-cancel"
                                onClick={() => setIsRemoveModalOpen(false)}
                                disabled={isRemoving}
                            >
                                Cancel
                            </button>
                            <button 
                                className="btn-remove"
                                onClick={handleRemoveAssignment}
                                disabled={isRemoving}
                            >
                                {isRemoving ? 'Removing...' : 'Remove'}
                            </button>
                        </div>
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

export default AssignResponders;