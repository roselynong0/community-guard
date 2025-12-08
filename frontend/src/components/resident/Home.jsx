import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
import MapView from "./Mapview";
import LoadingScreen from "../shared/LoadingScreen";
import Toast from "../shared/Toast";
// Lazy-load the verification modal to avoid runtime import issues
const GetVerifiedModal = React.lazy(() => import("../shared/GetVerifiedModal"));
import { API_CONFIG, getApiUrl } from "../../utils/apiConfig";
import "./Home.css";

// ----------------- CONSTANTS -----------------
const CATEGORY_COLORS = {
  "Concern": "#4a76b9",      
  "Crime": "#d9534f",        
  "Hazard": "#f0ad4e",       
  "Lost&Found": "#5cb85c",  
  "Others": "#777777",
  default: "#2d2d73", 
};

// ----------------- FETCH UTILITY -----------------
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

function Home({ token, session }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState([
    { title: "Community Reports", value: 0, icon: <FaExclamationTriangle />, color: "primary" },
    { title: "Ongoing Cases", value: 0, icon: <FaSyncAlt />, color: "danger" },
    { title: "Resolved Cases", value: 0, icon: <FaCheckCircle />, color: "success" },
    { title: "Pending Reports", value: 0, icon: <FaClock />, color: "warning" },
  ]);
  const [recentReports, setRecentReports] = useState([]);
  const [categoryData, setCategoryData] = useState([{ name: "No Data", value: 0, color: "#e9ecef" }]); 
  const [_activeSlice, setActiveSlice] = useState(null);
  const [userBarangay, setUserBarangay] = useState(null);
  
  // Calculate total (0 for "No Data" state, actual sum otherwise)
  const hasRealData = categoryData.length > 0 && !(categoryData.length === 1 && categoryData[0].name === "No Data");
  const totalReports = hasRealData ? categoryData.reduce((s, c) => s + (c.value || 0), 0) : 0;
  
  // Prepare pie data - use value=1 for rendering "No Data" pie slice visually, but display 0
  const pieDisplayData = hasRealData 
    ? categoryData 
    : [{ name: "No Data", value: 1, color: "#e9ecef", displayValue: 0 }];

  // Custom tooltip to show category amount + percentage
  function CustomTooltip({ active, payload, total }) {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload || payload[0];
    // Use displayValue if available (for "No Data" state), otherwise use value
    const value = item.displayValue !== undefined ? item.displayValue : (item.value || 0);
    // For "No Data" state, show 100% since the gray represents the full pie
    const isNoData = item.name === "No Data" && item.displayValue === 0;
    const pct = isNoData ? "100.0" : (total ? ((value / total) * 100).toFixed(1) : "0.0");
    return (
      <div className="custom-tooltip">
        <div style={{ fontWeight: 700 }}>{item.name}</div>
        <div style={{ color: 'var(--muted)' }}>{value} reports · {pct}%</div>
      </div>
    );
  }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overlayExited, setOverlayExited] = useState(false);
  const [showGetVerifiedModal, setShowGetVerifiedModal] = useState(false);
  const [userProfile, setUserProfile] = useState(null); // Store full profile for GetVerifiedModal
  const toastRef = useRef(null);
  const getCategoryColor = useCallback((categoryName) => {
    return CATEGORY_COLORS[categoryName] || CATEGORY_COLORS.default;
  }, []);


  useEffect(() => {
    if (!token) return;

    // Check if user came from login (URL has ?showMissed=1)
    const urlParams = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '');
    const showMissedParam = urlParams.get('showMissed') || urlParams.get('show_missed');
    const cameFromLogin = showMissedParam === '1';

    // Fetch missed-summary and show toast (only if user came from login)
    const fetchMissedSummaryAndShowToast = async () => {
      // Only fetch if user came from login with ?showMissed=1
      if (!cameFromLogin) {
        console.log('📊 Skipping missed summary - user did not come from login');
        return;
      }
      
      try {
        const toastKey = `missed_toast_home_${session?.user?.id || session?.user?.email || 'anon'}`;
        if (sessionStorage.getItem(toastKey)) return; // Already shown toast this session
        
        const res = await fetch(getApiUrl('/api/reports/missed_summary'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res) return;
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok) return;
        
        if (contentType.includes('application/json')) {
          const data = await res.json().catch(() => null);
          if (data && data.status === 'success' && data.summary) {
            const totalMissed = data.summary.total || 0;
            const barangayCounts = data.summary.barangays || {};
            
            // Show toast after a short delay
            if (totalMissed > 0) {
              setTimeout(() => {
                if (toastRef.current) {
                  const userBarangayName = data.summary.user_barangay || session?.user?.address_barangay || '';
                  const missedInBarangay = userBarangayName ? (barangayCounts[userBarangayName] || 0) : totalMissed;
                  
                  if (missedInBarangay > 0) {
                    toastRef.current.show(
                      `📢 You missed ${missedInBarangay} report${missedInBarangay > 1 ? 's' : ''} in ${userBarangayName || 'your area'} while you were away.`,
                      'info'
                    );
                  } else {
                    toastRef.current.show(
                      `📢 You missed ${totalMissed} report${totalMissed > 1 ? 's' : ''} while you were away.`,
                      'info'
                    );
                  }
                }
              }, 2000);
              // Mark toast as shown for this session to prevent duplicates
              try { sessionStorage.setItem(toastKey, '1'); } catch { /* ignore */ }
            }
          }
        }
      } catch (e) {
        console.debug('missed summary fetch error', e);
      }
    };

    const fetchData = async () => {
      setLoading(true);
        // Reset overlay exited flag when a new loading cycle starts
        setOverlayExited(false);
        setError(null);
        try {
          // Show toast for missed reports (non-blocking)
          fetchMissedSummaryAndShowToast();        // 1. Fetch user profile first to get their barangay from info table
        let barangay = null;
        try {
          const profileEndpoint = getApiUrl(API_CONFIG.endpoints.profile);
          const profileRes = await fetchWithToken(profileEndpoint, token);
          if (profileRes.status === "success" && profileRes.profile) {
            // address_barangay comes from info table via profile endpoint
            const userBarangayValue = profileRes.profile.address_barangay;
            // Only use barangay if it's a valid value (not the default placeholder)
            if (userBarangayValue && userBarangayValue !== "No barangay selected") {
              barangay = userBarangayValue;
              setUserBarangay(barangay);
              console.log("📍 User barangay from info table:", barangay);
            } else {
              console.log("📍 User has no barangay set in info table - showing all reports");
            }
          }
        } catch (profileErr) {
          console.warn("Could not fetch user barangay:", profileErr);
        }
        
        // 2. Fetch stats filtered by user's barangay (if set)
        const statsEndpoint = getApiUrl(API_CONFIG.endpoints.stats + (barangay ? `?barangay=${encodeURIComponent(barangay)}` : ''));
        const statsRes = await fetchWithToken(statsEndpoint, token);
        if (statsRes.status === "success") {
          setStats([
            { title: "Community Reports", value: statsRes.totalReports || 0, icon: <FaExclamationTriangle />, color: "primary" },
            { title: "Ongoing Cases", value: statsRes.ongoing || 0, icon: <FaSyncAlt />, color: "danger" },
            { title: "Resolved Cases", value: statsRes.resolved || 0, icon: <FaCheckCircle />, color: "success" },
            { title: "Pending Reports", value: statsRes.pending || 0, icon: <FaClock />, color: "warning" },
          ]);
        }

        // 3. Fetch categories filtered by user's barangay from info table
        const categoryEndpoint = getApiUrl(
          API_CONFIG.endpoints.reports + 
          `/categories?filter=all${barangay ? `&barangay=${encodeURIComponent(barangay)}` : ''}`
        );
        const categoryRes = await fetchWithToken(categoryEndpoint, token);
        if (categoryRes.status === "success" && categoryRes.data && categoryRes.data.length > 0) {
          const formattedCategoryData = categoryRes.data.map(item => ({
            ...item,
            color: getCategoryColor(item.name),
          }));
          setCategoryData(formattedCategoryData);
          console.log("📊 Categories loaded for barangay:", barangay || "All", categoryRes.data.length, "categories");
        } else {
          setCategoryData([{ name: "No Data", value: 0, color: "#e9ecef" }]);
        }

        // 4. Fetch recent reports filtered by user's barangay from info table
        const reportsEndpoint = getApiUrl(
          API_CONFIG.endpoints.reports + 
          `?limit=5&sort=desc&filter=all${barangay ? `&barangay=${encodeURIComponent(barangay)}` : ''}`
        );
        const recentRes = await fetchWithToken(reportsEndpoint, token);
        setRecentReports(recentRes.status === "success" ? recentRes.reports : []);
        console.log("📋 Recent reports loaded for barangay:", barangay || "All", recentRes.reports?.length || 0, "reports");
        
      } catch (err) {
        console.debug('missed summary load error', err);
        console.debug('missed summary load error', err);
        console.error("Dashboard fetch error:", err);
        setError("Failed to load dashboard");
        setStats([
          { title: "Total Reports", value: 0, icon: <FaExclamationTriangle />, color: "primary" },
          { title: "Ongoing Cases", value: 0, icon: <FaSyncAlt />, color: "danger" },
          { title: "Resolved Cases", value: 0, icon: <FaCheckCircle />, color: "success" },
          { title: "Pending Reports", value: 0, icon: <FaClock />, color: "warning" },
        ]);
        setRecentReports([]);
        setCategoryData([
          { name: "No Data", value: 0, color: "#e9ecef" }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, session?.user?.role, session?.user?.email, session?.user?.id, getCategoryColor]);

  // Check verification status after login and show GetVerifiedModal if needed
  useEffect(() => {
    if (!token) return;

    // Check URL params - only show modal when coming from login
    const urlParams = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '');
    const showMissedParam = urlParams.get('showMissed') || urlParams.get('show_missed');
    const cameFromLogin = showMissedParam === '1';
    
    if (!cameFromLogin) return;

    // Avoid showing modal multiple times
    const verifyModalKey = `verify_modal_shown_${session?.user?.id || session?.user?.email || 'anon'}`;
    if (sessionStorage.getItem(verifyModalKey)) return;

    let cancelled = false;
    (async () => {
      try {
        // Fetch latest profile to check verification flags
        const profileUrl = getApiUrl(API_CONFIG.endpoints.profile);
        const profileResp = await fetchWithToken(profileUrl, token).catch(() => null);
        const profileData = profileResp && profileResp.profile ? profileResp.profile : profileResp || {};

        // Check info.verified (from profile response)
        const infoVerified = profileData.verified === true;

        console.log('🔐 Verification check:', { infoVerified });

        if (!cancelled) {
          setUserProfile(profileData);
          
          // Show GetVerifiedModal if not verified
          if (!infoVerified) {
            setShowGetVerifiedModal(true);
            try { sessionStorage.setItem(verifyModalKey, '1'); } catch { /* ignore */ }
          }
        }
      } catch (err) {
        console.debug('verification check error', err);
      }
    })();

    return () => { cancelled = true; };
  }, [token, session?.user?.id, session?.user?.email]);

  // Profile update handler passed to verification modal
  const handleProfileUpdate = async (updateData) => {
    try {
      const profileUrl = getApiUrl(API_CONFIG.endpoints.profile);
      const res = await fetch(profileUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(updateData)
      });
      if (!res.ok) throw new Error('Update failed');
      // on success, close verification modal
      setShowGetVerifiedModal(false);
      // Show success toast
      if (toastRef.current) {
        toastRef.current.show('Profile updated successfully!', 'success');
      }
      return true;
    } catch (e) {
      console.error('profile update error', e);
      return false;
    }
  };

  const loadingFeatures = [
    {
      title: "Dashboard Overview",
      description:
        "Dashboard allows you to view recent reports and monitor ongoing cases.",
    },
    {
      title: "Community Map",
      description:
        "The map show the Communities' location of Olongapo City.",
    },
  ];

  const handleReportClick = (reportId) => {
    const isAdmin = session?.user?.role === "Admin";
    
    if (isAdmin) {
      navigate(`/admin/reports?highlight=${reportId}`);
    } else {
      navigate(`/reports?highlight=${reportId}`);
    }
  };

  const mapRef = useRef(null);

  // REMOVED: Duplicate missed-summary fetch that was showing modal without login check
  // The fetchMissedSummary in the main fetchData useEffect already handles this correctly
  // by checking for ?showMissed=1 parameter

  const mapSection = (
    <div className="map-section" style={{ animationDelay: "0.5s" }}>
      <h3>{userBarangay ? `${userBarangay} Community Map` : 'Community Map'}</h3>
      <div className="map-placeholder">
        <MapView ref={mapRef} barangay={userBarangay} /> 
      </div>
    </div>
  );

  const contentWithoutMap = (
    <div className={`dashboard ${overlayExited ? 'overlay-exited' : ''}`}>
      {error && <p className="error">{error}</p>}

      <div className="stats-grid">
        {stats.map((stat, i) => (
          <div
            key={i}
            className={`stat-card ${stat.color}`}
          >
            <div className="stat-content">
              <div className="stat-icon">{stat.icon}</div>
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
          <h3>{userBarangay ? `Recent Reports in ${userBarangay}` : 'Recent Reports'}</h3>
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
                    <span className="report-barangay">📍 {report.address_barangay || "Unknown"}</span>
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
            {/* Use a numeric height so Recharts can measure reliably */}
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieDisplayData}
                    cx="50%"
                    cy="50%"
                    innerRadius="55%"
                    outerRadius="70%"
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    labelLine={false}
                    onMouseEnter={(_, index) => setActiveSlice(index)}
                    onMouseLeave={() => setActiveSlice(null)}
                  >
                    {pieDisplayData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={<CustomTooltip total={totalReports} />} 
                    position={{ x: 10, y: 10 }}
                    wrapperStyle={{ position: 'absolute', top: 10, left: 10 }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center label showing total */}
              <div className="chart-center" aria-hidden>
                <div className="value">{totalReports}</div>
                <div className="label">Total reports</div>
              </div>
            </div>
            {/* custom legend will be rendered inside the card (below chart) */}
            <div className="custom-legend">
              {categoryData.map((cat, idx) => {
                // Use displayValue if available (for "No Data" state), otherwise use value
                const value = cat.displayValue !== undefined ? cat.displayValue : (cat.value || 0);
                // For "No Data" state, show 100% since the gray represents the full pie
                const isNoData = !hasRealData && cat.name === "No Data";
                const pct = isNoData ? '100' : (totalReports ? ((value / totalReports) * 100).toFixed(0) : '0');
                return (
                  <div key={idx} className="legend-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="legend-chip" style={{ background: cat.color }} />
                      <span className="legend-name">{cat.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="legend-pct">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
      </div>
      {mapSection}
    </div>
  );
  

  return (
    <>
    <Toast ref={toastRef} />
    <LoadingScreen
      variant="inline"
      features={loadingFeatures}
      title={loading ? "Loading dashboard..." : undefined}
      subtitle={loading ? "Fetching latest stats and reports" : undefined}
      stage={loading ? "loading" : "exit"}
      onExited={() => {
        setOverlayExited(true);
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
          try { mapRef.current?.invalidate?.(); } catch (e) { console.debug('map invalidate error', e); }
        }, 120);
      }}
      inlineOffset="25vh"
    >
      {contentWithoutMap}
    </LoadingScreen>
    {/* GetVerifiedModal for unverified users */}
    <React.Suspense fallback={null}>
      <GetVerifiedModal
        open={showGetVerifiedModal}
        onSkip={() => setShowGetVerifiedModal(false)}
        onProfileUpdate={handleProfileUpdate}
        user={userProfile || session?.user}
      />
    </React.Suspense>
    </>
  );
}

export default Home;