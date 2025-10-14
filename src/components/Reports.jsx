/* eslint-disable no-irregular-whitespace */
import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { FaEdit, FaTrashAlt, FaSearch, FaRedo, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./Reports.css";
import RealtimeStatus from "./RealtimeStatus";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const API_URL = "http://localhost:5000/api";

// Image error handling utility
const handleImageError = (e, imgUrl) => {
  console.error(`❌ Failed to load image: ${imgUrl}`);
  e.target.style.display = 'none'; // Hide broken images
};

const handleImageLoad = (imgUrl) => {
  console.log(`✅ Image loaded: ${imgUrl}`);
};

// Enhanced optimistic update utility - show images immediately with error handling
const createOptimisticImageUrl = (file) => {
  try {
    if (!file || !(file instanceof File)) {
      console.warn('⚠️ Invalid file passed to createOptimisticImageUrl:', file);
      return null;
    }
    
    const url = URL.createObjectURL(file);
    console.log(`✨ Created optimistic URL for ${file.name}: ${url}`);
    return url;
  } catch (error) {
    console.error('❌ Error creating optimistic URL:', error);
    return null;
  }
};

// Fix Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function LocationPicker({ setLocation }) {
  const [position, setPosition] = useState(null);

  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      setLocation(e.latlng);
    },
  });

  return position ? <Marker position={position} /> : null;
}

// --- NEW Hook for Arrow Key Navigation in Filter Controls ---
// MODIFIED: Added isModalOpen to prevent filter navigation when modal is active.
const useKeyboardNavigation = (containerRef, selector, isModalOpen) => {
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleArrowNavigation = (event) => {
            // FIX: If the modal is open, prevent filter navigation
            if (isModalOpen) return; 

            // Only capture arrows if the current focus is within the filter container
            if (!container.contains(document.activeElement) && event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
                return;
            }

            // The selector finds all focusable filter elements
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
                    // Loop to the first element
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
                    // Loop to the last element
                    focusableElements[focusableElements.length - 1].focus();
                }
                event.preventDefault(); // Prevent default scroll/behavior
            }
        };

        window.addEventListener('keydown', handleArrowNavigation);
        return () => window.removeEventListener('keydown', handleArrowNavigation);
    }, [containerRef, selector, isModalOpen]); // ADDED: isModalOpen to dependency array
};
// -------------------------------------------------------------

