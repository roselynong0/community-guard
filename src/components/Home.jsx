import React, { useState, useEffect } from "react";
import {
  FaExclamationTriangle,
  FaCheckCircle,
  FaSyncAlt,
  FaClock,
} from "react-icons/fa";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import MapView from "../components/Mapview"; 
import "./Home.css";

// ----------------- FETCH UTILITY -----------------
async function fetchWithToken(url, token) {
  if (!token) throw new Error("Token is required");
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || "Failed to fetch");
  }

  return res.json();
}

function Home({ token }) {
  const [stats, setStats] = useState([
    { title: "Total Reports", value: 0, icon: <FaExclamationTriangle />, color: "#2d2d73" },
    { title: "Ongoing Cases", value: 0, icon: <FaSyncAlt />, color: "#f40014ff" },
    { title: "Resolved Cases", value: 0, icon: <FaCheckCircle />, color: "#2a9d62ff" },
    { title: "Pending Reports", value: 0, icon: <FaClock />, color: "#f4b761ff" },
  ]);
  const [recentReports, setRecentReports] = useState([]);
  const [categoryData, setCategoryData] = useState([{ name: "No Data", value: 1, color: "#ccc" }]); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Map your category names to colors
  const CATEGORY_COLORS = {
    "Concern": "#4a76b9",      
    "Crime": "#d9534f",        
    "Hazard": "#f0ad4e",       
    "Lost&Found": "#5cb85c",  
    "Others": "#777777",
    default: "#2d2d73", 
  };

  const getCategoryColor = (categoryName) => {
    return CATEGORY_COLORS[categoryName] || CATEGORY_COLORS.default;
  };


  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch dashboard stats
        const statsRes = await fetchWithToken("http://localhost:5000/api/stats", token);
        if (statsRes.status === "success") {
          // Update stats cards
          setStats([
            { title: "Total Reports", value: statsRes.totalReports || 0, icon: <FaExclamationTriangle />, color: "#2d2d73" },
            { title: "Ongoing Cases", value: statsRes.ongoing || 0, icon: <FaSyncAlt />, color: "#f40014ff" },
            { title: "Resolved Cases", value: statsRes.resolved || 0, icon: <FaCheckCircle />, color: "#2a9d62ff" },
            { title: "Pending Reports", value: statsRes.pending || 0, icon: <FaClock />, color: "#f4b761ff" },
          ]);
        }

        // 2. Fetch reports by category data
        const categoryRes = await fetchWithToken("http://localhost:5000/api/reports/categories", token);
        if (categoryRes.status === "success" && categoryRes.data && categoryRes.data.length > 0) {
          // Map data to include colors
          const formattedCategoryData = categoryRes.data.map(item => ({
            ...item,
            color: getCategoryColor(item.name),
          }));
          setCategoryData(formattedCategoryData);
        } else {
            // Handle case with no category data
            setCategoryData([{ name: "No Data", value: 1, color: "#ccc" }]);
        }

        // 3. Fetch recent reports
        const recentRes = await fetchWithToken(
          "http://localhost:5000/api/reports?limit=5&sort=desc",
          token
        );
        setRecentReports(recentRes.status === "success" ? recentRes.reports : []);
        
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setError("Failed to load dashboard");
        // Reset to initial state on error
        setStats([
          { title: "Total Reports", value: 0, icon: <FaExclamationTriangle />, color: "#2d2d73" },
          { title: "Ongoing Cases", value: 0, icon: <FaSyncAlt />, color: "#f40014ff" },
          { title: "Resolved Cases", value: 0, icon: <FaCheckCircle />, color: "#2a9d62ff" },
          { title: "Pending Reports", value: 0, icon: <FaClock />, color: "#f4b761ff" },
        ]);
        setRecentReports([]);
        setCategoryData([
          { name: "No Data", value: 1, color: "#ccc" }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {error && <p className="error">{error}</p>}

      <div className="stats-grid">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="stat-card animate-up"
            style={{ borderLeft: `6px solid ${stat.color}`, animationDelay: `${i * 0.1}s` }}
          >
            <div className="stat-icon" style={{ color: stat.color }}>{stat.icon}</div>
            <div>
              <h4>{stat.title}</h4>
              <p>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="middle-grid animate-up" style={{ animationDelay: "0.2s" }}>
        <div className="recent-reports animate-up" style={{ animationDelay: "0.3s" }}>
          <h3>Recent Reports</h3>
          <ul>
            {recentReports.length ? (
              recentReports.map(report => (
                <li key={report.id}>
                  <div className="report-header">
                    <strong>{report.title}</strong>
                    <span className="report-date">
                      {report.created_at ? new Date(report.created_at).toLocaleString() : "N/A"}
                    </span>
                  </div>
                  <div className="report-category">{report.category || "Uncategorized"}</div>
                </li>
              ))
            ) : (
              <li className="no-reports">No reports available.</li>
            )}
          </ul>
        </div>

        <div className="reports-chart animate-up" style={{ animationDelay: "0.4s" }}>
          <h3>Reports by Category</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" labelLine={false} outerRadius="70%" dataKey="value" nameKey="name"> {/* Added nameKey */}
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="map-section animate-up" style={{ animationDelay: "0.5s" }}>
        <h3>Community Map</h3>
        <div className="map-placeholder">
          <MapView reports={recentReports} /> 
        </div>
      </div>
    </div>
  );
}

export default Home;