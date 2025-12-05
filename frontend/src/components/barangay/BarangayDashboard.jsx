import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaExclamationTriangle,
  FaCheckCircle,
  FaSyncAlt,
  FaClock,
  FaFilter,
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
import "./BarangayDashboard.css";
import "../shared/Notification.css";
import LoadingScreen from "../shared/LoadingScreen";
import ModalPortal from "../shared/ModalPortal";

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

// ✅ AnimatedNumber component - MOVED OUTSIDE to prevent ref reset on parent re-renders
// Counts from previous to new value smoothly, skips animation on initial load
function AnimatedNumber({ value, duration = 800 }) {
  const [display, setDisplay] = useState(value);
  const startRef = useRef(null);
  const fromRef = useRef(null); // null initially to detect first render
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Handle null/undefined - show nothing during initial load
    if (value === null || value === undefined) {
      setDisplay(null);
      return;
    }
    
    const to = Number(value) || 0;
    
    // Skip animation on first meaningful value (avoid 0 → actual flash)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDisplay(to);
      fromRef.current = to;
      return;
    }
    
    const from = fromRef.current ?? to;
    
    // Skip animation if no change
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

  // Show dash placeholder during loading
  if (display === null) {
    return <p className="stat-loading">—</p>;
  }
  
  return <p>{display}</p>;
}

