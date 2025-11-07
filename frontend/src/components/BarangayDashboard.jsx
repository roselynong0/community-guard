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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

import { API_CONFIG } from "../utils/apiConfig";
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
      console.log(`Fetch attempt ${attempt}/${retries} failed:`, error.message);
      
      if (attempt === retries) {
        throw error; // Last attempt failed, throw the error
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export default function BarangayDashboard({ token }) {
  const [stats, setStats] = useState([
    { title: "Total Reports", value: 0, icon: <FaExclamationTriangle />, color: "#2d2d73" },
    { title: "Ongoing", value: 0, icon: <FaSyncAlt />, color: "#f40014ff" },
    { title: "Resolved", value: 0, icon: <FaCheckCircle />, color: "#2a9d62ff" },
    { title: "Pending", value: 0, icon: <FaClock />, color: "#f4b761ff" },
  ]);

  const [userProfile, setUserProfile] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [topBarangays, setTopBarangays] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ Single useEffect to fetch profile and dashboard data
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    
    const fetchAllData = async () => {
      setLoading(true);
      try {
        // 1. Fetch profile first to get barangay
        const profileResponse = await fetchWithToken(`${API_CONFIG.BASE_URL}/api/profile`, token);
        if (profileResponse.status !== "success") {
          console.error("Failed to load profile:", profileResponse);
          setLoading(false);
          return;
        }
        
        const profile = profileResponse.profile;
        setUserProfile(profile);
        
        const selectedBarangay = profile?.address_barangay || "All";
        console.log("🔄 Fetching dashboard data for barangay:", selectedBarangay);
        
        // 2. Fetch dashboard data with barangay filter
        const dashboardEndpoint = `${API_CONFIG.BASE_URL}/api/dashboard/barangay/stats${
          selectedBarangay !== "All"
            ? `?barangay=${encodeURIComponent(selectedBarangay)}`
            : ""
        }`;
        
        console.log("📊 Fetching all data from:", dashboardEndpoint);
        const response = await fetchWithToken(dashboardEndpoint, token);
        
        if (response.status === "success") {
          console.log("✅ Dashboard data loaded:", response);
          
          // Update stats
          if (response.stats) {
            setStats([
              {
                title: "Total Reports",
                value: response.stats.totalReports || 0,
                icon: <FaExclamationTriangle />,
                color: "#2d2d73",
              },
              {
                title: "Ongoing",
                value: response.stats.ongoing || 0,
                icon: <FaSyncAlt />,
                color: "#f40014ff",
              },
              {
                title: "Resolved",
                value: response.stats.resolved || 0,
                icon: <FaCheckCircle />,
                color: "#2a9d62ff",
              },
              {
                title: "Pending",
                value: response.stats.pending || 0,
                icon: <FaClock />,
                color: "#f4b761ff",
              },
            ]);
          }
          
          // Update trends
          if (response.trends && response.trends.length > 0) {
            console.log("✅ Trends loaded:", response.trends.length, "months");
            setTrendData(response.trends);
          } else {
            console.warn("⚠️ No trend data available");
            setTrendData([]);
          }
          
          // Update top barangays
          if (response.topBarangays && response.topBarangays.length > 0) {
            console.log("✅ Top barangays loaded:", response.topBarangays.length);
            setTopBarangays(response.topBarangays);
          } else {
            setTopBarangays([]);
          }
        } else {
          console.warn("⚠️ Dashboard response not successful:", response);
        }

        console.log("✅ Dashboard data fetch completed");

      } catch (error) {
        console.error("❌ Failed to load dashboard data:", error);
        console.error("Error details:", error.message, error.stack);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [token]); // Only depend on token, not userProfile

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner"></div>
        <p>Loading Barangay Dashboard...</p>
      </div>
    );
  }

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

      {/* --- BARANGAYS WITH MOST REPORTS (only show if viewing "All") --- */}
      {userProfile?.address_barangay === "All" && topBarangays.length > 0 && (
        <div className="section-card animate-up">
          <h3>Barangays with Most Reports</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topBarangays}>
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
      )}

      {/* --- MAP --- */}
      <div className="map-section animate-up">
        <h3>High-Risk Zones Map</h3>
        <div className="map-placeholder">
          <MapView reports={topBarangays} />
        </div>
      </div>

    </div>
  );
}
