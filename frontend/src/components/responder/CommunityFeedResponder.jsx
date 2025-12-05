import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useOutletContext } from "react-router-dom";
import "../resident/CommunityFeed.css";
import "../resident/Notifications.css";
import ModalPortal from "../shared/ModalPortal";
import { 
  FaPaperPlane, 
  FaUsers, 
  FaTrash,
  FaHeart,
  FaRegHeart,
  FaSearch,
  FaFire,
  FaStar,
  FaPlus,
  FaMinus,
  FaMapPin
} from "react-icons/fa";
import { API_CONFIG, getApiUrl } from "../../utils/apiConfig";

// ✅ ROLE COLORS
const ROLE_COLORS = {
  "Admin": { bg: "rgba(139, 92, 246, 0.1)", text: "#8b5cf6" },
  "Barangay Official": { bg: "rgba(37, 99, 235, 0.1)", text: "#2563eb" },
  "Responder": { bg: "rgba(239, 68, 68, 0.1)", text: "#ef4444" },
  "Resident": { bg: "rgba(59, 130, 246, 0.1)", text: "#3b82f6" },
};

// Sort options - null means no sort active
const DEFAULT_SORT = null;

// Responder community feed - View and interact with posts (no moderation)
// Responders can only see posts from their assigned barangay
export default function CommunityFeedResponder({ session, token }) {
  const outlet = useOutletContext?.() || {};

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [postTypeFilter, setPostTypeFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("latest");
  const [sortBy, setSortBy] = useState(DEFAULT_SORT);
  const [userBarangay, setUserBarangay] = useState("");
  
  // Trending section states
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [trendingExpanded, setTrendingExpanded] = useState(false);
  const [trendingTimeFilter, setTrendingTimeFilter] = useState("this-month");
  
  const authToken = token || session?.token || localStorage.getItem('token') || '';

  // Fetch user's barangay first
  const fetchUserBarangay = useCallback(async () => {
    if (!authToken) return;
    try {
      const response = await fetch(getApiUrl(API_CONFIG.endpoints.profile), {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        const barangay = data?.info?.address_barangay || data?.address_barangay || "";
        setUserBarangay(barangay);
      }
    } catch (error) {
      console.error("Error fetching user barangay:", error);
    }
  }, [authToken]);

  useEffect(() => {
    fetchUserBarangay();
  }, [fetchUserBarangay]);

  const fetchPosts = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);

    try {
      // Responders only see posts from their barangay
      let url = getApiUrl('/api/community/posts');
      const params = new URLSearchParams();

      // Force filter to responder's barangay only
      if (userBarangay) {
        params.append("barangay", userBarangay);
      }

      const response = await fetch(url + (params.toString() ? `?${params.toString()}` : ''), {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        // Filter out rejected posts
        const visiblePosts = (data.posts || []).filter(p => 
          p.status !== 'rejected'
        );
        setPosts(visiblePosts);
      } else {
        setPosts([]);
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [authToken, userBarangay]);

  useEffect(() => {
    if (userBarangay) {
      fetchPosts();
    }
  }, [fetchPosts, userBarangay]);

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

  // ✅ DELETE COMMENT (own comments only)
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

  // ✅ FILTER POSTS
  const filteredPosts = useMemo(() => {
    let filtered = posts.filter((p) => {
      const text = searchTerm.toLowerCase();
      const authorName = (p.author?.firstname || '') + " " + (p.author?.lastname || '');
      const matchesSearch = 
        p.title?.toLowerCase().includes(text) ||
        p.content?.toLowerCase().includes(text) ||
        authorName?.toLowerCase().includes(text);
      
      let matchesType = true;
      if (postTypeFilter !== "all") {
        matchesType = p.post_type === postTypeFilter;
      }
      
      return matchesSearch && matchesType;
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
      // Default sort by date
      filtered.sort((a, b) => {
        if (sortOrder === "oldest") {
          return new Date(a.created_at) - new Date(b.created_at);
        }
        return new Date(b.created_at) - new Date(a.created_at);
      });
    }
    
    return filtered;
  }, [posts, searchTerm, postTypeFilter, sortBy, sortOrder]);

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
          Community Feed — {userBarangay || "My Barangay"}
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
          
          <select 
            className="feed-filter-select" 
            value={sortOrder} 
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="latest">Latest → Oldest</option>
            <option value="oldest">Oldest → Latest</option>
          </select>
          
          <button className="feed-btn" onClick={fetchPosts}>↻ Refresh</button>
        </div>
      </div>

      {/* ⭐ Pill Button Row: Trending, Top */}
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
            {filteredPosts.length === 0 && <p>No posts found in your barangay.</p>}

            {filteredPosts.map((post) => (
              <ResponderPostCard
                key={post.id}
                post={post}
                onAddComment={handleAddComment}
                onDeleteComment={handleDeleteComment}
                onLike={handleLikePost}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ✅ RESPONDER POST CARD (View + Comment only)
const ResponderPostCard = ({ post, onAddComment, onDeleteComment, onLike }) => {
  const [comment, setComment] = useState("");
  const [showComments, setShowComments] = useState(false);

  const roleColor = ROLE_COLORS[post.author?.role] || ROLE_COLORS["Resident"];
  const authorName = `${post.author?.firstname || 'Unknown'} ${post.author?.lastname || 'User'}`;
  const postedDate = new Date(post.created_at).toLocaleDateString();
  
  // Approved posts can be liked
  const canLike = post.status === 'approved';

  const handleCommentKey = (e) => {
    if (e.key === "Enter" && comment.trim()) {
      onAddComment(post.id, comment);
      setComment("");
    }
  };

  return (
    <div id={`post-${post.id}`} className={`post-card ${post.is_pinned ? "post-pinned" : ""}`}>
      <div className="post-header">
        <div className="post-title-section">
          <h3>{post.title}</h3>
          {post.is_pinned && <span className="badge-pinned">📌 Pinned</span>}
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
        By {authorName} · {postedDate} · {post.barangay}
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
