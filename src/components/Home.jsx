import React from "react";
import {
  FaExclamationTriangle,
  FaCheckCircle,
  FaBell,
  FaClock,
  FaTasks,
  FaProcedures,
  FaSyncAlt,
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

function Home() {
  // Example report stats
  const stats = [
    { title: "Total Reports", value: 125, icon: <FaExclamationTriangle />, color: "#2d2d73" },
    { title: "Ongoing Cases", value: 8, icon: <FaSyncAlt />, color: "#f40014ff" },
    { title: "Resolved Cases", value: 96, icon: <FaCheckCircle />, color: "#2a9d62ff" },
    { title: "Pending Reports", value: 21, icon: <FaClock />, color: "#f4b761ff" },
  ];

  // Example recent reports
  const recentReports = [
  { id: 1, title: "Broken Streetlight", category: "Hazard", date: "2025-09-04 10:30 AM" },
  { id: 2, title: "Car Accident on Main St", category: "Accident", date: "2025-09-04 09:10 AM" },
  { id: 3, title: "Suspicious Activity", category: "Crime", date: "2025-09-03 11:45 PM" },
  { id: 4, title: "Noise Complaint", category: "Concern", date: "2025-09-03 08:20 PM" },
  { id: 5, title: "Lost Dog in Park", category: "Lost & Found", date: "2025-09-03 05:05 PM" },
];

  // Example pie chart data
  const categoryData = [
    { name: "Hazard", value: 20 },
    { name: "Crime", value: 30 },
    { name: "Accident", value: 15 },
    { name: "Concern", value: 25 },
    { name: "Lost & Found", value: 10 },
  ];

  const COLORS = ["#e65252ff", "#263b53ff", "#2a869dff", "#61f464ff", "#e9c46a"];

  return (
    <div className="dashboard">
      {/* Top Section: Stat Cards */}
      <div className="stats-grid">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="stat-card animate-up"
            style={{
              borderLeft: `6px solid ${stat.color}`,
              animationDelay: `${i * 0.1}s`
            }}
          >
            <div className="stat-icon" style={{ color: stat.color }}>{stat.icon}</div>
            <div>
              <h4>{stat.title}</h4>
              <p>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Middle Section: Reports + Chart */}
      <div className="middle-grid animate-up" style={{ animationDelay: "0.2s" }}>
        {/* Recent Reports */}
        <div className="recent-reports animate-up" style={{ animationDelay: "0.3s" }}>
          <h3>Recent Reports</h3>
          <ul>
            {recentReports.map((report) => (
              <li key={report.id}>
                <div className="report-header">
                  <strong>{report.title}</strong>
                  <span className="report-date">{report.date}</span>
                </div>
                <div className="report-category">{report.category}</div>
              </li>
            ))}
          </ul>
        </div>

        {/* Pie Chart */}
        <div className="reports-chart animate-up" style={{ animationDelay: "0.4s" }}>
          <h3>Reports by Category</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius="70%" 
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
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

      {/* Bottom Section: Map Placeholder */}
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
