import React, { useState, useEffect, useCallback, useRef } from "react";
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
import LoadingScreen from "./LoadingScreen";
// Lazy-load the missed-summary modal and verification modal to avoid runtime import issues
const MissedSummaryModal = React.lazy(() => import("./MissedSummaryModal"));
const GetVerifiedModal = React.lazy(() => import("./GetVerifiedModal"));
import { API_CONFIG, getApiUrl } from "../utils/apiConfig";
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
  const [stats, setStats] = useState([
    { title: "Community Reports", value: 0, icon: <FaExclamationTriangle />, color: "primary" },
    { title: "Ongoing Cases", value: 0, icon: <FaSyncAlt />, color: "danger" },
    { title: "Resolved Cases", value: 0, icon: <FaCheckCircle />, color: "success" },
    { title: "Pending Reports", value: 0, icon: <FaClock />, color: "warning" },
  ]);
  const [recentReports, setRecentReports] = useState([]);
  const [categoryData, setCategoryData] = useState([{ name: "No Data", value: 1, color: "#ccc" }]); 
  const [_activeSlice, setActiveSlice] = useState(null);
  const [userBarangay, setUserBarangay] = useState(null);
  const totalReports = categoryData.reduce((s, c) => s + (c.value || 0), 0);

  // Custom tooltip to show category amount + percentage
  function CustomTooltip({ active, payload, total }) {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload || payload[0];
    const value = item.value || 0;
    const pct = total ? ((value / total) * 100).toFixed(1) : "0.0";
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
  const [missedSummary, setMissedSummary] = useState(null);
  const [showMissedModal, setShowMissedModal] = useState(false);
  const [showGetVerifiedModal, setShowGetVerifiedModal] = useState(false);
  const [isInfoVerified, setIsInfoVerified] = useState(true); // Track if user info.verified is true
  const [userProfile, setUserProfile] = useState(null); // Store full profile for GetVerifiedModal
  const getCategoryColor = useCallback((categoryName) => {
    return CATEGORY_COLORS[categoryName] || CATEGORY_COLORS.default;
  }, []);


  useEffect(() => {
    if (!token) return;

    // Check if user came from login (URL has ?showMissed=1)
    const urlParams = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '');
    const showMissedParam = urlParams.get('showMissed') || urlParams.get('show_missed');
    const cameFromLogin = showMissedParam === '1';

    // Fetch missed-summary only if user came from login
    const fetchMissedSummary = async () => {
      // Only fetch if user came from login with ?showMissed=1
      if (!cameFromLogin) {
        console.log('📊 Skipping missed summary - user did not come from login');
        return;
      }
      
      try {
        const shownKey = `missed_shown_${session?.user?.id || session?.user?.email || 'anon'}`;
        if (sessionStorage.getItem(shownKey)) return;
        const res = await fetch(getApiUrl('/reports/missed_summary'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res) return;
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok) {
          // non-ok: skip
          return;
        }
        if (contentType.includes('application/json')) {
          const data = await res.json().catch(() => null);
          if (data && data.status === 'success' && data.summary) {
            setMissedSummary(data);
            // Don't show modal yet - wait for verification check
            sessionStorage.setItem(shownKey, '1');
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
        // attempt to fetch missed summary before other data
        await fetchMissedSummary();
        
        // 1. Fetch user profile first to get their barangay from info table
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
          setCategoryData([{ name: "No Data", value: 1, color: "#ccc" }]);
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
          { name: "No Data", value: 1, color: "#ccc" }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, session?.user?.role, session?.user?.email, session?.user?.id, getCategoryColor]);

  // When a missedSummary arrives, check verification status and show appropriate modal
  useEffect(() => {
    // Guard: only run when we have a missed summary and a valid token
    if (!missedSummary || !token) return;

    let cancelled = false;
    (async () => {
      try {
        // Fetch latest profile to check verification flags
        const profileUrl = getApiUrl(API_CONFIG.endpoints.profile);
        const profileResp = await fetchWithToken(profileUrl, token).catch(() => null);
        const profileData = profileResp && profileResp.profile ? profileResp.profile : profileResp || {};

        // Check users.isverified and info.verified (from profile response)
        const usersIsVerified = profileData.isverified === true;
        const infoVerified = profileData.verified === true; // info.verified is merged into profile

        console.log('🔐 Verification check:', { usersIsVerified, infoVerified });

        if (!cancelled) {
          setIsInfoVerified(infoVerified);
          setUserProfile(profileData); // Store full profile for GetVerifiedModal
          
          // Always show missed summary modal first (it was fetched because ?showMissed=1)
          // The button text will be "Continue" if not verified, "Continue to Dashboard" if verified
          setShowMissedModal(true);
        }
      } catch (err) {
        // fallback: show missed summary if verification check fails
        console.debug('verification check error', err);
        if (!cancelled) {
          setIsInfoVerified(false); // Assume not verified on error
          setShowMissedModal(true);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [missedSummary, token]);

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
      // on success, close verification modal and proceed to missed-summary
      setShowGetVerifiedModal(false);
      setShowMissedModal(true);
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
      window.location.href = `/admin/reports?highlight=${reportId}`;
    } else {
      window.location.href = `/reports?highlight=${reportId}`;
    }
  };

  const mapRef = useRef(null);

  // REMOVED: Duplicate missed-summary fetch that was showing modal without login check
  // The fetchMissedSummary in the main fetchData useEffect already handles this correctly
  // by checking for ?showMissed=1 parameter

  const mapSection = (
    <div className="map-section" style={{ animationDelay: "0.5s" }}>
      <h3>Community Map</h3>
      <div className="map-placeholder">
        <MapView ref={mapRef} /> 
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
            className={`stat-card ${stat.color} animate-up`}
            style={{ animationDelay: `${i * 0.1}s` }}
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
      <div className="middle-grid animate-up" style={{ animationDelay: "0.2s" }}>
        <div className="recent-reports animate-up" style={{ animationDelay: "0.3s" }}>
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
                    <span className="report-barangay">📍 {report.address_barangay || "Unknown"}</span>
                  </div>
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
            {/* Use a numeric height so Recharts can measure reliably */}
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
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
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip total={totalReports} />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Center label showing total */}
              <div className="chart-center" aria-hidden>
                <div className="value">{categoryData.reduce((s, c) => s + (c.value || 0), 0)}</div>
                <div className="label">Total reports</div>
              </div>
            </div>
            {/* custom legend will be rendered inside the card (below chart) */}
            <div className="custom-legend">
              {categoryData.map((cat, idx) => {
                const value = cat.value || 0;
                const pct = totalReports ? ((value / totalReports) * 100).toFixed(0) : '0';
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
    {/* Missed summary modal overlays the loading/dashboard as needed */}
    <React.Suspense fallback={null}>
      <GetVerifiedModal
        open={showGetVerifiedModal}
        onSkip={() => { setShowGetVerifiedModal(false); setShowMissedModal(true); }}
        onProfileUpdate={handleProfileUpdate}
        user={userProfile || session?.user}
      />

      <MissedSummaryModal
        open={showMissedModal && !showGetVerifiedModal}
        onClose={() => setShowMissedModal(false)}
        data={missedSummary}
        showProceedAsNext={!isInfoVerified}
        onProceed={() => {
          // User clicked "Next" (when not verified) - show GetVerified modal
          setShowMissedModal(false);
          setShowGetVerifiedModal(true);
        }}
      />
    </React.Suspense>
    </>
  );
}

export default Home;