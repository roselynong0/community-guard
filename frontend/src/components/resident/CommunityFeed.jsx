import React, { useState, useEffect, useCallback, useMemo } from "react";
import "./CommunityFeed.css";
import "./Notifications.css";
import { FaPaperPlane, FaUsers, FaTrash, FaHeart, FaRegHeart, FaFire, FaStar, FaClock, FaPlus, FaMinus, FaMapPin, FaSearch, FaTimes, FaUser } from "react-icons/fa";
import { getApiUrl, API_CONFIG } from "../../utils/apiConfig";
import LoadingScreen from "../shared/LoadingScreen";
import ModalPortal from "../shared/ModalPortal";

// ✅ POST TYPES
const POST_TYPES = ["incident", "safety", "suggestion", "recommendation", "general"];

// ✅ ROLE COLORS
const ROLE_COLORS = {
  "Admin": { bg: "rgba(139, 92, 246, 0.1)", text: "#8b5cf6" },
  "Barangay Official": { bg: "rgba(37, 99, 235, 0.1)", text: "#2563eb" },
  "Responder": { bg: "rgba(239, 68, 68, 0.1)", text: "#ef4444" },
  "Resident": { bg: "rgba(59, 130, 246, 0.1)", text: "#3b82f6" },
};

// ✅ BARANGAYS (Olongapo City)
const BARANGAYS = [
  "Barretto",
  "East Bajac-Bajac",
  "East Tapinac",
  "Gordon Heights",
  "Kalaklan",
  "Mabayuan",
  "New Asinan",
  "New Banicain",
  "New Cabalan",
  "New Ilalim",
  "New Kababae",
  "New Kalalake",
  "Old Cabalan",
  "Pag-Asa",
  "Santa Rita",
  "West Bajac-Bajac",
  "West Tapinac",
];

// Sort options - null means no sort active (show pending first)
const DEFAULT_SORT = null;