function Reports({ session }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [barangay, setBarangay] = useState("All Barangays");
  const [sort, setSort] = useState("latest");
  const [showMyReports, setShowMyReports] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newReport, setNewReport] = useState({
    title: "",
    description: "",
    category: "Concern",
    barangay: "All",
    addressStreet: "",
    images: [],
    existingImages: [],
    lat: null,
    lng: null,
    date: new Date(),
  });
  const [editReportId, setEditReportId] = useState(null);
  const [expandedPosts, setExpandedPosts] = useState([]);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  // ⭐ NEW STATE FOR NOTIFICATION
  const [notification, setNotification] = useState(null); // { message: string, type: 'success' | 'error' | 'caution' }
  const [highlightedReportId, setHighlightedReportId] = useState(null);

  // ⭐ REFS for Modals (already existed)
  const modalRef = useRef(null);
  const focusableElementsRef = useRef([]);

  // ⭐ NEW REF FOR FILTER KEYBOARD NAVIGATION
  const filterContainerRef = useRef(null);
  const filterSelector = '.search-input, select, .action-buttons-group button';
  // MODIFIED: Passing isModalOpen to prevent conflict when modal is open
  useKeyboardNavigation(filterContainerRef, filterSelector, isModalOpen); 
  // ------------------------------------------

  const barangays = [
    "All Barangays",
    "Barretto",
    "East Bajac-Bajac",
    "East Tapinac",
    "Gordon Heights",
    "Kalaklan",
    "Mabayuan",
    "New Asinan",
    "New Banicain",
    "New Cabalan",
    "New Ilalim",
    "New Kababae",
    "New Kalalake",
    "Old Cabalan",
    "Pag-Asa",
    "Santa Rita",
    "West Bajac-Bajac",
    "West Tapinac",
  ];

  // The 'applied' states will now track the current filter values directly (real-time).
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedCategory, setAppliedCategory] = useState("All");
  const [appliedBarangay, setAppliedBarangay] = useState("All Barangays");
  const token = session?.token;

  // ⭐ NOTIFICATION HANDLER FUNCTION
  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3000); // Notification disappears after 3 seconds
  };

  // ✅ Fetch reports
  const fetchReports = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/reports?sort=${sort === "latest" ? "desc" : "asc"}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.status === "success" && Array.isArray(res.data.reports)) {
        setReports(res.data.reports);
      } else {
        console.warn("Unexpected response format:", res.data);
        setReports([]);
      }
    } catch (err) {
      console.error("Error fetching reports:", err);
      // On error, preserve existing reports to prevent blank page
      // Only set empty array if there are no existing reports
    } finally {
      setLoading(false);
    }
  }, [token, sort]);

  // ✅ Run on mount & whenever token/sort changes
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // 🔄 SMART REAL-TIME UPDATES - Only fetch when needed
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
  const [changeType, setChangeType] = useState(null);

  // ✅ SORTING VALIDATION: Ensure reports maintain correct created_at order
  const validateReportSorting = useCallback((reports, currentSort) => {
    if (reports.length < 2) return true;
    
    for (let i = 0; i < reports.length - 1; i++) {
      const current = new Date(reports[i].created_at);
      const next = new Date(reports[i + 1].created_at);
      
      if (currentSort === "latest") {
        // For "latest", newer reports should come first (DESC order)
        if (current < next) {
          console.warn("⚠️ Sort validation failed: Reports not in DESC order");
          return false;
        }
      } else {
        // For "oldest", older reports should come first (ASC order)  
        if (current > next) {
          console.warn("⚠️ Sort validation failed: Reports not in ASC order");
          return false;
        }
      }
    }
    return true;
  }, []);

  useEffect(() => {
    if (!token) return;

    let pollInterval;
    
    // Smart polling - only fetch if we haven't made recent changes
    const smartPoll = async () => {
      const now = Date.now();
      
      // Skip polling if we just made a change (within last 10 seconds)
      if (lastUpdateTime && (now - lastUpdateTime) < 10000) {
        console.log("⏭️ Skipping poll - recent update detected");
        return;
      }

      try {
        console.log(`🔄 Smart polling for updates... (sort: ${sort} → ${sort === "latest" ? "desc" : "asc"})`);
        const response = await axios.get(`${API_URL}/reports?sort=${sort === "latest" ? "desc" : "asc"}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data?.reports) {
          const newReports = response.data.reports;
          
          // Only update if there are actual changes
          setReports(prevReports => {
            const hasChanges = JSON.stringify(prevReports) !== JSON.stringify(newReports);
            if (hasChanges) {
              console.log("� Updates detected - applying changes");
              return newReports;
            }
            // ✅ ADD SORTING VALIDATION
            const isSortingCorrect = validateReportSorting(newReports, sort);
            if (hasChanges && !isSortingCorrect) {
              console.warn(`❌ Sorting validation failed - keeping current state (${sort})`);
              return prevReports;
            }
            
            return prevReports; // No changes, keep existing state
          });
        }
        setIsConnected(true);
      } catch (error) {
        console.error("❌ Smart poll error:", error);
        setIsConnected(false);
      }
    };

    // Start smart polling every 8 seconds
    pollInterval = setInterval(smartPoll, 8000);

    return () => {
      clearInterval(pollInterval);
      console.log("🛑 Smart polling stopped");
    };
  }, [token, sort, lastUpdateTime, validateReportSorting]);  // ⭐ ORIGINAL KEYBOARD NAVIGATION EFFECT (FOR MODAL)
  useEffect(() => {
    if (isModalOpen && modalRef.current) {
      // Get all focusable elements in the modal
      const focusableElements = modalRef.current.querySelectorAll(
        // Selector includes input, textarea, select, button, and any element with tabIndex (like the upload label)
        'input:not([type="file"]), textarea, select, button:not([type="button"]), [tabindex]:not([tabindex="-1"])'
      );
      
      focusableElementsRef.current = Array.from(focusableElements);
      
      // Set focus to first element when modal opens
      if (focusableElementsRef.current.length > 0) {
        focusableElementsRef.current[0].focus();
      }

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          setIsModalOpen(false);
          return;
        }
        
        // Tab and Shift+Tab for focus trap (important for accessibility)
        if (e.key === 'Tab') {
          const currentIndex = focusableElementsRef.current.indexOf(document.activeElement);
          // Enhance default tab behavior with cycling
          if (!e.shiftKey && currentIndex === focusableElementsRef.current.length - 1) {
            e.preventDefault();
            focusableElementsRef.current[0]?.focus();
          } else if (e.shiftKey && currentIndex === 0) {
            e.preventDefault();
            focusableElementsRef.current[focusableElementsRef.current.length - 1]?.focus();
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isModalOpen]);

  // Add or update report
  const handleAddOrUpdateReport = async () => {
    if (
      !newReport.title ||
      !newReport.description ||
      !newReport.barangay ||
      newReport.barangay === "All"
    ) {
      showNotification(
        "Please fill in the Title, Description, and select a Barangay.",
        "caution"
      );
      return;
    }

    try {
      const formData = new FormData();
      formData.append("title", newReport.title);
      formData.append("description", newReport.description);
      formData.append("category", newReport.category);
      formData.append("barangay", newReport.barangay);
      formData.append("addressStreet", newReport.addressStreet);
      if (newReport.lat && newReport.lng) {
        formData.append("lat", newReport.lat);
        formData.append("lng", newReport.lng);
      }
      newReport.images.forEach((file) => formData.append("images", file));

      if (editReportId) {
        const response = await axios.put(`${API_URL}/reports/${editReportId}`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });
        
        // Real-time update: Update the specific report in the list with complete data
        if (response.data.status === "success" && response.data.report) {
          console.log("Update Response:", response.data.report); // Debug log
          
          const updatedReport = response.data.report;
          setReports(prevReports => 
            prevReports.map(report => 
              report.id === editReportId 
                ? { 
                    ...report, 
                    ...updatedReport,
                    // Preserve reporter info to avoid badge rendering issues
                    reporter: report.reporter || updatedReport.reporter,
                    // Ensure all updated fields are properly set
                    images: updatedReport.images || report.images || [],
                    updated_at: updatedReport.updated_at || new Date().toISOString()
                  }
                : report
            )
          );
        }
        setLastUpdateTime(Date.now()); // Mark that we made a change
        setChangeType('update'); // Set the change type for status indicator
        showNotification("✓ Report updated successfully!", "success");
      } else {
        const response = await axios.post(`${API_URL}/reports`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });
        
        // Real-time update: Add new report to the top of the list
        if (response.data.status === "success") {
          console.log("📝 New report added:", response.data.report.title);
          setReports(prevReports => [response.data.report, ...prevReports]);
          setLastUpdateTime(Date.now()); // Mark that we made a change
          setChangeType('add'); // Set the change type for status indicator
        }
        showNotification("✓ Report submitted successfully!", "success");
      }      resetNewReport();
      setIsModalOpen(false);
      setEditReportId(null);
      // Remove fetchReports() call - no longer needed for real-time updates
    } catch (err) {
      console.error("Add/Update Error:", err);
      showNotification(
        "Failed to save report. Please check your connection and data.",
        "error"
      );
    }
  };

  const handleEdit = (report) => {
    setEditReportId(report.id);
    setNewReport({
      title: report.title || "",
      description: report.description || "",
      category: report.category || "Concern",
      barangay: report.address_barangay || "All", // Use address_barangay from the report object
      addressStreet: report.address_street || "",
      images: [],
      existingImages: report.images || [], // Store existing images separately
      lat: report.latitude || null,
      lng: report.longitude || null,
      date: report.created_at ? new Date(report.created_at) : new Date(),
    });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await axios.patch(
        `${API_URL}/reports/${deleteTarget.id}`,
        { deleted: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Real-time update: Remove the deleted report from the list
      setReports(prevReports => 
        prevReports.filter(report => report.id !== deleteTarget.id)
      );
      
      showNotification("🗑️ Report deleted successfully!", "success");
      setIsDeleteConfirmOpen(false);
      setDeleteTarget(null);
      // Remove fetchReports() call - no longer needed for real-time updates
    } catch (err) {
      console.error("Delete Error:", err);
      showNotification("Failed to delete report. Please try again.", "error");
    }
  };

  const toggleExpand = (id) => {
    setExpandedPosts((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Enhanced function to clean up optimistic URLs and reset form
  const cleanupOptimisticUrls = () => {
    // Clean up any existing blob URLs to prevent memory leaks
    if (newReport.images && newReport.images.length > 0) {
      newReport.images.forEach(file => {
        if (typeof file !== "string" && file instanceof File) {
          const url = URL.createObjectURL(file);
          URL.revokeObjectURL(url);
        }
      });
    }
  };

  const resetNewReport = () => {
    // Clean up optimistic URLs before resetting
    cleanupOptimisticUrls();
    
    setNewReport({
      title: "",
      description: "",
      category: "Concern",
      barangay: "Barretto", // Set a default barangay other than "All" for form
      addressStreet: "",
      images: [],
      existingImages: [],
      lat: null,
      lng: null,
      date: new Date(),
    });
  };  // Correct toggle logic
  const filteredReports = reports
    .filter((r) => r.deleted !== true) 
    .filter((r) =>
      showMyReports
        ? String(r.user_id) === String(session?.user?.id) // My Reports
        : true // All Reports
    )
    .filter((r) => appliedCategory === "All" || r.category === appliedCategory)
    .filter(
      (r) => appliedBarangay === "All Barangays" || r.address_barangay === appliedBarangay
    )
    .filter((r) => {
      if (!appliedSearch) return true;
      const searchLower = appliedSearch.toLowerCase();
      return (
        (r.title || "").toLowerCase().includes(searchLower)
      );
    });

  // 👇 NEW HANDLER TO RESET ALL FILTERS
  const handleResetFilters = () => {
    setSearch("");
    setCategory("All");
    setBarangay("All Barangays");
    setAppliedSearch("");
    setAppliedCategory("All");
    setAppliedBarangay("All Barangays");
    setSort("latest");
  };

  useEffect(() => {
    setAppliedSearch(search);
  }, [search]);

  useEffect(() => {
    setAppliedCategory(category);
  }, [category]);

  useEffect(() => {
    setAppliedBarangay(barangay);
  }, [barangay]);

  // Handle highlight parameter from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const highlightId = urlParams.get('highlight');
    if (highlightId && reports.length > 0) {
      // Use string comparison since IDs might be UUIDs
      setHighlightedReportId(highlightId);
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

  return (
    <div className="reports-container">
      {notification && (
        <div className={`notif notif-${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="header-row">
        <h2>Community Reports</h2>
        <button
          className="history-btn"
          onClick={() => setShowMyReports(!showMyReports)}
          aria-pressed={showMyReports} // ARIA for toggles
        >
          {showMyReports ? "My Reports" : "All Reports"}
        </button>
      </div>

      {/* Filters - Added ref for keyboard navigation */}
      <div className="top-controls" ref={filterContainerRef}>
        <div className="search-bar-container">
          <FaSearch className="search-icon" /> {/* Visual Search Icon */}
          <label htmlFor="report-search" className="sr-only">Search reports by title</label>
          <input
            id="report-search"
            type="text"
            placeholder="Search reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)} // State update triggers useEffect to update appliedSearch
            className="search-input real-time-search-input" // Add a class for styling the input part
            tabIndex="0" // Ensure this is focusable
          />
        </div>

        {/* Category filter - Now uses useEffect for real-time application */}
        <label htmlFor="category-filter" className="sr-only">Filter by Category</label>
        <select
          id="category-filter"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
          }}
          tabIndex="0"
        >
          <option value="All">All Categories</option>
          <option value="Concern">Concern</option>
          <option value="Crime">Crime</option>
          <option value="Hazard">Hazard</option>
          <option value="Lost&Found">Lost & Found</option>
          <option value="Others">Others</option>
        </select>
        
        {/* Barangay filter - Now uses useEffect for real-time application */}
        <label htmlFor="barangay-filter" className="sr-only">Filter by Barangay</label>
        <select
          id="barangay-filter"
          value={barangay}
          onChange={(e) => {
            setBarangay(e.target.value);
          }}
          tabIndex="0"
        >
          {barangays.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <label htmlFor="sort-order" className="sr-only">Sort Order</label>
        <select 
          id="sort-order"
          value={sort} 
          onChange={(e) => setSort(e.target.value)}
          tabIndex="0"
        >
          <option value="latest">Latest → Oldest</option>
          <option value="oldest">Oldest → Latest</option>
        </select>

        {/* Buttons Group for Flex Layout */}
        <div className="action-buttons-group">
          <div className="filter-btns">
           <button
              className="filter-icon-btn"
              title="Reset Filters"
             onClick={handleResetFilters}
             tabIndex="0" // Ensure this is focusable
            >
            <FaRedo aria-hidden="true" />
            </button>
          </div>

          {/* Add Report Button */}
          <button
            className="add-btn"
            onClick={() => {
              resetNewReport();
              setEditReportId(null);
              setIsModalOpen(true);
            }}
             tabIndex="0" // Ensure this is focusable
          >
            + Add Report
          </button>
        </div>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="loading-overlay loading-compact">
          {" "}
          <div className="spinner" /> <p>Loading reports...</p>{" "}
        </div>
      )}

      {/* Reports List */}
      <div className="reports-list">
        {!loading && filteredReports.length > 0 ? (
          filteredReports.map((report) => {
            const isExpanded = expandedPosts.includes(report.id);
            const displayDescription = isExpanded
              ? report.description
              : `${(report.description || "").slice(0, 130)}${
                  (report.description?.length || 0) > 130 ? "..." : ""
                }`;

            return (
              <div 
                key={report.id} 
                id={`report-${report.id}`}
                className={`report-card ${highlightedReportId === String(report.id) ? 'highlighted-report' : ''}`}
                 role="article"
              >
                {/* Header */}
                <div className="report-header">
                  <div className="report-header-left">
                    <img
                      src={
                        report.reporter?.avatar_url || "/src/assets/profile.png"
                      }
                      alt={`Profile picture of ${report.reporter?.firstname || "Unknown"}`}
                      className="profile-pic"
                      onError={(e) => {
                        e.target.src = "/src/assets/profile.png"; // Fallback image
                      }}
                    />
                    <div className="report-header-text">
                      <p className="report-user">
                        {report.reporter ? (
                          <>
                            {`${report.reporter.firstname || ""} ${
                              report.reporter.lastname || ""
                            }`.trim()}
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
                            Unknown User
                            <span className="admin-verification-status unverified">
                              <FaTimesCircle aria-hidden="true" />Unverified
                            </span>
                          </>
                        )}
                      </p>
                      <p className="report-subinfo">
                        {report.created_at
                          ? new Date(report.created_at).toLocaleString()
                          : ""}{" "}
                        · {report.category || "N/A"}
                      </p>
                      <p className="report-address-info">
                        {(report.address_street || "")},{" "}
                        {(report.address_barangay || "")}, Olongapo City
                      </p>
                    </div>
                  </div>

                  <div className="report-header-actions">
                    <span
                      className={`status-badge status-${(
                        report.status || "pending"
                      ).toLowerCase()}`}
                    >
                      {report.status || "Pending"}
                    </span>

                    {session?.user &&
                      String(report.user_id) === String(session.user.id) && (
                        <>
                          <button
                            className="icon-btn edit-btn"
                            onClick={() => handleEdit(report)}
                             aria-label={`Edit report: ${report.title}`}
                             title="Edit Report"
                          >
                            <FaEdit aria-hidden="true" />
                          </button>
                          <button
                            className="icon-btn delete-btn"
                            onClick={() => {
                              setDeleteTarget(report);
                              setIsDeleteConfirmOpen(true);
                            }}
                             aria-label={`Delete report: ${report.title}`}
                             title="Delete Report"
                          >
                            <FaTrashAlt aria-hidden="true" />
                          </button>
                        </>
                      )}
                  </div>
                </div>

                {/* Caption */}
                <div className="report-caption">
                  <strong>{report.title || ""}</strong>
                  <p className="report-description-text">
                    {displayDescription}
                    {report.description?.length > 130 && (
                      <span
                        className="more-link"
                        onClick={() => toggleExpand(report.id)}
                        aria-expanded={isExpanded}
                        aria-controls={`report-description-full-${report.id}`}
                      >
                        {isExpanded ? " Show less" : " ...more"}
                      </span>
                    )}
                  </p>
                </div>

                {/* Images */}
                {report.images?.length > 0 && (
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
          !loading && <p className="no-report-msg">No reports found.</p>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            ref={modalRef}
          >
            <div className="modal-scrollable">
              <h3>{editReportId ? "Edit Report" : "Add New Report"}</h3>

              <label>Title:</label>
              <input
                type="text"
                placeholder="Title"
                value={newReport.title}
                onChange={(e) =>
                  setNewReport({ ...newReport, title: e.target.value })
                }
                tabIndex="0"
              />

              <label>Description:</label>
              <textarea
                placeholder="Description"
                value={newReport.description}
                onChange={(e) =>
                  setNewReport({ ...newReport, description: e.target.value })
                }
                tabIndex="0"
              />

              <div className="address-fields">
                <label>Street Address:</label>
                <input
                  type="text"
                  placeholder="e.g. 45 Rizal Avenue"
                  value={newReport.addressStreet}
                  onChange={(e) =>
                    setNewReport({ ...newReport, addressStreet: e.target.value })
                  }
                  tabIndex="0"
                />
                <label>Barangay:</label>
                <select
                  value={newReport.barangay}
                  onChange={(e) =>
                    setNewReport({ ...newReport, barangay: e.target.value })
                  }
                  tabIndex="0"
                >
                  {/* Filter "All Barangays" out of the form dropdown */}
                  {barangays.filter((b) => b !== "All Barangays").map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <label>Category:</label>
              <select
                value={newReport.category}
                onChange={(e) =>
                  setNewReport({ ...newReport, category: e.target.value })
                }
                tabIndex="0"
              >
                <option value="Concern">Concern</option>
                <option value="Crime">Crime</option>
                <option value="Hazard">Hazard</option>
                <option value="Lost&Found">Lost & Found</option>
                <option value="Others">Others</option>
              </select>

              <div className="map-field">
                <label>Pick Location on Map:</label>
                <MapContainer
                  // Use the report's current location if editing, otherwise default to Olongapo
                  center={[
                    newReport.lat || 14.8477,
                    newReport.lng || 120.2879,
                  ]}
                  zoom={newReport.lat ? 16 : 13}
                  style={{ height: 250, width: "100%", marginBottom: 10 }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap contributors"
                  />
                  {/* Marker will show if location is picked/exists */}
                  {newReport.lat && newReport.lng && (
                    <Marker position={[newReport.lat, newReport.lng]} />
                  )}
                  <LocationPicker
                    setLocation={(latlng) =>
                      setNewReport({
                        ...newReport,
                        lat: latlng.lat,
                        lng: latlng.lng,
                      })
                    }
                  />
                </MapContainer>
              </div>

              {/* MODIFIED: Added tabIndex="0" to the label to make the upload button focusable */}
              <label 
                className="upload-btn"
                tabIndex="0" 
              >
                {editReportId ? "Replace Image(s)" : "Upload Image(s)"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    // Limit to 5 images total
                    const files = Array.from(e.target.files).slice(0, 5);
                    console.log(`📸 User selected ${files.length} new images for ${editReportId ? 'editing' : 'new report'}`);
                    
                    // Validate file types and sizes
                    const validFiles = files.filter(file => {
                      const isValidType = file.type.startsWith('image/');
                      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB limit
                      
                      if (!isValidType) {
                        console.warn(`⚠️ Invalid file type: ${file.name}`);
                      }
                      if (!isValidSize) {
                        console.warn(`⚠️ File too large: ${file.name}`);
                      }
                      
                      return isValidType && isValidSize;
                    });
                    
                    // Immediately update state to show preview
                    setNewReport((prev) => ({ ...prev, images: validFiles }));
                    
                    // Show immediate feedback notification
                    if (validFiles.length > 0) {
                      showNotification(
                        `📸 ${validFiles.length} image(s) selected - preview ready!`, 
                        "success"
                      );
                    }
                    
                    if (validFiles.length !== files.length) {
                      showNotification(
                        `⚠️ ${files.length - validFiles.length} file(s) skipped (invalid type or too large)`, 
                        "caution"
                      );
                    }
                  }}
                  hidden
                />
              </label>

              {/* Enhanced Image Preview - Show immediate preview of changes */}
              {(editReportId || newReport.images.length > 0) && (
                <div>
                  {newReport.images && newReport.images.length > 0 ? (
                    <>
                      <p style={{ fontSize: '12px', color: '#666', margin: '5px 0' }}>
                        {editReportId ? "📸 Preview (New Images):" : "Selected Images:"}
                      </p>
                      <div
                        className={`report-images images-${newReport.images.length}`}
                      >
                        {newReport.images.map((file, idx) => (
                          <img
                            key={`preview-${idx}`}
                            src={
                              typeof file === "string"
                                ? file
                                : createOptimisticImageUrl(file)
                            }
                            alt={`preview-${idx}`}
                            className="report-collage-img"
                            onClick={() => setPreviewImage(
                              typeof file === "string" 
                                ? file 
                                : createOptimisticImageUrl(file)
                            )}
                            style={{ cursor: 'pointer' }}
                            onLoad={() => handleImageLoad(
                              typeof file === "string" 
                                ? file 
                                : 'preview-image'
                            )}
                            onError={(e) => handleImageError(e, 
                              typeof file === "string" 
                                ? file 
                                : 'preview-image'
                            )}
                          />
                        ))}
                      </div>
                    </>
                  ) : editReportId && newReport.existingImages && newReport.existingImages.length > 0 ? (
                    <>
                      <p style={{ fontSize: '12px', color: '#666', margin: '5px 0' }}>Current Images:</p>
                      <div
                        className={`report-images images-${newReport.existingImages.length}`}
                      >
                        {newReport.existingImages.map((imgObj, idx) => (
                          <img
                            key={`existing-${idx}`}
                            src={`${API_URL}${imgObj.url}`}
                            alt={`existing-${idx}`}
                            className="report-collage-img"
                            onClick={() => setPreviewImage(`${API_URL}${imgObj.url}`)}
                            style={{ cursor: 'pointer' }}
                            onLoad={() => handleImageLoad(`${API_URL}${imgObj.url}`)}
                            onError={(e) => handleImageError(e, `${API_URL}${imgObj.url}`)}
                          />
                        ))}
                      </div>
                    </>
                  ) : editReportId ? (
                    <p style={{ fontSize: '12px', color: '#999', margin: '5px 0', fontStyle: 'italic' }}>
                      No images currently attached to this report.
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            <div className="modal-buttons">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditReportId(null);
                  resetNewReport(); // Reset fields on cancel
                }}
                tabIndex="0"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddOrUpdateReport}
                tabIndex="0"
              >
                {editReportId ? "Update" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {isDeleteConfirmOpen && (
        <div 
            className="modal-overlay"
            role="dialog" 
            aria-modal="true" 
            aria-labelledby="delete-modal-title"
        >
          <div className="modal">
            <h3 id="delete-modal-title">Delete Report</h3>
            <p>
              Are you sure you want to delete "<strong>{deleteTarget?.title}</strong>"?
            </p>
            <div className="delete-actions">
              <button onClick={handleDelete} autoFocus>Yes, Delete</button>
              <button onClick={() => setIsDeleteConfirmOpen(false)}>
                Cancel
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
          <img
            src={previewImage}
            alt="Full screen report image"
            className="fullscreen-image"
          />
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

      {/* Real-time Status Indicator */}
      <RealtimeStatus 
        isConnected={isConnected}
        lastUpdate={lastUpdateTime}
        changeType={changeType}
      />
    </div>
  );
}export default Reports;