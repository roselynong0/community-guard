import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import "../resident/CommunityFeed.css";
import "../resident/Notifications.css";
import ModalPortal from "../shared/ModalPortal";
import { 
  FaPaperPlane, 
  FaUsers, 
  FaTrash, 
  FaExclamationTriangle,
  FaCheck,
  FaTimes,
  FaComment,
  FaCommentSlash,
  FaHeart,
  FaRegHeart,
  FaSearch,
  FaFire,
  FaClock,
  FaStar,
  FaPlus,
  FaMinus,
  FaMapPin
} from "react-icons/fa";
import { getApiUrl, API_CONFIG } from "../../utils/apiConfig";

// ✅ POST TYPES
const POST_TYPES = ["incident", "safety", "suggestion", "recommendation", "general"];

// ✅ ROLE COLORS
const ROLE_COLORS = {
  "Admin": { bg: "rgba(139, 92, 246, 0.1)", text: "#8b5cf6" },
  "Barangay Official": { bg: "rgba(37, 99, 235, 0.1)", text: "#2563eb" },
  "Responder": { bg: "rgba(239, 68, 68, 0.1)", text: "#ef4444" },
  "Resident": { bg: "rgba(59, 130, 246, 0.1)", text: "#3b82f6" },
};

// Sort options - null means no sort active (show pending first)
const DEFAULT_SORT = null;