const CommunityFeed = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true); // Initial page loading
  const [isFilterLoading, setIsFilterLoading] = useState(false); // Filter/sort change loading (no fullscreen)
  const [openModal, setOpenModal] = useState(false);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("All Barangays");
  const [postTypeFilter, setPostTypeFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("latest"); // latest or oldest
  const [sortBy, setSortBy] = useState(DEFAULT_SORT); // null = pending first, 'trending' or 'top'
  const [userBarangay, setUserBarangay] = useState("");
  const [overlayExited, setOverlayExited] = useState(false);
  const [announcements, setAnnouncements] = useState([]); // LGU Announcements
  const [initialLoadDone, setInitialLoadDone] = useState(false); // Track if initial load completed
  
  // Trending section states
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [trendingExpanded, setTrendingExpanded] = useState(false); // Collapsed by default
  const [trendingTimeFilter, setTrendingTimeFilter] = useState("all"); // today, yesterday, this-month, all
  const [pendingExpanded, setPendingExpanded] = useState(false); // Show pending posts section
  
  // User verification status
  const [userVerified, setUserVerified] = useState(false); // True if users_info.verified = true
  const [userDataLoaded, setUserDataLoaded] = useState(false); // Track if user data has been loaded

  useEffect(() => {
    fetchUserBarangay();
    fetchAnnouncements();
  }, []);

  const fetchUserBarangay = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setUserDataLoaded(true);
        return;
      }

      const response = await fetch(getApiUrl(API_CONFIG.endpoints.profile), {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const barangay = data.profile?.address_barangay || data.address_barangay || "Barretto";
        setUserBarangay(barangay);
        // Don't auto-filter - show all barangays by default
        // User can manually filter if they want to see only their barangay
        // Check if user is fully verified (users_info.verified = true)
        // isverified = email verified, verified = full verification
        const isFullyVerified = data.profile?.verified === true;
        setUserVerified(isFullyVerified);
      } else {
        console.error("Error fetching user info:", response.statusText);
        setUserBarangay("Barretto");
        setUserVerified(false);
      }
    } catch (error) {
      console.error("Error fetching user info:", error);
      setUserBarangay("Barretto");
      setUserVerified(false);
    } finally {
      setUserDataLoaded(true);
    }
  };

  // Fetch LGU Announcements
  const fetchAnnouncements = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(getApiUrl('/api/announcements'), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAnnouncements(data.announcements || []);
      } else {
        // Silently handle non-200 responses - announcements are optional
        console.warn("Announcements unavailable:", response.status);
        setAnnouncements([]);
      }
    } catch (error) {
      // Silently handle errors - announcements are optional feature
      console.warn("Could not fetch announcements:", error.message);
      setAnnouncements([]);
    }
  };

  const fetchPosts = useCallback(async (isFilterChange = false, showLoading = true) => {
    // Only show filter loading for Top pill, not for barangay/type filter changes
    if (initialLoadDone || isFilterChange) {
      if (showLoading) {
        setIsFilterLoading(true);
      }
    } else {
      setLoading(true);
    }
    
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      let url = getApiUrl('/api/community/posts');
      const params = new URLSearchParams();

      if (barangayFilter && barangayFilter !== "All Barangays") {
        params.append("barangay", barangayFilter);
      }

      if (postTypeFilter && postTypeFilter !== "all") {
        params.append("post_type", postTypeFilter);
      }

      // Add sort algorithm parameter (default to 'latest' if null)
      params.append("sort", sortBy || "latest");

      const response = await fetch(url + (params.toString() ? `?${params.toString()}` : ''), {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("📥 Fetched community posts:", data.posts?.length, "posts");
        console.log("📊 Post engagement stats:", data.posts?.slice(0, 3).map(p => ({
          id: p.id,
          title: p.title?.substring(0, 30),
          comments: p.comment_count,
          reactions: p.reaction_count
        })));
        setPosts(data.posts || []);
      } else {
        console.error("Error fetching posts:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoading(false);
      setIsFilterLoading(false);
      setInitialLoadDone(true);
    }
  }, [barangayFilter, postTypeFilter, sortBy, initialLoadDone]);

  // Initial fetch on mount - WAIT for user data to load first
  // This ensures barangayFilter is already set to user's barangay before first fetch
  useEffect(() => {
    if (userDataLoaded && !initialLoadDone) {
      fetchPosts(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDataLoaded]); // Only run when user data is loaded
  
  // Re-fetch when filters change (after initial load)
  // Only show loading indicator for Top pill, not for regular filter changes
  useEffect(() => {
    if (initialLoadDone) {
      const showLoading = sortBy === 'top'; // Only show loading for Top pill
      fetchPosts(true, showLoading);
    }
  }, [barangayFilter, postTypeFilter, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  // ⭐ Compute trending posts - Community Involvement Algorithm
  // Shows ALL engaged posts (including your own) to encourage participation & awareness
  useEffect(() => {
    if (!posts.length) {
      setTrendingPosts([]);
      console.log("🔥 No posts to compute trending from");
      return;
    }

    const now = new Date();
    
    // Time filter logic - more generous time windows for stability
    const filterByTime = (createdAt) => {
      if (trendingTimeFilter === "all") return true; // Show all posts
      
      const postDate = new Date(createdAt);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      switch (trendingTimeFilter) {
        case "today":
          return postDate >= today;
        case "yesterday":
          return postDate >= yesterday && postDate < today;
        case "this-month":
          return postDate >= thisMonthStart;
        default:
          return true;
      }
    };
    
    // Filter approved posts with likes for trending (INCLUDING your own posts!)
    // Community involvement = showing ALL engaged content regardless of author
    // Using reaction_count which is synced from react_counts DB column
    const engagedPosts = posts.filter(p => 
      p.status === 'approved' && 
      (p.reaction_count || 0) > 0 &&
      filterByTime(p.created_at)
    );
    
    console.log(`📋 Filtered ${engagedPosts.length} engaged posts from ${posts.length} total (${trendingTimeFilter})`);
    console.log(`📊 Post statuses: ${[...new Set(posts.map(p => p.status))].join(', ')}`);
    
    // Apply trending algorithm: Community Awareness & Involvement
    // Shows popular content from all users (including your own) to encourage participation
    // Score = (reactions * 15 + comments * 8 + type_weight + base_score) / (days_old + 1)^0.8
    // Gentler decay keeps posts visible longer for stable trending display
    const scored = engagedPosts.map((p) => {
      const createdAt = new Date(p.created_at || 0);
      const daysOld = Math.max(0, (now - createdAt) / (1000 * 60 * 60 * 24));
      
      // Engagement weights - higher weights for community interaction
      // Using reaction_count which is synced from react_counts DB column
      const typeWeight = { incident: 4, safety: 3.5, suggestion: 3, recommendation: 2.5, general: 2 };
      const reactionBoost = (p.reaction_count || 0) * 15;  // High weight for reactions (community engagement)
      const commentBoost = (p.comment_count || 0) * 8;     // Comments show discussion/awareness
      const baseScore = 5; // Base score ensures posts don't disappear too quickly
      const engagement = reactionBoost + commentBoost + (typeWeight[p.post_type] || 2) + baseScore;
      
      // Very gentle time decay (0.8 exponent) - keeps trending stable, posts don't vanish suddenly
      // Using days instead of hours for smoother decay
      const timeFactor = Math.pow(daysOld + 1, 0.8);
      const trendingScore = engagement / timeFactor;
      
      return { ...p, trendingScore };
    });

    // Sort by trending score descending, limit to 5 for clean display
    const trending = scored
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 5);

    setTrendingPosts(trending);
    console.log(`🔥 ${trending.length} trending community posts (${trendingTimeFilter})`, trending.map(t => ({
      title: t.title,
      reactions: t.reaction_count,
      comments: t.comment_count,
      score: t.trendingScore?.toFixed(2)
    })));
  }, [posts, trendingTimeFilter]);

  useEffect(() => {
    if (loading) {
      setOverlayExited(false);
    }
  }, [loading]);

  const loadingFeatures = useMemo(
    () => [
      {
        title: "Community Updates",
        description: "Pulling in the latest neighborhood posts and announcements.",
      },
      {
        title: "Stay Engaged",
        description: "Share insights, comment on reports, and collaborate in real-time.",
      },
    ],
    []
  );

  const handleNewPost = async (newPost) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(getApiUrl('/api/community/posts'), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(newPost),
      });

      if (response.ok) {
        const data = await response.json();
        setPosts((prev) => [data.post, ...prev]);

        setNotification({ type: "success", message: "✅ Post published successfully!" });
        localStorage.removeItem("postFormDraft");
        setOpenModal(false);
        return true;
      } else {
        const error = await response.json();
        localStorage.setItem("postFormDraft", JSON.stringify(newPost));
        setNotification({ type: "error", message: `❌ Error: ${error.message}` });
        return false;
      }
    } catch (error) {
      console.error("Error creating post:", error);
      localStorage.setItem("postFormDraft", JSON.stringify(newPost));
      setNotification({ type: "error", message: "❌ Failed to create post" });
      return false;
    } finally {
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleDeletePost = async (postId, permanent = false) => {
    const confirmMsg = permanent 
      ? "This will permanently delete the post. This action cannot be undone. Continue?"
      : "Are you sure you want to delete this post?";
    if (!window.confirm(confirmMsg)) return;
    try {
      const token = localStorage.getItem("token");
      const url = permanent 
        ? getApiUrl(`/api/community/posts/${postId}?permanent=true`)
        : getApiUrl(`/api/community/posts/${postId}`);
      const response = await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setNotification({ type: "success", message: permanent ? "✅ Post permanently deleted!" : "✅ Post deleted successfully!" });
      } else {
        setNotification({ type: "error", message: "❌ Failed to delete post" });
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      setNotification({ type: "error", message: "❌ Failed to delete post" });
    } finally {
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleAddComment = async (postId, commentText) => {
    if (!commentText.trim()) return;
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(getApiUrl(`/api/community/posts/${postId}/comments`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: commentText }),
      });
      if (response.ok) {
        fetchPosts();
        setNotification({ type: "success", message: "✅ Comment added!" });
      } else {
        const error = await response.json();
        setNotification({ type: "error", message: `❌ ${error.message}` });
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      setNotification({ type: "error", message: "❌ Failed to add comment" });
    } finally {
      setTimeout(() => setNotification(null), 2000);
    }
  };

  const handleDeleteComment = async (postId, commentId) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(getApiUrl(`/api/community/comments/${commentId}`), {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (response.ok) fetchPosts();
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  // ✅ LIKE/UNLIKE POST
  const handleLikePost = async (postId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(getApiUrl(`/api/community/posts/${postId}/react`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reaction_type: "like" }),
      });
      if (response.ok) {
        const data = await response.json();
        // Update local state
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, user_liked: data.liked, reaction_count: data.reaction_count }
              : p
          )
        );
      }
    } catch (error) {
      console.error("Error liking post:", error);
    }
  };

  // Get user's pending posts count
  const userPendingPosts = useMemo(() => {
    return posts.filter(p => p.status === 'pending' && p.can_delete);
  }, [posts]);

  const filteredPosts = useMemo(() => {
    let result = posts.filter((p) => {
      // Filter out rejected posts (unless it's the user's own post - they can see to delete)
      if (p.status === 'rejected' && !p.can_delete) {
        return false;
      }
      
      const text = searchTerm.toLowerCase();
      const authorName = p.author?.firstname + " " + p.author?.lastname;
      return (
        p.title?.toLowerCase().includes(text) ||
        p.content?.toLowerCase().includes(text) ||
        authorName?.toLowerCase().includes(text)
      );
    });

    // Sort logic based on active pill
    if (sortBy === 'trending') {
      // Sort by trending score (engagement + recency)
      const now = new Date();
      result = result.sort((a, b) => {
        const scoreA = ((a.reaction_count || 0) * 2 + (a.comment_count || 0)) / Math.pow((now - new Date(a.created_at)) / 3600000 + 2, 1.3);
        const scoreB = ((b.reaction_count || 0) * 2 + (b.comment_count || 0)) / Math.pow((now - new Date(b.created_at)) / 3600000 + 2, 1.3);
        return scoreB - scoreA;
      });
    } else if (sortBy === 'top') {
      // Sort by most engagement
      result = result.sort((a, b) => {
        const engagementA = (a.reaction_count || 0) + (a.comment_count || 0);
        const engagementB = (b.reaction_count || 0) + (b.comment_count || 0);
        return engagementB - engagementA;
      });
    } else {
      // Default: pending posts first, then by date based on sortOrder
      result = result.sort((a, b) => {
        const aIsPending = a.status === 'pending' && a.can_delete;
        const bIsPending = b.status === 'pending' && b.can_delete;
        if (aIsPending && !bIsPending) return -1;
        if (!aIsPending && bIsPending) return 1;
        // Apply sortOrder: latest (desc) or oldest (asc)
        if (sortOrder === 'oldest') {
          return new Date(a.created_at) - new Date(b.created_at);
        }
        return new Date(b.created_at) - new Date(a.created_at);
      });
    }

    return result;
  }, [posts, searchTerm, sortBy, sortOrder]);

  const main = (
    <div className={`feed-container ${overlayExited ? "overlay-exited" : ""}`}>
      {/* Notification - wrapped in ModalPortal for proper z-index */}
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
      
      {/* LGU Announcements Banner */}
      {announcements.length > 0 && (
        <div className="announcements-banner">
          <div className="announcements-header">
            <span className="announcements-icon">📢</span>
            <span className="announcements-title">LGU Announcements</span>
          </div>
          <div className="announcements-list">
            {announcements.slice(0, 3).map((ann) => (
              <div key={ann.id} className={`announcement-item priority-${ann.priority || 'normal'}`}>
                <div className="announcement-type">{ann.announcement_type === 'policy' ? '📜' : ann.announcement_type === 'emergency' ? '🚨' : ann.announcement_type === 'event' ? '📅' : '📣'}</div>
                <div className="announcement-content">
                  <strong>{ann.title}</strong>
                  <p>{ann.content.slice(0, 100)}{ann.content.length > 100 ? '...' : ''}</p>
                  <small>{ann.barangay || 'City-wide'} • {new Date(ann.created_at).toLocaleDateString()}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="feed-header">
        <h2 className="feed-title"><FaUsers className="feed-icon" /> Community Feed</h2>
        
        {/* Top Controls - Matching BarangayReports Design */}
        <div className="feed-top-controls">
          <div className="feed-search-container">
            <label htmlFor="feed-search-input" className="sr-only">Search posts by title or author</label>
            <input 
              id="feed-search-input"
              className="feed-search-input" 
              type="text" 
              placeholder="Search posts..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isFilterLoading}
            />
            <FaSearch className="feed-search-icon" aria-hidden="true" />
          </div>
          
          <label htmlFor="barangay-filter" className="sr-only">Filter by Barangay</label>
          <select 
            id="barangay-filter"
            className="feed-filter-select" 
            value={barangayFilter} 
            onChange={(e) => setBarangayFilter(e.target.value)}
            disabled={isFilterLoading}
            aria-label="Filter posts by barangay"
          >
            <option value="All Barangays">All Barangays</option>
            {BARANGAYS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          
          <label htmlFor="type-filter" className="sr-only">Filter by Post Type</label>
          <select 
            id="type-filter"
            className="feed-filter-select" 
            value={postTypeFilter} 
            onChange={(e) => setPostTypeFilter(e.target.value)}
            disabled={isFilterLoading}
            aria-label="Filter posts by type"
          >
            <option value="all">All Types</option>
            <option value="incident">🚨 Incident</option>
            <option value="safety">🛡️ Safety</option>
            <option value="suggestion">💡 Suggestion</option>
            <option value="recommendation">⭐ Recommendation</option>
            <option value="general">📢 General</option>
          </select>
          
          <label htmlFor="sort-order" className="sr-only">Sort Order</label>
          <select 
            id="sort-order"
            className="feed-filter-select" 
            value={sortOrder} 
            onChange={(e) => setSortOrder(e.target.value)}
            disabled={isFilterLoading}
            aria-label="Sort order"
          >
            <option value="latest">Latest → Oldest</option>
            <option value="oldest">Oldest → Latest</option>
          </select>
          
          <button 
            className={`feed-btn ${!userVerified ? 'disabled' : ''}`} 
            onClick={() => userVerified && setOpenModal(true)}
            disabled={!userVerified}
            title={!userVerified ? 'Please complete your profile verification to create posts' : 'Create a new post'}
          >
            + New Post
          </button>
          {!userVerified && (
            <span className="verification-hint" title="Complete profile verification to post">
              🔒 Verification Required
            </span>
          )}
        </div>
      </div>

      {/* ⭐ Pill Button Row: Trending, Pending, Top */}
      <div className="feed-pill-row">
        {/* Trending Pill - Toggle sort */}
        <button
          className={`feed-trending-pill-btn ${sortBy === 'trending' ? 'active' : ''} ${trendingPosts.length === 0 ? 'empty' : ''}`}
          data-count={trendingPosts.length}
          onClick={() => {
            if (sortBy === 'trending') {
              setSortBy(DEFAULT_SORT);
              setTrendingExpanded(false);
            } else {
              setSortBy('trending');
              setTrendingExpanded(true);
            }
          }}
          title={sortBy === 'trending' ? 'Turn off trending sort' : 'Sort by trending'}
        >
          <FaFire className="feed-pill-icon" />
          <span className="pill-text">Trending ({trendingPosts.length})</span>
          {sortBy === 'trending' ? <FaMinus className="feed-pill-toggle" /> : <FaPlus className="feed-pill-toggle" />}
        </button>
        
        {/* Pending Pill - Show user's pending posts */}
        <button
          className={`feed-pending-pill-btn ${pendingExpanded ? 'active' : ''} ${userPendingPosts.length === 0 ? 'empty' : ''}`}
          data-count={userPendingPosts.length}
          onClick={() => setPendingExpanded(!pendingExpanded)}
          title={pendingExpanded ? 'Hide pending posts' : 'Show your pending posts'}
        >
          <FaClock className="feed-pill-icon" />
          <span className="pill-text">Pending ({userPendingPosts.length})</span>
          {pendingExpanded ? <FaMinus className="feed-pill-toggle" /> : <FaPlus className="feed-pill-toggle" />}
        </button>

        {/* Top Pill - Toggle sort */}
        <button
          className={`feed-top-pill-btn ${sortBy === 'top' ? 'active' : ''}`}
          data-count=""
          onClick={() => setSortBy(sortBy === 'top' ? DEFAULT_SORT : 'top')}
          title={sortBy === 'top' ? 'Turn off top sort' : 'Sort by most engagement'}
        >
          <FaStar className="feed-pill-icon" />
          <span className="pill-text">Top</span>
        </button>
      </div>

      {/* ⭐ Trending Posts Section - Collapsible */}
      {trendingExpanded && (
        <div className={`feed-trending-container expanded ${trendingPosts.length === 0 ? 'empty' : ''}`}>
          <div className="feed-trending-header">
            <h3><FaMapPin className="feed-trending-pin" /> Trending Posts</h3>
            <select
              className="trending-time-filter"
              value={trendingTimeFilter}
              onChange={(e) => setTrendingTimeFilter(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this-month">This Month</option>
            </select>
          </div>
          {trendingPosts.length > 0 ? (
            <div className="feed-trending-list">
              {trendingPosts.map((post) => (
                <div 
                  key={`trending-${post.id}`} 
                  className={`feed-trending-card ${post.can_delete ? 'your-post' : ''}`}
                  onClick={() => {
                    const element = document.getElementById(`post-${post.id}`);
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }}
                >
                  {/* Badge for your own post */}
                  {post.can_delete && (
                    <div className="your-post-badge">
                      <FaUser /> Your Post
                    </div>
                  )}
                  <div className="feed-trending-type" data-type={post.post_type}>
                    {post.post_type}
                  </div>
                  <div className="feed-trending-title">{post.title}</div>
                  <div className="feed-trending-location">
                    📍 {post.barangay}
                  </div>
                  <div className="feed-trending-meta">
                    <span className="feed-trending-author">
                      {post.author?.firstname} {post.author?.lastname}
                    </span>
                    <span className="feed-trending-time">
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="feed-trending-engagement">
                    <span className="feed-trending-likes">
                      <FaHeart className="heart-icon-small" /> {post.reaction_count || 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="feed-trending-empty">
              <FaFire className="empty-icon" />
              <p>No trending posts for this period</p>
              <span>Posts with likes will appear here</span>
            </div>
          )}
        </div>
      )}

      {/* ⭐ Pending Posts Section - Shows user's pending posts */}
      {pendingExpanded && userPendingPosts.length > 0 && (
        <div className="feed-pending-container expanded">
          <div className="feed-pending-header">
            <h3><FaClock className="feed-pending-icon" /> Your Pending Posts</h3>
          </div>
          <div className="feed-pending-list">
            {userPendingPosts.map((post) => (
              <div 
                key={`pending-${post.id}`} 
                className="feed-pending-card"
                onClick={() => {
                  const element = document.getElementById(`post-${post.id}`);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
              >
                <div className="feed-pending-type" data-type={post.post_type}>
                  {post.post_type}
                </div>
                <div className="feed-pending-title">{post.title}</div>
                <div className="feed-pending-location">
                  📍 {post.barangay}
                </div>
                <div className="feed-pending-meta">
                  <span className="feed-pending-status">⏳ Awaiting Approval</span>
                  <span className="feed-pending-time">
                    {new Date(post.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingExpanded && userPendingPosts.length === 0 && (
        <div className="feed-pending-container expanded empty">
          <div className="feed-pending-empty">
            <FaClock className="empty-icon" />
            <p>No pending posts</p>
            <span>All your posts have been reviewed</span>
          </div>
        </div>
      )}

      <div className="feed-list">
        {!loading && filteredPosts.length === 0 && <p>No posts found.</p>}
        {!loading && filteredPosts.map((post) => (
          <PostCard key={post.id} post={post} onAddComment={handleAddComment} onDeleteComment={handleDeleteComment} onDeletePost={handleDeletePost} onLikePost={handleLikePost} />
        ))}
      </div>
      {openModal && <ModalPortal><PostModal onClose={() => setOpenModal(false)} onSubmit={handleNewPost} userBarangay={userBarangay} /></ModalPortal>}
    </div>
  );

  return (
    <LoadingScreen
      variant="inline"
      features={loadingFeatures}
      title={loading ? "Loading posts..." : undefined}
      subtitle={loading ? "Fetching the latest community stories" : undefined}
      stage={loading ? "loading" : "exit"}
      successTitle="Feed Updated!"
      inlineOffset="18vh"
      onExited={() => setOverlayExited(true)}
    >
      {main}
    </LoadingScreen>
  );
};

// ✅ POST CARD
const PostCard = ({ post, onAddComment, onDeleteComment, onDeletePost, onLikePost }) => {
  const [comment, setComment] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(post.comments || []);
  const [loadingComments, setLoadingComments] = useState(false);

  // Fetch comments when expanding
  const handleToggleComments = async () => {
    if (!showComments && comments.length === 0) {
      setLoadingComments(true);
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(getApiUrl(`/api/community/posts/${post.id}`), {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setComments(data.post?.comments || []);
        }
      } catch (error) {
        console.error("Error fetching comments:", error);
      } finally {
        setLoadingComments(false);
      }
    }
    setShowComments(!showComments);
  };

  // Handle adding comment and update local state
  const handleAddCommentLocal = async (commentText) => {
    if (!commentText.trim()) return;
    await onAddComment(post.id, commentText);
    // Refresh comments after adding
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(getApiUrl(`/api/community/posts/${post.id}`), {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setComments(data.post?.comments || []);
      }
    } catch (error) {
      console.error("Error refreshing comments:", error);
    }
  };

  const handleCommentKey = (e) => {
    if (e.key === "Enter" && comment.trim()) {
      handleAddCommentLocal(comment);
      setComment("");
    }
  };

  const roleColor = ROLE_COLORS[post.author?.role] || ROLE_COLORS["Resident"];
  const authorName = `${post.author?.firstname} ${post.author?.lastname}`;
  const postedDate = new Date(post.created_at).toLocaleDateString();

  const isPending = post.status === 'pending';
  const isRejected = post.status === 'rejected';

  return (
    <div className={`post-card ${post.is_pinned ? "post-pinned" : ""} ${isPending ? 'pending' : ''} ${isRejected ? 'rejected' : ''}`}>
      <div className="post-header">
        <div className="post-title-section">
          <h3>{post.title}</h3>
            {post.is_pinned && <span className="badge-pinned">📌 Pinned</span>}
            {isPending && <span className="badge-pending">⏳ Pending</span>}
            {isRejected && <span className="badge-rejected">❌ Rejected</span>}
        </div>
        <div className="post-header-right">
          <div className="post-meta">
            <span
              className="role-badge"
              style={{
                backgroundColor: roleColor.bg,
                color: roleColor.text,
                padding: "0.25rem 0.75rem",
                borderRadius: "20px",
                fontSize: "0.75rem",
                fontWeight: "600",
                textTransform: "uppercase",
              }}
            >
              {post.author?.role || "Resident"}
            </span>
            {post.can_delete && (
              <span className="user-post-label">Your Post</span>
            )}
            {post.can_delete && (
              <FaTrash
                className="post-delete-btn"
                onClick={() => onDeletePost(post.id)}
                title="Delete post"
              />
            )}
          </div>
        </div>
      </div>

      <div className="post-type-container">
        <span 
          className="post-type-badge"
          style={{
            backgroundColor: "rgba(156, 163, 175, 0.15)",
            color: "#6b7280",
            padding: "0.25rem 0.75rem",
            borderRadius: "20px",
            fontSize: "0.75rem",
            fontWeight: "600",
            textTransform: "capitalize",
          }}
        >
          {post.post_type}
        </span>
      </div>

      <p className="post-content">{post.content}</p>

      <p className="post-subinfo">
        By {authorName} · {postedDate} · {post.barangay}
      </p>

      {/* Rejected post notice */}
      {isRejected && post.can_delete && (
        <div className="rejected-notice">
          <p style={{ color: "#dc2626", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
            ⚠️ This post was rejected by moderators for not meeting community guidelines.
          </p>
          <button 
            className="delete-rejected-btn"
            onClick={() => onDeletePost(post.id, true)}
            style={{
              backgroundColor: "#dc2626",
              color: "white",
              border: "none",
              padding: "0.5rem 1rem",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: "600"
            }}
          >
            🗑️ Delete This Post
          </button>
        </div>
      )}

      {/* Like button - only for approved posts */}
      {post.status === 'approved' && (
        <div className="post-reactions">
          <button
            className={`reaction-btn heart-btn ${post.user_liked ? 'liked' : ''}`}
            onClick={() => onLikePost(post.id)}
            aria-label={post.user_liked ? 'Unlike this post' : 'Like this post'}
            title={post.user_liked ? 'Unlike' : 'Like'}
          >
            {post.user_liked ? (
              <FaHeart className="heart-icon filled" aria-hidden="true" />
            ) : (
              <FaRegHeart className="heart-icon" aria-hidden="true" />
            )}
            <span className="reaction-count">{post.reaction_count || 0}</span>
          </button>
        </div>
      )}

      {!post.allow_comments && !isRejected && (
        <p style={{ color: "#ef4444", fontSize: "0.9rem", marginTop: "0.5rem" }}>
          💬 Comments are disabled for this post
        </p>
      )}

      {isPending && !isRejected && (
        <p style={{ color: "#f97316", fontSize: "0.9rem", marginTop: "0.5rem" }}>
          💬 Comments are only available once this post is approved
        </p>
      )}

      {post.status === 'approved' && post.allow_comments && (
        <div className="toggle-comment-container">
          <button
            className="toggle-comment-btn"
            onClick={handleToggleComments}
            disabled={loadingComments}
          >
            {loadingComments ? "Loading..." : showComments ? "Hide Comments" : `View Comments (${post.comment_count || 0})`}
          </button>
        </div>
      )}

      {showComments && (
        <div className="comments-box">
          {loadingComments ? (
            <div className="comments-loading">
              <div className="spinner-small" />
              <span>Loading comments...</span>
            </div>
          ) : (
            <div className="comments-scroll">
              {comments.length === 0 ? (
                <p className="no-comments">No comments yet. Be the first to comment!</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="comment-item">
                    <div className="comment-header">
                      <span className="comment-author">
                        {c.author?.firstname} {c.author?.lastname}
                      </span>
                      <span className="comment-time">
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p>{c.content}</p>

                    {c.can_delete && (
                      <FaTrash
                        className="comment-delete-btn"
                        onClick={() => onDeleteComment(post.id, c.id)}
                        title="Delete comment"
                      />
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {post.allow_comments && (
            <div className="comment-input-section">
              <input
                type="text"
                placeholder="Write a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={handleCommentKey}
              />

              <button
                className="comment-send-btn"
                onClick={() => {
                  handleAddCommentLocal(comment);
                  setComment("");
                }}
              >
                <FaPaperPlane />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommunityFeed;

// ✅ POST MODAL WITH 3-TAB SYSTEM
const PostModal = ({ onClose, onSubmit, userBarangay }) => {
  const [currentTab, setCurrentTab] = useState(1);
  const [isFirstTimePost, setIsFirstTimePost] = useState(false);
  
  // ✅ Load saved draft from localStorage if available
  const savedDraft = (() => {
    try {
      const draft = localStorage.getItem("postFormDraft");
      return draft ? JSON.parse(draft) : null;
    } catch {
      return null;
    }
  })();
  
  const [title, setTitle] = useState(savedDraft?.title || "");
  const [content, setContent] = useState(savedDraft?.content || "");
  const [postType, setPostType] = useState(savedDraft?.post_type || "general");
  const [barangay, setBarangay] = useState(savedDraft?.barangay || userBarangay);
  const [skipGuidelinesChecked, setSkipGuidelinesChecked] = useState(() => {
    try {
      return localStorage.getItem("skipGuidelinesNextPost") === 'true';
    } catch {
      return false;
    }
  });
  const [posting, setPosting] = useState(false);
  const [barangayOptions] = useState([
    "Barretto",
    "East Bajac-Bajac",
    "East Tapinac",
    "Gordon Heights",
    "Kalaklan",
    "Mabayuan",
    "New Asinan",
    "New Banicain",
    "New Cabalan",
    "New Ilalim",
    "New Kababae",
    "New Kalalake",
    "Old Cabalan",
    "Pag-Asa",
    "Santa Rita",
    "West Bajac-Bajac",
    "West Tapinac",
  ]);

  useEffect(() => {
    setBarangay(userBarangay);
    checkIfFirstTimePost();

    // ✅ Show notification if draft was recovered
    if (savedDraft) {
      console.log("📝 Recovered unsaved form data from previous error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userBarangay]);

  const checkIfFirstTimePost = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(getApiUrl('/api/community/posts'), {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setIsFirstTimePost((data.posts || []).length === 0);
      }
    } catch (error) {
      console.error("Error checking posts:", error);
    }
  };

  const handleModalClose = () => {
    // ✅ Save form data as draft if user is closing with unsaved content
    if (title.trim() || content.trim()) {
      localStorage.setItem("postFormDraft", JSON.stringify({
        title,
        content,
        post_type: postType,
        barangay,
      }));
    }
    onClose();
  };

  const handleNext = () => {
    if (!title.trim() || !content.trim()) {
      alert("Please fill in all fields");
      return;
    }

    // Move to the next visible tab: if guidelines should appear they are tab 2,
    // otherwise tab 2 is the confirmation. Simpler mapping keeps indices consistent.
    setCurrentTab(2);
  };

  const handleTabChange = (tabNumber) => {
    setCurrentTab(tabNumber);
  };

  const handleEditField = () => {
    // Return to Tab 1 (form)
    setCurrentTab(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      alert("Please fill in all fields");
      return;
    }

    if (!barangay) {
      alert("Please select a barangay");
      return;
    }

    const newPost = {
      title: title.trim(),
      content: content.trim(),
      post_type: postType,
      barangay,
    };

    // Save skip preference to localStorage
    localStorage.setItem("skipGuidelinesNextPost", skipGuidelinesChecked);

    // Show posting state and await parent's onSubmit result
    try {
      setPosting(true);
      const success = await onSubmit(newPost);
      setPosting(false);

      if (success) {
        // Parent will close modal and show a notification; clear form locally
        setTitle("");
        setContent("");
        setPostType("general");
        setBarangay(userBarangay);
        setCurrentTab(1);
      } else {
        // Keep modal open to allow retry; parent's notification will show error
      }
    } catch (err) {
      console.error("Error submitting post:", err);
      setPosting(false);
    }
  };

  // Determine if we should show guidelines tab
  const showGuidelinesTab = isFirstTimePost || !skipGuidelinesChecked;

  return (
    <div className="portal-modal-overlay" onClick={onClose}>
      <div className="portal-modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="portal-modal-header">
          <h3>Create Community Post</h3>
          <button 
            className="portal-modal-close" 
            onClick={handleModalClose}
            aria-label="Close modal"
            title="Close"
          >
            <FaTimes aria-hidden="true" />
          </button>
        </div>

        <div className="portal-modal-body">
        {/* TAB INDICATORS */}
        <div className="tab-indicators">
          <div 
            className={`tab-dot ${currentTab === 1 ? 'active' : ''}`}
            onClick={() => currentTab === 1 && handleTabChange(1)}
            title="Post Details"
          />
          {showGuidelinesTab && (
            <div 
              className={`tab-dot ${currentTab === 2 ? 'active' : ''} ${currentTab === 1 && (!title.trim() || !content.trim()) ? 'disabled' : ''}`}
              onClick={() => (currentTab === 2 || (currentTab === 1 && title.trim() && content.trim())) && handleTabChange(2)}
              title="Review Guidelines"
            />
          )}
          <div 
            className={`tab-dot ${currentTab === (showGuidelinesTab ? 3 : 2) ? 'active' : ''} ${currentTab !== (showGuidelinesTab ? 3 : 2) && (currentTab === 1 && (!title.trim() || !content.trim())) ? 'disabled' : ''}`}
            onClick={() => {
              const confirmTabNum = showGuidelinesTab ? 3 : 2;
              if (currentTab === confirmTabNum || (currentTab !== confirmTabNum && title.trim() && content.trim())) {
                handleTabChange(confirmTabNum);
              }
            }}
            title="Confirmation"
          />
        </div>

        {/* TAB 1: POST DETAILS */}
        <div className={`tab-content ${currentTab === 1 ? 'active' : ''}`}>
          <form className="post-form">
            <div className="form-group">
              <label>Why are you posting this? * <span className="required">(Required)</span></label>
              <select
                value={postType}
                onChange={(e) => setPostType(e.target.value)}
                className="form-select"
              >
                <option value="">-- Select Post Type --</option>
                <option value="incident">🚨 Incident Report</option>
                <option value="safety">🛡️ Safety Concern</option>
                <option value="suggestion">💡 Suggestion</option>
                <option value="recommendation">⭐ Recommendation</option>
                <option value="general">📢 General Information</option>
              </select>
              <small className="form-help-text">
                Choose the category that best describes your post
              </small>
            </div>

            <div className="form-group">
              <label>Barangay *</label>
              <select
                value={barangay}
                onChange={(e) => setBarangay(e.target.value)}
                className="form-select"
              >
                {barangayOptions.map((b, idx) => (
                  <option key={idx} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <small className="form-help-text">
                Select the barangay where you are reporting
              </small>
            </div>

            <div className="form-group">
              <label>Title * <span className="required">(Max 255 characters)</span></label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your post a clear, concise title..."
                className="form-input"
                maxLength="255"
              />
              <small className="char-count">{title.length}/255</small>
            </div>

            <div className="form-group">
              <label>Message *</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Describe in detail. Include what, when, where, and why if applicable..."
                className="form-textarea"
                rows="6"
              />
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleModalClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleNext}
              >
                Next →
              </button>
            </div>
          </form>
        </div>

        {/* TAB 2: REVIEW GUIDELINES (Only for first-time or non-skip users) */}
        {showGuidelinesTab && (
          <div className={`tab-content ${currentTab === 2 ? 'active' : ''}`}>
            <div className="guidelines-content">
              <div className="warning-section">
                <div className="warning-icon-container">
                  <div className="warning-circle">
                    <span className="warning-question">?</span>
                  </div>
                </div>
                <h4>Community Guidelines</h4>
                <p>
                  Please ensure your post is related to community safety, incidents, 
                  constructive suggestions, or recommendations. Posts must be respectful, 
                  factual, and helpful to the community. Avoid misinformation or spam.
                </p>
                <div className="guidelines-list">
                  <p><strong>✅ Post these:</strong></p>
                  <ul>
                    <li>Safety incidents or hazards</li>
                    <li>Community concerns & suggestions</li>
                    <li>Local recommendations</li>
                    <li>Helpful information</li>
                  </ul>
                  <p><strong>❌ Avoid posting:</strong></p>
                  <ul>
                    <li>Misinformation or rumors</li>
                    <li>Personal disputes</li>
                    <li>Spam or advertisements</li>
                    <li>Inappropriate content</li>
                  </ul>
                </div>
              </div>

              {!isFirstTimePost && (
                <div className="skip-guidelines-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={skipGuidelinesChecked}
                      onChange={(e) => setSkipGuidelinesChecked(e.target.checked)}
                    />
                    <span>I accept and skip guidelines the next time I post another post</span>
                  </label>
                </div>
              )}

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setCurrentTab(1)}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setCurrentTab(showGuidelinesTab ? 3 : 2)}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CONFIRMATION */}
        <div className={`tab-content ${currentTab === (showGuidelinesTab ? 3 : 2) ? 'active' : ''}`}>
          <div className="confirmation-content">
            <h3>Review Your Post</h3>
            <p className="confirmation-subtitle">Please review your information before posting</p>

            <div className="confirmation-field">
              <div className="field-header">
                <label>Post Type</label>
                <button 
                  type="button" 
                  className="edit-field-btn" 
                  onClick={handleEditField}
                  title="Edit"
                >
                  ✎
                </button>
              </div>
              <div className="field-value">
                {postType === "incident" && "🚨 Incident Report"}
                {postType === "safety" && "🛡️ Safety Concern"}
                {postType === "suggestion" && "💡 Suggestion"}
                {postType === "recommendation" && "⭐ Recommendation"}
                {postType === "general" && "📢 General Information"}
              </div>
            </div>

            <div className="confirmation-field">
              <div className="field-header">
                <label>Barangay</label>
                <button 
                  type="button" 
                  className="edit-field-btn" 
                  onClick={handleEditField}
                  title="Edit"
                >
                  ✎
                </button>
              </div>
              <div className="field-value">{barangay}</div>
            </div>

            <div className="confirmation-field">
              <div className="field-header">
                <label>Title</label>
                <button 
                  type="button" 
                  className="edit-field-btn" 
                  onClick={handleEditField}
                  title="Edit"
                >
                  ✎
                </button>
              </div>
              <div className="field-value">{title}</div>
            </div>

            <div className="confirmation-field">
              <div className="field-header">
                <label>Message</label>
                <button 
                  type="button" 
                  className="edit-field-btn" 
                  onClick={handleEditField}
                  title="Edit"
                >
                  ✎
                </button>
              </div>
              <div className="field-value">{content}</div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setCurrentTab(showGuidelinesTab ? 2 : 1)}
              >
                ← Back
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleModalClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-success"
                onClick={handleSubmit}
                disabled={posting}
              >
                {posting ? (
                  <span style={{display: 'inline-flex', alignItems: 'center', gap: 8}}>
                    <div className="spinner" style={{width: 16, height: 16, borderWidth: '2px'}} />
                    Posting...
                  </span>
                ) : (
                  '✓ Post'
                )}
              </button>
            </div>
          </div>
        </div>
        </div>{/* portal-modal-body */}
      </div>
    </div>
  );
};