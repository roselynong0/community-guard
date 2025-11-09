import React, { useEffect, useMemo, useState } from "react";
import "./Notifications.css";
import {
  FaInfoCircle,
  FaCheckCircle,
  FaSyncAlt,
  FaClock,
  FaCheckDouble,
  FaSync,
  FaCheck,
  FaTrashAlt,
  FaExclamationTriangle,
} from "react-icons/fa";

const API_URL = "http://localhost:5000/api";

// Determine responder notification type
const getFinalNotificationType = (n) => {
  const textContext =
    String(n.title || "") +
    " " +
    String(n.message || "") +
    " " +
    String(n.type || "");
  const normalizedText = textContext.trim().toLowerCase();

  if (normalizedText.includes("resolved") || normalizedText.includes("done")) {
    return "resolved";
  }

  if (normalizedText.includes("pending") || normalizedText.includes("queue")) {
    return "pending";
  }

  if (normalizedText.includes("ongoing") || normalizedText.includes("in-progress")) {
    return "ongoing";
  }

  if (
    normalizedText.includes("emergency") ||
    normalizedText.includes("critical") ||
    normalizedText.includes("incident")
  ) {
    return "emergency";
  }

  return "info";
};

// Map icons
const getNotificationIcon = (type) => {
  switch (type?.toLowerCase()) {
    case "resolved":
      return <FaCheckCircle className="icon icon-success" />;
    case "pending":
      return <FaClock className="icon icon-pending" />;
    case "ongoing":
      return <FaSyncAlt className="icon icon-warning" />;
    case "emergency":
      return <FaExclamationTriangle className="icon icon-report" />;
    default:
      return <FaInfoCircle className="icon icon-info" />;
  }
};

export default function ResponderNotifications({ session, token }) {
  const authToken = session?.token || token || "";

  const [notifications, setNotifications] = useState([]);
  const [loading] = useState(false);
  const [error] = useState("");
  const [filter, setFilter] = useState("all");

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    }),
    [authToken]
  );

  /** ✅ Dummy notifications */
  useEffect(() => {
    const dummyNotifs = [
      {
        id: "1",
        title: "Emergency Incident Report",
        message: "A critical situation reported at Zone 1.",
        type: "emergency",
        created_at: new Date().toISOString(),
        read: false,
      },
      {
        id: "2",
        title: "Report Assigned",
        message: "You have been assigned a fire incident in Zone 4.",
        type: "ongoing",
        created_at: new Date().toISOString(),
        read: false,
      },
      {
        id: "3",
        title: "Report Pending",
        message: "Report ID 33221 is waiting acknowledgment.",
        type: "pending",
        created_at: new Date().toISOString(),
        read: true,
      },
      {
        id: "4",
        title: "Report Resolved",
        message: "Road obstruction cleared at City Highway.",
        type: "resolved",
        created_at: new Date().toISOString(),
        read: false,
      },
    ];
    setNotifications(dummyNotifs);
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const visible = useMemo(() => {
    if (filter === "unread") return notifications.filter((n) => !n.read);
    if (filter === "read") return notifications.filter((n) => n.read);
    return notifications;
  }, [notifications, filter]);

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return (
      date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }) +
      " " +
      date.toLocaleDateString()
    );
  };

  const markRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const deleteNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <div className="left">
          <h2>
            Responder Notifications
            <span className="badge" aria-label={`${unreadCount} unread`}>
              {unreadCount}
            </span>
          </h2>
        </div>

        <div className="right">
          <div className="filter-button-group">
            <button
              className={`filter-btn ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            <button
              className={`filter-btn ${filter === "unread" ? "active" : ""}`}
              onClick={() => setFilter("unread")}
            >
              Unread ({unreadCount})
            </button>
            <button
              className={`filter-btn ${filter === "read" ? "active" : ""}`}
              onClick={() => setFilter("read")}
            >
              Read
            </button>
          </div>

          <button
            className="btn icon-btn mark-all"
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            <FaCheckDouble /> <span className="btn-text">Mark All Read</span>
          </button>

          <button className="btn icon-btn refresh">
            <FaSync /> <span className="btn-text">Refresh</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading notifications…</div>
      ) : visible.length === 0 ? (
        <div className="empty">No notifications to show.</div>
      ) : (
        <ul className="notifications-list">
          {visible.map((n) => (
            <li
              key={n.id}
              className={`notification-item ${n.read ? "read" : "unread"}`}
            >
              <div className="notif-icon-container">
                {getNotificationIcon(getFinalNotificationType(n))}
              </div>

              <div className="notif-details">
                <p className="notif-message">
                  <strong>{n.title}</strong>: {n.message}
                </p>
                <p className="notif-time">{formatTime(n.created_at)}</p>
              </div>

              <div className="notification-actions">
                {!n.read && (
                  <button
                    className="btn-action"
                    onClick={() => markRead(n.id)}
                  >
                    <FaCheck />
                  </button>
                )}
                <button
                  className="btn-action"
                  onClick={() => deleteNotification(n.id)}
                >
                  <FaTrashAlt />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
