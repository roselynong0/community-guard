import React, { useState, useEffect, useCallback, useMemo } from "react";
import "../resident/CommunityFeed.css";
import "../resident/Notifications.css";
import ModalPortal from "../shared/ModalPortal";
import { 
  FaUsers, 
  FaTrash, 
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

const CommunityFeedAdmin = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("All");
  const [postTypeFilter, setPostTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // all, pending, approved, rejected
  const [sortOrder, setSortOrder] = useState("latest");
  const [sortBy, setSortBy] = useState(DEFAULT_SORT);
  
  // Trending section states
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [trendingExpanded, setTrendingExpanded] = useState(false);
  const [trendingTimeFilter, setTrendingTimeFilter] = useState("this-month");
  const [pendingExpanded, setPendingExpanded] = useState(false);

  useEffect(() => {
    fetchAllPosts();
  }, []);

  const fetchAllPosts = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      let url = getApiUrl('/api/community/posts/all');
      const params = new URLSearchParams();

      if (barangayFilter && barangayFilter !== "All") {
        params.append("barangay", barangayFilter);
      }

      if (postTypeFilter && postTypeFilter !== "all") {
        params.append("post_type", postTypeFilter);
      }

      // Append query string to the full URL returned by getApiUrl
      const response = await fetch(url + (params.toString() ? `?${params.toString()}` : ''), {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
      } else {
        console.error("Error fetching posts:", response.statusText);
        setNotification({
          type: "error",
          message: "❌ Failed to fetch posts",
        });
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
      setNotification({
        type: "error",
        message: "❌ Failed to fetch posts",
      });
    } finally {
      setLoading(false);
    }
  }, [barangayFilter, postTypeFilter]);

  // ✅ ACCEPT POST (sets is_accepted = true, shows normally but keeps pending)
  const handleAcceptPost = async (postId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(getApiUrl(`/api/community/posts/${postId}/accept`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, is_accepted: true } : p
          )
        );
        setNotification({
          type: "success",
          message: "✅ Post accepted!",
        });
      } else {
        const error = await response.json();
        setNotification({
          type: "error",
          message: `❌ Error: ${error.message}`,
        });
      }
    } catch (error) {
      console.error("Error accepting post:", error);
      setNotification({
        type: "error",
        message: "❌ Failed to accept post",
      });
    }

    setTimeout(() => setNotification(null), 3000);
  };

  const handleApprovePost = async (postId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(getApiUrl(`/api/community/posts/${postId}/approve`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, status: "approved", is_accepted: true } : p
          )
        );
        setNotification({
          type: "success",
          message: "✅ Post approved successfully!",
        });
      } else {
        const error = await response.json();
        setNotification({
          type: "error",
          message: `❌ Error: ${error.message}`,
        });
      }
    } catch (error) {
      console.error("Error approving post:", error);
      setNotification({
        type: "error",
        message: "❌ Failed to approve post",
      });
    }

    setTimeout(() => setNotification(null), 3000);
  };

  const handleRejectPost = async (postId) => {
    if (!window.confirm("Are you sure you want to reject this post? The user will be notified.")) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(getApiUrl(`/api/community/posts/${postId}/reject`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        // Mark as rejected instead of removing (owner can still see it)
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, is_rejected: true, status: "rejected" } : p
          )
        );
        setNotification({
          type: "success",
          message: "✅ Post rejected and user notified!",
        });
      } else {
        const error = await response.json();
        setNotification({
          type: "error",
          message: `❌ Error: ${error.message}`,
        });
      }
    } catch (error) {
      console.error("Error rejecting post:", error);
      setNotification({
        type: "error",
        message: "❌ Failed to reject post",
      });
    }

    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(getApiUrl(`/api/community/posts/${postId}`), {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setNotification({
          type: "success",
          message: "✅ Post deleted successfully!",
        });
      } else {
        setNotification({
          type: "error",
          message: "❌ Failed to delete post",
        });
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      setNotification({
        type: "error",
        message: "❌ Failed to delete post",
      });
    }

    setTimeout(() => setNotification(null), 3000);
  };

  const handleToggleComments = async (postId, currentAllow) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(getApiUrl(`/api/community/posts/${postId}/toggle-comments`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ allow_comments: !currentAllow }),
      });

      if (response.ok) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, allow_comments: !currentAllow } : p
          )
        );
        const status = !currentAllow ? "enabled" : "disabled";
        setNotification({
          type: "success",
          message: `✅ Comments ${status}!`,
        });
      } else {
        const error = await response.json();
        setNotification({
          type: "error",
          message: `❌ Error: ${error.message}`,
        });
      }
    } catch (error) {
      console.error("Error toggling comments:", error);
      setNotification({
        type: "error",
        message: "❌ Failed to toggle comments",
      });
    }

    setTimeout(() => setNotification(null), 3000);
  };

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

  // ⭐ Compute trending posts
  useEffect(() => {
    if (!posts.length) {
      setTrendingPosts([]);
      return;
    }

    const now = new Date();
    
    const filterByTime = (createdAt) => {
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
    
    const approvedPosts = posts.filter(p => 
      p.status === 'approved' && 
      filterByTime(p.created_at)
    );
    
    const scored = approvedPosts.map((p) => {
      const createdAt = new Date(p.created_at || 0);
      const hoursOld = Math.max(0, (now - createdAt) / (1000 * 60 * 60));
      
      const typeWeight = { incident: 3, safety: 2.5, suggestion: 2, recommendation: 1.5, general: 1 };
      const reactionBoost = (p.reaction_count || 0) * 2;
      const commentBoost = (p.comment_count || 0) * 1.5;
      const engagement = reactionBoost + commentBoost + (typeWeight[p.post_type] || 1) * 2;
      
      const timeFactor = Math.pow(hoursOld + 2, 1.5);
      const trendingScore = engagement / timeFactor;
      
      return { ...p, trendingScore };
    });

    const trending = scored
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 5);

    setTrendingPosts(trending);
  }, [posts, trendingTimeFilter]);

  // Get pending posts count
  const pendingPostsCount = useMemo(() => {
    return posts.filter(p => p.status === 'pending' && !p.is_accepted && !p.is_rejected).length;
  }, [posts]);

  // ✅ FILTER POSTS - Sort pending posts to top
  const filteredPosts = useMemo(() => {
    let filtered = posts.filter((p) => {
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

      return matchesSearch && matchesStatus;
    });
    
    // Apply sorting
    if (sortBy === 'trending') {
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
      filtered.sort((a, b) => {
        const aScore = ((a.reaction_count || 0) * 2) + ((a.comment_count || 0) * 3);
        const bScore = ((b.reaction_count || 0) * 2) + ((b.comment_count || 0) * 3);
        return bScore - aScore;
      });
    } else {
      // Default: Pending posts first, then by date
      filtered.sort((a, b) => {
        const aIsPending = a.status === 'pending' && !a.is_accepted;
        const bIsPending = b.status === 'pending' && !b.is_accepted;
        if (aIsPending && !bIsPending) return -1;
        if (!aIsPending && bIsPending) return 1;
        
        if (sortOrder === "oldest") {
          return new Date(a.created_at) - new Date(b.created_at);
        }
        return new Date(b.created_at) - new Date(a.created_at);
      });
    }
    
    return filtered;
  }, [posts, searchTerm, statusFilter, sortBy, sortOrder]);

  return (
    <div className="feed-container">
      {/* Notification */}
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
          Community Feed Moderation — All Barangays
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
            value={barangayFilter}
            onChange={(e) => setBarangayFilter(e.target.value)}
          >
            <option value="All">All Barangays</option>
            {BARANGAYS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

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

          <select
            className="feed-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">⏳ Pending</option>
            <option value="approved">✅ Approved</option>
            <option value="rejected">❌ Rejected</option>
          </select>
          
          <select 
            className="feed-filter-select" 
            value={sortOrder} 
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="latest">Latest → Oldest</option>
            <option value="oldest">Oldest → Latest</option>
          </select>
          
          <button className="feed-btn" onClick={fetchAllPosts}>↻ Refresh</button>
        </div>
      </div>

      {/* ⭐ Pill Button Row: Trending, Pending, Top */}
      <div className="feed-pill-row">
        <button
          className={`feed-trending-pill-btn ${sortBy === 'trending' ? 'active' : ''} ${trendingPosts.length === 0 ? 'empty' : ''}`}
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
          Trending ({trendingPosts.length})
          {sortBy === 'trending' ? <FaMinus className="feed-pill-toggle" /> : <FaPlus className="feed-pill-toggle" />}
        </button>
        
        <button
          className={`feed-pending-pill-btn ${pendingExpanded ? 'active' : ''} ${pendingPostsCount === 0 ? 'empty' : ''}`}
          onClick={() => setPendingExpanded(!pendingExpanded)}
          title={pendingExpanded ? 'Hide pending posts' : 'Show pending posts'}
        >
          <FaClock className="feed-pill-icon" />
          Pending ({pendingPostsCount})
          {pendingExpanded ? <FaMinus className="feed-pill-toggle" /> : <FaPlus className="feed-pill-toggle" />}
        </button>

        <button
          className={`feed-top-pill-btn ${sortBy === 'top' ? 'active' : ''}`}
          onClick={() => setSortBy(sortBy === 'top' ? DEFAULT_SORT : 'top')}
          title={sortBy === 'top' ? 'Turn off top sort' : 'Sort by most engagement'}
        >
          <FaStar className="feed-pill-icon" />
          Top
        </button>
      </div>

      {/* ⭐ Trending Posts Section */}
      {trendingExpanded && trendingPosts.length > 0 && (
        <div className="feed-trending-container expanded">
          <div className="feed-trending-header">
            <h3><FaMapPin className="feed-trending-pin" /> Trending Posts</h3>
            <select
              className="trending-time-filter"
              value={trendingTimeFilter}
              onChange={(e) => setTrendingTimeFilter(e.target.value)}
            >
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
              <AdminPostCard
                key={post.id}
                post={post}
                onAccept={handleAcceptPost}
                onApprove={handleApprovePost}
                onReject={handleRejectPost}
                onDelete={handleDeletePost}
                onToggleComments={handleToggleComments}
                onLike={handleLikePost}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
};

// ✅ ADMIN POST CARD WITH ACCEPT/APPROVE/REJECT BUTTONS
const AdminPostCard = ({ post, onAccept, onApprove, onReject, onDelete, onToggleComments, onLike }) => {
  const roleColor = ROLE_COLORS[post.author?.role] || ROLE_COLORS["Resident"];
  const authorName = `${post.author?.firstname} ${post.author?.lastname}`;
  const postedDate = new Date(post.created_at).toLocaleDateString();
  const canLike = post.is_accepted || post.status === 'approved';
  
  // Pending = status is pending AND is_accepted is false AND not rejected
  const isPending = post.status === 'pending' && !post.is_accepted && !post.is_rejected;
  // Accepted = is_accepted is true (regardless of status)
  const isAccepted = post.is_accepted === true;
  // Rejected = is_rejected is true or status is rejected
  const isRejected = post.is_rejected || post.status === 'rejected';

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

      {/* ADMIN CONTROLS */}
      <div className="admin-post-controls" style={{
        display: 'flex',
        gap: '8px',
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: '1px solid #ddd',
        flexWrap: 'wrap',
      }}>
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
        
        {/* Show rejected notice for admin */}
        {isRejected && (
          <div style={{
            width: '100%',
            padding: '8px 12px',
            background: 'rgba(220, 38, 38, 0.1)',
            borderRadius: '6px',
            color: '#dc2626',
            fontSize: '14px',
            marginBottom: '8px',
          }}>
            ⚠️ This post was rejected. The user has been notified and can delete it from their feed.
          </div>
        )}
        
        {!isRejected && (
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
        <button
          className="admin-delete-btn"
          onClick={() => onDelete(post.id)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            background: isRejected ? '#dc2626' : '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            marginLeft: 'auto',
            transition: 'background 0.2s',
          }}
          title={isRejected ? "Permanently delete this rejected post" : "Delete post"}
        >
          <FaTrash /> {isRejected ? 'Permanently Delete' : 'Delete'}
        </button>
      </div>
    </div>
  );
};

export default CommunityFeedAdmin;
