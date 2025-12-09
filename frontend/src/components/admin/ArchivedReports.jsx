import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import {
  FaSearch,
  FaRedo,
  FaCheckCircle,
  FaArchive,
  FaThLarge,
  FaList,
  FaFileCsv,
  FaFilePdf,
  FaDownload,
  FaMapMarkerAlt,
  FaHeart,
  FaFire,
  FaPlus,
  FaMinus,
  FaTimes,
} from "react-icons/fa";
import { API_CONFIG, getApiUrl } from "../../utils/apiConfig";
import "../resident/Reports.css";
import "./ArchivedReports.css";
import "./Admin-Reports.css";
import LoadingScreen from "../shared/LoadingScreen";
import ModalPortal from "../shared/ModalPortal";
const logoImg = /* @vite-ignore */ new URL('../../assets/logo.png', import.meta.url).href;

// ML Categorizer Priority Mapping - matches backend ml_categorizer.py CATEGORY_PRIORITY
const PRIORITY_COLORS = {
  Crime: { borderColor: '#c0392b', bgColor: '#fdedec', priority: 'Critical', label: '🔴 Critical', score: 10 },
  Hazard: { borderColor: '#d35400', bgColor: '#fef5e7', priority: 'High', label: '🟠 High', score: 8 },
  Concern: { borderColor: '#95a5a6', bgColor: '#ecf0f1', priority: 'Medium', label: '⚪ Medium', score: 5 },
  'Lost&Found': { borderColor: '#95a5a6', bgColor: '#ecf0f1', priority: 'Low', label: '⚪ Low', score: 2 },
  Others: { borderColor: '#95a5a6', bgColor: '#ecf0f1', priority: 'Low', label: '⚪ Low', score: 1 },
};

// Get priority style from category
const getPriorityStyle = (category) => {
  return PRIORITY_COLORS[category] || PRIORITY_COLORS['Others'];
};

// Get report priority - uses AI priority if available, falls back to category-based ML mapping
const getReportPriority = (report) => {
  // Use AI priority if available from backend
  if (report.ai_priority) {
    const pri = String(report.ai_priority).toLowerCase().trim();
    if (pri === 'critical') return 'Critical';
    if (pri === 'high') return 'High';
    if (pri === 'medium') return 'Medium';
    if (pri === 'low') return 'Low';
  }
  // Fallback to category-based priority from ML categorizer mapping
  const catPriority = getPriorityStyle(report.category);
  return catPriority.priority || 'Low';
};

// Hook for keyboard navigation
const useKeyboardNavigation = (containerRef, selector) => {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleArrowNavigation = (event) => {
      if (!container.contains(document.activeElement)) return;

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
        event.preventDefault();
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
  }, [containerRef, selector]);
};