export default function BarangayDashboard({ token }) {
  const navigate = useNavigate();

  const [stats, setStats] = useState([
    { title: "Total Reports", value: null, icon: <FaExclamationTriangle />, colorClass: "primary" },
    { title: "Ongoing", value: null, icon: <FaSyncAlt />, colorClass: "danger" },
    { title: "Resolved", value: null, icon: <FaCheckCircle />, colorClass: "success" },
    { title: "Pending", value: null, icon: <FaClock />, colorClass: "warning" },
  ]);

  const [trendData, setTrendData] = useState([]);
  const [topBarangays, setTopBarangays] = useState([]);
  const [userBarangay, setUserBarangay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportView, setReportView] = useState("barangay"); // Toggle between "barangay" and "monthly"
  const [onpremium, setOnpremium] = useState(false); // Premium status
  const [showPremiumModal, setShowPremiumModal] = useState(false); // Premium upgrade modal
  const [notification, setNotification] = useState(null); // Toast notification
  const [overlayExited, setOverlayExited] = useState(false);

  const loadingFeatures = [
    { title: "Barangay Overview", description: "Loading barangay statistics and trends." },
    { title: "Maps & Hotspots", description: "Preparing high-risk zones and top barangays." },
  ];

  // Notification handler
  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // ✅ Single useEffect to fetch profile and dashboard data
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    
    const fetchAllData = async () => {
      setLoading(true);
      setOverlayExited(false);
      try {
        // 1. Fetch profile first to get barangay from info table and premium status
        const profileResponse = await fetchWithToken(getApiUrl('/api/profile'), token);
        if (profileResponse.status !== "success") {
          console.error("Failed to load profile:", profileResponse);
          setLoading(false);
          return;
        }
        
        const profile = profileResponse.profile;
        
        // Set premium status
        const isPremium = profile?.onpremium === true;
        setOnpremium(isPremium);
        console.log('📊 User premium status:', isPremium);
        
        // Get address_barangay from info table (via profile endpoint)
        const userBarangayValue = profile?.address_barangay;
        // Only use barangay if it's a valid value (not the default placeholder)
        const selectedBarangay = (userBarangayValue && userBarangayValue !== "No barangay selected") 
          ? userBarangayValue 
          : null;
        
        setUserBarangay(selectedBarangay);
        console.log('🏘️ User barangay from info table:', selectedBarangay || 'Not set');
        
        if (!selectedBarangay) {
          console.warn('No address_barangay set in info table — skipping barangay-specific dashboard fetch');
          setTopBarangays([]);
          setTrendData([]);
          // still allow stats to be empty or default
        } else {
          console.log("🔄 Fetching dashboard data for barangay:", selectedBarangay);
          // 2. Fetch dashboard data scoped to the user's barangay from info table
          // This includes stats, top barangays, and monthly trends filtered by this barangay
          // Use filter=all to get all-time stats (not just this month)
          const dashboardEndpoint = getApiUrl(`/api/dashboard/barangay/stats?barangay=${encodeURIComponent(selectedBarangay)}&filter=all`);
          console.log("📊 Fetching all data from:", dashboardEndpoint);
          const response = await fetchWithToken(dashboardEndpoint, token);
        
          if (response.status === "success") {
          console.log("✅ Dashboard data loaded for barangay:", selectedBarangay, response);
          
          // Update stats (filtered by user's barangay from info table)
          if (response.stats) {
            console.log("📊 Stats for barangay", selectedBarangay, ":", response.stats);
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
          
          // Update monthly trends (filtered by user's barangay from info table)
          if (response.trends && response.trends.length > 0) {
            console.log("📅 Monthly trends for barangay", selectedBarangay, ":", response.trends.length, "months");
            setTrendData(response.trends);
          } else {
            console.warn("⚠️ No trend data available for barangay:", selectedBarangay);
            setTrendData([]);
          }
          
          // Update top barangays (shows all barangays for comparison)
          if (response.topBarangays && response.topBarangays.length > 0) {
            console.log("🏘️ Top barangays loaded:", response.topBarangays.length);
            setTopBarangays(response.topBarangays);
          } else {
            setTopBarangays([]);
          }
          } else {
            console.warn("⚠️ Dashboard response not successful:", response);
          }
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

  const mapRef = useRef(null);

  const content = (
    <div className={`dashboard ${overlayExited ? 'overlay-exited' : ''}`}>
      {/* --- STAT CARDS (Dynamic) --- */}
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

      {/* --- COMBINED TRENDS SECTION (Barangay Trends & Monthly Reports) --- */}
      <div className="section-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h3 style={{ margin: 0 }}>
            {reportView === "barangay" ? "Barangays with Most Reports" : "Monthly Report Summary"}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <FaFilter style={{ fontSize: "0.875rem", color: "#666" }} />
            {/* Report View Toggle */}
            <select
              value={reportView}
              onChange={(e) => {
                const newView = e.target.value;
                // Check premium status before allowing monthly view
                if (newView === "monthly" && !onpremium) {
                  console.log('📊 Monthly reports require premium - showing upgrade modal');
                  showNotification('✨ Premium feature - Upgrade to unlock Monthly Reports', 'premium');
                  setShowPremiumModal(true);
                  return; // Don't change view
                }
                setReportView(newView);
              }}
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
              <option value="monthly">✨ Monthly Reports</option>
            </select>
          </div>
        </div>

        {/* Single section-card: tabs to switch between Chart and Pie (pie shown in same container) */}
        <ChartTabs
          reportView={reportView}
          trendData={trendData}
          topBarangays={topBarangays}
        />
      </div>

      {/* --- MAP --- */}
      <div className="map-section">
        <h3>High-Risk Zones Map</h3>
        <div className="map-placeholder">
          <MapView ref={mapRef} barangay={userBarangay} />
        </div>
      </div>

      {/* --- PREMIUM UPGRADE MODAL --- */}
      {showPremiumModal && (
        <ModalPortal>
        <div 
          className="modal-overlay premium-modal-overlay"
          onClick={() => setShowPremiumModal(false)}
        >
          <div 
            className="modal premium-upgrade-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="premium-modal-header">
              <h3>✨ Premium Feature</h3>
              <button
                className="premium-modal-close"
                onClick={() => setShowPremiumModal(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="premium-modal-body">
              <div className="premium-feature-highlight">
                <div className="premium-feature-icon">📊</div>
                <div className="premium-feature-title">Monthly Report Summary</div>
                <p className="premium-feature-desc">
                  Access detailed monthly report analytics and trends. This feature is reserved for Premium subscribers.
                </p>
              </div>

              <div className="premium-benefits-section">
                <div className="premium-benefits-title">✨ Premium Benefits</div>
                <ul className="premium-benefits-list">
                  <li>📊 Monthly report summaries</li>
                  <li>⏱️ Unlimited Smart Filter usage</li>
                  <li>📈 Advanced analytics</li>
                  <li>🚀 Priority support</li>
                </ul>
              </div>
            </div>

            <div className="premium-modal-actions">
              <button 
                className="premium-btn-cancel"
                onClick={() => setShowPremiumModal(false)}
              >
                Close
              </button>
              <button 
                className="premium-btn-upgrade"
                onClick={() => {
                  console.log('User clicked upgrade button');
                  showNotification('🚀 Redirecting to Premium page...', 'premium');
                  setShowPremiumModal(false);
                  // Navigate to premium page
                  setTimeout(() => navigate('/barangay/premium'), 500);
                }}
              >
                ✨ Upgrade Now
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Toast Notification - wrapped in ModalPortal for proper z-index */}
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
      title={loading ? "Loading Dashboard..." : undefined}
      subtitle={loading ? "Fetching barangay stats and trends" : undefined}
      stage={loading ? "loading" : "exit"}
      onExited={() => {
        setOverlayExited(true);
        setTimeout(() => {
          // Trigger a window resize then invalidate the Leaflet map twice with a short delay
          // to ensure Leaflet recalculates container size after the loading overlay is removed.
          window.dispatchEvent(new Event('resize'));
          try {
            mapRef.current?.invalidate();
            // Second invalidate after a short delay as a safeguard for stubborn layouts
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

// Small presentational tab component kept in same file for convenience
function ChartTabs({ reportView, trendData, topBarangays }) {
  const [tab, setTab] = useState('chart');

  // Color palette for pies/legends
  const palette = ["#4a76b9","#d9534f","#f0ad4e","#5cb85c","#777777","#8e44ad","#16a085"];

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
            <ResponsiveContainer width="100%" height={260}>
              {reportView === 'barangay' ? (
                <BarChart data={topBarangays.map(item => ({...item, Total: parseInt(item.total) || 0}))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="barangay" />
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
            <h4 style={{ marginTop: 0 }}>{reportView === 'barangay' ? 'Top Barangays' : 'Monthly Distribution'}</h4>
            <div className="chart-container">
              <div className="chart-wrapper" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
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

              <div className="custom-legend">
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