import React, { useEffect, useState, useCallback } from 'react';
import { useOutletContext } from "react-router-dom";
import "./CommunityFeed.css";
import "./Notifications.css";
import { 
  FaPaperPlane, 
  FaUsers, 
  FaTrash,
  FaHeart,
  FaRegHeart
} from "react-icons/fa";
import { API_CONFIG, getApiUrl } from "../utils/apiConfig";

// ✅ ROLE COLORS
const ROLE_COLORS = {
  "Admin": { bg: "rgba(139, 92, 246, 0.1)", text: "#8b5cf6" },
  "Barangay Official": { bg: "rgba(37, 99, 235, 0.1)", text: "#2563eb" },
  "Responder": { bg: "rgba(239, 68, 68, 0.1)", text: "#ef4444" },
  "Resident": { bg: "rgba(59, 130, 246, 0.1)", text: "#3b82f6" },
};

// Responder community feed - View and interact with posts (no moderation)
export default function CommunityFeedResponder({ session, token }) {
  const outlet = useOutletContext?.() || {};
  const selectedBarangay = outlet.selectedBarangay || "All";

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  const authToken = token || session?.token || localStorage.getItem('token') || '';

  const fetchPosts = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);

    try {
      let url = getApiUrl('/api/community/posts/barangay');
      const params = new URLSearchParams();

      if (selectedBarangay && selectedBarangay !== "All") {
        params.append("barangay", selectedBarangay);
      }

      const response = await fetch(url + (params.toString() ? `?${params.toString()}` : ''), {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
      } else {
        setPosts([]);
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [selectedBarangay, authToken]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

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
  const filteredPosts = posts.filter((p) => {
    const text = searchTerm.toLowerCase();
    const authorName = (p.author?.firstname || '') + " " + (p.author?.lastname || '');
    return (
      p.title?.toLowerCase().includes(text) ||
      p.content?.toLowerCase().includes(text) ||
      authorName?.toLowerCase().includes(text)
    );
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
          Community Feed — Responder View
        </h2>

        <div className="header-actions">
          <input
            className="feed-search"
            type="text"
            placeholder="Search post or user..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <button className="feed-btn" onClick={fetchPosts}>
            ↻ Refresh
          </button>
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
  
  // Accepted posts show normally
  const isAccepted = post.is_accepted === true || post.status === 'approved';
  const canLike = isAccepted;

  const handleCommentKey = (e) => {
    if (e.key === "Enter" && comment.trim()) {
      onAddComment(post.id, comment);
      setComment("");
    }
  };

  return (
    <div className={`post-card ${post.is_pinned ? "post-pinned" : ""}`}>
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
