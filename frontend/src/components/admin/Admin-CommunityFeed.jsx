import React, { useState, useEffect } from "react";
import "../resident/CommunityFeed.css";
import "../resident/Notifications.css";
import { FaPaperPlane, FaUsers, FaCheck, FaTimes, FaEdit, FaTrash } from "react-icons/fa";

const AdminCommunityFeed = () => {
  const [posts, setPosts] = useState([]);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = () => {
    setPosts([
      {
        id: 1,
        author: "Juan Dela Cruz",
        role: "resident",
        title: "Lost Wallet",
        content: "I found a wallet at Mango Street. Pm me!",
        timestamp: "2025-11-05",
        status: "pending",
        comments: [],
      },
      {
        id: 2,
        author: "Pedro Santos",
        role: "resident",
        title: "Free tutoring",
        content: "Offering free tutoring on math. Every Sat.",
        timestamp: "2025-11-04",
        status: "approved",
        comments: [],
      },
    ]);
  };

  // ✅ Approve
  const handleApprove = (postId) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, status: "approved" } : p
      )
    );

    showNotif("success", "Post approved successfully!");
  };

  // ✅ Reject
  const handleReject = (postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    showNotif("caution", "Post rejected and removed.");
  };

  const showNotif = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const getCurrentUserName = () => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      return user?.name || "Unknown User";
    } catch {
      return "Unknown User";
    }
  };

  const handleAddComment = (postId, commentText) => {
    if (!commentText.trim()) return;
    const commenter = getCurrentUserName();

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              comments: [
                ...p.comments,
                {
                  id: Date.now(),
                  name: commenter,
                  text: commentText,
                  timestamp: new Date().toISOString(),
                },
              ],
            }
          : p
      )
    );
  };

  // ✅ SEARCH filter
  const filteredPosts = posts.filter((p) => {
    const text = searchTerm.toLowerCase();
    return (
      p.title?.toLowerCase().includes(text) ||
      p.content?.toLowerCase().includes(text) ||
      p.author?.toLowerCase().includes(text)
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
          Admin Community Feed
        </h2>

        <div className="header-actions">
          <input
            className="feed-search"
            type="text"
            placeholder="Search post or user..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="feed-list">
        {filteredPosts.length === 0 && <p>No posts found.</p>}

        {filteredPosts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onApprove={handleApprove}
            onReject={handleReject}
            onAddComment={handleAddComment}
          />
        ))}
      </div>
    </div>
  );
};



// ✅ POST CARD
const PostCard = ({ post, onApprove, onReject, onAddComment }) => {
  const [comment, setComment] = useState("");
  const [showComments, setShowComments] = useState(false);

  const currentUser = (() => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      return user?.name || "Unknown User";
    } catch {
      return "Unknown User";
    }
  })();

  const handleCommentKey = (e) => {
    if (e.key === "Enter") {
      onAddComment(post.id, comment);
      setComment("");
    }
  };

  return (
    <div className={`post-card ${post.status === "pending" ? "post-pending" : ""}`}>
      <div className="post-header">
        <h3>{post.title}</h3>

        {post.status === "pending" && (
          <span className="badge-pending">Pending Approval</span>
        )}
      </div>

      <p className="post-content">{post.content}</p>

      <p className="post-subinfo">
        {post.author} · {post.timestamp}
      </p>

      {/* ✅ ACTION BUTTONS FOR ADMIN */}
      {post.status === "pending" && (
        <div className="admin-approval-buttons">
          <button className="btn-approve" onClick={() => onApprove(post.id)}>
            <FaCheck /> Approve
          </button>
          <button className="btn-reject" onClick={() => onReject(post.id)}>
            <FaTimes /> Reject
          </button>
        </div>
      )}

      {/* ✅ COMMENTS TOGGLE */}
      <div className="toggle-comment-container">
        <button
          className="toggle-comment-btn"
          onClick={() => setShowComments(!showComments)}
        >
          {showComments ? "Hide Comments" : "View Comments"}
        </button>
      </div>

      {showComments && (
        <div className="comments-box">
          <h4>Comments</h4>

          {(!post.comments || post.comments.length === 0) && (
            <p className="no-comments">No comments yet</p>
          )}

          <div className="comments-scroll">
            {(post.comments ?? []).map((c) => (
              <div key={c.id} className="comment-item">
                <p>{c.text}</p>
                <span className="comment-time">
                  {c.name} · {new Date(c.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

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
        </div>
      )}
    </div>
  );
};

export default AdminCommunityFeed;
