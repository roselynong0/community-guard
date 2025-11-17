import React, { useState, useEffect } from "react";
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
  const [stats, setStats] = useState([
    { title: "Active Reports", value: 0, icon: <FaExclamationTriangle />, color: "#f40014ff" },
    { title: "Resolved Reports", value: 0, icon: <FaCheckCircle />, color: "#2a9d62ff" },
    { title: "Pending Reports", value: 0, icon: <FaTasks />, color: "#f4b761ff" },
    { title: "Avg Response Time", value: "0 hrs", icon: <FaClock />, color: "#2d2d73" },
  ]);

  const [activeReports, setActiveReports] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [highIncidentAreas, setHighIncidentAreas] = useState([]);
  const [responderUserId, setResponderUserId] = useState(null);

  // Fetch responder's user ID
  useEffect(() => {
    const fetchResponderInfo = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const response = await fetch(getApiUrl("/api/profile"), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error("Failed to fetch profile");

        const data = await response.json();
        if (data.status === "success" && data.profile?.id) {
          setResponderUserId(data.profile.id);
        }
      } catch (error) {
        console.error("Error fetching responder info:", error);
      }
    };

    fetchResponderInfo();
  }, []);

  // Fetch reports on component mount
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token || !responderUserId) return;

        // Fetch assigned reports for stats and active reports table
        const assignedResponse = await fetch(getApiUrl(`/api/reports?limit=100&sort=desc&responder_id=${responderUserId}`), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!assignedResponse.ok) throw new Error("Failed to fetch assigned reports");

        const assignedData = await assignedResponse.json();
        const assignedReports = assignedData.reports || [];

        // Calculate stats - show only reports assigned to this responder
        const pending = assignedReports.filter(r => r.status === "Pending").length;
        const ongoing = assignedReports.filter(r => r.status === "Ongoing").length;
        const resolved = assignedReports.filter(r => r.status === "Resolved").length;
        const avgResponseTime = calculateAvgResponseTime(assignedReports);

        setStats([
          { title: "Active Reports", value: ongoing, icon: <FaExclamationTriangle />, color: "#f40014ff" },
          { title: "Resolved Reports", value: resolved, icon: <FaCheckCircle />, color: "#2a9d62ff" },
          { title: "Pending Reports", value: pending, icon: <FaTasks />, color: "#f4b761ff" },
          { title: "Avg Response Time", value: avgResponseTime, icon: <FaClock />, color: "#2d2d73" },
        ]);

        // Set active reports (only ongoing status, assigned to this responder)
        const active = assignedReports.filter(r => r.status === "Ongoing").slice(0, 10);
        setActiveReports(active);

        // Fetch all reports for analytics (high incident areas and monthly trends)
        const allResponse = await fetch(getApiUrl("/api/reports?limit=100&sort=desc"), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!allResponse.ok) throw new Error("Failed to fetch all reports");

        const allData = await allResponse.json();
        const allReports = allData.reports || [];
        setAllReports(allReports);

        // Filter all reports to only approved ones for analytics
        const approvedReports = allReports.filter(
          report => report.is_approved !== false && !report.is_rejected
        );

        // Generate trend data by month from APPROVED reports
        const monthlyData = {};
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        approvedReports.forEach(report => {
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

        // Generate high incident areas by barangay from APPROVED reports
        const barangayData = {};
        approvedReports.forEach(report => {
          const barangay = extractBarangay(report);
          barangayData[barangay] = (barangayData[barangay] || 0) + 1;
        });

        const incidentAreas = Object.entries(barangayData)
          .map(([area, total]) => ({ area, total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);

        setHighIncidentAreas(incidentAreas.length > 0 ? incidentAreas : [{ area: "No Data", total: 0 }]);
      } catch (error) {
        console.error("Error fetching reports:", error);
        setTrendData([{ month: "No Data", count: 0 }]);
        setHighIncidentAreas([{ area: "No Data", total: 0 }]);
      }
    };

    fetchReports();
  }, [responderUserId]);

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

  return (
    <div className="dashboard">
      {/* STAT CARDS */}
      <div className="stats-grid">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="stat-card animate-up"
            style={{ borderLeft: `4px solid ${stat.color}`, animationDelay: `${i * 0.1}s` }}
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
      <div className="section-card animate-up">
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
        <div className="section-card animate-up">
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

        <div className="trend-section animate-up">
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
      <div className="map-section animate-up">
        <h3>Hotspots</h3>
        <div className="map-placeholder">
          <MapView />
        </div>
      </div>
    </div>
  );
}
