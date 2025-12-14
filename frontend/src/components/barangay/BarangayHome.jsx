import React, { useState, useEffect, useCallback } from "react";
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
import MapView from "../resident/Mapview"; 
import "../resident/Home.css";

// CONSTANTS FOR CATEGORY COLORS
const CATEGORY_COLORS = {
  "Concern": "#4a76b9",      
  "Crime": "#d9534f",        
  "Hazard": "#f0ad4e",       
  "Lost&Found": "#5cb85c",  
  "Others": "#777777",
  default: "#2d2d73", 
};

// FETCH UTILITY
async function fetchWithToken(url, token, retries = 3) {
  if (!token) throw new Error("Token is required");
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
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
    } catch (error) {
      console.log(`Fetch attempt ${attempt}/${retries} failed:`, error.message);
      
      if (attempt === retries) {
        throw error;
      }
      
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

function Home({ token, session }) {
  const [stats, setStats] = useState([
    { title: "Total Reports", value: 0, icon: <FaExclamationTriangle />, color: "#2d2d73" },
    { title: "Ongoing Cases", value: 0, icon: <FaSyncAlt />, color: "#f40014ff" },
    { title: "Resolved Cases", value: 0, icon: <FaCheckCircle />, color: "#2a9d62ff" },
    { title: "Pending Reports", value: 0, icon: <FaClock />, color: "#f4b761ff" },
  ]);
  const [recentReports, setRecentReports] = useState([]);
  const [categoryData, setCategoryData] = useState([{ name: "No Data", value: 1, color: "#e9ecef" }]); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getCategoryColor = useCallback((categoryName) => {
    return CATEGORY_COLORS[categoryName] || CATEGORY_COLORS.default;
  }, []);


  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const statsEndpoint = "http://localhost:5000/api/stats";
        const statsRes = await fetchWithToken(statsEndpoint, token);
        if (statsRes.status === "success") {
          setStats([
            { title: "Community Reports", value: statsRes.totalReports || 0, icon: <FaExclamationTriangle />, color: "#2d2d73" },
            { title: "Ongoing Cases", value: statsRes.ongoing || 0, icon: <FaSyncAlt />, color: "#f40014ff" },
            { title: "Resolved Cases", value: statsRes.resolved || 0, icon: <FaCheckCircle />, color: "#2a9d62ff" },
            { title: "Pending Reports", value: statsRes.pending || 0, icon: <FaClock />, color: "#f4b761ff" },
          ]);
        }

        const categoryEndpoint = "http://localhost:5000/api/reports/categories?filter=all";
        const categoryRes = await fetchWithToken(categoryEndpoint, token);
        if (categoryRes.status === "success" && categoryRes.data && categoryRes.data.length > 0) {
          const formattedCategoryData = categoryRes.data.map(item => ({
            ...item,
            color: getCategoryColor(item.name),
          }));
          setCategoryData(formattedCategoryData);
        } else {
            setCategoryData([{ name: "No Data", value: 1, color: "#e9ecef" }]);
        }

        const reportsEndpoint = `http://localhost:5000/api/reports?limit=5&sort=desc&filter=all`;
        const recentRes = await fetchWithToken(reportsEndpoint, token);
        setRecentReports(recentRes.status === "success" ? recentRes.reports : []);
        
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setError("Failed to load dashboard");
        setStats([
          { title: "Total Reports", value: 0, icon: <FaExclamationTriangle />, color: "#2d2d73" },
          { title: "Ongoing Cases", value: 0, icon: <FaSyncAlt />, color: "#f40014ff" },
          { title: "Resolved Cases", value: 0, icon: <FaCheckCircle />, color: "#2a9d62ff" },
          { title: "Pending Reports", value: 0, icon: <FaClock />, color: "#f4b761ff" },
        ]);
        setRecentReports([]);
        setCategoryData([
          { name: "No Data", value: 1, color: "#e9ecef" }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, session?.user?.role, getCategoryColor]);

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const handleReportClick = (reportId) => {
    const isAdmin = session?.user?.role === "Admin";
    
    if (isAdmin) {
      window.location.href = `/admin/reports?highlight=${reportId}`;
    } else {
      window.location.href = `/reports?highlight=${reportId}`;
    }
  };

  return (
    <div className="dashboard">
      {error && <p className="error">{error}</p>}

      <div className="stats-grid">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="stat-card"
            style={{ borderLeft: `4px solid ${stat.color}` }}
          >
            <div className="stat-content">
              <div className="stat-icon" style={{ color: stat.color }}>{stat.icon}</div>
              <div className="stat-text">
                <h4>{stat.title}</h4>
                <p>{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="middle-grid">
        <div className="recent-reports">
          <h3>Recent Reports</h3>
          <ul>
            {recentReports.length ? (
              recentReports.map(report => (
                <li 
                  key={report.id} 
                  onClick={() => handleReportClick(report.id)}
                  style={{ cursor: "pointer" }}
                  className="clickable-report"
                >
                  <div className="report-header">
                    <strong>{report.title}</strong>
                    <div className="report-meta">
                      <span className="report-date">
                        {report.created_at ? new Date(report.created_at).toLocaleString() : "N/A"}
                      </span>
                    </div>
                  </div>
                  <div className="report-details">
                    <span className="report-category">{report.category || "Uncategorized"}</span>
                    <span className="report-barangay" style={{ 
                        marginLeft: "1rem", 
                        padding: "0.2rem 0.5rem", 
                        backgroundColor: "#e9e9ff", 
                        color: "#2d2d73", 
                        borderRadius: "12px", 
                        fontSize: "0.8rem",
                        fontWeight: "500"
                      }}>
                        📍 {report.address_barangay || "Unknown"}
                      </span>
                  </div>
                </li>
              ))
            ) : (
              <li className="no-reports">No reports available.</li>
            )}
          </ul>
        </div>

        <div className="reports-chart">
          <h3>Reports by Category</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={260}>
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

      <div className="map-section">
        <h3>Community Map</h3>
        <div className="map-placeholder">
          <MapView reports={recentReports} /> 
        </div>
      </div>
    </div>
  );
}

export default Home;