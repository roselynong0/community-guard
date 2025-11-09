import React, { useState, useEffect, useCallback } from "react";
import {
  FaUsers,
  FaPlus,
  FaComment,
  FaTrash,
  FaEdit,
  FaCircle,
  FaFilter,
  FaSearch,
} from "react-icons/fa";
import PostModal from "./PostModal";
import "./CommunityFeed.css";
import API_CONFIG from "../config";

const API_URL = `${API_CONFIG.BASE_URL}/api/community`;

const ROLE_BADGES = {
  Admin: { color: "#8b5cf6", label: "Admin", icon: "🛡️" },
  "Barangay Official": { color: "#2563eb", label: "Official", icon: "📋" },
  Responder: { color: "#ef4444", label: "Responder", icon: "🚨" },
  Resident: { color: "#3b82f6", label: "Resident", icon: "👤" },
};

function CommunityFeed({ session }) {
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isFirstPost, setIsFirstPost] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // User info
  const [userProfile, setUserProfile] = useState(null);
  const [expandedComments, setExpandedComments] = useState(new Set());

  const BARANGAYS = [
    "All",
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

  const CATEGORIES = [
    "All",
    "Incident",
    "Safety",
    "Suggestion",
    "Recommendation",
    "Other",
  ];

  // Fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await fetch(`${API_URL.replace("/community", "")}/profile`, {
          headers: {
            Authorization: `Bearer ${session?.token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setUserProfile(data.user);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };

    if (session?.token) {
      fetchUserProfile();
    }
  }, [session?.token]);

  // Fetch community feed posts
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        barangay: selectedBarangay === "All" ? "" : selectedBarangay,
        category: selectedCategory === "All" ? "" : selectedCategory,
        search: searchTerm,
      });

      const response = await fetch(`${API_URL}/feed?${params}`, {
        headers: {
          Authorization: `Bearer ${session?.token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
        setFilteredPosts(data.posts || []);
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
      showNotification("Failed to load community feed", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedBarangay, selectedCategory, searchTerm, session?.token]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCreatePost = async (postData) => {
    try {
      const response = await fetch(`${API_URL}/feed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.token}`,
        },
        body: JSON.stringify(postData),
      });

      if (response.ok) {
        const data = await response.json();
        setPosts([data.post, ...posts]);
        setIsFirstPost(data.is_first_post);
        showNotification(
          data.is_first_post
            ? "Welcome! Your first post has been published!"
            : "Post published successfully!",
          "success"
        );
        setIsModalOpen(false);
      } else {
        showNotification("Failed to create post", "error");
      }
    } catch (error) {
      console.error("Error creating post:", error);
      showNotification("Error creating post", "error");
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;

    try {
      const response = await fetch(`${API_URL}/feed/posts/${postId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session?.token}`,
        },
      });

      if (response.ok) {
        setPosts(posts.filter((p) => p.id !== postId));
        showNotification("Post deleted successfully", "success");
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      showNotification("Failed to delete post", "error");
    }
  };

  const toggleComments = (postId) => {
    const newExpanded = new Set(expandedComments);
    if (newExpanded.has(postId)) {
      newExpanded.delete(postId);
    } else {
      newExpanded.add(postId);
    }
    setExpandedComments(newExpanded);
  };

  const getRoleBadge = (role) => {
    const badgeInfo = ROLE_BADGES[role] || ROLE_BADGES.Resident;
    return badgeInfo;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return "Just now";
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  return (
    <div className="community-feed-container">
      {/* Header */}
      <div className="feed-header-section">
        <div className="feed-header-content">
          <div className="feed-header-title">
            <FaUsers className="header-icon" />
            <h1>Community Guard Feed</h1>
          </div>
          <p className="feed-subtitle">
            Connect with your community, share insights, and stay informed
          </p>
        </div>
        <button
          className="create-post-btn"
          onClick={() => setIsModalOpen(true)}
          title="Create a new post"
        >
          <FaPlus /> New Post
        </button>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`notification notif-${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="search-box">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search posts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-controls">
          <div className="filter-group">
            <label className="filter-label">
              <FaFilter className="filter-icon" />
              Barangay
            </label>
            <select
              value={selectedBarangay}
              onChange={(e) => setSelectedBarangay(e.target.value)}
              className="filter-select"
            >
              {BARANGAYS.map((brgy) => (
                <option key={brgy} value={brgy}>
                  {brgy}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="filter-select"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Posts List */}
      <div className="posts-container">
        {loading ? (
          <div className="loading-state">
            <p>Loading community posts...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="empty-state">
            <FaUsers className="empty-icon" />
            <h3>No posts found</h3>
            <p>Be the first to share something with your community!</p>
            <button
              className="create-post-btn-secondary"
              onClick={() => setIsModalOpen(true)}
            >
              <FaPlus /> Create First Post
            </button>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <div key={post.id} className="post-card">
              {/* Post Header */}
              <div className="post-header">
                <div className="post-author-info">
                  <img
                    src={post.author?.avatar_url || "/default-avatar.png"}
                    alt={post.author?.firstname}
                    className="author-avatar"
                  />
                  <div className="author-details">
                    <div className="author-name">
                      {post.author?.firstname} {post.author?.lastname}
                    </div>
                    <div className="author-meta">
                      <span
                        className="role-badge"
                        style={{
                          backgroundColor: getRoleBadge(post.author?.role).color,
                        }}
                      >
                        {getRoleBadge(post.author?.role).icon}{" "}
                        {getRoleBadge(post.author?.role).label}
                      </span>
                      <span className="post-time">{formatDate(post.created_at)}</span>
                      <span className="barangay-tag">{post.address_barangay}</span>
                    </div>
                  </div>
                </div>

                {/* Post Actions */}
                {session?.user?.id === post.user_id && (
                  <div className="post-actions">
                    <button
                      className="action-btn delete-btn"
                      onClick={() => handleDeletePost(post.id)}
                      title="Delete post"
                    >
                      <FaTrash />
                    </button>
                  </div>
                )}
              </div>

              {/* Post Content */}
              <div className="post-content">
                <h3 className="post-title">{post.title}</h3>
                <p className="post-text">{post.content}</p>

                {/* Category Badge */}
                <div className="post-category-badge">{post.category}</div>
              </div>

              {/* Post Footer */}
              <div className="post-footer">
                <div className="post-stats">
                  <span className="stat">
                    <FaComment /> {post.comment_count || 0} Comments
                  </span>
                </div>

                {/* Comment Toggle Button */}
                {post.allow_comments && (
                  <button
                    className="comment-toggle-btn"
                    onClick={() => toggleComments(post.id)}
                  >
                    {expandedComments.has(post.id) ? "Hide Comments" : "View Comments"}
                  </button>
                )}
              </div>

              {/* Comments Section */}
              {expandedComments.has(post.id) && post.allow_comments && (
                <CommentsSection postId={post.id} session={session} />
              )}
            </div>
          ))
        )}
      </div>

      {/* Post Modal */}
      <PostModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreatePost}
        defaultBarangay={userProfile?.address_barangay || ""}
        isFirstPost={isFirstPost}
        user={userProfile}
      />
    </div>
  );
}

// ============================================
// COMMENTS SECTION COMPONENT
// ============================================

function CommentsSection({ postId, session }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadComments = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/feed/posts/${postId}/comments`, {
          headers: {
            Authorization: `Bearer ${session?.token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setComments(data.comments || []);
        }
      } catch (error) {
        console.error("Error fetching comments:", error);
      } finally {
        setLoading(false);
      }
    };

    loadComments();
  }, [postId, session?.token]);


  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      const response = await fetch(`${API_URL}/feed/posts/${postId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.token}`,
        },
        body: JSON.stringify({ content: newComment }),
      });

      if (response.ok) {
        const data = await response.json();
        setComments([...comments, data.comment]);
        setNewComment("");
      }
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;

    try {
      const response = await fetch(`${API_URL}/feed/comments/${commentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session?.token}`,
        },
      });

      if (response.ok) {
        setComments(comments.filter((c) => c.id !== commentId));
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  return (
    <div className="comments-section">
      {/* Comments List */}
      {loading ? (
        <div className="comments-loading">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="no-comments">No comments yet</div>
      ) : (
        <div className="comments-list">
          {comments.map((comment) => (
            <div key={comment.id} className="comment-item">
              <img
                src={comment.author?.avatar_url || "/default-avatar.png"}
                alt={comment.author?.firstname}
                className="comment-avatar"
              />
              <div className="comment-content">
                <div className="comment-header">
                  <span className="comment-author">
                    {comment.author?.firstname} {comment.author?.lastname}
                  </span>
                  <span className="comment-time">
                    {new Date(comment.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="comment-text">{comment.content}</p>
              </div>

              {/* Delete Button */}
              {session?.user?.id === comment.user_id && (
                <button
                  className="delete-comment-btn"
                  onClick={() => handleDeleteComment(comment.id)}
                  title="Delete comment"
                >
                  <FaTrash />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Comment Input */}
      <div className="add-comment-box">
        <input
          type="text"
          placeholder="Write a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
          className="comment-input"
        />
        <button
          className="comment-submit-btn"
          onClick={handleAddComment}
          disabled={!newComment.trim()}
        >
          Post
        </button>
      </div>
    </div>
  );
}

export default CommunityFeed;
