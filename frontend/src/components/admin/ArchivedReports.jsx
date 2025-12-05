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
} from "react-icons/fa";
import { API_CONFIG, getApiUrl } from "../../utils/apiConfig";
import "../resident/Reports.css";
import "./ArchivedReports.css";
import "./Admin-Reports.css";
import LoadingScreen from "../shared/LoadingScreen";
import ModalPortal from "../shared/ModalPortal";

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
            images: report.images?.map(img => img.url) || []
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

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      "ID",
      "Title",
      "Category",
      "Status",
      "Barangay",
      "Priority",
      "AI Analysis",
      "Reporter",
      "Created At",
      "Resolved At",
      "Description"
    ];
    
    const csvRows = [headers.join(",")];
    
    filteredReports.forEach((report) => {
      const row = [
        report.id,
        `"${(report.title || "").replace(/"/g, '""')}"`,
        report.category || "",
        report.status || "",
        report.address_barangay || "",
        report.priority || "N/A",
        `"${(report.ai_analysis || "No AI analysis").replace(/"/g, '""')}"`,
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
    
    // Generate filename based on role
    const dateStr = new Date().toISOString().split("T")[0];
    let filename = `archived_reports_${dateStr}`;
    if (canExportAll) {
      filename = `all_archived_reports_${dateStr}`;
    } else if (isBarangayOrResponder && userBarangay) {
      const safeBarangay = userBarangay.replace(/\s+/g, '_').toLowerCase();
      filename = `archived_reports_${safeBarangay}_${dateStr}`;
    }
    link.download = `${filename}.csv`;
    link.click();
  };

  // Export to PDF with Community Helper AI Analytics
  const exportToPDF = async () => {
    // Create a printable HTML document
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
    const priorityStats = { high: 0, medium: 0, low: 0 };
    
    filteredReports.forEach((report) => {
      // Category stats
      const cat = report.category || "Unknown";
      categoryStats[cat] = (categoryStats[cat] || 0) + 1;
      
      // Barangay stats
      const brgy = report.address_barangay || "Unknown";
      barangayStats[brgy] = (barangayStats[brgy] || 0) + 1;
      
      // Priority stats
      const priority = (report.priority || "").toLowerCase();
      if (priority === "high" || priority === "critical") priorityStats.high++;
      else if (priority === "medium") priorityStats.medium++;
      else priorityStats.low++;
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
    
    // Logo as base64 (Community Guard logo)
    const logoPath = new URL('../assets/logo.png', import.meta.url).href;
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Community Guard - Archived Reports Analytics</title>
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
          .priority-high { color: #dc2626; font-weight: bold; }
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
          @media print { body { padding: 20px; } .stats-grid { grid-template-columns: repeat(4, 1fr); } }
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
              <div class="number" style="color: #dc2626;">${priorityStats.high}</div>
              <div class="label">High Priority</div>
            </div>
            <div class="stat-card">
              <div class="number" style="color: #f59e0b;">${priorityStats.medium}</div>
              <div class="label">Medium Priority</div>
            </div>
            <div class="stat-card">
              <div class="number" style="color: #22c55e;">${priorityStats.low}</div>
              <div class="label">Low Priority</div>
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
                <th>AI Analysis</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              ${filteredReports.map((report) => `
                <tr>
                  <td>${report.id}</td>
                  <td>${report.title || "Untitled"}</td>
                  <td>${report.category || "N/A"}</td>
                  <td>${report.address_barangay || "N/A"}</td>
                  <td class="priority-${(report.priority || "low").toLowerCase()}">${report.priority || "N/A"}</td>
                  <td class="ai-analysis">${report.ai_analysis || "No AI analysis available"}</td>
                  <td>${new Date(report.created_at).toLocaleDateString()}</td>
                </tr>
              `).join("")}
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
          
          {/* Export Buttons - Always visible */}
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