function ArchivedReports({ session }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("latest");
  const [previewImage, setPreviewImage] = useState(null);
  const [expandedPosts, setExpandedPosts] = useState([]);
  const [error, setError] = useState(null);
  const [overlayExited, setOverlayExited] = useState(false);
  const [showMountAnimation, setShowMountAnimation] = useState(false);
  const [mountStage, setMountStage] = useState("exit");
  const loadingRef = useRef(loading);
  const successTitle = "Archives Synced!";
  const [viewMode, setViewMode] = useState("card"); // "card" or "list"

  // Applied filter states (for immediate filtering)
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedCategory, setAppliedCategory] = useState("All");

  // Export modal states
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState(null); // 'csv' or 'pdf'
  const [exportTimeFilter, setExportTimeFilter] = useState("all"); // 'today', 'this-week', 'this-month', 'all'
  const [exportColorMode, setExportColorMode] = useState('color'); // 'color' or 'bw'
  const [exportPageSize, setExportPageSize] = useState('A4'); // 'A4', 'Letter', 'Legal', 'Long'

  // Trending reports states
  const [trendingReports, setTrendingReports] = useState([]);
  const [trendingExpanded, setTrendingExpanded] = useState(true);
  const [trendingTimeFilter, setTrendingTimeFilter] = useState("this-month");

  const token = session?.token;
  const userRole = session?.user?.role;
  const userBarangay = session?.user?.address_barangay || session?.user?.barangay;
  const filterContainerRef = useRef(null);

  useKeyboardNavigation(filterContainerRef, 'input, select, button');

  // Check if user can export all reports (Admin only)
  const canExportAll = userRole === "Admin";
  // Barangay Officials and Responders can only export their barangay's reports
  const isBarangayOrResponder = userRole === "Barangay Official" || userRole === "Responder";

  const categories = [
    { value: "All", label: "All Categories" },
    { value: "Concern", label: "Concern" },
    { value: "Crime", label: "Crime" },
    { value: "Hazard", label: "Hazard" },
    { value: "Lost&Found", label: "Lost & Found" },
    { value: "Others", label: "Others" },
  ];

  const fetchArchivedReports = useCallback(async () => {
    if (!token) return;
    setOverlayExited(false);
    setError(null);
    setLoading(true);
    try {
      const res = await axios.get(
        getApiUrl(`/api/reports`),
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 30000
        }
      );
      if (res.data.status === "success" && Array.isArray(res.data.reports)) {
        const resolvedReports = res.data.reports
          .filter(r => r.status === "Resolved")
          .map(report => ({
            ...report,
            images: report.images?.map(img => img.url) || [],
            reaction_count: report.reaction_count || 0,
            user_liked: report.user_liked || false
          }));
        setReports(resolvedReports);
        console.log(`📦 Loaded ${resolvedReports.length} archived (resolved) reports`);
        
        if (resolvedReports.length > 0) {
          const animationDuration = (resolvedReports.length * 100) + 500;
          setTimeout(() => {
            setLoading(false);
          }, animationDuration);
        } else {
          setLoading(false);
        }
      } else {
        setReports([]);
        setLoading(false);
      }
    } catch (err) {
      console.error("Error fetching archived reports:", err);
      setError("Failed to load archived reports");
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchArchivedReports();
  }, [fetchArchivedReports]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  // Calculate trending reports for archived (resolved) reports
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

    // Filter reports based on barangay for non-admin users and time filter
    const eligibleReports = reports.filter((r) => {
      if (!filterByTime(r.created_at)) return false;
      if (canExportAll) return true;
      if (isBarangayOrResponder && userBarangay) {
        return r.address_barangay === userBarangay;
      }
      return true;
    });

    // Trending algorithm based on reaction count and recency
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
    console.log(`🔥 ${trending.length} trending archived reports`);
  }, [reports, trendingTimeFilter, canExportAll, isBarangayOrResponder, userBarangay]);

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

  const toggleExpand = (id) => {
    setExpandedPosts((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const filteredReports = reports
    .filter((r) => r.deleted !== true)
    .filter((r) => {
      if (canExportAll) return true; // Admin sees all
      if (isBarangayOrResponder && userBarangay) {
        return r.address_barangay === userBarangay;
      }
      return true; // Residents see all (but can only export their own filtered view)
    })
    .filter((r) => appliedCategory === "All" || r.category === appliedCategory)
    .filter((r) => {
      if (!appliedSearch) return true;
      const searchLower = appliedSearch.toLowerCase();
      return (r.title || "").toLowerCase().includes(searchLower);
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return sort === "latest" ? dateB - dateA : dateA - dateB;
    });

  // Helper function to filter reports by time period
  const filterReportsByTime = (reportsToFilter, timeFilter) => {
    if (timeFilter === "all") return reportsToFilter;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return reportsToFilter.filter((r) => {
      const reportDate = new Date(r.created_at);
      switch (timeFilter) {
        case "today":
          return reportDate >= today;
        case "this-week":
          return reportDate >= thisWeekStart;
        case "this-month":
          return reportDate >= thisMonthStart;
        default:
          return true;
      }
    });
  };

  // Get time period label for export filename
  const getTimeFilterLabel = (timeFilter) => {
    switch (timeFilter) {
      case "today": return "today";
      case "this-week": return "this_week";
      case "this-month": return "this_month";
      default: return "all_time";
    }
  };

  // Open export modal
  const openExportModal = (type) => {
    setExportType(type);
    setExportTimeFilter("all");
    setShowExportModal(true);
  };

  // Export to CSV with time filter
  const exportToCSV = (timeFilter = "all") => {
    const reportsToExport = filterReportsByTime(filteredReports, timeFilter);
    
    if (reportsToExport.length === 0) {
      alert("No reports found for the selected time period.");
      return;
    }
    
    const headers = [
      "ID",
      "Title",
      "Category",
      "Status",
      "Barangay",
      "Priority",
      "Likes",
      "Reporter",
      "Created At",
      "Resolved At",
      "Description"
    ];
    
    const csvRows = [headers.join(",")];
    
    reportsToExport.forEach((report) => {
      const priority = getReportPriority(report);
      const row = [
        report.id,
        `"${(report.title || "").replace(/"/g, '""')}"`,
        report.category || "",
        report.status || "",
        report.address_barangay || "",
        priority,
        report.reaction_count || 0,
        `"${report.reporter?.firstname || "Unknown"} ${report.reporter?.lastname || ""}"`,
        new Date(report.created_at).toLocaleString(),
        report.resolved_at ? new Date(report.resolved_at).toLocaleString() : "N/A",
        `"${(report.description || "").replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      ];
      csvRows.push(row.join(","));
    });
    
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    
    // Generate filename based on role and time filter
    const dateStr = new Date().toISOString().split("T")[0];
    const timeLabel = getTimeFilterLabel(timeFilter);
    let filename = `archived_reports_${timeLabel}_${dateStr}`;
    if (canExportAll) {
      filename = `all_archived_reports_${timeLabel}_${dateStr}`;
    } else if (isBarangayOrResponder && userBarangay) {
      const safeBarangay = userBarangay.replace(/\s+/g, '_').toLowerCase();
      filename = `archived_reports_${safeBarangay}_${timeLabel}_${dateStr}`;
    }
    link.download = `${filename}.csv`;
    link.click();
    setShowExportModal(false);
  };

  // Export to PDF with Community Helper AI Analytics
  const exportToPDF = async (timeFilter = "all", colorMode = 'color', pageSize = 'A4') => {
    const reportsToExport = filterReportsByTime(filteredReports, timeFilter);
    
    if (reportsToExport.length === 0) {
      alert("No reports found for the selected time period.");
      return;
    }
    
    // Create a printable HTML document
    const reportDate = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    
    // Calculate analytics from filtered reports
    const totalReports = reportsToExport.length;
    const categoryStats = {};
    const barangayStats = {};
    const priorityStats = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    let totalLikes = 0;
    
    reportsToExport.forEach((report) => {
      // Category stats
      const cat = report.category || "Unknown";
      categoryStats[cat] = (categoryStats[cat] || 0) + 1;
      
      // Barangay stats
      const brgy = report.address_barangay || "Unknown";
      barangayStats[brgy] = (barangayStats[brgy] || 0) + 1;
      
      // Priority stats - use ML-based getReportPriority for accurate categorization
      const priority = getReportPriority(report);
      priorityStats[priority] = (priorityStats[priority] || 0) + 1;
      
      // Total likes
      totalLikes += (report.reaction_count || 0);
    });
    
    // Sort stats by count
    const sortedCategories = Object.entries(categoryStats).sort((a, b) => b[1] - a[1]);
    const sortedBarangays = Object.entries(barangayStats).sort((a, b) => b[1] - a[1]);
    
    // Generate role-based report subtitle
    let reportSubtitle = "Archived Reports Analytics Report";
    if (canExportAll) {
      reportSubtitle = "All Barangays - Complete Analytics Report";
    } else if (isBarangayOrResponder && userBarangay) {
      reportSubtitle = `${userBarangay} - Barangay Analytics Report`;
    }
    
    // Logo (static import)
    const logoPath = logoImg;
    // Build color and page CSS based on user selection
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

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Community Guard - Archived Reports Analytics</title>
        <style>
          ${pageCss}
          ${colorCss}
        
          
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; }
          ${""}
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
          .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-bottom: 25px; }
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
          .priority-critical { color: #c0392b; font-weight: bold; }
          .priority-high { color: #d35400; font-weight: bold; }
          .priority-medium { color: #f59e0b; font-weight: bold; }
          .priority-low { color: #22c55e; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; padding-top: 20px; border-top: 2px solid #2d3b8f; }
          .footer-brand { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 8px; }
          .footer-brand img { width: 28px; height: 28px; object-fit: contain; }
          .footer-brand span { font-weight: 600; color: #2d3b8f; font-size: 14px; }
          .footer-tagline { color: #888; font-size: 11px; }
          .footer-subtitle { margin-top: 8px; font-size: 11px; color: #888; font-style: italic; }
          .ai-analysis { max-width: 200px; font-size: 10px; color: #666; }
          .implementation-phases { background: linear-gradient(135deg, #f8fafc, #eef2ff); padding: 20px; border-radius: 10px; margin-bottom: 25px; border: 1px solid #e5e7eb; }
          .implementation-phases h3 { color: #2d3b8f; margin-bottom: 15px; font-size: 14px; }
          .phase { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
          .phase-number { background: #2d3b8f; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
          .phase-text { font-size: 12px; }
          @media print { body { padding: 20px; } .stats-grid { grid-template-columns: repeat(5, 1fr); } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-logo">
            <img src="${logoPath}" alt="Community Guard Logo" onerror="this.style.display='none'" />
            <h1>Community Guard</h1>
          </div>
          <p class="subtitle">${reportSubtitle}</p>
          <div class="ai-badge">💡 Community Helper</div>
          <p style="margin-top: 10px; font-size: 13px; color: #666;">Generated: ${reportDate}</p>
        </div>
        
        <div class="section">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="number">${totalReports}</div>
              <div class="label">Total Archived Reports</div>
            </div>
            <div class="stat-card">
              <div class="number" style="color: #dc2626;">${priorityStats.Critical}</div>
              <div class="label">🔴 Critical Priority</div>
            </div>
            <div class="stat-card">
              <div class="number" style="color: #d35400;">${priorityStats.High}</div>
              <div class="label">🟠 High Priority</div>
            </div>
            <div class="stat-card">
              <div class="number" style="color: #f59e0b;">${priorityStats.Medium}</div>
              <div class="label">⚪ Medium Priority</div>
            </div>
            <div class="stat-card">
              <div class="number" style="color: #22c55e;">${priorityStats.Low}</div>
              <div class="label">⚪ Low Priority</div>
            </div>
          </div>
        </div>
        
        <div class="implementation-phases">
          <h3>📊 Community Guard Implementation Phases</h3>
          <div class="phase"><span class="phase-number">1</span><span class="phase-text">MVP Reporting App - Basic incident reporting and tracking</span></div>
          <div class="phase"><span class="phase-number">2</span><span class="phase-text">AI and GIS Integration - Smart categorization and mapping</span></div>
          <div class="phase"><span class="phase-number">3</span><span class="phase-text">IoT and Predictive Analytics - Advanced monitoring</span></div>
          <div class="phase"><span class="phase-number">4</span><span class="phase-text">Full Citywide Deployment - Complete coverage</span></div>
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
        
        ${totalLikes > 0 ? `
        <div class="section">
          <h2 class="section-title">🔥 Community Engagement - Top Archived Reports</h2>
          <div class="stats-grid" style="grid-template-columns: 1fr 1fr;">
            <div class="stat-card">
              <div class="number" style="color: #ef4444;">${totalLikes}</div>
              <div class="label">Total Likes</div>
            </div>
            <div class="stat-card">
              <div class="number" style="color: #f59e0b;">${reportsToExport.filter(r => (r.reaction_count || 0) > 0).length}</div>
              <div class="label">Reports with Engagement</div>
            </div>
          </div>
          <div class="analytics-card" style="margin-top: 15px;">
            <h3>❤️ Most Liked Archived Reports</h3>
            ${reportsToExport.sort((a, b) => (b.reaction_count || 0) - (a.reaction_count || 0)).slice(0, 5).filter(r => (r.reaction_count || 0) > 0).map((r) => `
              <div class="analytics-item">
                <span class="name">${r.title?.substring(0, 40) || "Untitled"}${r.title?.length > 40 ? '...' : ''}</span>
                <span class="count">${r.reaction_count || 0} ❤️</span>
              </div>
            `).join("")}
          </div>
        </div>
        ` : ''}
        
        <div class="section" style="background: linear-gradient(135deg, #f0f4ff, #e8f0fe); padding: 25px; border-radius: 12px; border: 1px solid #3b82f6;">
          <h2 class="section-title" style="border-bottom-color: #3b82f6;">🤖 Community Helper - AI Analysis & Recommendations</h2>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid ${priorityStats.Critical > 0 ? '#dc2626' : '#22c55e'};">
              <h4 style="color: #1e293b; margin-bottom: 10px;">📊 Archive Summary</h4>
              <p style="font-size: 13px; color: #475569; line-height: 1.5;">
                ${totalReports} resolved reports archived. 
                ${priorityStats.Critical > 0 ? `<strong style="color: #dc2626;">🔴 ${priorityStats.Critical} Critical</strong> priority cases resolved. ` : ''}
                ${priorityStats.High > 0 ? `<strong style="color: #d35400;">🟠 ${priorityStats.High} High</strong> priority. ` : ''}
                ${priorityStats.Medium > 0 ? `<strong style="color: #f59e0b;">${priorityStats.Medium} Medium</strong>. ` : ''}
                ✅ All reports successfully resolved.
              </p>
            </div>
            
            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
              <h4 style="color: #1e293b; margin-bottom: 10px;">📈 Historical Trends</h4>
              <p style="font-size: 13px; color: #475569; line-height: 1.5;">
                ${sortedCategories.length > 0 ? `Most resolved category: <strong>${sortedCategories[0][0]}</strong> (${sortedCategories[0][1]} reports, ${((sortedCategories[0][1] / totalReports) * 100).toFixed(0)}%). ` : ''}
                ${totalLikes > 0 ? `Total community engagement: ${totalLikes} reactions on archived reports.` : 'Historical data preserved for future reference.'}
              </p>
            </div>
          </div>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #8b5cf6;">
            <h4 style="color: #1e293b; margin-bottom: 10px;">💡 Insights & Recommendations</h4>
            <ul style="font-size: 13px; color: #475569; line-height: 1.8; margin-left: 20px;">
              ${priorityStats.Critical > 0 ? `<li><strong>🔴 Critical Cases Resolved:</strong> ${priorityStats.Critical} critical priority reports (Crime-related) were successfully resolved.</li>` : ''}
              ${sortedBarangays.length > 0 && sortedBarangays[0][1] > totalReports * 0.25 ? `<li><strong>Historical Hotspot:</strong> ${sortedBarangays[0][0]} had ${sortedBarangays[0][1]} resolved reports (${((sortedBarangays[0][1] / totalReports) * 100).toFixed(0)}%). Monitor for recurring issues.</li>` : ''}
              ${categoryStats['Crime'] && categoryStats['Crime'] > totalReports * 0.2 ? `<li><strong>Crime Resolution:</strong> ${categoryStats['Crime']} crime reports were successfully resolved. Continue coordination with law enforcement.</li>` : ''}
              ${categoryStats['Hazard'] && categoryStats['Hazard'] > totalReports * 0.2 ? `<li><strong>Hazard Mitigation:</strong> ${categoryStats['Hazard']} hazard reports addressed. Review for infrastructure improvement opportunities.</li>` : ''}
              ${totalLikes > 0 && reportsToExport.filter(r => (r.reaction_count || 0) >= 5).length > 0 ? `<li><strong>Community Impact:</strong> ${reportsToExport.filter(r => (r.reaction_count || 0) >= 5).length} high-engagement reports show strong community involvement.</li>` : ''}
              <li><strong>Archive Review:</strong> Periodically review archived reports to identify patterns and improve future response strategies.</li>
            </ul>
          </div>
          
          <p style="font-size: 11px; color: #64748b; margin-top: 15px; text-align: center; font-style: italic;">
            This analysis is based on report data patterns. Always verify insights with local knowledge.
          </p>
        </div>
        
        <div class="section">
          <h2 class="section-title">📋 Detailed Report List</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Category</th>
                <th>Barangay</th>
                <th>Priority</th>
                <th>Likes</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              ${reportsToExport.map((report) => {
                const priority = getReportPriority(report);
                return `
                <tr>
                  <td>${report.id}</td>
                  <td>${report.title || "Untitled"}</td>
                  <td>${report.category || "N/A"}</td>
                  <td>${report.address_barangay || "N/A"}</td>
                  <td class="priority-${priority.toLowerCase()}">${priority}</td>
                  <td>${report.reaction_count || 0} ❤️</td>
                  <td>${new Date(report.created_at).toLocaleDateString()}</td>
                </tr>
              `}).join("")}
            </tbody>
          </table>
        </div>
        
        <div class="footer">
          <div class="footer-brand">
            <img src="${logoPath}" alt="Community Guard Logo" onerror="this.style.display='none'" />
            <span>Community Guard</span>
          </div>
          <p class="footer-tagline">Protecting Communities Together</p>
        </div>
      </body>
      </html>
    `;
    
    const printWindow = window.open("", "_blank");
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
    setShowExportModal(false);
  };

  useEffect(() => {
    setAppliedSearch(search);
  }, [search]);

  useEffect(() => {
    setAppliedCategory(category);
  }, [category]);

  // Main content
  const mainContent = (
    <>
      {/* Header */}
      <div className="reports-header archived-header">
        <div className="header-left">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FaArchive /> Archived Reports
            {isBarangayOrResponder && userBarangay && (
              <span style={{ fontSize: '0.6em', color: '#666', fontWeight: 'normal' }}>
                ({userBarangay})
              </span>
            )}
          </h2>
        </div>
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
          
          {/* Export Buttons - Opens time filter modal */}
          <div className="export-buttons">
            <button
              className="export-btn csv"
              onClick={() => openExportModal('csv')}
              title="Export to CSV"
              aria-label="Export reports to CSV"
            >
              <FaFileCsv /> CSV
            </button>
            <button
              className="export-btn pdf"
              onClick={() => openExportModal('pdf')}
              title="Export to PDF with Analytics"
              aria-label="Export reports to PDF with AI analytics"
            >
              <FaFilePdf /> PDF
            </button>
          </div>
        </div>
      </div>

      {/* Trending Archived Reports Section */}
      {trendingReports.length > 0 && (
        <div className="trending-section" style={{
          background: 'linear-gradient(135deg, #fff5f5 0%, #fffaf0 100%)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
          border: '1px solid #fed7aa'
        }}>
          <div className="trending-header" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: trendingExpanded ? '12px' : '0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FaFire style={{ color: '#f97316', fontSize: '1.2em' }} />
              <span style={{ fontWeight: '600', color: '#ea580c' }}>
                Top Archived Reports
              </span>
              <span style={{ 
                fontSize: '0.75em', 
                background: '#fed7aa', 
                color: '#c2410c', 
                padding: '2px 8px', 
                borderRadius: '10px' 
              }}>
                {trendingReports.length}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={trendingTimeFilter}
                onChange={(e) => setTrendingTimeFilter(e.target.value)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #fed7aa',
                  background: 'white',
                  fontSize: '0.85em'
                }}
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="this-month">This Month</option>
              </select>
              <button
                onClick={() => setTrendingExpanded(!trendingExpanded)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#ea580c'
                }}
              >
                {trendingExpanded ? <FaMinus /> : <FaPlus />}
              </button>
            </div>
          </div>
          
          {trendingExpanded && (
            <div className="trending-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {trendingReports.map((report, idx) => (
                <div
                  key={report.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    background: 'white',
                    borderRadius: '8px',
                    border: '1px solid #fde68a'
                  }}
                >
                  <span style={{
                    fontWeight: 'bold',
                    color: idx === 0 ? '#f97316' : '#9ca3af',
                    fontSize: '0.9em',
                    minWidth: '20px'
                  }}>
                    #{idx + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '500', fontSize: '0.9em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {report.title || 'Untitled Report'}
                    </div>
                    <div style={{ fontSize: '0.75em', color: '#6b7280' }}>
                      {report.category} · {report.address_barangay}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444' }}>
                    <FaHeart style={{ fontSize: '0.85em' }} />
                    <span style={{ fontSize: '0.85em', fontWeight: '500' }}>{report.reaction_count || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Top Controls - Matching BarangayReports */}
      <div className="archived-top-controls" ref={filterContainerRef}>
        <div className="archived-search-container">
          <input
            type="text"
            className="archived-search-input"
            placeholder="Search archived reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search archived reports"
          />
          <FaSearch className="archived-search-icon" aria-hidden="true" />
        </div>

        <select
          className="archived-filter-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
        >
          {categories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>

        <select
          className="archived-filter-select"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort reports"
        >
          <option value="latest">Latest → Oldest</option>
          <option value="oldest">Oldest → Latest</option>
        </select>
      </div>

      {/* Reports List */}
      <div className="reports-list">
        {filteredReports.length > 0 ? (
          viewMode === 'card' ? (
            // Card View - Exact match to BarangayReports
            filteredReports.map((report, index) => {
              const isExpanded = expandedPosts.includes(report.id);

              return (
                <div
                  key={report.id}
                  id={`report-${report.id}`}
                  className="report-card"
                  style={{
                    animationDelay: `${index * 0.1}s`,
                    position: 'relative',
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
                              {`${report.reporter.firstname || ""} ${report.reporter.lastname || ""}`.trim()}{" "}
                              <span
                                className={`admin-verification-status ${
                                  report.reporter.verified ? "fully-verified" : "unverified"
                                }`}
                              >
                                {report.reporter.verified ? (
                                  <><FaCheckCircle aria-hidden="true" />Verified</>
                                ) : (
                                  <><FaCheckCircle aria-hidden="true" />Unverified</>
                                )}
                              </span>
                            </>
                          ) : (
                            <>
                              Unknown User{" "}
                              <span className="admin-verification-status unverified">
                                <FaCheckCircle aria-hidden="true" />Unverified
                              </span>
                            </>
                          )}
                        </p>
                        <p className="report-subinfo">
                          {report.created_at
                            ? new Date(report.created_at).toLocaleString()
                            : ""}
                          {" "}· {report.category}
                        </p>
                        <p className="report-address-info">
                          {report.address_street || ""}, {report.address_barangay || ""}, Olongapo City
                        </p>
                      </div>
                    </div>
                    <div className="report-header-actions">
                      <span className="status-tag status-resolved"><FaCheckCircle /> Resolved</span>
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

                  {/* Like Count Display (disabled - resolved status) */}
                  <div className="report-reactions" style={{ padding: '8px 0' }}>
                    <div
                      className="reaction-display"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: '#9ca3af',
                        fontSize: '0.9em',
                        cursor: 'default'
                      }}
                      title="Likes are disabled for resolved reports"
                    >
                      <FaHeart style={{ color: '#ef4444', opacity: 0.6 }} />
                      <span>{report.reaction_count || 0} likes</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            // List View
            <div className="archived-list-table">
              <div className="list-header">
                <div className="list-col col-image">Image</div>
                <div className="list-col col-title">Title</div>
                <div className="list-col col-category">Category</div>
                <div className="list-col col-barangay">Barangay</div>
                <div className="list-col col-priority">Priority</div>
                <div className="list-col col-reporter">Reporter</div>
                <div className="list-col col-date">Date</div>
                <div className="list-col col-status">Status</div>
                <div className="list-col col-likes" style={{ width: '60px', textAlign: 'center' }}>Likes</div>
              </div>
              {filteredReports.map((report, index) => (
                <div 
                  key={report.id} 
                  className="list-row"
                  onClick={() => toggleExpand(report.id)}
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
                        <FaArchive />
                      </div>
                    )}
                  </div>
                  <div className="list-col col-title">
                    <span className="list-title">{report.title || "Untitled"}</span>
                    {expandedPosts.includes(report.id) && (
                      <p className="list-description">{report.description}</p>
                    )}
                  </div>
                  <div className="list-col col-category">
                    <span className="category-tag">{report.category || "N/A"}</span>
                  </div>
                  <div className="list-col col-barangay">{report.address_barangay || "N/A"}</div>
                  <div className="list-col col-priority">
                    <span className={`priority-tag priority-${(report.priority || "low").toLowerCase()}`}>
                      {report.priority || "N/A"}
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
                    <span className="date-text">
                      {report.created_at
                        ? new Date(report.created_at).toLocaleDateString()
                        : "N/A"}
                    </span>
                  </div>
                  <div className="list-col col-status">
                    <span className="status-tag resolved">
                      <FaCheckCircle /> Resolved
                    </span>
                  </div>
                  <div className="list-col col-likes" style={{ width: '60px', textAlign: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: '#9ca3af' }}>
                      <FaHeart style={{ color: '#ef4444', opacity: 0.6, fontSize: '0.8em' }} />
                      {report.reaction_count || 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="no-reports" role="status">
            <FaArchive style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem' }} />
            <p>No archived reports found.</p>
            <p className="muted">Resolved incidents will appear here.</p>
          </div>
        )}
      </div>

      {/* Fullscreen Image Preview - wrapped in ModalPortal */}
      {previewImage && (
        <ModalPortal>
          <div
            className="fullscreen-preview"
            onClick={() => setPreviewImage(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
          >
            <img src={previewImage} alt="Full size preview" />
            <button 
              className="close-preview"
              onClick={() => setPreviewImage(null)}
              aria-label="Close preview"
            >
              ×
            </button>
          </div>
        </ModalPortal>
      )}

      {/* Export Options Modal */}
      {showExportModal && (
        <ModalPortal>
          <div
            className="modal-overlay"
            onClick={() => setShowExportModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-modal-title"
          >
            <div 
              className="modal"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '400px',
                padding: '24px',
                borderRadius: '12px'
              }}
            >
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
    </>
  );

  const loadingFeatures = [
    {
      title: "Resolved Cases",
      description: "Gathering completed incident reports for review.",
    },
    {
      title: "Smart Analytics",
      description: "Building Community Helper insights and trends.",
    },
    {
      title: "Barangay Sync",
      description: "Filtering archives based on your role and barangay.",
    },
    {
      title: "Export Suite",
      description: "Preparing CSV/PDF templates for download.",
    },
  ];

  const effectiveStage = showMountAnimation
    ? mountStage
    : (loading ? "loading" : "exit");

  const handleLoadingExited = () => {
    setOverlayExited(true);
  };

  // Show error state
  if (error && !loading && reports.length === 0) {
    return (
      <div className="reports-container">
        <div className="error-message" role="alert">
          <p>{error}</p>
          <button onClick={fetchArchivedReports}>Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <LoadingScreen
      variant="inline"
      features={loadingFeatures}
      title={loading ? "Syncing archieves..." : undefined}
      subtitle={loading ? "Preparing resolved cases and analytics" : undefined}
      stage={effectiveStage}
      onExited={handleLoadingExited}
      inlineOffset="25vh"
      successDuration={900}
      successTitle={successTitle}
    >
      <div className={`reports-container ${overlayExited ? "overlay-exited" : ""}`}>
        {mainContent}
      </div>
    </LoadingScreen>
  );
}

export default ArchivedReports;