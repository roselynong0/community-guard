import React, { useState, useEffect, useCallback } from "react";
import "./CommunityFeed.css";
import "./Notifications.css";
import { FaUsers, FaTrash, FaCheck, FaTimes } from "react-icons/fa";
import { getApiUrl, API_CONFIG } from "../utils/apiConfig";

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

const CommunityFeedAdmin = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("All");
  const [postTypeFilter, setPostTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // all, pending, approved, rejected

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
            p.id === postId ? { ...p, status: "approved" } : p
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
    if (!window.confirm("Are you sure you want to reject this post?")) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(getApiUrl(`/api/community/posts/${postId}/reject`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setNotification({
          type: "success",
          message: "✅ Post rejected successfully!",
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

  // ✅ FILTER POSTS
  const filteredPosts = posts.filter((p) => {
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

  return (
    <div className="feed-container">
      {notification && (
        <div className={`notif notif-${notification.type}`}>
          {notification.message}
        </div>
      )}

      <div className="feed-header">
        <h2 className="feed-title">
          <FaUsers className="feed-icon" />
          Community Feed Moderation
        </h2>

        {/* ✅ SEARCH + REFRESH ROW */}
        <div className="header-actions">
          <input
            className="feed-search"
            type="text"
            placeholder="Search post or user..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <button className="feed-btn" onClick={fetchAllPosts}>
            ↻ Refresh
          </button>
        </div>

        {/* ✅ FILTERS ROW */}
        <div className="feed-filters">
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
            <option value="incident">Incident</option>
            <option value="safety">Safety</option>
            <option value="suggestion">Suggestion</option>
            <option value="recommendation">Recommendation</option>
            <option value="general">General</option>
          </select>

          <select
            className="feed-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
          </select>
        </div>
      </div>

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
                onApprove={handleApprovePost}
                onReject={handleRejectPost}
                onDelete={handleDeletePost}
                onToggleComments={handleToggleComments}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
};

// ✅ ADMIN POST CARD WITH APPROVE/REJECT BUTTONS
const AdminPostCard = ({ post, onApprove, onReject, onDelete, onToggleComments }) => {
  const roleColor = ROLE_COLORS[post.author?.role] || ROLE_COLORS["Resident"];
  const authorName = `${post.author?.firstname} ${post.author?.lastname}`;
  const postedDate = new Date(post.created_at).toLocaleDateString();
  const isPending = (post.status && post.status !== 'approved') || post.is_pending;

  return (
    <div className={`post-card ${post.is_pinned ? "post-pinned" : ""} ${isPending ? 'pending' : ''}`}>
      <div className="post-header">
        <div className="post-title-section">
          <h3>{post.title}</h3>
          {post.is_pinned && <span className="badge-pinned">📌 Pinned</span>}
          {isPending && <span className="badge-pending">⏳ Pending</span>}
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

      {/* ADMIN CONTROLS */}
      <div className="admin-post-controls" style={{
        display: 'flex',
        gap: '8px',
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: '1px solid #ddd',
      }}>
        {isPending && (
          <>
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
              onMouseEnter={(e) => e.target.style.background = '#059669'}
              onMouseLeave={(e) => e.target.style.background = '#10b981'}
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
              onMouseEnter={(e) => e.target.style.background = '#dc2626'}
              onMouseLeave={(e) => e.target.style.background = '#ef4444'}
            >
              <FaTimes /> Reject
            </button>
          </>
        )}
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
          onMouseEnter={(e) => e.target.style.background = post.allow_comments ? '#7c3aed' : '#4f46e5'}
          onMouseLeave={(e) => e.target.style.background = post.allow_comments ? '#8b5cf6' : '#6366f1'}
        >
          💬 {post.allow_comments ? 'Disable' : 'Enable'} Comments
        </button>
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
          onMouseEnter={(e) => e.target.style.background = '#4b5563'}
          onMouseLeave={(e) => e.target.style.background = '#6b7280'}
        >
          <FaTrash /> Delete
        </button>
      </div>
    </div>
  );
};

export default CommunityFeedAdmin;
