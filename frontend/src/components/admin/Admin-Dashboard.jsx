import React, { useState, useEffect, useRef } from "react";
import {
  FaExclamationTriangle,
  FaCheckCircle,
  FaSyncAlt,
  FaClock,
  FaFilter,
  FaMapMarkerAlt,
  FaUsers,
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

import { API_CONFIG, getApiUrl } from "../../utils/apiConfig";
import MapView from "../resident/Mapview";
import "../barangay/BarangayDashboard.css";
import "../shared/Notification.css";
import LoadingScreen from "../shared/LoadingScreen";
import ModalPortal from "../shared/ModalPortal";

// ✅ Fetch helper (same as barangay dashboard)
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

// ✅ AnimatedNumber component
function AnimatedNumber({ value, duration = 800 }) {
  const [display, setDisplay] = useState(value);
  const startRef = useRef(null);
  const fromRef = useRef(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (value === null || value === undefined) {
      setDisplay(null);
      return;
    }
    
    const to = Number(value) || 0;
    
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDisplay(to);
      fromRef.current = to;
      return;
    }
    
    const from = fromRef.current ?? to;
    
    if (from === to) {
      setDisplay(to);
      return;
    }
    
    const start = performance.now();
    startRef.current = start;
    let raf = null;

    function easeOutQuad(t) {
      return t * (2 - t);
    }

    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutQuad(t);
      const current = Math.round(from + (to - from) * eased);
      setDisplay(current);
      if (t < 1) raf = requestAnimationFrame(frame);
      else fromRef.current = to;
    }

    raf = requestAnimationFrame(frame);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [value, duration]);

  if (display === null) {
    return <p className="stat-loading">—</p>;
  }
  
  return <p>{display}</p>;
}

