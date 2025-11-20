import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { FaEdit, FaTrashAlt, FaSearch, FaRedo, FaCheckCircle, FaTimesCircle, FaQuestionCircle, FaTimes } from "react-icons/fa";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import { API_CONFIG, getApiUrl } from "../utils/apiConfig";
import AICategorySelector from "./AICategorySelector";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./Reports.css";
import LoadingScreen from "./LoadingScreen";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Use getApiUrl(...) so VITE_API_URL from env is used in production (Railway) and localhost in dev

// Helper function to construct proper image URLs with optimization
const getImageUrl = (imgUrl) => {
  // If it's a data URL (base64), return as is
  if (imgUrl && imgUrl.startsWith('data:')) {
    return imgUrl;
  }
  // If it's an API path, construct full URL
  if (imgUrl && imgUrl.startsWith('/api/')) {
    return `${API_CONFIG.BASE_URL}${imgUrl}`;
  }
  // Default case for relative paths
  if (imgUrl) {
    return `${API_CONFIG.BASE_URL}${imgUrl}`;
  }
  // Fallback for empty/null URLs
  return "/src/assets/placeholder.png";
};

// Fix Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function LocationPicker({ setLocation, currentLocation }) {
  const [position, setPosition] = useState(null);

  useMapEvents({
    click(e) {
      // If the user clicks on the map, set manual marker location
      setPosition(e.latlng);
      setLocation(e.latlng);
    },
  });

  // If the "Use My Location" button is pressed, clear manual picker marker
  useEffect(() => {
    if (currentLocation) {
      setPosition(null); // remove manual marker when using GPS
    }
  }, [currentLocation]);

  return position ? <Marker position={position} /> : null;
}
// ✅ Helper Component: Recenters map when lat/lng changes
function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], 16);
    }
  }, [lat, lng, map]);
  return null;
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
                    focusableElements[0]?.focus();
                } else {
                    const nextIndex = (currentIndex + 1) % focusableElements.length;
                    focusableElements[nextIndex]?.focus();
                }
                event.preventDefault(); // Prevent default scroll/behavior
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                if (currentIndex === -1) {
                    focusableElements[focusableElements.length - 1]?.focus();
                } else {
                    const prevIndex = currentIndex === 0 ? focusableElements.length - 1 : currentIndex - 1;
                    focusableElements[prevIndex]?.focus();
                }
                event.preventDefault();
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
    category: "", // Start with empty selection to force user to choose
    barangay: "", // Start with empty selection to force user to choose
    addressStreet: "",
    images: [],
    existingImages: [],
    lat: null,
    lng: null,
    date: new Date(),
  });
  const [editReportId, setEditReportId] = useState(null);
  const [editReportOwner, setEditReportOwner] = useState(false);
  const [expandedPosts, setExpandedPosts] = useState([]);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  // ⭐ NEW STATE FOR NOTIFICATION
  const [notification, setNotification] = useState(null); // { message: string, type: 'success' | 'error' | 'caution' }
  const [highlightedReportId, setHighlightedReportId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // Prevent double submissions
  const [isDeleting, setIsDeleting] = useState(false); // Delete loading state
  
  // ⭐ NEW STATE FOR REJECTION MODAL
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState(null);

  // Persistent error state (shows a non-transient message like Home.jsx)
  const [error, setError] = useState(null);

  // Overlay exited state for inline loading exit animation (matches Home.jsx behavior)
  const [overlayExited, setOverlayExited] = useState(false);

  // Mount animation: show a short cinematic opening when the page isn't already loading
  const [showMountAnimation, setShowMountAnimation] = useState(false);
  const [mountStage, setMountStage] = useState("exit");
  const loadingRef = useRef(loading);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  // Start a cinematic mount animation only if a real loading fetch is not already running.
  // We wait a short delay so that if `fetchReports` triggers quickly (setting `loading` to true)
  // we won't display the cinematic overlay and instead show the real loading state.
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
  // AI free attempts tracking (3 attempts free by default), persisted in localStorage
  const [aiAttemptsLeft, setAiAttemptsLeft] = useState(() => {
    try {
      const existing = localStorage.getItem('ai_free_attempts');
      return existing ? parseInt(existing, 10) : 3;
    } catch (e) {
      console.debug('ai attempts load error', e);
      return 3;
    }
  });
  const token = session?.token;

  // Helper to decrement an AI attempt and persist to localStorage
  const handleUseAiAttempt = () => {
    setAiAttemptsLeft((prev) => {
      const next = Math.max(0, prev - 1);
      try {
        localStorage.setItem('ai_free_attempts', String(next));
      } catch (err) {
        console.debug('ai attempts save error', err);
      }
      return next;
    });
  };

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
    // Reset overlay exit flag when starting a new loading cycle
    setOverlayExited(false);
    setError(null);
    setLoading(true);
    try {
      const res = await axios.get(
  getApiUrl(`/api/reports?sort=${sort === "latest" ? "desc" : "asc"}`),
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 30000 // 30 second timeout
        }
      );
      if (res.data.status === "success" && Array.isArray(res.data.reports)) {
        setReports(res.data.reports);
        console.log(`📊 Loaded ${res.data.reports.length} reports successfully`);
      } else {
        console.warn("Unexpected response format:", res.data);
        setReports([]);
        showNotification("Failed to load reports - invalid format", "error");
      }
    } catch (err) {
      console.error("Error fetching reports:", err);
      setError("Failed to load reports");
      if (err.code === 'ECONNABORTED') {
        showNotification("Request timed out - please try again", "error");
      } else if (err.response?.status >= 500) {
        showNotification("Server error - please try again later", "error");
      } else {
        showNotification("Failed to load reports", "error");
      }
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

  // ⭐ ORIGINAL KEYBOARD NAVIGATION EFFECT (FOR MODAL)
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
        }
        
        // Tab and Shift+Tab for focus trap (important for accessibility)
        if (e.key === 'Tab') {
          e.preventDefault();
          const currentIndex = focusableElementsRef.current.indexOf(document.activeElement);
          let nextIndex;
          if (e.shiftKey) {
            nextIndex = currentIndex === 0 ? focusableElementsRef.current.length - 1 : currentIndex - 1;
          } else {
            nextIndex = (currentIndex + 1) % focusableElementsRef.current.length;
          }
          focusableElementsRef.current[nextIndex]?.focus();
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
    // Prevent double submissions
    if (isSubmitting) {
      console.log("⚠️ Already submitting, ignoring duplicate request");
      return;
    }

    console.log("=== handleAddOrUpdateReport called ===");
    console.log("editReportId:", editReportId);
    console.log("newReport data:", newReport);
    
    setIsSubmitting(true);
    
    try {
      // ✅ VALIDATION: Check all required fields
      const requiredFields = {
        title: newReport.title?.trim(),
        description: newReport.description?.trim(),
        addressStreet: newReport.addressStreet?.trim(),
        barangay: newReport.barangay,
        category: newReport.category
      };

      // Check for empty required fields
      const emptyFields = Object.entries(requiredFields)
        .filter(([, value]) => !value || value === "")
        .map(([key]) => key);

      if (emptyFields.length > 0) {
        const fieldNames = emptyFields.map(field => {
          switch(field) {
            case 'addressStreet': return 'Street Address';
            case 'barangay': return 'Barangay';
            case 'category': return 'Category';
            default: return field.charAt(0).toUpperCase() + field.slice(1);
          }
        });
        showNotification(
          `Please fill in the following required fields: ${fieldNames.join(', ')}`,
          "caution"
        );
        return;
      }

      // ✅ VALIDATION: Check if barangay is selected (not "All")
      if (newReport.barangay === "All") {
        showNotification(
          "Please select a specific barangay.",
          "caution"
        );
        return;
      }

      // ✅ VALIDATION: Check if images are provided (required for new reports, optional for updates)
      if (!editReportId && (!newReport.images || newReport.images.length === 0)) {
        showNotification(
          "At least one image is required to submit a report.",
          "caution"
        );
        return;
      }
      const formData = new FormData();
      formData.append("title", newReport.title.trim());
      formData.append("description", newReport.description.trim());
      formData.append("category", newReport.category);
      formData.append("barangay", newReport.barangay);
      formData.append("addressStreet", newReport.addressStreet.trim());
      if (newReport.lat && newReport.lng) {
        formData.append("lat", newReport.lat);
        formData.append("lng", newReport.lng);
      }
      newReport.images.forEach((file) => formData.append("images", file));

      if (editReportId) {
        console.log("🔄 UPDATING existing report with ID:", editReportId);
        console.log("📝 FormData contents:");
        for (let pair of formData.entries()) {
          console.log(pair[0] + ': ' + pair[1]);
        }
        
  const response = await axios.put(getApiUrl(`/api/reports/${editReportId}`), formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });
        
        // Real-time update: Update the specific report in the list with complete data
        if (response.data.status === "success" && response.data.report) {
          const updatedReport = response.data.report;
          
          // Log verification status for debugging
          console.log("Updated report verification status:", {
            email: updatedReport.reporter?.isverified,
            full: updatedReport.reporter?.verified
          });
          
          setReports(prevReports => 
            prevReports.map(report => 
              report.id === editReportId 
                ? { 
                    ...updatedReport, // Use the complete updated report from backend
                    // Ensure reporter info is properly updated with current verification status
                    reporter: updatedReport.reporter || report.reporter,
                    images: updatedReport.images || [],
                    updated_at: updatedReport.updated_at || new Date().toISOString()
                  }
                : report
            )
          );
        }
        showNotification("✓ Report updated successfully!", "success");
      } else {
        console.log("➕ CREATING new report");
        console.log("📝 FormData contents:");
        for (let pair of formData.entries()) {
          console.log(pair[0] + ': ' + pair[1]);
        }
        
  const response = await axios.post(getApiUrl(`/api/reports`), formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });
        
        // Real-time update: Add new report to the top of the list
        if (response.data.status === "success") {
          const newReport = response.data.report;
          console.log("=== New report received from backend ===");
          console.log("New report structure:", newReport);
          console.log("New report ID:", newReport.id);
          console.log("New report ID type:", typeof newReport.id);
          
          // Ensure the new report has the correct verification status
          if (newReport.reporter) {
            // The backend should have already set the correct verification status
            console.log("New report verification status:", {
              email: newReport.reporter.isverified,
              full: newReport.reporter.verified
            });
          }
          
          setReports(prevReports => {
            console.log("Adding new report to list. Current reports count:", prevReports.length);
            return [newReport, ...prevReports];
          });
        }
        showNotification("✓ Report submitted successfully!", "success");
      }

      console.log("=== Success! Cleaning up state ===");
      resetNewReport();
      setIsModalOpen(false);
      setEditReportId(null);
      // Remove fetchReports() call - no longer needed for real-time updates
    } catch (err) {
      console.error("Add/Update Error:", err);
      showNotification(
        "Failed to save report. Please check your connection and data.",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (report) => {
    console.log("=== handleEdit called ===");
    console.log("Report to edit:", report);
    console.log("Report has ID?", !!report.id);
    console.log("Report ID value:", report.id);
    console.log("Report ID type:", typeof report.id);
    console.log("Setting editReportId to:", report.id);
    
    if (!report.id) {
      console.error("❌ Cannot edit report - missing ID!");
      showNotification("Error: Cannot edit report - missing ID", "error");
      return;
    }
    
    setEditReportId(report.id);
    setEditReportOwner(String(report.user_id) === String(session?.user?.id));
    setNewReport({
      title: report.title || "",
      description: report.description || "",
      category: report.category || "Concern",
      barangay: report.address_barangay || "", // Use address_barangay from the report object, but don't default to "All"
      addressStreet: report.address_street || "",
      images: [],
      existingImages: report.images || [], // Store existing images separately
      lat: report.latitude || null,
      lng: report.longitude || null,
      date: report.created_at ? new Date(report.created_at) : new Date(),
    });
    setIsModalOpen(true);
    
    console.log("Edit state set - editReportId:", report.id);
  };

  const handleDelete = async () => {
    console.log("=== DELETE REPORT CALLED ===");
    console.log("Delete target:", deleteTarget);
    console.log("Delete target type:", typeof deleteTarget);
    console.log("Delete target ID:", deleteTarget?.id);
    console.log("Delete target ID type:", typeof deleteTarget?.id);
    
    if (!deleteTarget || !deleteTarget.id) {
      console.error("❌ Delete target or ID is missing:", deleteTarget);
      showNotification("Error: Cannot delete report - invalid ID", "error");
      return;
    }
    
    console.log("✅ Delete target validation passed");
    console.log("Report ID:", deleteTarget.id);
    console.log("Report title:", deleteTarget.title);
    
    setIsDeleting(true);
    
    try {
  const deleteUrl = getApiUrl(`/api/reports/${deleteTarget.id}`);
      console.log("🔗 Delete URL:", deleteUrl);
      console.log("🔑 Token exists:", !!token);
      
      // Use DELETE method for hard delete - send empty object as body with proper headers
      const response = await axios.delete(deleteUrl, { 
        data: {},
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        } 
      });
      
      console.log("✅ Delete response:", response.status, response.data);
      
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
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedPosts((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const resetNewReport = () => {
    setNewReport({
      title: "",
      description: "",
      category: "", // Start with empty selection to force user to choose
      barangay: "", // Start with empty selection to force user to choose
      addressStreet: "",
      images: [],
      existingImages: [],
      lat: null,
      lng: null,
      date: new Date(),
    });
  };

  // Correct toggle logic
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
          reportElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          // Remove highlight after scrolling
          setTimeout(() => setHighlightedReportId(null), 3000);
        }
      }, 500);
    }
  }, [reports]); // Depend on reports so it runs after reports are loaded

  const mainContent = (
    <div className={`reports-container ${overlayExited ? 'overlay-exited' : ''}`}>
      {notification && (
        <div className={`notif notif-${notification.type}`}>
          {notification.message}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {/* Header */}
      <div className="header-row animate-up">
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
      <div className="top-controls animate-up" ref={filterContainerRef}>
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
          <option value="Crime">Crime</option>
          <option value="Concern">Concern</option>
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
      <div className="reports-list animate-up">
        {!loading && filteredReports.length > 0 ? (
          filteredReports.map((report) => {
            const isExpanded = expandedPosts.includes(report.id);
            const isPending = report.is_approved === false;
            const isRejected = report.is_rejected === true;
            const displayDescription = isExpanded
              ? report.description
              : `${(report.description || "").slice(0, 130)}${
                  (report.description?.length || 0) > 130 ? "..." : ""
                }`;

            return (
              <div 
                key={report.id} 
                id={`report-${report.id}`}
                className={(isRejected ? 'report-rejected' : isPending ? 'report-pending' : `report-card ${highlightedReportId === String(report.id) ? 'highlighted-report' : ''}`) + ' animate-up'}
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
                    {/* Show rejection badge and icons if report is rejected */}
                    {isRejected && session?.user && String(report.user_id) === String(session.user.id) && (
                      <>
                        <span className="status-badge status-rejected">REJECTED</span>
                        <button
                          className="icon-btn question-btn"
                          onClick={() => {
                            setRejectionReason(report.rejection_reason);
                            setRejectionModalOpen(true);
                          }}
                          aria-label={`View rejection details for: ${report.title}`}
                          title="Rejection Details"
                        >
                          <FaQuestionCircle aria-hidden="true" />
                        </button>
                        <button
                          className="icon-btn delete-btn"
                          onClick={async () => {
                            try {
                              const response = await fetch(getApiUrl(`/api/reports/${report.id}`), {
                                method: 'DELETE',
                                headers: {
                                  'Authorization': `Bearer ${session?.token}`,
                                  'Content-Type': 'application/json'
                                }
                              });

                              if (!response.ok) {
                                throw new Error('Failed to delete report');
                              }

                              setReports(prevReports => prevReports.filter(r => r.id !== report.id));
                              showNotification('Report deleted', 'success');
                            } catch (error) {
                              console.error('Error deleting report:', error);
                              showNotification(`Failed to delete report: ${error.message}`, 'error');
                            }
                          }}
                          aria-label={`Delete rejected report: ${report.title}`}
                          title="Delete Report"
                        >
                          <FaTrashAlt aria-hidden="true" />
                        </button>
                      </>
                    )}

                    {/* Hide PENDING badge if is_approved is TRUE or report is rejected */}
                    {!(report.is_approved === true && report.status === "Pending") && !isRejected && (
                      <span
                        className={`status-badge status-${(
                          report.status || "pending"
                        ).toLowerCase()}`}
                      >
                        {report.status || "Pending"}
                      </span>
                    )}

                    {/* Show edit/delete for non-rejected reports only if user is owner */}
                    {!isRejected && session?.user &&
                      String(report.user_id) === String(session.user.id) && (
                        <>
                          <button
                            className="icon-btn edit-btn"
                            onClick={() => {
                              console.log("=== Edit button clicked ===");
                              console.log("Report to edit:", report);
                              console.log("Report object keys:", Object.keys(report));
                              console.log("Report ID:", report.id);
                              console.log("Report ID type:", typeof report.id);
                              handleEdit(report);
                            }}
                             aria-label={`Edit report: ${report.title}`}
                             title="Edit Report"
                          >
                            <FaEdit aria-hidden="true" />
                          </button>
                          <button
                            className="icon-btn delete-btn"
                            onClick={() => {
                              console.log("=== Delete button clicked ===");
                              console.log("Report to delete:", report);
                              console.log("Report object keys:", Object.keys(report));
                              console.log("Report ID:", report.id);
                              console.log("Report ID type:", typeof report.id);
                              console.log("Report title:", report.title);
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
                        src={getImageUrl(imgObj.url)}
                        alt={`Report evidence photo ${idx + 1}`}
                        className="report-collage-img"
                        onClick={() => setPreviewImage(getImageUrl(imgObj.url))}
                        tabIndex="0"
                        loading="lazy"
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPreviewImage(getImageUrl(imgObj.url)); }}
                        onError={(e) => {
                          console.error(`Failed to load image: ${getImageUrl(imgObj.url)}`);
                          e.target.style.opacity = '0.5';
                          e.target.title = 'Failed to load image';
                        }}
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
        <div className="modal-overlay" onClick={() => {
          if (!isSubmitting) { // Only allow closing if not submitting
            console.log("=== Modal overlay clicked ===");
            console.log("Previous editReportId:", editReportId);
            setIsModalOpen(false);
            setEditReportId(null);
            setIsSubmitting(false);
            resetNewReport();
          }
        }}>
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            ref={modalRef}
          >
            <div className="modal-scrollable">
              <h3>{editReportId ? "Edit Report" : "Add New Report"}</h3>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
                Fields marked with <span style={{ color: 'red' }}>*</span> are required
              </p>

              <label>Title: <span style={{ color: 'red' }}>*</span></label>
              <input
                type="text"
                placeholder="Enter report title"
                value={newReport.title}
                onChange={(e) =>
                  setNewReport({ ...newReport, title: e.target.value })
                }
                tabIndex="0"
                required
              />

              <label>Description: <span style={{ color: 'red' }}>*</span></label>
              <textarea
                placeholder="Describe the incident in detail"
                value={newReport.description}
                onChange={(e) =>
                  setNewReport({ ...newReport, description: e.target.value })
                }
                tabIndex="0"
                required
              />

              <div className="address-fields">
                <label>Street Address: <span style={{ color: 'red' }}>*</span></label>
                <input
                  type="text"
                  placeholder="e.g. 45 Rizal Avenue"
                  value={newReport.addressStreet}
                  onChange={(e) =>
                    setNewReport({ ...newReport, addressStreet: e.target.value })
                  }
                  tabIndex="0"
                  required
                />
                <label>Barangay: <span style={{ color: 'red' }}>*</span></label>
                <select
                  value={newReport.barangay}
                  onChange={(e) =>
                    setNewReport({ ...newReport, barangay: e.target.value })
                  }
                  tabIndex="0"
                  required
                >
                  <option value="">Select a barangay</option>
                  {/* Filter "All Barangays" out of the form dropdown */}
                  {barangays.filter((b) => b !== "All Barangays").map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* AI Category Suggestions */}
              <label>Category: <span style={{ color: 'red' }}>*</span></label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: 'column' }}>
                <select
                value={newReport.category}
                onChange={(e) =>
                  setNewReport({ ...newReport, category: e.target.value })
                }
                tabIndex="0"
                required
              >
                <option value="">Select a category</option>
                <option value="Crime">Crime</option>
                <option value="Concern">Concern</option>
                <option value="Hazard">Hazard</option>
                <option value="Lost&Found">Lost & Found</option>
                <option value="Others">Others</option>
              </select>
                <AICategorySelector
                  description={newReport.description}
                  selectedCategory={newReport.category}
                  onSelectCategory={(category) =>
                    setNewReport({ ...newReport, category })
                  }
                  token={token}
                  /* Only allow the AI helper when the current user is the report owner.
                     For the 'Add New Report' modal this is always the case, and for
                     edits we pass owner status in the future if we add per-report owner checks. */
                  isOwner={editReportId ? editReportOwner : true}
                  /* Ensure user has provided required fields before AI selection */
                  allFieldsFilled={Boolean(newReport.title && newReport.description && newReport.barangay && newReport.addressStreet && ((newReport.images && newReport.images.length > 0) || (newReport.existingImages && newReport.existingImages.length > 0)))}
                  aiAttemptsLeft={aiAttemptsLeft}
                  onUseAI={handleUseAiAttempt}
                />
              </div>

              <div className="map-field">
                <label>
                  Pick Location on Map:{" "}
                  <span style={{ fontSize: "12px", color: "#999" }}>(Optional)</span>
                </label>

                {/* === Button to Get User Location === */}
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (position) => {
                          const { latitude, longitude } = position.coords;
                          // ✅ Replace manual picker with user's location
                          setNewReport({
                            ...newReport,
                            lat: latitude,
                            lng: longitude,
                          });
                        },
                        (error) => {
                          console.error("Geolocation error:", error);
                          alert("Unable to get your location. Please allow location access.");
                        }
                      );
                    } else {
                      alert("Geolocation is not supported by your browser.");
                    }
                  }}
                  style={{
                    backgroundColor: "#1976d2",
                    color: "#fff",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "13px",
                    marginBottom: "10px",
                  }}
                >
                  📍 Use My Current Location
                </button>

                {/* === Map Container === */}
                <MapContainer
                  center={[newReport.lat || 14.8477, newReport.lng || 120.2879]}
                  zoom={newReport.lat ? 16 : 13}
                  style={{ height: 250, width: "100%", marginBottom: 10 }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap contributors"
                  />

                  {/* ✅ Show a single marker (either GPS or manual pick) */}
                  {newReport.lat && newReport.lng && (
                    <Marker position={[newReport.lat, newReport.lng]} />
                  )}

                  <RecenterMap lat={newReport.lat} lng={newReport.lng} />

                  {/* ✅ Manual picker resets when GPS is used */}
                  <LocationPicker
                    setLocation={(latlng) =>
                      setNewReport({
                        ...newReport,
                        lat: latlng.lat,
                        lng: latlng.lng,
                      })
                    }
                    currentLocation={
                      newReport.lat && newReport.lng
                        ? { lat: newReport.lat, lng: newReport.lng }
                        : null
                    }
                  />
                </MapContainer>
              </div>

              {/* MODIFIED: Added tabIndex="0" to the label to make the upload button focusable */}
              <label 
                className="upload-btn"
                tabIndex="0" 
              >
                {editReportId ? "Replace Image(s)" : "Upload Image(s)"} {!editReportId && <span style={{ color: 'red' }}>*</span>}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    // Limit to 5 images total
                    const files = Array.from(e.target.files).slice(0, 5);
                    setNewReport((prev) => ({ ...prev, images: files }));
                  }}
                  hidden
                  required={!editReportId}
                />
              </label>
              {!editReportId && (
                <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  At least one image is required for new reports
                </p>
              )}

              {/* Show existing images when editing */}
              {editReportId && newReport.images.length === 0 && (
                <div>
                  {newReport.existingImages && newReport.existingImages.length > 0 ? (
                    <>
                      <p style={{ fontSize: '12px', color: '#666', margin: '5px 0' }}>Current Images:</p>
                      <div
                        className={`report-images images-${newReport.existingImages.length}`}
                      >
                        {newReport.existingImages.map((imgObj, idx) => (
                          <img
                            key={`existing-${idx}`}
                            src={getImageUrl(imgObj.url)}
                            alt={`existing-${idx}`}
                            className="report-collage-img"
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    <p style={{ fontSize: '12px', color: '#999', margin: '5px 0', fontStyle: 'italic' }}>
                      No images currently attached to this report.
                    </p>
                  )}
                </div>
              )}

              {/* Show new images when files are selected */}
              {newReport.images && newReport.images.length > 0 && (
                <div>
                  <p style={{ fontSize: '12px', color: '#666', margin: '5px 0' }}>
                    {editReportId ? "New Images (will replace current):" : "Selected Images:"}
                  </p>
                  <div
                    className={`report-images images-${newReport.images.length}`}
                  >
                    {newReport.images.map((file, idx) => (
                      <img
                        key={`new-${idx}`}
                        src={
                          typeof file === "string"
                            ? file
                            : URL.createObjectURL(file)
                        }
                        alt={`preview-${idx}`}
                        className="report-collage-img"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-buttons">
              <button
                onClick={() => {
                  console.log("=== Cancel button clicked ===");
                  console.log("Previous editReportId:", editReportId);
                  setIsModalOpen(false);
                  setEditReportId(null);
                  setIsSubmitting(false); // Reset submission state
                  resetNewReport(); // Reset fields on cancel
                }}
                tabIndex="0"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                onClick={handleAddOrUpdateReport}
                tabIndex="0"
                disabled={isSubmitting}
                style={{ opacity: isSubmitting ? 0.6 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
              >
                {isSubmitting ? 'Submitting...' : (editReportId ? "Update" : "Submit")}
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
            onClick={() => {
              if (!isDeleting) {
                setIsDeleteConfirmOpen(false);
              }
            }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 id="delete-modal-title">Delete Report</h3>
            <p>
              Are you sure you want to delete "<strong>{deleteTarget?.title}</strong>"?
            </p>
            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={() => {
                  if (!isDeleting) {
                    setIsDeleteConfirmOpen(false);
                  }
                }}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                className="confirm-btn"
                onClick={handleDelete} 
                autoFocus
                disabled={isDeleting}
                style={{ 
                  opacity: isDeleting ? 0.6 : 1, 
                  cursor: isDeleting ? 'not-allowed' : 'pointer' 
                }}
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Preview */}
      {/* Rejection Reason Modal */}
      {rejectionModalOpen && (
        <div 
          className="modal-overlay rejection-modal-overlay"
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="rejection-modal-title"
          onClick={() => setRejectionModalOpen(false)}
        >
          <div className="rejection-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="rejection-modal-header">
              <h3 id="rejection-modal-title">Report Rejection Details</h3>
              <button
                className="close-modal-btn"
                onClick={() => setRejectionModalOpen(false)}
                aria-label="Close rejection modal"
                title="Close"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className="rejection-modal-body">
              <div className="rejection-reason-section">
                <h4>Reason for Rejection</h4>
                <p className="rejection-reason-text">
                  {rejectionReason || 'Your report violated our community guidelines.'}
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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Image */}
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
    </div>
  );

  const loadingFeatures = [
    {
      title: "Incident Reporting",
      description:
        "Submit safety incidents with location, photos, and details.",
    },
    {
      title: "Report Tracking",
      description:
        "Monitor the status and updates of your submitted reports.",
    },
    {
      title: "Nearby Incidents",
      description:
        "View real-time incidents around your area on the map.",
    },
    {
      title: "Barangay Reports",
      description:
        "Browse and monitor barangay-level reports.",
    },
    {
      title: "Report Notifications",
      description:
        "Receive alerts for report progress, approvals, and community updates.",
    },
  ];

  const effectiveStage = showMountAnimation ? mountStage : (loading ? "loading" : "exit");

  const handleLoadingExited = () => {
    // When the overlay has exited, mark overlayExited so the UI can animate content in.
    setShowMountAnimation(false);
    setOverlayExited(true);
  };

  return (
    <LoadingScreen
      variant="inline"
      features={loadingFeatures}
      title={loading ? "Loading reports..." : undefined}
      subtitle={loading ? "Fetching latest reports and resources" : undefined}
      stage={effectiveStage}
      onExited={handleLoadingExited}
      inlineOffset="25vh"
      successDuration={900}
    >
      {mainContent}
    </LoadingScreen>
  );
}

export default Reports;