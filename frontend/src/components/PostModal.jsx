import React, { useState } from "react";
import "./PostModal.css";

const PostModal = ({ onClose, onSubmit }) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  // Replace with real user auth
  const user = {
    name: "CurrentUser",
    role: "resident", // change dynamically
  };

  const handleSubmit = () => {
    if (!title || !content) return;

    const newPost = {
      id: Date.now(),
      author: user.name,
      role: user.role,
      title,
      content,
      timestamp: new Date().toLocaleDateString(),
      status: user.role === "official" ? "approved" : "pending",
    };

    // ✅ Send new post back to feed
    onSubmit(newPost);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="post-modal">
        <h3>Create Post</h3>

        <label>
          Title <span style={{ color: "red" }}>*</span>
        </label>
        <input
          className="input-box"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <label>
          Content <span style={{ color: "red" }}>*</span>
        </label>
        <textarea
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="input-box"
          rows={5}
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-submit" onClick={handleSubmit}>
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostModal;