export default function AdminDashboard({ token }) {
  const [stats, setStats] = useState([
    { title: "Total Reports", value: null, icon: <FaExclamationTriangle />, colorClass: "primary" },
    { title: "Ongoing", value: null, icon: <FaSyncAlt />, colorClass: "danger" },
    { title: "Resolved", value: null, icon: <FaCheckCircle />, colorClass: "success" },
    { title: "Pending", value: null, icon: <FaClock />, colorClass: "warning" },
  ]);

  const [trendData, setTrendData] = useState([]);
  const [topBarangays, setTopBarangays] = useState([]);
  const [totalBarangays, setTotalBarangays] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reportView, setReportView] = useState("barangay"); // Toggle between "barangay" and "monthly"
  const [notification, setNotification] = useState(null);
  const [overlayExited, setOverlayExited] = useState(false);

  const loadingFeatures = [
    { title: "Admin Overview", description: "Loading system-wide statistics and trends." },
    { title: "All Barangays", description: "Preparing data for all barangays in the system." },
  ];

  // Notification handler
  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // ✅ Single useEffect to fetch admin dashboard data (all barangays)
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    
    const fetchAllData = async () => {
      setLoading(true);
      setOverlayExited(false);
      try {
        // Admin dashboard fetches ALL reports across ALL barangays
        console.log("🔄 Fetching admin dashboard data for ALL barangays");
        
        // Use admin-specific endpoint that returns system-wide stats
        const dashboardEndpoint = getApiUrl(`/api/dashboard/admin/stats?filter=all`);
        console.log("📊 Fetching all data from:", dashboardEndpoint);
        
        const response = await fetchWithToken(dashboardEndpoint, token);
        
        if (response.status === "success") {
          console.log("✅ Admin dashboard data loaded:", response);
          
          // Update stats (system-wide)
          if (response.stats) {
            console.log("📊 System-wide stats:", response.stats);
            setStats([
              {
                title: "Total Reports",
                value: response.stats.totalReports || 0,
                icon: <FaExclamationTriangle />,
                colorClass: "primary",
              },
              {
                title: "Ongoing",
                value: response.stats.ongoing || 0,
                icon: <FaSyncAlt />,
                colorClass: "danger",
              },
              {
                title: "Resolved",
                value: response.stats.resolved || 0,
                icon: <FaCheckCircle />,
                colorClass: "success",
              },
              {
                title: "Pending",
                value: response.stats.pending || 0,
                icon: <FaClock />,
                colorClass: "warning",
              },
            ]);
          }
          
          // Update monthly trends (system-wide)
          if (response.trends && response.trends.length > 0) {
            console.log("📅 Monthly trends (all barangays):", response.trends.length, "months");
            setTrendData(response.trends);
          } else {
            console.warn("⚠️ No trend data available");
            setTrendData([]);
          }
          
          // Update top barangays
          if (response.topBarangays && response.topBarangays.length > 0) {
            console.log("🏘️ Top barangays loaded:", response.topBarangays.length);
            setTopBarangays(response.topBarangays);
            setTotalBarangays(response.topBarangays.length);
          } else {
            setTopBarangays([]);
          }

          // Update total users if available
          if (response.totalUsers) {
            setTotalUsers(response.totalUsers);
          }
        } else {
          console.warn("⚠️ Dashboard response not successful:", response);
        }

        console.log("✅ Admin dashboard data fetch completed");

      } catch (error) {
        console.error("❌ Failed to load admin dashboard data:", error);
        console.error("Error details:", error.message, error.stack);
        showNotification("Failed to load dashboard data", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [token]);

  const mapRef = useRef(null);

  const content = (
    <div className={`dashboard admin-dashboard ${overlayExited ? 'overlay-exited' : ''}`}>
      {/* --- STAT CARDS (System-wide) --- */}
      <div className="stats-grid">
        {stats.map((stat, i) => (
          <div
            key={i}
            className={`stat-card ${stat.colorClass}`}
          >
            <div className="stat-content">
              <div className="stat-icon">
                {stat.icon}
              </div>
              <div className="stat-text">
                <h4>{stat.title}</h4>
                <AnimatedNumber value={stat.value} duration={900} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* --- ADDITIONAL ADMIN STATS --- */}
      <div className="stats-grid stats-grid-secondary">
        <div className="stat-card info">
          <div className="stat-content">
            <div className="stat-icon">
              <FaMapMarkerAlt />
            </div>
            <div className="stat-text">
              <h4>Total Barangays</h4>
              <AnimatedNumber value={totalBarangays} duration={900} />
            </div>
          </div>
        </div>
        <div className="stat-card info">
          <div className="stat-content">
            <div className="stat-icon">
              <FaUsers />
            </div>
            <div className="stat-text">
              <h4>Total Users</h4>
              <AnimatedNumber value={totalUsers} duration={900} />
            </div>
          </div>
        </div>
      </div>

      {/* --- COMBINED TRENDS SECTION (All Barangays & Monthly Reports) --- */}
      <div className="section-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h3 style={{ margin: 0 }}>
            {reportView === "barangay" ? "All Barangays Report Summary" : "Monthly Report Summary (All Barangays)"}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <FaFilter style={{ fontSize: "0.875rem", color: "#666" }} />
            {/* Report View Toggle - Admin has full access to monthly reports */}
            <select
              value={reportView}
              onChange={(e) => setReportView(e.target.value)}
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid #e0e0e0",
                fontSize: "0.875rem",
                fontWeight: "500",
                backgroundColor: "#fff",
                color: "#333",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <option value="barangay">Barangay Trends</option>
              <option value="monthly">📊 Monthly Reports</option>
            </select>
          </div>
        </div>

        {/* Chart Tabs Component */}
        <ChartTabs
          reportView={reportView}
          trendData={trendData}
          topBarangays={topBarangays}
        />
      </div>

      {/* --- MAP (All Barangays) --- */}
      <div className="map-section">
        <h3>City-Wide Incident Map</h3>
        <div className="map-placeholder">
          <MapView ref={mapRef} barangay={null} /> {/* null = show all barangays */}
        </div>
      </div>

      {/* Toast Notification */}
      {notification && (
        <ModalPortal>
          <div 
            className={`notif notif-${notification.type}`}
            role="alert" 
            aria-live="assertive"
          >
            {notification.message}
          </div>
        </ModalPortal>
      )}
    </div>
  );

  return (
    <LoadingScreen
      variant="inline"
      features={loadingFeatures}
      title={loading ? "Loading Admin Dashboard..." : undefined}
      subtitle={loading ? "Fetching system-wide stats and trends" : undefined}
      stage={loading ? "loading" : "exit"}
      onExited={() => {
        setOverlayExited(true);
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
          try {
            mapRef.current?.invalidate();
            setTimeout(() => {
              try { mapRef.current?.invalidate(); } catch { /* ignore */ }
            }, 160);
          } catch {
            // ignore
          }
        }, 120);
      }}
      inlineOffset="18vh"
    >
      {content}
    </LoadingScreen>
  );
}

// Chart Tabs component - shows both Barangay comparison and Monthly trends
function ChartTabs({ reportView, trendData, topBarangays }) {
  const [tab, setTab] = useState('chart');

  // Color palette for pies/legends
  const palette = ["#4a76b9","#d9534f","#f0ad4e","#5cb85c","#777777","#8e44ad","#16a085","#e74c3c","#3498db","#9b59b6","#1abc9c","#f39c12","#2ecc71","#e67e22","#95a5a6","#34495e","#27ae60","#c0392b"];

  // Build the pie data depending on the active report view
  const pieData = React.useMemo(() => {
    if (reportView === 'barangay') {
      return (topBarangays || []).map(b => ({ name: b.barangay, value: parseInt(b.total) || 0 }));
    }
    // monthly view -> use trendData (month / count)
    return (trendData || []).map(t => ({ name: t.month || t.label || 'Unknown', value: parseInt(t.count) || 0 }));
  }, [reportView, topBarangays, trendData]);

  const pieTotal = (pieData || []).reduce((s, d) => s + (d.value || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={tab === 'chart' ? 'tab-active' : 'tab-inactive'}
            onClick={() => setTab('chart')}
            style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}
          >Chart</button>
          <button
            className={tab === 'pie' ? 'tab-active' : 'tab-inactive'}
            onClick={() => setTab('pie')}
            style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}
          >Pie</button>
        </div>
      </div>

      <div>
        {tab === 'chart' ? (
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              {reportView === 'barangay' ? (
                <BarChart data={topBarangays.map(item => ({...item, Total: parseInt(item.total) || 0}))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="barangay" angle={-45} textAnchor="end" height={80} interval={0} fontSize={11} />
                  <YAxis allowDecimals={false} type="number" domain={[0, 'dataMax + 1']} />
                  <Tooltip formatter={(value) => parseInt(value)} />
                  <Legend />
                  <Bar dataKey="Total" fill="#2d2d73" isAnimationActive={true} animationDuration={900} />
                </BarChart>
              ) : (
                <LineChart data={trendData.map(item => ({...item, Count: parseInt(item.count) || 0}))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} type="number" domain={[0, 'dataMax + 1']} />
                  <Tooltip formatter={(value) => parseInt(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="Count" stroke="#2d2d73" strokeWidth={2} isAnimationActive={true} animationDuration={900} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="reports-chart">
            <h4 style={{ marginTop: 0 }}>{reportView === 'barangay' ? 'All Barangays Distribution' : 'Monthly Distribution'}</h4>
            <div className="chart-container">
              <div className="chart-wrapper" style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={100}
                      dataKey="value"
                      paddingAngle={2}
                      nameKey="name"
                    >
                      {pieData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={palette[idx % palette.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>

                <div className="chart-center" aria-hidden={true}>
                  <div className="value">{pieTotal}</div>
                  <div className="label">Total reports</div>
                </div>
              </div>

              <div className="custom-legend" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                {pieData.length === 0 ? (
                  <div style={{ padding: 12, color: '#666' }}>No data to display.</div>
                ) : (
                  pieData.map((d, idx) => (
                    <div key={idx} className="legend-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="legend-chip" style={{ background: palette[idx % palette.length] }} />
                        <span className="legend-name">{d.name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className="legend-pct">{d.value}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
