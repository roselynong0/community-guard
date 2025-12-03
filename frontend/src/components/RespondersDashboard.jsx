import React, { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import {
  FaExclamationTriangle,
  FaCheckCircle,
  FaTasks,
  FaClock,
} from "react-icons/fa";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";

import MapView from "../components/Mapview";
import LoadingScreen from "./LoadingScreen";
import { getApiUrl } from "../utils/apiConfig";
import "./RespondersDashboard.css";

// Utility function to calculate average response time in days and hours
const calculateAvgResponseTime = (reports) => {
  const resolvedReports = reports.filter(r => r.status === "Resolved" && r.created_at && r.updated_at);
  
  if (resolvedReports.length === 0) return "0h";
  
  const totalMs = resolvedReports.reduce((sum, report) => {
    const createdTime = new Date(report.created_at).getTime();
    const resolvedTime = new Date(report.updated_at).getTime();
    return sum + (resolvedTime - createdTime);
  }, 0);
  
  const avgMs = totalMs / resolvedReports.length;
  const avgHours = avgMs / (1000 * 60 * 60);
  const days = Math.floor(avgHours / 24);
  const hours = Math.round(avgHours % 24);
  
  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  return `${Math.round(avgHours)}h`;
};

// Utility function to extract barangay from report
const extractBarangay = (report) => {
  const barangay = report.address_barangay || report.barangay || "Unknown";
  return barangay.includes("Brgy") ? barangay : `Brgy. ${barangay}`;
};

export default function RespondersDashboard() {
  const [loading, setLoading] = useState(true);
  const [overlayExited, setOverlayExited] = useState(false);
  const mapRef = useRef(null);
  
  const loadingFeatures = [
    { title: "Responder Overview", description: "Loading active reports and statistics." },
    { title: "Incident Areas", description: "Preparing hotspots and trends." },
  ];

  const [stats, setStats] = useState([
    { title: "Active Reports", value: 0, icon: <FaExclamationTriangle />, color: "#f40014ff" },
    { title: "Resolved Reports", value: 0, icon: <FaCheckCircle />, color: "#2a9d62ff" },
    { title: "Pending Reports", value: 0, icon: <FaTasks />, color: "#f4b761ff" },
    { title: "Avg Response Time", value: "0 hrs", icon: <FaClock />, color: "#2d2d73" },
  ]);

  const [activeReports, setActiveReports] = useState([]);
  const [trendData, setTrendData] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [allReports, setAllReports] = useState([]);
  const [highIncidentAreas, setHighIncidentAreas] = useState([]);
  const [userBarangay, setUserBarangay] = useState(null);

  // Fetch reports on component mount - filtered by responder's barangay, excluding rejected
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        // Use the new responder-specific endpoint that filters by barangay and excludes rejected reports
        const response = await fetch(getApiUrl("/api/responder/reports?limit=100"), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          // Fall back to regular reports endpoint if responder endpoint fails
          console.warn("Responder endpoint failed, falling back to regular reports");
          const fallbackResponse = await fetch(getApiUrl("/api/reports?limit=100&sort=desc"), {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!fallbackResponse.ok) throw new Error("Failed to fetch reports");
          const fallbackData = await fallbackResponse.json();
          const reports = (fallbackData.reports || []).filter(r => !r.is_rejected);
          processReports(reports);
          return;
        }

        const data = await response.json();
        
        if (data.status === "success") {
          const reports = data.reports || [];
          setAllReports(reports);
          setUserBarangay(data.barangay);
          
          // Use pre-calculated stats from backend
          if (data.stats) {
            setStats([
              { title: "Active Reports", value: data.stats.ongoing || 0, icon: <FaExclamationTriangle />, color: "#f40014ff" },
              { title: "Resolved Reports", value: data.stats.resolved || 0, icon: <FaCheckCircle />, color: "#2a9d62ff" },
              { title: "Pending Reports", value: data.stats.pending || 0, icon: <FaTasks />, color: "#f4b761ff" },
              { title: "Avg Response Time", value: data.stats.avgResponseTime || "0h", icon: <FaClock />, color: "#2d2d73" },
            ]);
          }
          
          // Set active reports (only ongoing for the table)
          const active = reports.filter(r => r.status === "Ongoing").slice(0, 10);
          setActiveReports(active);
          
          // Use pre-calculated trends from backend
          setTrendData(data.trends || [{ month: "No Data", count: 0 }]);
          
          // Use pre-calculated high incident areas from backend
          setHighIncidentAreas(data.highIncidentAreas || [{ area: "No Data", total: 0 }]);
          
          console.log(`✅ Responder loaded ${reports.length} reports for barangay: ${data.barangay || 'All'}`);
        } else {
          throw new Error(data.message || "Failed to fetch reports");
        }
      } catch (error) {
        console.error("Error fetching reports:", error);
        setTrendData([{ month: "No Data", count: 0 }]);
        setHighIncidentAreas([{ area: "No Data", total: 0 }]);
      } finally {
        setLoading(false);
      }
    };
    
    // Helper function to process reports when falling back to regular endpoint
    const processReports = (reports) => {
      setAllReports(reports);

      // Calculate stats
      const pending = reports.filter(r => r.status === "Pending").length;
      const ongoing = reports.filter(r => r.status === "Ongoing").length;
      const resolved = reports.filter(r => r.status === "Resolved").length;
      const avgResponseTime = calculateAvgResponseTime(reports);

      setStats([
        { title: "Active Reports", value: ongoing, icon: <FaExclamationTriangle />, color: "#f40014ff" },
        { title: "Resolved Reports", value: resolved, icon: <FaCheckCircle />, color: "#2a9d62ff" },
        { title: "Pending Reports", value: pending, icon: <FaTasks />, color: "#f4b761ff" },
        { title: "Avg Response Time", value: avgResponseTime, icon: <FaClock />, color: "#2d2d73" },
      ]);

      // Set active reports (only ongoing for the table)
      const active = reports.filter(r => r.status === "Ongoing").slice(0, 10);
      setActiveReports(active);

      // Generate trend data by month
      const monthlyData = {};
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      
      reports.forEach(report => {
        if (report.created_at) {
          const date = new Date(report.created_at);
          const monthKey = months[date.getMonth()];
          monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
        }
      });

      const trendArray = months
        .filter(month => monthlyData[month])
        .map(month => ({ month, count: monthlyData[month] }));
      
      setTrendData(trendArray.length > 0 ? trendArray : [{ month: "No Data", count: 0 }]);

      // Generate high incident areas by barangay
      const barangayData = {};
      reports.forEach(report => {
        const barangay = extractBarangay(report);
        barangayData[barangay] = (barangayData[barangay] || 0) + 1;
      });

      const incidentAreas = Object.entries(barangayData)
        .map(([area, total]) => ({ area, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      setHighIncidentAreas(incidentAreas.length > 0 ? incidentAreas : [{ area: "No Data", total: 0 }]);
    };

    fetchReports();
  }, []);

  // Handle Mark as Resolved
  const handleResolve = (reportId) => {
    setActiveReports((prev) => prev.filter((r) => r.id !== reportId));
    setStats((prev) =>
      prev.map((s) =>
        s.title === "Resolved Reports"
          ? { ...s, value: s.value + 1 }
          : s.title === "Active Reports"
          ? { ...s, value: s.value - 1 }
          : s
      )
    );
  };

  const content = (
    <div className={`dashboard ${overlayExited ? 'overlay-exited' : ''}`}>
      {/* BARANGAY HEADER */}
      {userBarangay && (
        <div className="barangay-header" style={{ marginBottom: "1rem", padding: "0.5rem 1rem", background: "#f0f4f8", borderRadius: "8px", display: "inline-block" }}>
          <span style={{ color: "#2d2d73", fontWeight: 500 }}>📍 {userBarangay}</span>
        </div>
      )}
      
      {/* STAT CARDS */}
      <div className="stats-grid">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="stat-card"
            style={{ borderLeft: `4px solid ${stat.color}` }}
          >
            <div className="stat-content">
              <span className="stat-icon" style={{ color: stat.color }}>
                {stat.icon}
              </span>
              <div className="stat-text">
                <h4>{stat.title}</h4>
                <p>{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ACTIVE REPORTS TABLE */}
      <div className="section-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Active Reports</h3>

          <NavLink
            to="/responder/reports"
            style={{
              fontSize: "0.85rem",
              color: "#2d2d73",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            View All →
          </NavLink>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date Reported</th>
              <th>Title</th>
              <th>Location</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {activeReports.map((report) => (
              <tr key={report.id}>
                <td>{new Date(report.created_at).toLocaleDateString()}</td>
                <td>{report.title}</td>
                <td>{extractBarangay(report)}</td>
                <td>{report.status}</td>
                <td>
                  <button
                    className="resolve-btn"
                    onClick={() => handleResolve(report.id)}
                  >
                    Mark as Resolved
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Monthly Trend + High Incident Areas */}
      <div className="two-column">
        <div className="section-card">
          <h3>High Incident Areas</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={highIncidentAreas}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="area" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" fill="#2d2d73" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="trend-section">
          <h3>Monthly Report Summary</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#2d2d73" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* HOTSPOTS MAP */}
      <div className="map-section">
        <h3>Hotspots</h3>
        <div className="map-placeholder">
          <MapView ref={mapRef} />
        </div>
      </div>
    </div>
  );

  return (
    <LoadingScreen
      variant="inline"
      features={loadingFeatures}
      title={loading ? "Loading Dashboard..." : undefined}
      subtitle={loading ? "Fetching responder stats" : undefined}
      stage={loading ? "loading" : "exit"}
      successTitle="Dashboard Ready!"
      onExited={() => {
        setOverlayExited(true);
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
          try { mapRef.current?.invalidate?.(); } catch (e) { console.debug('map invalidate error', e); }
        }, 120);
      }}
      inlineOffset="18vh"
    >
      {content}
    </LoadingScreen>
  );
}
