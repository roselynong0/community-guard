import React, { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import "./CommunityFeed.css";
import "./Notifications.css";
import { FaPaperPlane, FaUsers, FaTrash, FaExclamationTriangle } from "react-icons/fa";
import { getApiUrl, API_CONFIG } from "../utils/apiConfig";

// ✅ POST TYPES
const POST_TYPES = ["incident", "safety", "suggestion", "recommendation", "general"];

// ✅ ROLE COLORS
const ROLE_COLORS = {
  "Admin": { bg: "rgba(139, 92, 246, 0.1)", text: "#8b5cf6" },
  "Barangay Official": { bg: "rgba(37, 99, 235, 0.1)", text: "#2563eb" },
  "Responder": { bg: "rgba(239, 68, 68, 0.1)", text: "#ef4444" },
  "Resident": { bg: "rgba(59, 130, 246, 0.1)", text: "#3b82f6" },
};

const CommunityFeedBarangay = ({ session, token }) => {
  const outlet = useOutletContext?.() || {};
  const selectedBarangay = outlet.selectedBarangay || "All";

  const [posts, setPosts] = useState([]);
  const [openModal, setOpenModal] = useState(false);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [userInfo, setUserInfo] = useState(null);
  const [isOfficialUser, setIsOfficialUser] = useState(false);

  const authToken = token || session?.token || localStorage.getItem("token") || "";

  useEffect(() => {
    if (!authToken) return;
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
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
  };

  const fetchPosts = useCallback(async () => {
    if (!authToken) return;

    try {
      // Use barangay-specific endpoint which returns only approved posts for barangay officials
  let url = getApiUrl('/api/community/posts/barangay');
      const params = new URLSearchParams();

      // If userInfo is loaded, use role to determine filter
      if (userInfo && userInfo.role === "Admin") {
        // Admins can optionally pass a barangay to filter; otherwise they'll get approved posts across barangays
        if (selectedBarangay && selectedBarangay !== "All") {
          params.append("barangay", selectedBarangay);
        }
      } else if (userInfo && userInfo.role === "Barangay Official") {
        // Barangay officials will be scoped server-side to their own address_barangay; no param required
      } else {
        // Residents can optionally view a specific barangay (selectedBarangay)
        if (selectedBarangay && selectedBarangay !== "All") {
          params.append("barangay", selectedBarangay);
        }
      }

      // Append params to the full URL returned by getApiUrl
      const response = await fetch(url + (params.toString() ? `?${params.toString()}` : ''), {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
      } else if (response.status === 403) {
        setPosts([]);
        console.warn("Not authorized to view pending posts or that barangay's posts");
      } else {
        console.error("Error fetching posts:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
    }
  }, [selectedBarangay, authToken, userInfo]);

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

        setNotification({
          type: "success",
          message: "✅ Post published successfully!",
        });
        setOpenModal(false);
      } else {
        const error = await response.json();
        setNotification({
          type: "error",
          message: `❌ Error: ${error.message}`,
        });
      }
    } catch (error) {
      console.error("Error creating post:", error);
      setNotification({
        type: "error",
        message: "❌ Failed to create post",
      });
    }

    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;

    try {
      const response = await fetch(getApiUrl(`/api/community/posts/${postId}`), {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setNotification({
          type: "success",
          message: "✅ Post deleted successfully!",
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

  const handleAddComment = async (postId, commentText) => {
    if (!commentText.trim()) return;

    try {
      const response = await fetch(getApiUrl(`/api/community/posts/${postId}/comments`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ content: commentText }),
      });

      if (response.ok) {
        fetchPosts(); // Refresh posts to show new comment
        setNotification({
          type: "success",
          message: "✅ Comment added!",
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
      const response = await fetch(getApiUrl(`/api/community/comments/${commentId}`), {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
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

  const feedTitle = isOfficialUser
    ? `Barangay Official Feed — ${selectedBarangay || "All"}`
    : "Community Feed";

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
          {feedTitle}
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
      </div>

      <div className="feed-list">
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
      </div>

      {openModal && (
        <PostModal 
          onClose={() => setOpenModal(false)} 
          onSubmit={handleNewPost}
          userBarangay={userInfo?.address_barangay}
          selectedBarangay={selectedBarangay}
          isOfficialUser={isOfficialUser}
        />
      )}
    </div>
  );
};

// ✅ POST CARD
const PostCard = ({ post, onAddComment, onDeleteComment, onDeletePost }) => {
  const [comment, setComment] = useState("");
  const [showComments, setShowComments] = useState(false);

  const handleCommentKey = (e) => {
    if (e.key === "Enter" && comment.trim()) {
      onAddComment(post.id, comment);
      setComment("");
    }
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
        <div className="post-actions">
          {post.can_delete && (
            <FaTrash
              className="post-delete-btn"
              onClick={() => onDeletePost(post.id)}
              title="Delete post"
            />
          )}
        </div>
      </div>

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
        <span className="post-type-badge">{post.post_type}</span>
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

      <div className="toggle-comment-container">
        <button
          className="toggle-comment-btn"
          onClick={() => setShowComments(!showComments)}
        >
          {showComments ? "Hide Comments" : `View Comments (${post.comment_count || 0})`}
        </button>
      </div>

      {showComments && post.allow_comments && (
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
const PostModal = ({ onClose, onSubmit, userBarangay, selectedBarangay, isOfficialUser }) => {
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
    setTitle("");
    setContent("");
    setPostType("general");
    setBarangay(userBarangay || "");
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Community Post</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

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
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
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
      </div>
    </div>
  );
};

export default CommunityFeedBarangay;
