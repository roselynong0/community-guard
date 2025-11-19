import React, { useState, useEffect, useCallback } from "react";
import "./CommunityFeed.css";
import "./Notifications.css";
import { FaPaperPlane, FaUsers, FaTrash } from "react-icons/fa";
import { getApiUrl, API_CONFIG } from "../utils/apiConfig";
import LoadingScreen from "./LoadingScreen";

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
const CommunityFeed = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("All");
  const [postTypeFilter, setPostTypeFilter] = useState("all");
  const [userBarangay, setUserBarangay] = useState("");
  const [postingState, setPostingState] = useState(false);

  useEffect(() => {
    fetchUserBarangay();
  }, []);

  const fetchUserBarangay = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(getApiUrl(API_CONFIG.endpoints.profile), {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const barangay = data.profile?.address_barangay || data.address_barangay || "Barretto";
        setUserBarangay(barangay);
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
      const token = localStorage.getItem("token");
      if (!token) return;

      let url = getApiUrl('/api/community/posts');
      const params = new URLSearchParams();

      if (barangayFilter && barangayFilter !== "All") {
        params.append("barangay", barangayFilter);
      }

      if (postTypeFilter && postTypeFilter !== "all") {
        params.append("post_type", postTypeFilter);
      }

      const response = await fetch(url + (params.toString() ? `?${params.toString()}` : ''), {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
  }, [barangayFilter, postTypeFilter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

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
        setNotification({ type: "success", message: "✅ Post deleted successfully!" });
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

  const filteredPosts = posts.filter((p) => {
    const text = searchTerm.toLowerCase();
    const authorName = p.author?.firstname + " " + p.author?.lastname;
    return (
      p.title?.toLowerCase().includes(text) ||
      p.content?.toLowerCase().includes(text) ||
      authorName?.toLowerCase().includes(text)
    );
  });

  const main = (
    <div className="feed-container">
      {notification && <div className={`notif notif-${notification.type}`}>{notification.message}</div>}
      <div className="feed-header">
        <h2 className="feed-title"><FaUsers className="feed-icon" /> Community Feed</h2>
        <div className="header-actions">
          <input className="feed-search" type="text" placeholder="Search post or user..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <button className="feed-btn" onClick={() => setOpenModal(true)}>+ New Post</button>
        </div>
        <div className="feed-filters">
          <select className="feed-filter-select" value={barangayFilter} onChange={(e) => setBarangayFilter(e.target.value)}>
            <option value="All">All Barangays</option>
            {BARANGAYS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select className="feed-filter-select" value={postTypeFilter} onChange={(e) => setPostTypeFilter(e.target.value)}>
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
          <div className="feed-loading"><div className="spinner" /><p>Loading posts...</p></div>
        ) : (
          <>
            {filteredPosts.length === 0 && <p>No posts found.</p>}
            {filteredPosts.map((post) => (
              <PostCard key={post.id} post={post} onAddComment={handleAddComment} onDeleteComment={handleDeleteComment} onDeletePost={handleDeletePost} />
            ))}
          </>
        )}
      </div>
      {openModal && <PostModal onClose={() => setOpenModal(false)} onSubmit={handleNewPost} userBarangay={userBarangay} />}
    </div>
  );

  if (loading) {
    return (
      <LoadingScreen variant="inline" title="Loading posts...">{main}</LoadingScreen>
    );
  }

  return main;
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

      {post.status && post.status !== 'approved' && (
        <p style={{ color: "#f97316", fontSize: "0.9rem", marginTop: "0.5rem" }}>
          💬 Comments are only available once this post is approved
        </p>
      )}

      {post.status === 'approved' && post.allow_comments && (
        <div className="toggle-comment-container">
          <button
            className="toggle-comment-btn"
            onClick={() => setShowComments(!showComments)}
          >
            {showComments ? "Hide Comments" : `View Comments (${post.comment_count || 0})`}
          </button>
        </div>
      )}

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-tabbed" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Community Post</h2>
          <button className="modal-close" onClick={handleModalClose}>
            ✕
          </button>
        </div>

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
      </div>
    </div>
  );
};