const CommunityFeedBarangay = ({ session, token }) => {
  const outlet = useOutletContext?.() || {};
  const selectedBarangay = outlet.selectedBarangay || "All";

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [postTypeFilter, setPostTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // all, pending, approved
  const [sortOrder, setSortOrder] = useState("latest"); // latest or oldest
  const [sortBy, setSortBy] = useState(DEFAULT_SORT); // null = pending first, 'trending' or 'top'
  const [userInfo, setUserInfo] = useState(null);
  const [isOfficialUser, setIsOfficialUser] = useState(false);
  
  // Trending section states
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [trendingExpanded, setTrendingExpanded] = useState(false);
  const [trendingTimeFilter, setTrendingTimeFilter] = useState("all"); // all, today, yesterday, this-month
  const [pendingExpanded, setPendingExpanded] = useState(false);

  const authToken = token || session?.token || localStorage.getItem("token") || "";

  const fetchUserInfo = useCallback(async () => {
    if (!authToken) return;
    try {
      const response = await fetch(getApiUrl(API_CONFIG.endpoints.profile), {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUserInfo(data);
        setIsOfficialUser(data.role === "Barangay Official" || data.role === "Admin");
      }
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  }, [authToken]);

  useEffect(() => {
    fetchUserInfo();
  }, [fetchUserInfo]);

  const fetchPosts = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);

    try {
      let url = getApiUrl('/api/community/posts/barangay');
      const params = new URLSearchParams();

      if (userInfo && userInfo.role === "Admin") {
        if (selectedBarangay && selectedBarangay !== "All") {
          params.append("barangay", selectedBarangay);
        }
      }

      if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      const response = await fetch(url + (params.toString() ? `?${params.toString()}` : ''), {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("📥 Barangay fetched community posts:", data.posts?.length, "posts");
        console.log("📊 Barangay post engagement stats:", data.posts?.slice(0, 5).map(p => ({
          id: p.id,
          title: p.title?.substring(0, 30),
          status: p.status,
          reactions: p.reaction_count,
          user_liked: p.user_liked,
          comments: p.comment_count
        })));
        setPosts(data.posts || []);
      } else if (response.status === 403) {
        setPosts([]);
        console.warn("Not authorized to view posts");
      } else {
        console.error("Error fetching posts:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedBarangay, authToken, userInfo, statusFilter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleNewPost = async (newPost) => {
    try {
      const response = await fetch(getApiUrl('/api/community/posts'), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(newPost),
      });

      if (response.ok) {
        const data = await response.json();
        setPosts((prev) => [data.post, ...prev]);
        setNotification({ type: "success", message: "✅ Post published successfully!" });
        setOpenModal(false);
      } else {
        const error = await response.json();
        setNotification({ type: "error", message: `❌ Error: ${error.message}` });
      }
    } catch (error) {
      console.error("Error creating post:", error);
      setNotification({ type: "error", message: "❌ Failed to create post" });
    }
    setTimeout(() => setNotification(null), 3000);
  };

  // ✅ ACCEPT POST (sets is_accepted = true, shows normally)
  const handleAcceptPost = async (postId) => {
    try {
      const response = await fetch(getApiUrl(`/api/community/posts/${postId}/accept`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        setPosts((prev) => prev.map((p) => 
          p.id === postId ? { ...p, is_accepted: true } : p
        ));
        setNotification({ type: "success", message: "✅ Post accepted!" });
      } else {
        const error = await response.json();
        setNotification({ type: "error", message: `❌ ${error.message}` });
      }
    } catch (error) {
      console.error("Error accepting post:", error);
      setNotification({ type: "error", message: "❌ Failed to accept post" });
    }
    setTimeout(() => setNotification(null), 3000);
  };

  // ✅ APPROVE POST (sets status = approved)
  const handleApprovePost = async (postId) => {
    try {
      const response = await fetch(getApiUrl(`/api/community/posts/${postId}/approve`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        setPosts((prev) => prev.map((p) => 
          p.id === postId ? { ...p, status: 'approved', is_accepted: true } : p
        ));
        setNotification({ type: "success", message: "✅ Post approved!" });
      } else {
        const error = await response.json();
        setNotification({ type: "error", message: `❌ ${error.message}` });
      }
    } catch (error) {
      console.error("Error approving post:", error);
      setNotification({ type: "error", message: "❌ Failed to approve post" });
    }
    setTimeout(() => setNotification(null), 3000);
  };

  // ✅ REJECT POST
  const handleRejectPost = async (postId) => {
    if (!window.confirm("Are you sure you want to reject this post? The user will be notified and the post will be removed.")) return;

    try {
      const response = await fetch(getApiUrl(`/api/community/posts/${postId}/reject`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        // Remove post from list (backend auto soft-deletes rejected posts)
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setNotification({ type: "success", message: "✅ Post rejected, user notified, and post removed!" });
      } else {
        const error = await response.json();
        setNotification({ type: "error", message: `❌ ${error.message}` });
      }
    } catch (error) {
      console.error("Error rejecting post:", error);
      setNotification({ type: "error", message: "❌ Failed to reject post" });
    }
    setTimeout(() => setNotification(null), 3000);
  };

  // ✅ DELETE POST
  const handleDeletePost = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;

    try {
      const response = await fetch(getApiUrl(`/api/community/posts/${postId}`), {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setNotification({ type: "success", message: "✅ Post deleted!" });
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      setNotification({ type: "error", message: "❌ Failed to delete post" });
    }
    setTimeout(() => setNotification(null), 3000);
  };

  // ✅ TOGGLE COMMENTS
  const handleToggleComments = async (postId, currentAllow) => {
    try {
      const response = await fetch(getApiUrl(`/api/community/posts/${postId}/toggle-comments`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ allow_comments: !currentAllow }),
      });

      if (response.ok) {
        setPosts((prev) => prev.map((p) => 
          p.id === postId ? { ...p, allow_comments: !currentAllow } : p
        ));
        setNotification({ 
          type: "success", 
          message: `✅ Comments ${!currentAllow ? 'enabled' : 'disabled'}!` 
        });
      }
    } catch (error) {
      console.error("Error toggling comments:", error);
      setNotification({ type: "error", message: "❌ Failed to toggle comments" });
    }
    setTimeout(() => setNotification(null), 3000);
  };

  // ✅ ADD COMMENT
  const handleAddComment = async (postId, commentText) => {
    if (!commentText.trim()) return;

    try {
      const response = await fetch(getApiUrl(`/api/community/posts/${postId}/comments`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ content: commentText }),
      });

      if (response.ok) {
        fetchPosts();
        setNotification({ type: "success", message: "✅ Comment added!" });
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      setNotification({ type: "error", message: "❌ Failed to add comment" });
    }
    setTimeout(() => setNotification(null), 2000);
  };

  // ✅ DELETE COMMENT
  const handleDeleteComment = async (postId, commentId) => {
    if (!window.confirm("Delete this comment?")) return;

    try {
      const response = await fetch(getApiUrl(`/api/community/comments/${commentId}`), {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        fetchPosts();
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  // ✅ LIKE POST
  const handleLikePost = async (postId) => {
    try {
      const response = await fetch(getApiUrl(`/api/community/posts/${postId}/react`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ reaction_type: "like" }),
      });
      if (response.ok) {
        const data = await response.json();
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

  // ⭐ Compute trending posts - Same algorithm as resident Reports/CommunityFeed
  useEffect(() => {
    if (!posts.length) {
      setTrendingPosts([]);
      console.log("🔥 Barangay: No posts to compute trending from");
      return;
    }

    const now = new Date();
    
    // Time filter logic - matches resident CommunityFeed
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
    
    // Filter approved posts with likes for trending
    // reaction_count is synced from react_counts DB column on backend
    const approvedPosts = posts.filter(p => 
      p.status === 'approved' && 
      (p.reaction_count || 0) > 0 &&
      filterByTime(p.created_at)
    );
    
    console.log(`📋 Barangay: Filtered ${approvedPosts.length} engaged posts from ${posts.length} total (${trendingTimeFilter})`);
    console.log(`📊 Barangay: Post statuses: ${[...new Set(posts.map(p => p.status))].join(', ')}`);
    console.log(`❤️ Barangay: Posts with reactions: ${posts.filter(p => (p.reaction_count || 0) > 0).length}`);
    
    // Apply trending algorithm - Community Awareness & Involvement
    // Score = (reactions * 15 + comments * 8 + type_weight + base_score) / (days_old + 1)^0.8
    // Gentler decay keeps posts visible longer for stable trending display
    const scored = approvedPosts.map((p) => {
      const createdAt = new Date(p.created_at || 0);
      const daysOld = Math.max(0, (now - createdAt) / (1000 * 60 * 60 * 24));
      
      const typeWeight = { incident: 4, safety: 3.5, suggestion: 3, recommendation: 2.5, general: 2 };
      const reactionBoost = (p.reaction_count || 0) * 15;
      const commentBoost = (p.comment_count || 0) * 8;
      const baseScore = 5;
      const engagement = reactionBoost + commentBoost + (typeWeight[p.post_type] || 2) + baseScore;
      
      // Very gentle time decay (0.8 exponent) - keeps trending stable
      const timeFactor = Math.pow(daysOld + 1, 0.8);
      const trendingScore = engagement / timeFactor;
      
      return { ...p, trendingScore };
    });

    const trending = scored
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 5);

    setTrendingPosts(trending);
    console.log(`🔥 Barangay: ${trending.length} trending community posts (${trendingTimeFilter})`, trending.map(t => ({
      title: t.title?.substring(0, 30),
      reactions: t.reaction_count,
      comments: t.comment_count,
      score: t.trendingScore?.toFixed(2)
    })));
  }, [posts, trendingTimeFilter]);

  // Get pending posts count for the pill
  const pendingPostsCount = useMemo(() => {
    return posts.filter(p => p.status === 'pending').length;
  }, [posts]);

  // Get actual pending posts list for the container (status = pending)
  const pendingPostsList = useMemo(() => {
    return posts.filter(p => p.status === 'pending');
  }, [posts]);

  // ✅ FILTER POSTS - Sort pending posts to top
  const filteredPosts = useMemo(() => {
    let filtered = posts.filter((p) => {
      // Filter out rejected posts (they shouldn't show to anyone except the author)
      if (p.status === 'rejected' || p.is_rejected) {
        return false;
      }
      
      const text = searchTerm.toLowerCase();
      const authorName = p.author?.firstname + " " + p.author?.lastname;
      const matchesSearch =
        p.title?.toLowerCase().includes(text) ||
        p.content?.toLowerCase().includes(text) ||
        authorName?.toLowerCase().includes(text);

      let matchesStatus = true;
      if (statusFilter !== "all") {
        matchesStatus = p.status === statusFilter;
      }
      
      let matchesType = true;
      if (postTypeFilter !== "all") {
        matchesType = p.post_type === postTypeFilter;
      }

      return matchesSearch && matchesStatus && matchesType;
    });
    
    // Apply sorting based on sortBy
    if (sortBy === 'trending') {
      // Use trending scores
      const now = new Date();
      filtered = filtered.map(p => {
        const createdAt = new Date(p.created_at || 0);
        const hoursOld = Math.max(0, (now - createdAt) / (1000 * 60 * 60));
        const typeWeight = { incident: 3, safety: 2.5, suggestion: 2, recommendation: 1.5, general: 1 };
        const engagement = ((p.reaction_count || 0) * 2) + ((p.comment_count || 0) * 1.5) + ((typeWeight[p.post_type] || 1) * 2);
        const trendingScore = engagement / Math.pow(hoursOld + 2, 1.5);
        return { ...p, trendingScore };
      }).sort((a, b) => b.trendingScore - a.trendingScore);
    } else if (sortBy === 'top') {
      // Sort by engagement only
      filtered.sort((a, b) => {
        const aScore = ((a.reaction_count || 0) * 2) + ((a.comment_count || 0) * 3);
        const bScore = ((b.reaction_count || 0) * 2) + ((b.comment_count || 0) * 3);
        return bScore - aScore;
      });
    } else {
      // Default: Pending posts first, then by date
      filtered.sort((a, b) => {
        const aIsPending = a.status === 'pending';
        const bIsPending = b.status === 'pending';
        if (aIsPending && !bIsPending) return -1;
        if (!aIsPending && bIsPending) return 1;
        
        // Then sort by date
        if (sortOrder === "oldest") {
          return new Date(a.created_at) - new Date(b.created_at);
        }
        return new Date(b.created_at) - new Date(a.created_at);
      });
    }
    
    return filtered;
  }, [posts, searchTerm, statusFilter, postTypeFilter, sortBy, sortOrder]);

  const userBarangay = userInfo?.info?.address_barangay || userInfo?.address_barangay;
  const feedTitle = isOfficialUser
    ? `Community Feed Moderation — ${userBarangay || "My Barangay"}`
    : "Community Feed";

  return (
    <div className="feed-container">
      {/* Notification - wrapped in ModalPortal for proper z-index display */}
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

      <div className="feed-header">
        <h2 className="feed-title">
          <FaUsers className="feed-icon" />
          {feedTitle}
        </h2>

        {/* ✅ TOP CONTROLS - Matching CommunityFeed Design */}
        <div className="feed-top-controls">
          <div className="feed-search-container">
            <input 
              type="text" 
              className="feed-search-input" 
              placeholder="Search posts..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <FaSearch className="feed-search-icon" aria-hidden="true" />
          </div>
          
          <select 
            className="feed-filter-select" 
            value={postTypeFilter} 
            onChange={(e) => setPostTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="incident">🚨 Incident</option>
            <option value="safety">🛡️ Safety</option>
            <option value="suggestion">💡 Suggestion</option>
            <option value="recommendation">⭐ Recommendation</option>
            <option value="general">📢 General</option>
          </select>
          
          {isOfficialUser && (
            <select
              className="feed-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">⏳ Pending</option>
              <option value="approved">✅ Approved</option>
            </select>
          )}
          
          <select 
            className="feed-filter-select" 
            value={sortOrder} 
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="latest">Latest → Oldest</option>
            <option value="oldest">Oldest → Latest</option>
          </select>
          
          <button className="feed-btn" onClick={() => setOpenModal(true)}>+ New Post</button>
        </div>
      </div>

      {/* ⭐ Pill Button Row: Trending, Pending, Top */}
      <div className="feed-pill-row">
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
        
        {isOfficialUser && (
          <button
            className={`feed-pending-pill-btn ${pendingExpanded ? 'active' : ''} ${pendingPostsCount === 0 ? 'empty' : ''}`}
            data-count={pendingPostsCount}
            onClick={() => setPendingExpanded(!pendingExpanded)}
            title={pendingExpanded ? 'Hide pending posts' : 'Show pending posts'}
          >
            <FaClock className="feed-pill-icon" />
            <span className="pill-text">Pending ({pendingPostsCount})</span>
            {pendingExpanded ? <FaMinus className="feed-pill-toggle" /> : <FaPlus className="feed-pill-toggle" />}
          </button>
        )}

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
      {trendingExpanded && trendingPosts.length > 0 && (
        <div className="feed-trending-container expanded">
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
          <div className="feed-trending-list">
            {trendingPosts.map((post) => (
              <div 
                key={`trending-${post.id}`} 
                className="feed-trending-card"
                onClick={() => {
                  const element = document.getElementById(`post-${post.id}`);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
              >
                <div className="feed-trending-type" data-type={post.post_type}>
                  {post.post_type}
                </div>
                <div className="feed-trending-title">{post.title}</div>
                <div className="feed-trending-location">📍 {post.barangay}</div>
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
        </div>
      )}

      {trendingExpanded && trendingPosts.length === 0 && (
        <div className="feed-trending-container expanded empty">
          <div className="feed-trending-empty">
            <FaFire className="empty-icon" />
            <p>No trending posts yet</p>
            <span>Posts become trending based on engagement and recency</span>
          </div>
        </div>
      )}

      {/* ⭐ Pending Posts Section - Shows posts awaiting approval (is_accepted = false) */}
      {isOfficialUser && pendingExpanded && pendingPostsList.length > 0 && (
        <div className="feed-pending-container expanded">
          <div className="feed-pending-header">
            <h3><FaClock className="feed-pending-icon" /> Pending Posts</h3>
          </div>
          <div className="feed-pending-list">
            {pendingPostsList.map((post) => (
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
                  <span className="feed-pending-author">
                    {post.author?.firstname} {post.author?.lastname}
                  </span>
                  <span className="feed-pending-time">
                    {new Date(post.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isOfficialUser && pendingExpanded && pendingPostsList.length === 0 && (
        <div className="feed-pending-container expanded empty">
          <div className="feed-pending-empty">
            <FaClock className="empty-icon" />
            <p>No pending posts</p>
            <span>All posts have been reviewed</span>
          </div>
        </div>
      )}

      <div className="feed-list">
        {loading ? (
          <div className="feed-loading">
            <div className="spinner" />
            <p>Loading posts...</p>
          </div>
        ) : (
          <>
            {filteredPosts.length === 0 && <p>No posts found.</p>}

            {filteredPosts.map((post) => (
              <BarangayPostCard
                key={post.id}
                post={post}
                isOfficial={isOfficialUser}
                onAccept={handleAcceptPost}
                onApprove={handleApprovePost}
                onReject={handleRejectPost}
                onDelete={handleDeletePost}
                onToggleComments={handleToggleComments}
                onAddComment={handleAddComment}
                onDeleteComment={handleDeleteComment}
                onLike={handleLikePost}
              />
            ))}
          </>
        )}
      </div>

      {openModal && (
        <ModalPortal>
        <PostModal 
          onClose={() => setOpenModal(false)} 
          onSubmit={handleNewPost}
          userBarangay={userBarangay}
          selectedBarangay={selectedBarangay}
          isOfficialUser={isOfficialUser}
        />
        </ModalPortal>
      )}
    </div>
  );
};

// ✅ BARANGAY POST CARD WITH MODERATION (Same design as Admin)
const BarangayPostCard = ({ 
  post, 
  isOfficial,
  onAccept,
  onApprove, 
  onReject, 
  onDelete, 
  onToggleComments,
  onAddComment,
  onDeleteComment,
  onLike
}) => {
  const [comment, setComment] = useState("");
  const [showComments, setShowComments] = useState(false);

  const roleColor = ROLE_COLORS[post.author?.role] || ROLE_COLORS["Resident"];
  const authorName = `${post.author?.firstname} ${post.author?.lastname}`;
  const postedDate = new Date(post.created_at).toLocaleDateString();
  
  // Pending = status is pending AND is_accepted is false AND not rejected
  const isPending = post.status === 'pending' && !post.is_accepted && !post.is_rejected;
  // Accepted = is_accepted is true (regardless of status)
  const isAccepted = post.is_accepted === true;
  // Rejected = is_rejected is true
  const isRejected = post.is_rejected || post.status === 'rejected';
  // Can like = post is accepted or approved
  const canLike = isAccepted || post.status === 'approved';

  const handleCommentKey = (e) => {
    if (e.key === "Enter" && comment.trim()) {
      onAddComment(post.id, comment);
      setComment("");
    }
  };

  return (
    <div className={`post-card ${post.is_pinned ? "post-pinned" : ""} ${isPending ? 'pending' : ''} ${isRejected ? 'rejected' : ''}`}>
      <div className="post-header">
        <div className="post-title-section">
          <h3>{post.title}</h3>
          {post.is_pinned && <span className="badge-pinned">📌 Pinned</span>}
          {isPending && <span className="badge-pending">⏳ Pending Review</span>}
          {isRejected && <span className="badge-rejected">❌ Rejected</span>}
          {isAccepted && post.status !== 'approved' && !isRejected && (
            <span className="badge-accepted" style={{
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              padding: '0.25rem 0.75rem',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: '600',
              marginLeft: '8px'
            }}>✓ Accepted</span>
          )}
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
        By {authorName} · {postedDate} · {post.barangay} · Status: <strong>{post.status || 'unknown'}</strong>
      </p>

      {/* Like Button - Only for accepted/approved posts */}
      {canLike && (
        <div className="post-engagement" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid #eee',
        }}>
          <button
            onClick={() => onLike(post.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              background: post.user_liked ? '#fee2e2' : '#f3f4f6',
              color: post.user_liked ? '#ef4444' : '#6b7280',
              border: 'none',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s',
            }}
          >
            {post.user_liked ? <FaHeart /> : <FaRegHeart />}
            {post.reaction_count || 0} {post.reaction_count === 1 ? 'Like' : 'Likes'}
          </button>
        </div>
      )}

      {/* MODERATION CONTROLS - Only for officials */}
      {isOfficial && (
        <div className="admin-post-controls" style={{
          display: 'flex',
          gap: '8px',
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid #ddd',
          flexWrap: 'wrap',
        }}>
          {/* Accept/Approve/Reject - Only for pending posts that aren't accepted */}
          {isPending && (
            <>
              <button
                className="admin-accept-btn"
                onClick={() => onAccept(post.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background 0.2s',
                }}
                title="Accept post (shows normally but keeps pending status)"
              >
                <FaCheck /> Accept
              </button>
              <button
                className="admin-approve-btn"
                onClick={() => onApprove(post.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background 0.2s',
                }}
                title="Fully approve post"
              >
                <FaCheck /> Approve
              </button>
              <button
                className="admin-reject-btn"
                onClick={() => onReject(post.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background 0.2s',
                }}
              >
                <FaTimes /> Reject
              </button>
            </>
          )}

          {/* Toggle Comments - Always available for officials or post owner */}
          {(post.can_toggle_comments || isOfficial) && (
            <button
              className="admin-toggle-comments-btn"
              onClick={() => onToggleComments(post.id, post.allow_comments)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                background: post.allow_comments ? '#8b5cf6' : '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'background 0.2s',
              }}
            >
              {post.allow_comments ? <FaCommentSlash /> : <FaComment />}
              {post.allow_comments ? 'Disable' : 'Enable'} Comments
            </button>
          )}

          {/* Delete - Only for post owner (Barangay Officials cannot delete posts) */}
          {post.can_delete && (
            <button
              className="admin-delete-btn"
              onClick={() => onDelete(post.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                marginLeft: 'auto',
                transition: 'background 0.2s',
              }}
            >
              <FaTrash /> Delete
            </button>
          )}
        </div>
      )}

      {/* Comments Section */}
      {!post.allow_comments && (
        <p style={{ color: "#ef4444", fontSize: "0.9rem", marginTop: "0.5rem" }}>
          💬 Comments are disabled for this post
        </p>
      )}

      <div className="toggle-comment-container" style={{ marginTop: '12px' }}>
        <button
          className="toggle-comment-btn"
          onClick={() => setShowComments(!showComments)}
        >
          {showComments ? "Hide Comments" : `View Comments (${post.comment_count || 0})`}
        </button>
      </div>

      {showComments && (
        <div className="comments-box">
          <div className="comments-scroll">
            {(post.comments ?? []).map((c) => (
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
            ))}
          </div>

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
                  onAddComment(post.id, comment);
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

// ✅ POST MODAL
const PostModal = ({ onClose, onSubmit, userBarangay, isOfficialUser }) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState("general");
  const [barangay, setBarangay] = useState(userBarangay || "");
  const [showWarning, setShowWarning] = useState(false);

  const handleSubmit = (e) => {
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

    onSubmit(newPost);
  };

  return (
    <div className="portal-modal-overlay" onClick={onClose}>
      <div className="portal-modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="portal-modal-header">
          <h3>Create Community Post</h3>
          <button 
            className="portal-modal-close" 
            onClick={onClose}
            aria-label="Close modal"
            title="Close"
          >
            <FaTimes aria-hidden="true" />
          </button>
        </div>

        <div className="portal-modal-body">
        {showWarning && (
          <div className="warning-section">
            <FaExclamationTriangle className="warning-icon" />
            <h4>Community Guidelines</h4>
            <p>
              Please ensure your post is related to community safety, incidents, or
              constructive suggestions. Posts must be respectful and factual.
            </p>
            <button
              className="warning-dismiss-btn"
              onClick={() => setShowWarning(false)}
            >
              I Understand
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="post-form">
          <div className="form-group">
            <label>Post Type *</label>
            <select
              value={postType}
              onChange={(e) => setPostType(e.target.value)}
              className="form-select"
            >
              {POST_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Barangay *</label>
            <input
              type="text"
              value={barangay}
              onChange={(e) => setBarangay(e.target.value)}
              placeholder="Your barangay"
              className="form-input"
              disabled={!isOfficialUser}
            />
          </div>

          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title..."
              className="form-input"
              maxLength="255"
            />
          </div>

          <div className="form-group">
            <label>Content *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your thoughts, incident report, or suggestion..."
              className="form-textarea"
              rows="5"
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              onClick={() => !showWarning && setShowWarning(true)}
            >
              Post to Feed
            </button>
          </div>
        </form>
        </div>{/* portal-modal-body */}
      </div>
    </div>
  );
};

export default CommunityFeedBarangay;
