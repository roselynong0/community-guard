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
import "./RespondersDashboard.css";

// Dummy trend data for monthly report
const defaultTrendData = [
  { month: "Jan", count: 12 },
  { month: "Feb", count: 18 },
  { month: "Mar", count: 10 },
  { month: "Apr", count: 20 },
  { month: "May", count: 16 },
];

// Dummy high incident areas
const highIncidentAreas = [
  { area: "Brgy. 12", total: 12 },
  { area: "Brgy. 3", total: 9 },
  { area: "Brgy. 8", total: 7 },
  { area: "Brgy. 5", total: 6 },
  { area: "Brgy. 10", total: 5 },
];

// Dummy active reports table data
const dummyActiveReports = [
  { id: 1, title: "Burglary", location: "East Tapinac", status: "Ongoing" },
  { id: 2, title: "Traffic Accident", location: "Kalaklan", status: "Pending" },
  { id: 3, title: "Medical Emergency", location: "Gordon Heights", status: "Ongoing" },
  { id: 4, title: "Fire Incident", location: "Pag Asa", status: "Pending" },
  { id: 5, title: "Hazard", location: "Santa Rita", status: "Ongoing" },
];

export default function RespondersDashboard() {
  const [stats, setStats] = useState([
    { title: "Active Reports", value: 4, icon: <FaExclamationTriangle />, color: "#f40014ff" },
    { title: "Resolved Reports", value: 12, icon: <FaCheckCircle />, color: "#2a9d62ff" },
    { title: "Pending Reports", value: 3, icon: <FaTasks />, color: "#f4b761ff" },
    { title: "Avg Response Time", value: "24 hrs", icon: <FaClock />, color: "#2d2d73" },
  ]);

  const [activeReports, setActiveReports] = useState(dummyActiveReports);
  const [trendData, setTrendData] = useState(defaultTrendData);

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
            to="/responders/reports"
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
              <th>No.</th>
              <th>Title</th>
              <th>Location</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {activeReports.map((report) => (
              <tr key={report.id}>
                <td>{report.id}</td>
                <td>{report.title}</td>
                <td>{report.location}</td>
                <td>{report.status}</td>
                <td>
                  {report.status === "Pending" ? (
                    <button
                      className="ongoing-btn"
                      onClick={() =>
                        setActiveReports((prev) =>
                          prev.map((r) =>
                            r.id === report.id ? { ...r, status: "Ongoing" } : r
                          )
                        )
                      }
                    >
                      Mark as Ongoing
                    </button>
                  ) : (
                    <button
                      className="resolve-btn"
                      onClick={() => handleResolve(report.id)}
                    >
                      Mark as Resolved
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Monthly Trend + High Incident Areas */}
      <div className="two-column-section">
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
      </div>

      {/* HIGH RISK ZONE MAP */}
      <div className="map-section animate-up">
        <h3>High Risk Zone Map</h3>
        <div className="map-placeholder">
          <MapView reports={highIncidentAreas} />
        </div>
      </div>
    </div>
  );
}
