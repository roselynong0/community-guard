import React, { useState, useEffect } from "react";
import {
  FaExclamationTriangle,
  FaCheckCircle,
  FaSyncAlt,
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
  PieChart,
  Pie,
  Cell,
} from "recharts";

import MapView from "../components/Mapview";
import "./BarangayDashboard.css";

// Fetch helper
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

// Dummy trend data
const defaultTrendData = [
  { month: "Jan", count: 20 },
  { month: "Feb", count: 32 },
  { month: "Mar", count: 28 },
  { month: "Apr", count: 40 },
  { month: "May", count: 44 },
];

// Dummy data for barangays with most reports
const barangayMostReports = [
  { barangay: "Baretto", total: 42 },
  { barangay: "Kalaklan", total: 38 },
  { barangay: "East Tapinac", total: 31 },
  { barangay: "Santa Rita", total: 25 },
  { barangay: "Gordon Heights", total: 18 },
];

// Dummy default Pie Chart data
const defaultCategoryData = [
  { name: "Crime", value: 40, color: "#d9534f" },
  { name: "Hazard", value: 25, color: "#f0ad4e" },
  { name: "Concern", value: 20, color: "#4a76b9" },
  { name: "Lost&Found", value: 15, color: "#5cb85c" },
];

export default function BarangayDashboard({ token, session }) {
  const [stats, setStats] = useState([
    { title: "Total Reports", value: 0, icon: <FaExclamationTriangle />, color: "#2d2d73" },
    { title: "Ongoing", value: 0, icon: <FaSyncAlt />, color: "#f40014ff" },
    { title: "Resolved", value: 0, icon: <FaCheckCircle />, color: "#2a9d62ff" },
    { title: "Pending", value: 0, icon: <FaClock />, color: "#f4b761ff" },
  ]);

  const [trendData, setTrendData] = useState(defaultTrendData);
  const [categoryDataState, setCategoryDataState] = useState(defaultCategoryData);
  const [selectedBarangayFilter, setSelectedBarangayFilter] = useState("All");

  const barangayList = [
    "All",
    "Asinan",
    "Banicain",
    "Barretto",
    "East Bajac-bajac",
    "East Tapinac",
    "Gordon Heights",
    "Kalaklan",
    "Mabayuan",
    "New Cabalan",
    "New Ilalim",
    "New Kababae",
    "New Kalalake",
    "Old Cabalan",
    "Pag-asa",
    "Santa Rita",
    "West Bajac-bajac",
    "West Tapinac",
  ];

  // Fetch stats when filter changes
  useEffect(() => {
    if (!token) return;

    const fetchStats = async () => {
      try {
        const endpoint = `http://localhost:5000/api/stats${
          selectedBarangayFilter !== "All"
            ? `?barangay=${encodeURIComponent(selectedBarangayFilter)}`
            : ""
        }`;
        const response = await fetchWithToken(endpoint, token);

        if (response.status === "success") {
          // Update stats
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

          // Update trend chart
          if (response.monthly && Array.isArray(response.monthly)) {
            setTrendData(response.monthly);
          } else {
            setTrendData(defaultTrendData);
          }

          // Update Pie Chart
          if (response.categories && Array.isArray(response.categories)) {
            setCategoryDataState(
              response.categories.map((c, idx) => ({
                ...c,
                color: defaultCategoryData[idx]?.color || "#2d2d73",
              }))
            );
          } else {
            setCategoryDataState(defaultCategoryData);
          }
        }
      } catch (error) {
        console.error("Failed to load stats:", error);
      }
    };

    fetchStats();
  }, [token, selectedBarangayFilter]);

  return (
    <div className="dashboard">

      {/* BARANGAY FILTER */}
      <div className="barangay-filter animate-up">
        <label htmlFor="barangay-select">Select Barangay:</label>
        <select
          id="barangay-select"
          value={selectedBarangayFilter}
          onChange={(e) => setSelectedBarangayFilter(e.target.value)}
        >
          {barangayList.map((b, idx) => (
            <option key={idx} value={b}>{b}</option>
          ))}
        </select>
      </div>

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

      {/* TWO-COLUMN: TREND + PIE CHART */}
      <div className="two-column-section animate-up">
        {/* Monthly Report Summary */}
        <div className="trend-column">
          <h3>Monthly Report Summary {selectedBarangayFilter !== "All" ? `— ${selectedBarangayFilter}` : ""}</h3>
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

        {/* Pie Chart by Category */}
        <div className="pie-column">
          <h3>Reports by Category</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={categoryDataState}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius="70%"
                  dataKey="value"
                  nameKey="name"
                >
                  {categoryDataState.map((entry, index) => (
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

      {/* BARANGAYS WITH MOST REPORTS */}
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

      {/* MAP */}
      <div className="map-section animate-up">
        <h3>High-Risk Zones Map</h3>
        <div className="map-placeholder">
          <MapView reports={barangayMostReports} />
        </div>
      </div>

    </div>
  );
}
