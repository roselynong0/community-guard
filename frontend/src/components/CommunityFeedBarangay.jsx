import React, { useState, useEffect, useCallback } from "react";
import "./CommunityFeed.css";
import "./Notifications.css";
import { FaPaperPlane, FaUsers, FaTrash } from "react-icons/fa";
import { getApiUrl, API_CONFIG } from "../utils/apiConfig";

// ✅ POST TYPES
const POST_TYPES = ["incident", "safety", "suggestion", "recommendation", "general"];

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

// ✅ ROLE COLORS
const ROLE_COLORS = {
  "Admin": { bg: "rgba(139, 92, 246, 0.1)", text: "#8b5cf6" },
  "Barangay Official": { bg: "rgba(37, 99, 235, 0.1)", text: "#2563eb" },
  "Responder": { bg: "rgba(239, 68, 68, 0.1)", text: "#ef4444" },
  "Resident": { bg: "rgba(59, 130, 246, 0.1)", text: "#3b82f6" },
};

const CommunityFeedBarangay = ({ session, token }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("All");
  const [postTypeFilter, setPostTypeFilter] = useState("all");
  const [userBarangay, setUserBarangay] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);

  const authToken = token || session?.token || localStorage.getItem("token") || "";

  useEffect(() => {
    fetchUserBarangay();
  }, []);

  const fetchUserBarangay = async () => {
    try {
      const tokenToUse = authToken || localStorage.getItem("token");
      if (!tokenToUse) return;

      const response = await fetch(getApiUrl(API_CONFIG.endpoints.profile), {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenToUse}` },
      });

      if (response.ok) {
        const data = await response.json();
        const barangay = data.profile?.address_barangay || data.address_barangay || "Barretto";
        setUserBarangay(barangay);
        
        // Set current user ID for draft storage
        if (data.profile?.id) {
          setCurrentUserId(data.profile.id);
        } else if (data.id) {
          setCurrentUserId(data.id);
        }
      } else {
        console.error("Error fetching user info:", response.statusText);
        setUserBarangay("Barretto");
      }
    } catch (error) {
      console.error("Error fetching user info:", error);
      setUserBarangay("Barretto");
    }
  };

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const tokenToUse = authToken || localStorage.getItem("token");
      if (!tokenToUse) return;

      let url = getApiUrl('/api/community/posts');
      const params = new URLSearchParams();

      if (barangayFilter && barangayFilter !== "All") {
        params.append("barangay", barangayFilter);
      }

      if (postTypeFilter && postTypeFilter !== "all") {
        params.append("post_type", postTypeFilter);
      }

      // Append params to the full URL returned by getApiUrl
      const response = await fetch(url + (params.toString() ? `?${params.toString()}` : ''), {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenToUse}` },
      });

      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
      } else {
        console.error("Error fetching posts:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoading(false);
    }
  }, [barangayFilter, postTypeFilter, authToken]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleNewPost = async (newPost) => {
    try {
      const tokenToUse = authToken || localStorage.getItem("token");
      const response = await fetch(getApiUrl('/api/community/posts'), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenToUse}` },
        body: JSON.stringify(newPost),
      });

      if (response.ok) {
        const data = await response.json();
        setPosts((prev) => [data.post, ...prev]);

        setNotification({
          type: "success",
          message: "✅ Post published successfully!",
        });
        
        // Clear saved form data on success (user-specific)
        const draftKey = currentUserId ? `postFormDraft_${currentUserId}` : "postFormDraft";
        localStorage.removeItem(draftKey);
        setOpenModal(false);
        setTimeout(() => setNotification(null), 3000);
        return true;
      } else {
        const error = await response.json();
        
        // ✅ Save form data for recovery on error (user-specific)
        const draftKey = currentUserId ? `postFormDraft_${currentUserId}` : "postFormDraft";
        localStorage.setItem(draftKey, JSON.stringify(newPost));
        
        setNotification({
          type: "error",
          message: `❌ Error: ${error.message}`,
        });
        setTimeout(() => setNotification(null), 3000);
        return false;
      }
    } catch (error) {
      console.error("Error creating post:", error);
      
      // ✅ Save form data for recovery on error (user-specific)
      const draftKey = currentUserId ? `postFormDraft_${currentUserId}` : "postFormDraft";
      localStorage.setItem(draftKey, JSON.stringify(newPost));
      
      setNotification({
        type: "error",
        message: "❌ Failed to create post",
      });
      setTimeout(() => setNotification(null), 3000);
      return false;
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;

    try {
      const tokenToUse = authToken || localStorage.getItem("token");
      const response = await fetch(getApiUrl(`/api/community/posts/${postId}`), {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenToUse}` },
      });

      if (response.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setNotification({
          type: "success",
          message: "✅ Post deleted successfully!",
        });
        setTimeout(() => setNotification(null), 3000);
      } else {
        setNotification({
          type: "error",
          message: "❌ Failed to delete post",
        });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      setNotification({
        type: "error",
        message: "❌ Failed to delete post",
      });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleAddComment = async (postId, commentText) => {
    if (!commentText.trim()) return;

    try {
      const tokenToUse = authToken || localStorage.getItem("token");
      const response = await fetch(getApiUrl(`/api/community/posts/${postId}/comments`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenToUse}` },
        body: JSON.stringify({ content: commentText }),
      });

      if (response.ok) {
        fetchPosts(); // Refresh posts to show new comment
        setNotification({
          type: "success",
          message: "✅ Comment added!",
        });
      } else {
        const error = await response.json();
        setNotification({
          type: "error",
          message: `❌ ${error.message}`,
        });
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      setNotification({
        type: "error",
        message: "❌ Failed to add comment",
      });
    }

    setTimeout(() => setNotification(null), 2000);
  };

  const handleDeleteComment = async (postId, commentId) => {
    if (!window.confirm("Delete this comment?")) return;

    try {
      const tokenToUse = authToken || localStorage.getItem("token");
      const response = await fetch(getApiUrl(`/api/community/comments/${commentId}`), {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenToUse}` },
      });

      if (response.ok) {
        fetchPosts(); // Refresh to show updated comments
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  // ✅ FILTER POSTS
  const filteredPosts = posts.filter((p) => {
    const text = searchTerm.toLowerCase();
    const authorName = p.author?.firstname + " " + p.author?.lastname;
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
          Community Feed
        </h2>

        {/* ✅ SEARCH + NEW POST ROW */}
        <div className="header-actions">
          <input
            className="feed-search"
            type="text"
            placeholder="Search post or user..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <button className="feed-btn" onClick={() => setOpenModal(true)}>
            + New Post
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
              <PostCard
                key={post.id}
                post={post}
                onAddComment={handleAddComment}
                onDeleteComment={handleDeleteComment}
                onDeletePost={handleDeletePost}
              />
            ))}
          </>
        )}
      </div>

      {openModal && (
        <PostModal onClose={() => setOpenModal(false)} onSubmit={handleNewPost} userBarangay={userBarangay} currentUserId={currentUserId} />
      )}
    </div>
  );
};

