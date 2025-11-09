import React, { useState, useEffect } from "react";
import "./CommunityFeed.css";
import "./Notifications.css";
import { FaPaperPlane, FaUsers, FaEdit, FaTrash } from "react-icons/fa";

const CommunityFeed = () => {
  const [posts, setPosts] = useState([]);
  const [openModal, setOpenModal] = useState(false);
  const [notification, setNotification] = useState(null);

  // ✅ NEW
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setPosts([
      {
        id: 1,
        author: "Barangay Official",
        role: "official",
        title: "Community Clean-Up Drive",
        content: "Join us this weekend at the plaza!",
        timestamp: "2025-11-01",
        status: "approved",
        comments: [],
      },
      {
        id: 2,
        author: "Juan Dela Cruz",
        role: "resident",
        title: "Stray Dog Spotted",
        content: "Aggressive dog seen near Riverside.",
        timestamp: "2025-11-02",
        status: "approved",
        comments: [],
      },
    ]);
  };

  const handleNewPost = (newPost) => {
    setPosts((prev) => [newPost, ...prev]);

    setNotification({
      type: newPost.status === "pending" ? "caution" : "success",
      message:
        newPost.status === "pending"
          ? "Post submitted! Waiting for admin approval."
          : "Post published successfully!",
    });

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

    setPosts((prevPosts) =>
      prevPosts.map((p) =>
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

  const handleEditComment = (postId, commentId, newText) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: post.comments.map((c) =>
                c.id === commentId ? { ...c, text: newText } : c
              ),
            }
          : post
      )
    );
  };

  const handleDeleteComment = (postId, commentId) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: post.comments.filter((c) => c.id !== commentId),
            }
          : post
      )
    );
  };

  // ✅ FILTER POSTS
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
      </div>

      <div className="feed-list">
        {filteredPosts.length === 0 && <p>No posts found.</p>}

        {filteredPosts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onAddComment={handleAddComment}
            onEditComment={handleEditComment}
            onDeleteComment={handleDeleteComment}
          />
        ))}
      </div>

      {openModal && (
        <PostModal onClose={() => setOpenModal(false)} onSubmit={handleNewPost} />
      )}
    </div>
  );
};


// ✅ POST CARD
const PostCard = ({ post, onAddComment, onEditComment, onDeleteComment }) => {
  const [comment, setComment] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingText, setEditingText] = useState("");

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
    <div
      className={`post-card
      ${post.status === "pending" ? "post-pending" : ""}
      ${post.role === "official" ? "official" : ""}
    `}
    >
      <div className="post-header">
        <h3>{post.title}</h3>
        {post.role === "official" && (
          <span className="badge-official">Officials</span>
        )}
        {post.status === "pending" && (
          <span className="badge-pending">Pending Approval</span>
        )}
      </div>

      <p className="post-content">{post.content}</p>

      <p className="post-subinfo">
        {post.author} · {post.timestamp}
      </p>

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
                {editingCommentId === c.id ? (
                  <div className="edit-comment-container">
                    <input
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                    />
                    <button
                      onClick={() => {
                        onEditComment(post.id, c.id, editingText);
                        setEditingCommentId(null);
                      }}
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <>
                    <p>{c.text}</p>
                    <span className="comment-time">
                      {c.name} · {new Date(c.timestamp).toLocaleString()}
                    </span>
                  </>
                )}

                {c.name === currentUser && editingCommentId !== c.id && (
                  <div className="comment-actions">
                    <FaEdit
                      className="comment-icon edit"
                      onClick={() => {
                        setEditingCommentId(c.id);
                        setEditingText(c.text);
                      }}
                    />
                    <FaTrash
                      className="comment-icon delete"
                      onClick={() => onDeleteComment(post.id, c.id)}
                    />
                  </div>
                )}
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

export default CommunityFeed;
