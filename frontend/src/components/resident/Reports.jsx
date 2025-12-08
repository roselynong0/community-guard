import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import axios from "axios";
import {
  FaEdit,
  FaTrashAlt,
  FaSearch,
  FaRedo,
  FaCheckCircle,
  FaTimesCircle,
  FaQuestionCircle,
  FaTimes,
  FaChartLine,
  FaHeart,
  FaRegHeart,
  FaPlus,
  FaMinus,
  FaMapPin,
  FaFire,
  FaClock,
  FaStar,
  FaSyncAlt,
  FaUser,
  FaFlag } from "react-icons/fa";
import {
  MapContainer,
  TileLayer, Marker,
  useMap,
  useMapEvents } from "react-leaflet";
import { API_CONFIG, getApiUrl } from "../../utils/apiConfig";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./Reports.css";
import "../shared/Notification.css";
import LoadingScreen from "../shared/LoadingScreen";
import ModalPortal from "../shared/ModalPortal";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const getImageUrl = (imgUrl) => {
  if (imgUrl && imgUrl.startsWith('data:')) {
    return imgUrl;
  }
  if (imgUrl && imgUrl.startsWith('/api/')) {
    return `${API_CONFIG.BASE_URL}${imgUrl}`;
  }
  if (imgUrl) {
    return `${API_CONFIG.BASE_URL}${imgUrl}`;
  }
  return "/src/assets/placeholder.png";
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
  const [sort, setSort] = useState("latest"); // 'latest', 'oldest', 'trending', 'top'
  const [showMyReports, setShowMyReports] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  
  // ⭐ NEW: User's barangay for "From Your Barangay" section
  const [userBarangay, setUserBarangay] = useState(null);
  const [barangayReports, setBarangayReports] = useState([]); // Reports from user's barangay (excluding own)
  const [otherBarangayReports, setOtherBarangayReports] = useState([]); // Trending from other barangays
  
  // ⭐ NEW: Trending container state
  const [trendingExpanded, setTrendingExpanded] = useState(false); // Collapsed by default
  const [trendingTimeFilter, setTrendingTimeFilter] = useState("all"); // today, yesterday, this-month, all
  const [pendingExpanded, setPendingExpanded] = useState(false); // Show pending reports section
  
  // ⭐ User verification status - posting requires full verification (users_info.verified = true)
  const [userVerified, setUserVerified] = useState(false);

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
  const successTitle = "Reports Complete!";

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
  const token = session?.token;

  // ⭐ NOTIFICATION HANDLER FUNCTION
  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3000); // Notification disappears after 3 seconds
  };

  // ⭐ NEW: Fetch user's barangay from profile
  const fetchUserBarangay = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(
        getApiUrl(API_CONFIG.endpoints.profile),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.status === "success" && res.data?.profile) {
        const barangayValue = res.data.profile.address_barangay;
        if (barangayValue && barangayValue !== "No barangay selected") {
          setUserBarangay(barangayValue);
          console.log("📍 User barangay:", barangayValue);
        }
        // Check if user is fully verified (users_info.verified = true)
        // isverified = email verified, verified = full verification
        const isFullyVerified = res.data.profile.verified === true;
        setUserVerified(isFullyVerified);
      }
    } catch (err) {
      console.warn("Could not fetch user barangay:", err);
      setUserVerified(false);
    }
  }, [token]);

  // ⭐ NEW: Compute "From Your Barangay" reports with newsfeed algorithm
  // Shows trending reports from user's barangay (excluding own reports)
  useEffect(() => {
    if (!userBarangay || !reports.length || !session?.user?.id) {
      setBarangayReports([]);
      return;
    }

    // Time filter logic
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

    // Filter reports from user's barangay (INCLUDING your own!)
    // Community Involvement - shows ALL engaged reports to encourage participation
    const fromBarangay = reports.filter((r) => 
      r.address_barangay === userBarangay && 
      r.status !== "Resolved" &&
      r.deleted_at === null &&
      r.is_approved === true &&
      r.is_rejected !== true &&
      (r.reaction_count || 0) > 0 &&
      filterByTime(r.created_at)
    );

    // Apply trending algorithm: Community Awareness & Involvement
    // Score = (reactions * 15 + base_score + category_weight) / (days_old + 1)^0.8
    // Gentler decay keeps reports visible longer for stable trending
    const scored = fromBarangay.map((r) => {
      const createdAt = new Date(r.created_at || 0);
      const daysOld = Math.max(0, (now - createdAt) / (1000 * 60 * 60 * 24));
      
      // Engagement weights - higher for community interaction
      const severityWeight = { Crime: 4, Hazard: 3.5, Concern: 3, 'Lost&Found': 2, Others: 2 };
      const reactionBoost = (r.reaction_count || 0) * 15; // High weight for community engagement
      const baseScore = 5; // Base score ensures reports don't vanish suddenly
      const isOwnReport = String(r.user_id) === String(session.user.id);
      const engagement = reactionBoost + (severityWeight[r.category] || 2) + baseScore;
      
      // Very gentle time decay (0.8 exponent) - keeps trending stable
      const timeFactor = Math.pow(daysOld + 1, 0.8);
      const trendingScore = engagement / timeFactor;
      
      return { ...r, trendingScore, isUserBarangay: true, isOwnReport };
    });

    // Sort by trending score descending, limit to 5
    const trending = scored
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 5);

    setBarangayReports(trending);
    console.log(`🔥 ${trending.length} trending reports from ${userBarangay}`);
  }, [userBarangay, reports, session?.user?.id, trendingTimeFilter]);

  // ⭐ Compute trending reports from OTHER barangays
  useEffect(() => {
    if (!reports.length || !session?.user?.id) {
      setOtherBarangayReports([]);
      return;
    }

    // Time filter logic
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

    // Filter reports from OTHER barangays (INCLUDING your own reports!)
    // Community Awareness - shows engaged content from all barangays
    const fromOtherBarangays = reports.filter((r) => 
      r.address_barangay !== userBarangay && 
      r.status !== "Resolved" &&
      r.deleted_at === null &&
      r.is_approved === true &&
      r.is_rejected !== true &&
      r.address_barangay &&
      (r.reaction_count || 0) > 0 &&
      filterByTime(r.created_at)
    );

    // Apply trending algorithm: Community Awareness across barangays
    // Gentler decay keeps cross-barangay reports visible longer
    const scored = fromOtherBarangays.map((r) => {
      const createdAt = new Date(r.created_at || 0);
      const daysOld = Math.max(0, (now - createdAt) / (1000 * 60 * 60 * 24));
      
      const severityWeight = { Crime: 4, Hazard: 3.5, Concern: 3, 'Lost&Found': 2, Others: 2 };
      const reactionBoost = (r.reaction_count || 0) * 15; // High weight for community engagement
      const baseScore = 5; // Base score for stability
      const isOwnReport = String(r.user_id) === String(session.user.id);
      const engagement = reactionBoost + (severityWeight[r.category] || 2) + baseScore;
      
      const timeFactor = Math.pow(daysOld + 1, 0.8); // Very gentle decay
      const trendingScore = engagement / timeFactor;
      
      return { ...r, trendingScore, isUserBarangay: false, isOwnReport };
    });

    // Sort by trending score descending, limit to 5
    const trending = scored
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 5);

    setOtherBarangayReports(trending);
    console.log(`🌍 ${trending.length} trending reports from other barangays`);
  }, [userBarangay, reports, session?.user?.id, trendingTimeFilter]);

  // ⭐ Combine all trending reports (user's barangay first, then others)
  const allTrendingReports = useMemo(() => {
    // Combine and sort: user's barangay reports first (with pin), then others by score
    const combined = [...barangayReports, ...otherBarangayReports];
    // Sort by: isUserBarangay first, then by trendingScore
    return combined.sort((a, b) => {
      if (a.isUserBarangay && !b.isUserBarangay) return -1;
      if (!a.isUserBarangay && b.isUserBarangay) return 1;
      return b.trendingScore - a.trendingScore;
    });
  }, [barangayReports, otherBarangayReports]);

  // ✅ Fetch reports
  const fetchReports = useCallback(async () => {
    if (!token) return;
    // Reset overlay exit flag when starting a new loading cycle
    setOverlayExited(false);
    setError(null);
    setLoading(true);
    try {
      const res = await axios.get(
  getApiUrl(`/api/reports`),
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 30000 // 30 second timeout
        }
      );
      if (res.data.status === "success" && Array.isArray(res.data.reports)) {
        setReports(res.data.reports);
        console.log(`📊 Loaded ${res.data.reports.length} reports successfully`);
        
        if (res.data.reports.length > 0) {
          // Calculate animation duration: 100ms per card + 500ms for slide animation
          const animationDuration = (res.data.reports.length * 100) + 500;
          
          // Keep loading screen visible until all cards have animated in
          setTimeout(() => {
            setLoading(false);
          }, animationDuration);
        } else {
          // No reports, exit loading immediately to show "No reports found" message
          setLoading(false);
        }
      } else {
        console.warn("Unexpected response format:", res.data);
        setReports([]);
        showNotification("Failed to load reports - invalid format", "error");
        setLoading(false);
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
      setLoading(false);
    }
  }, [token]);

  // ✅ Run on mount & whenever token/sort changes
  useEffect(() => {
    fetchReports();
    fetchUserBarangay(); // Fetch user's barangay for "From Your Barangay" section
  }, [fetchReports, fetchUserBarangay]);

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
    setNewReport({
      title: report.title || "", // ⭐ Added: Fetch title on edit
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

  // Handle heart/like toggle for reports with OPTIMISTIC UI UPDATE
  const handleToggleLike = async (reportId) => {
    if (!session?.token) {
      showNotification("Please log in to like reports", "caution");
      return;
    }

    // Find the current report state
    const currentReport = reports.find(r => r.id === reportId);
    if (!currentReport) return;

    const wasLiked = currentReport.user_liked;
    const previousCount = currentReport.reaction_count || 0;

    // OPTIMISTIC UPDATE: Immediately update UI before API call
    setReports(prevReports => 
      prevReports.map(report => 
        report.id === reportId 
          ? { 
              ...report, 
              user_liked: !wasLiked,
              reaction_count: wasLiked ? Math.max(0, previousCount - 1) : previousCount + 1
            }
          : report
      )
    );

    try {
      const response = await fetch(getApiUrl(`/api/reports/${reportId}/react`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reaction_type: 'heart' })
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        // Sync with server response (in case of race conditions)
        setReports(prevReports => 
          prevReports.map(report => 
            report.id === reportId 
              ? { 
                  ...report, 
                  user_liked: data.action === 'added',
                  reaction_count: data.reaction_count
                }
              : report
          )
        );
      } else {
        // ROLLBACK: Revert optimistic update on failure
        setReports(prevReports => 
          prevReports.map(report => 
            report.id === reportId 
              ? { 
                  ...report, 
                  user_liked: wasLiked,
                  reaction_count: previousCount
                }
              : report
          )
        );
        showNotification("Failed to update reaction", "error");
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      // ROLLBACK: Revert optimistic update on error
      setReports(prevReports => 
        prevReports.map(report => 
          report.id === reportId 
            ? { 
                ...report, 
                user_liked: wasLiked,
                reaction_count: previousCount
              }
            : report
        )
      );
      showNotification("Failed to update reaction", "error");
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

  // Get user's pending reports count
  const userPendingReports = useMemo(() => {
    return reports.filter(r => 
      r.is_approved === false && 
      !r.is_rejected && 
      String(r.user_id) === String(session?.user?.id)
    );
  }, [reports, session?.user?.id]);

  // Correct toggle logic
  const filteredReports = reports
    .filter((r) => r.deleted !== true) 
    .filter((r) => r.status !== "Resolved") // Exclude resolved reports - they go to Archived
    .filter((r) => {
      // Always show user's own reports if they are pending (is_approved=false) or rejected
      const isOwnReport = String(r.user_id) === String(session?.user?.id);
      const isPendingApproval = r.is_approved === false;
      const isRejected = r.is_rejected === true;
      
      // If it's user's own pending/rejected report, always show it
      if (isOwnReport && (isPendingApproval || isRejected)) {
        return true;
      }
      
      // For other reports, only show approved ones (is_approved !== false)
      // This hides other users' pending reports from the feed
      if (!isOwnReport && isPendingApproval) {
        return false;
      }
      
      // Apply My Reports filter
      if (showMyReports) {
        return isOwnReport;
      }
      
      return true;
    })
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
    })
    .sort((a, b) => {
      // Sort by 'trending' = engagement + recency algorithm
      if (sort === 'trending') {
        const now = new Date();
        const scoreA = ((a.reaction_count || 0) * 2) / Math.pow((now - new Date(a.created_at)) / 3600000 + 2, 1.3);
        const scoreB = ((b.reaction_count || 0) * 2) / Math.pow((now - new Date(b.created_at)) / 3600000 + 2, 1.3);
        return scoreB - scoreA;
      }
      // Sort by 'top' = most reactions/engagement first
      if (sort === "top") {
        const reactionsA = (a.reaction_count || 0);
        const reactionsB = (b.reaction_count || 0);
        // If same reactions, sort by recency
        if (reactionsB !== reactionsA) return reactionsB - reactionsA;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
      // Sort by 'latest' = newest first (default)
      if (sort === 'latest' || sort === null) {
        const isOwnA = String(a.user_id) === String(session?.user?.id);
        const isOwnB = String(b.user_id) === String(session?.user?.id);
        const aIsPending = a.is_approved === false && !a.is_rejected && isOwnA;
        const bIsPending = b.is_approved === false && !b.is_rejected && isOwnB;
        if (aIsPending && !bIsPending) return -1;
        if (!aIsPending && bIsPending) return 1;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
      // Sort by 'oldest' = oldest first
      if (sort === 'oldest') {
        const isOwnA = String(a.user_id) === String(session?.user?.id);
        const isOwnB = String(b.user_id) === String(session?.user?.id);
        const aIsPending = a.is_approved === false && !a.is_rejected && isOwnA;
        const bIsPending = b.is_approved === false && !b.is_rejected && isOwnB;
        if (aIsPending && !bIsPending) return -1;
        if (!aIsPending && bIsPending) return 1;
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      }
      // Default fallback
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

  // 👇 NEW HANDLER TO RESET ALL FILTERS
  const handleResetFilters = () => {
    setSearch("");
    setCategory("All");
    setBarangay("All Barangays");
    setAppliedSearch("");
    setAppliedCategory("All");
    setAppliedBarangay("All Barangays");
    setSort(null);
    setTrendingExpanded(false);
    setPendingExpanded(false);
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

      {error && <p className="error">{error}</p>}

      {/* Header */}
      <div className="header-row">
        <h2><FaFlag className="header-icon" /> Community Reports</h2>
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
          <FaSearch className="search-icon" aria-hidden="true" />
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
          value={sort || 'latest'} 
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
            className={`add-btn ${!userVerified ? 'disabled' : ''}`}
            onClick={() => {
              if (!userVerified) {
                showNotification("Please complete your profile verification to submit reports", "caution");
                return;
              }
              resetNewReport();
              setEditReportId(null);
              setIsModalOpen(true);
            }}
            tabIndex="0"
            disabled={!userVerified}
            title={!userVerified ? 'Please complete your profile verification to submit reports' : 'Submit a new report'}
          >
            + Add Report
          </button>
          {!userVerified && (
            <span className="verification-hint" title="Complete profile verification to submit reports">
              🔒 Verification Required
            </span>
          )}
        </div>
      </div>

      {/* ⭐ Pill Button Row: Trending, Pending, Top */}
      {!showMyReports && (
        <div className="trending-pill-row">
          {/* Trending Pill - Toggle sort */}
          <button
            className={`trending-pill-btn ${sort === 'trending' ? 'active' : ''} ${allTrendingReports.length === 0 ? 'empty' : ''}`}
            data-count={allTrendingReports.length}
            onClick={() => {
              if (sort === 'trending') {
                setSort(null);
                setTrendingExpanded(false);
              } else {
                setSort('trending');
                setTrendingExpanded(true);
              }
            }}
            title={sort === 'trending' ? 'Turn off trending sort' : 'Sort by trending'}
          >
            <FaFire className="trending-pill-icon" />
            <span className="pill-text">Trending ({allTrendingReports.length})</span>
            {sort === 'trending' ? <FaMinus className="trending-pill-toggle" /> : <FaPlus className="trending-pill-toggle" />}
          </button>
          
          {/* Pending Pill - Show user's pending reports */}
          <button
            className={`pending-pill-btn ${pendingExpanded ? 'active' : ''} ${userPendingReports.length === 0 ? 'empty' : ''}`}
            data-count={userPendingReports.length}
            onClick={() => setPendingExpanded(!pendingExpanded)}
            title={pendingExpanded ? 'Hide pending reports' : 'Show your pending reports'}
          >
            <FaClock className="pending-pill-icon" />
            <span className="pill-text">Pending ({userPendingReports.length})</span>
            {pendingExpanded ? <FaMinus className="pending-pill-toggle" /> : <FaPlus className="pending-pill-toggle" />}
          </button>

          {/* Top Pill - Toggle sort */}
          <button
            className={`top-pill-btn ${sort === 'top' ? 'active' : ''}`}
            onClick={() => setSort(sort === 'top' ? null : 'top')}
            title={sort === 'top' ? 'Turn off top sort' : 'Sort by most engagement'}
          >
            <FaStar className="top-pill-icon" />
            <span className="pill-text">Top</span>
          </button>
        </div>
      )}

      {/* ⭐ Trending Reports Section - Collapsible */}
      {!showMyReports && trendingExpanded && (
        <div className={`feed-trending-container expanded ${allTrendingReports.length === 0 ? 'empty' : ''}`}>
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
          
          {allTrendingReports.length > 0 ? (
            <div className="feed-trending-list">
              {allTrendingReports.map((report) => (
                <div 
                  key={`trending-${report.id}`} 
                  className={`feed-trending-card ${report.isUserBarangay ? 'from-your-barangay' : ''} ${report.isOwnReport ? 'your-report' : ''}`}
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
                  {/* Badge for user's barangay or own report */}
                  {report.isOwnReport ? (
                    <div className="your-report-badge">
                      <FaUser /> Your Report
                    </div>
                  ) : report.isUserBarangay ? (
                    <div className="your-barangay-badge">
                      <FaMapPin /> Your Barangay
                    </div>
                  ) : null}
                  
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

      {/* ⭐ Pending Reports Section - Shows user's pending reports */}
      {!showMyReports && pendingExpanded && userPendingReports.length > 0 && (
        <div className="feed-pending-container expanded">
          <div className="feed-pending-header">
            <h3><FaClock className="feed-pending-icon" /> Your Pending Reports</h3>
          </div>
          <div className="feed-pending-list">
            {userPendingReports.map((report) => (
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
      {!showMyReports && pendingExpanded && userPendingReports.length === 0 && (
        <div className="feed-pending-container expanded empty">
          <div className="feed-pending-empty">
            <FaClock className="empty-icon" />
            <p>No pending reports</p>
            <span>All your reports have been reviewed</span>
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      <div className="reports-list">
        {/* Show reports during loading if they exist (they'll animate in) */}
        {filteredReports.length > 0 ? (
          filteredReports.map((report, index) => {
            const isExpanded = expandedPosts.includes(report.id);
            const isPending = report.is_approved === false;
            const isRejected = report.is_rejected === true;
            const displayDescription = isExpanded
              ? report.description
              : `${(report.description || "").slice(0, 130)}${
                  (report.description?.length || 0) > 130 ? "..." : ""
                }`;

            const cardClasses = ["report-card"];
            if (highlightedReportId === String(report.id)) {
              cardClasses.push("highlighted-report");
            }
            if (isRejected) {
              cardClasses.push("report-rejected");
            } else if (isPending) {
              cardClasses.push("report-pending");
            }

            return (
              <div 
                key={report.id} 
                id={`report-${report.id}`}
                className={cardClasses.join(" ")}
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
                                report.reporter.verified && report.reporter.isverified
                                  ? "fully-verified"
                                  : report.reporter.isverified
                                  ? "email-verified"
                                  : "email-only-verified"
                              }`}
                            >
                              {report.reporter.verified && report.reporter.isverified ? (
                                <><FaCheckCircle aria-hidden="true" />Fully Verified</>
                              ) : report.reporter.isverified ? (
                                <><FaCheckCircle aria-hidden="true" />Email Verified</>
                              ) : (
                                <><FaCheckCircle aria-hidden="true" />Email Verified</>
                              )}
                            </span>
                          </>
                        ) : (
                          <>
                            Unknown User
                            <span className="admin-verification-status email-only-verified">
                              <FaCheckCircle aria-hidden="true" />Email Verified
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

                    {/* Hide PENDING badge if is_approved is TRUE, only show when is_approved is FALSE */}
                    {!isRejected && (
                      isPending ? (
                        // Show PENDING badge only when is_approved is FALSE
                        <span className="status-badge status-pending">
                          {getStatusIcon("Pending")}
                          Pending
                        </span>
                      ) : (
                        // Show normal status badge for approved reports (not Pending status)
                        report.status !== "Pending" && (
                          <span
                            className={`status-badge status-${(report.status || "pending").toLowerCase()}`}
                          >
                            {getStatusIcon(report.status)}
                            {report.status}
                          </span>
                        )
                      )
                    )}

                    {/* Show edit/delete for non-rejected reports only if user is owner */}
                    {!isRejected && session?.user &&
                      String(report.user_id) === String(session.user.id) && (
                        <>
                          <button
                            className="report-action-btn report-update-btn"
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
                            <span>Update</span>
                          </button>
                          <button
                            className="report-action-btn report-delete-btn"
                            onClick={() => {
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
                            <span>Delete</span>
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

                {/* Heart/Like Button - Disabled for pending reports */}
                <div className="report-reactions">
                  <button
                    className={`reaction-btn heart-btn ${report.user_liked ? 'liked' : ''} ${isPending ? 'disabled' : ''}`}
                    onClick={() => !isPending && handleToggleLike(report.id)}
                    aria-label={isPending ? 'Liking disabled for pending reports' : (report.user_liked ? 'Unlike this report' : 'Like this report')}
                    title={isPending ? 'Liking disabled until report is approved' : (report.user_liked ? 'Unlike' : 'Like')}
                    disabled={isPending}
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
          // Only show "No reports found" when loading is complete AND there are no reports
          !loading && (
            <div className="no-reports" role="status">
              <FaChartLine style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem' }} />
              <p>No reports found.</p>
              <p className="muted">Active incidents will appear here.</p>
            </div>
          )
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <ModalPortal>
        <div className="portal-modal-overlay" onClick={() => {
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
            className="portal-modal wide" 
            onClick={(e) => e.stopPropagation()}
            ref={modalRef}
          >
            <div className="portal-modal-header">
              <h3>{editReportId ? "Edit Report" : "Add New Report"}</h3>
              <button 
                className="portal-modal-close"
                onClick={() => {
                  if (!isSubmitting) {
                    setIsModalOpen(false);
                    setEditReportId(null);
                    setIsSubmitting(false);
                    resetNewReport();
                  }
                }}
                aria-label="Close modal"
                title="Close"
                disabled={isSubmitting}
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>
            <div className="portal-modal-body">
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
                Fields marked with <span style={{ color: 'red' }}>*</span> are required
              </p>

              <label>Title: <span style={{ color: 'red' }}>*</span></label>
              <input
                className="reports-modal-input"
                type="text"
                placeholder="Enter report title"
                value={newReport.title}
                onChange={(e) =>
                  setNewReport({ ...newReport, title: e.target.value })
                }
                tabIndex="0"
                aria-required="true"
                required
              />

              <label>Description: <span style={{ color: 'red' }}>*</span></label>
              <textarea
                className="reports-modal-textarea"
                placeholder="Describe the incident in detail"
                value={newReport.description}
                onChange={(e) =>
                  setNewReport({ ...newReport, description: e.target.value })
                }
                tabIndex="0"
                rows={5}
                aria-required="true"
                required
              />

              <div className="address-fields">
                <label>Street Address: <span style={{ color: 'red' }}>*</span></label>
                <input
                  className="reports-modal-input"
                  type="text"
                  placeholder="e.g. 45 Rizal Avenue"
                  value={newReport.addressStreet}
                  onChange={(e) =>
                    setNewReport({ ...newReport, addressStreet: e.target.value })
                  }
                  tabIndex="0"
                  aria-required="true"
                  required
                />
                <label>Barangay: <span style={{ color: 'red' }}>*</span></label>
                <select
                  className="reports-modal-select"
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

              <label>Category: <span style={{ color: 'red' }}>*</span></label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: 'column' }}>
                <select
                  className="reports-modal-select"
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
                  className="use-location-btn"
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

            <div className="portal-modal-actions">
              <button
                className="cancel-btn"
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
                className="confirm-btn"
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
        </ModalPortal>
      )}

      {/* Delete Confirm Modal */}
      {isDeleteConfirmOpen && (
        <ModalPortal>
        <div 
            className="portal-modal-overlay"
            role="dialog" 
            aria-modal="true" 
            aria-labelledby="delete-modal-title"
            onClick={() => {
              if (!isDeleting) {
                setIsDeleteConfirmOpen(false);
              }
            }}
        >
          <div className="portal-modal delete-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="portal-modal-header">
              <h3 id="delete-modal-title">Delete Report</h3>
              <button 
                className="portal-modal-close"
                onClick={() => {
                  if (!isDeleting) {
                    setIsDeleteConfirmOpen(false);
                  }
                }}
                aria-label="Close modal"
                title="Close"
                disabled={isDeleting}
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>
            <div className="portal-modal-body">
              <p>
                Are you sure you want to delete "<strong>{deleteTarget?.title}</strong>"?
              </p>
            </div>
            <div className="portal-modal-actions">
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
                className="danger-btn"
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
        </ModalPortal>
      )}

      {/* Fullscreen Image Preview */}
      {/* Rejection Reason Modal */}
      {rejectionModalOpen && (
        <ModalPortal>
        <div 
          className="portal-modal-overlay"
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="rejection-modal-title"
          onClick={() => setRejectionModalOpen(false)}
        >
          <div className="portal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="portal-modal-header">
              <h3 id="rejection-modal-title">Report Rejection Details</h3>
              <button
                className="portal-modal-close"
                onClick={() => setRejectionModalOpen(false)}
                aria-label="Close rejection modal"
                title="Close"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className="portal-modal-body rejection-modal-body">
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
        </ModalPortal>
      )}

      {/* Preview Image */}
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
        </ModalPortal>
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
      successTitle={successTitle}
    >
      {mainContent}
    </LoadingScreen>
  );
}

export default Reports;