// ✅ POST CARD
const PostCard = ({ post, onAddComment, onDeleteComment, onDeletePost }) => {
  const [comment, setComment] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [postData, setPostData] = useState(post);

  const handleCommentKey = (e) => {
    if (e.key === "Enter" && comment.trim()) {
      onAddComment(post.id, comment);
      setComment("");
    }
  };

  const handleViewComments = async () => {
    if (!showComments) {
      if (!postData.comments || postData.comments.length === 0) {
        setCommentsLoading(true);
        try {
          const token = localStorage.getItem("token");
          if (!token) return;
          const response = await fetch(
            `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/community/posts/${post.id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (response.ok) {
            const data = await response.json();
            if (data.status === "success") {
              setPostData(data.post);
            }
          }
        } catch (error) {
          console.error("Error loading comments:", error);
        } finally {
          setCommentsLoading(false);
        }
      }
    }
    setShowComments(!showComments);
  };

  const roleColor = ROLE_COLORS[post.author?.role] || ROLE_COLORS["Resident"];
  const authorName = `${post.author?.firstname} ${post.author?.lastname}`;
  const postedDate = new Date(post.created_at).toLocaleDateString();

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

      {!post.allow_comments && (
        <p style={{ color: "#ef4444", fontSize: "0.9rem", marginTop: "0.5rem" }}>
          💬 Comments are disabled for this post
        </p>
      )}

      {post.allow_comments && (
        <div className="toggle-comment-container">
          <button
            className="toggle-comment-btn"
            onClick={handleViewComments}
            disabled={commentsLoading}
          >
            {commentsLoading ? "Loading..." : showComments ? "Hide Comments" : `View Comments (${post.comment_count || 0})`}
          </button>
        </div>
      )}

      {showComments && post.allow_comments && (
        <div className="comments-box">
          <div className="comments-scroll">
            {(!postData.comments || postData.comments.length === 0) && (
              <p style={{ color: "#9ca3af", textAlign: "center", padding: "1rem" }}>
                No comments yet. Be the first to comment!
              </p>
            )}
            {(postData.comments ?? []).map((c) => (
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
const PostModal = ({ onClose, onSubmit, userBarangay, currentUserId }) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState("general");
  const [barangay, setBarangay] = useState(userBarangay || "");
  const [posting, setPosting] = useState(false);

  // ✅ Recover unsaved draft if it exists (user-specific)
  const [savedDraft] = useState(() => {
    try {
      const draftKey = currentUserId ? `postFormDraft_${currentUserId}` : "postFormDraft";
      const draft = localStorage.getItem(draftKey);
      if (draft) {
        const parsed = JSON.parse(draft);
        setTitle(parsed.title || "");
        setContent(parsed.content || "");
        setPostType(parsed.post_type || "general");
        setBarangay(parsed.barangay || userBarangay || "");
        return parsed;
      }
    } catch (err) {
      console.warn("Failed to recover draft:", err);
    }
    return null;
  });

  const handleModalClose = () => {
    // ✅ Save form data as draft if user is closing with unsaved content (user-specific)
    if (title.trim() || content.trim()) {
      const draftKey = currentUserId ? `postFormDraft_${currentUserId}` : "postFormDraft";
      localStorage.setItem(draftKey, JSON.stringify({
        title,
        content,
        post_type: postType,
        barangay,
      }));
    }
    onClose();
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

    try {
      setPosting(true);
      const success = await onSubmit(newPost);
      setPosting(false);

      if (success) {
        // Clear form locally
        setTitle("");
        setContent("");
        setPostType("general");
        setBarangay(userBarangay);
      }
    } catch (err) {
      console.error("Error submitting post:", err);
      setPosting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Community Post</h2>
          <button className="modal-close" onClick={handleModalClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="post-form">
          <div className="form-group">
            <label>Post Type * <span className="required">(Required)</span></label>
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
              <option value="">-- Select Barangay --</option>
              {BARANGAYS.map((b, idx) => (
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
              type="submit"
              className="btn-success"
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
        </form>
      </div>
    </div>
  );
};

export default CommunityFeedBarangay;
