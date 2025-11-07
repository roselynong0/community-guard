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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

import MapView from "../components/Mapview";
import "./BarangayDashboard.css";

// ✅ Fetch helper (same as resident)
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
      if (attempt === retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

const trendData = [
  { month: "Jan", count: 20 },
  { month: "Feb", count: 32 },
  { month: "Mar", count: 28 },
  { month: "Apr", count: 40 },
  { month: "May", count: 44 },
];

// ✅ NEW DATA – barangays with most reports
const barangayMostReports = [
  { barangay: "Baretto", total: 42 },
  { barangay: "Kalaklan", total: 38 },
  { barangay: "East Tapinac", total: 31 },
  { barangay: "Santa Rita", total: 25 },
  { barangay: "Gordon Heights", total: 18 },
];

export default function BarangayDashboard({ token, session }) {
  const [stats, setStats] = useState([
    { title: "Total Reports", value: 0, icon: <FaExclamationTriangle />, color: "#2d2d73" },
    { title: "Ongoing", value: 0, icon: <FaSyncAlt />, color: "#f40014ff" },
    { title: "Resolved", value: 0, icon: <FaCheckCircle />, color: "#2a9d62ff" },
    { title: "Pending", value: 0, icon: <FaClock />, color: "#f4b761ff" },
  ]);

  // ✅ GET BARANGAY
  const selectedBarangay = session?.user?.barangay || "All";

  // ✅ Fetch Stats on mount
  useEffect(() => {
    if (!token) return;
    const fetchStats = async () => {
      try {
        const statsEndpoint = `http://localhost:5000/api/stats${
          selectedBarangay !== "All"
            ? `?barangay=${encodeURIComponent(selectedBarangay)}`
            : ""
        }`;

        const response = await fetchWithToken(statsEndpoint, token);

        if (response.status === "success") {
          setStats([
            {
              title: "Total Reports",
              value: response.totalReports || 0,
              icon: <FaExclamationTriangle />,
              color: "#2d2d73",
            },
            {
              title: "Ongoing",
              value: response.ongoing || 0,
              icon: <FaSyncAlt />,
              color: "#f40014ff",
            },
            {
              title: "Resolved",
              value: response.resolved || 0,
              icon: <FaCheckCircle />,
              color: "#2a9d62ff",
            },
            {
              title: "Pending",
              value: response.pending || 0,
              icon: <FaClock />,
              color: "#f4b761ff",
            },
          ]);
        }
      } catch (error) {
        console.error("Failed to load stats:", error);
      }
    };

    fetchStats();
  }, [token, selectedBarangay, session]);

  return (
    <div className="dashboard">

      {/* --- STAT CARDS (Dynamic) --- */}
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

      {/* --- TREND MONITORING --- */}
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

      {/* --- BARANGAYS WITH MOST REPORTS --- */}
      <div className="section-card animate-up">
        <h3>Barangays with Most Reports</h3>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barangayMostReports}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="barangay" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#2d2d73" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* --- MAP --- */}
      <div className="map-section animate-up">
        <h3>High-Risk Zones Map</h3>
        <div className="map-placeholder">
          <MapView reports={barangayMostReports} />
        </div>
      </div>

    </div>
  );
}
