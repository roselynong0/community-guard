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

// ✅ Fetch utility using token
async function fetchWithToken(url, token) {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  return res.json();
}

function Home({ token }) {
  const [stats, setStats] = useState([]);
  const [recentReports, setRecentReports] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const COLORS = ["#e65252ff", "#263b53ff", "#2a869dff", "#61f464ff", "#e9c46a"];

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        // Fetch dashboard stats
        const statsRes = await fetchWithToken("http://localhost:5000/api/stats", token);
        if (statsRes.status === "success") {
          setStats([
            { title: "Total Reports", value: statsRes.totalReports, icon: <FaExclamationTriangle />, color: "#2d2d73" },
            { title: "Ongoing Cases", value: statsRes.ongoing, icon: <FaSyncAlt />, color: "#f40014ff" },
            { title: "Resolved Cases", value: statsRes.resolved, icon: <FaCheckCircle />, color: "#2a9d62ff" },
            { title: "Pending Reports", value: statsRes.pending, icon: <FaClock />, color: "#f4b761ff" },
          ]);
        } else {
          setStats([]);
        }

        // Fetch recent reports
        const recentRes = await fetchWithToken("http://localhost:5000/api/reports?limit=5&sort=desc", token);
        setRecentReports(recentRes.status === "success" ? recentRes.reports : []);

        // Fetch category stats
        const categoryRes = await fetchWithToken("http://localhost:5000/api/reports/categories", token);
        setCategoryData(categoryRes.status === "success" ? categoryRes.data : []);

      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setStats([]);
        setRecentReports([]);
        setCategoryData([]);
      }
    };

    fetchData();
  }, [token]);

  return (
    <div className="dashboard">
      {/* Stats Cards */}
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

      {/* Recent Reports & Pie Chart */}
      <div className="middle-grid animate-up" style={{ animationDelay: "0.2s" }}>
        <div className="recent-reports animate-up" style={{ animationDelay: "0.3s" }}>
          <h3>Recent Reports</h3>
          <ul>
            {recentReports.length ? (
              recentReports.map((report) => (
                <li key={report.id}>
                  <div className="report-header">
                    <strong>{report.title}</strong>
                    <span className="report-date">{report.created_at ? new Date(report.created_at).toLocaleString() : "N/A"}</span>
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
                <Pie
                  data={categoryData.length ? categoryData : [{ name: "No Data", value: 1 }]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius="70%"
                  fill="#8884d8"
                  dataKey="value"
                >
                  {(categoryData.length ? categoryData : [{ name: "No Data", value: 1 }]).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Map Section */}
      <div className="map-section animate-up" style={{ animationDelay: "0.5s" }}>
        <h3>Community Map</h3>
        <div className="map-placeholder">
          <MapView />
        </div>
      </div>
    </div>
  );
}

export default Home;