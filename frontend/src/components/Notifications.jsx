import React, { useEffect, useMemo, useState, useCallback } from "react";
import { API_CONFIG } from "../utils/apiConfig";
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
  FaUserShield,
  FaTimes
} from 'react-icons/fa';

import { getApiUrl } from "../utils/apiConfig";

// Use getApiUrl for consistent base URL resolution


const getFinalNotificationType = (n) => {
    const textContext = String(n.title || '') + ' ' + String(n.message || '') + ' ' + String(n.type || '');
    const normalizedText = textContext.trim().toLowerCase();

    // Report/post rejection should be detected first
    if (normalizedText.includes('report rejected') || normalizedText.includes('post rejected') || (normalizedText.includes('rejected') && (normalizedText.includes('report') || normalizedText.includes('post')))) {
        return 'rejected';
    }

    // Report/post deletion should be detected
    if (normalizedText.includes('report deleted') || normalizedText.includes('post deleted') || (normalizedText.includes('deleted') && (normalizedText.includes('report') || normalizedText.includes('post')))) {
        return 'report_deleted';
    }

    if (normalizedText.includes('resolved') || normalizedText.includes('complete') || normalizedText.includes('success')) {
        return 'resolved';
    }
    
    if (normalizedText.includes('verify') || normalizedText.includes('verification') || normalizedText.includes('account required')) {
        return 'account_alert';
    }

    if (normalizedText.includes('pending') || normalizedText.includes('submitted') || normalizedText.includes('waiting')) {
        return 'pending';
    }
    if (normalizedText.includes('ongoing') || normalizedText.includes('in-progress')) {
        return 'ongoing';
    }
    
    const genericType = String(n.type || 'info').trim().toLowerCase();
    if (genericType !== 'status update') {
        return genericType;
    }

    return 'info'; 
};


// UPDATED ICON MAPPING
const getNotificationIcon = (type) => {
  switch (type.toLowerCase()) {
    case 'success':
    case 'resolved':
    case 'complete': 
      return <FaCheckCircle className="icon icon-success" />;
    
    // ✅ NEW CASE FOR ACCOUNT/VERIFICATION ALERTS
    case 'account_alert':
    case 'security':
      return <FaUserShield className="icon icon-security" />;
    // END NEW CASE
    
    // Rejection notification - red X icon
    case 'rejected':
      return <FaTimes className="icon icon-rejected" />;
    
    // Report/post deletion - red trash icon
    case 'report_deleted':
      return <FaTrashAlt className="icon icon-delete" />;
      
    case 'warning':
    case 'ongoing':
    case 'in-progress': 
      return <FaSyncAlt className="icon icon-warning" />;
      
    case 'pending':
    case 'submitted': 
    case 'waiting': 
      return <FaClock className="icon icon-pending" />;
      
    default:
      return <FaInfoCircle className="icon icon-info" />;
  }
};

export default function Notifications({ session, token }) {
  const authToken = session?.token || token || "";

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); 
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    }),
    [authToken]
  );


  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
  const res = await fetch(getApiUrl(API_CONFIG.endpoints.notifications), { headers });
      if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
      const data = await res.json();
      
      const list = (data?.notifications || []).map((n) => {
        
        // --- Use the new helper to determine the type for the icon ---
        const finalType = getFinalNotificationType(n);

        return {
          id: n.id,
          title: n.title ?? n.type ?? "Notification",
          message: n.message ?? n.content ?? "",
          type: finalType, // Use the determined type
          created_at: n.created_at ?? n.createdAt ?? new Date().toISOString(),
          read: Boolean(n.read),
        };
      });
      setNotifications(list);
    } catch (e) {
      setError(e.message || "Something went wrong loading notifications");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

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
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + 
             ' ' + date.toLocaleDateString();
  };

  async function markRead(id) {
    try {
      // Optimistic UI update
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      const res = await fetch(getApiUrl(`/api/notifications/${id}/read`), {
        method: "POST",
        headers,
      });
      if (!res.ok) throw new Error(`Failed to mark as read (${res.status})`);
      const data = await res.json();
      // If server returned a notification, reconcile with local state
      if (data?.notification) {
        const srv = data.notification;
        setNotifications((prev) => prev.map((n) => (n.id === srv.id ? { ...n, read: Boolean(srv.is_read), created_at: srv.created_at ?? n.created_at } : n)));
      }
    } catch (e) {
      setError(e.message || "Failed to mark notification as read");
      // revert optimistic change
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
    }
  }

  async function deleteNotification(id) {
    try {
      // optimistic remove
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      const res = await fetch(getApiUrl(`/api/notifications/${id}`), {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error(`Failed to delete (${res.status})`);
    } catch (e) {
      setError(e.message || "Failed to delete notification");
      // refetch to restore list
      fetchNotifications();
    }
  }

  async function markAllRead() {
    try {
      // Optimistic UI update
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      const res = await fetch(getApiUrl(`/api/notifications/read_all`), {
        method: "POST",
        headers,
      });
      if (!res.ok) throw new Error(`Failed to mark all as read (${res.status})`);
      const data = await res.json();
      // If server returned updated_count or failed, we can decide to refetch
      if (data?.status !== 'success') {
        throw new Error(data?.message || 'Unexpected server response');
      }
    } catch (e) {
      setError(e.message || "Failed to mark all as read");
      // refresh from server to get authoritative state
      fetchNotifications();
    }
  }


  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <div className="left">
          <h2>
            Notifications
            <span className="badge" aria-label={`${unreadCount} unread`}>
              {unreadCount}
            </span>
          </h2>
        </div>
        <div className="right">
          {/* Filter button group */}
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
            disabled={loading || unreadCount === 0}
            title="Mark all as read"
          >
            {/* React Icon: FaCheckDouble */}
            <FaCheckDouble className="icon" /> 
            <span className="btn-text">Mark All Read</span>
          </button>
          <button 
            className="btn icon-btn refresh" 
            onClick={fetchNotifications} 
            disabled={loading}
            title="Refresh notifications"
          >
            {/* React Icon: FaSync */}
            <FaSync className="icon" />
            <span className="btn-text">Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading loading-block" aria-busy="true" aria-live="polite">
          <div className="spinner"></div>
          Loading notifications…
        </div>
      ) : visible.length === 0 ? (
        <div className="empty no-notifications">No notifications to show.</div>
      ) : (
        <ul className="notifications-list" role="list">
          {visible.map((n) => (
            <li key={n.id} className={`notification-item ${n.read ? "read" : "unread"}`}>
              {/* Notification Icon */}
              <div className="notif-icon-container">
                {getNotificationIcon(n.type)}
              </div>

              {/* Notification Content */}
              <div className="notif-details">
                <p className="notif-message">
                  <strong>{n.title}</strong>: {n.message}
                </p>
                <p className="notif-time">{formatTime(n.created_at)}</p>
              </div>

              {/* Actions Button Group */}
              <div className="notification-actions">
                {/* Mark Read button */}
                {!n.read && (
                  <button 
                    className="btn-action mark-read-btn" 
                    onClick={() => markRead(n.id)}
                    title="Mark as Read"
                  >
                    {/* React Icon: FaCheck */}
                    <FaCheck />
                  </button>
                )}
                
                {/* Delete button */}
                <button 
                  className="btn-action delete-notif-btn" 
                  onClick={() => deleteNotification(n.id)}
                  title="Delete Notification"
                >
                    {/* React Icon: FaTrashAlt */}
                    <FaTrashAlt />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!authToken && (
        <div className="notice warning" role="alert">
          No auth token detected. Pass <code>session</code> or <code>token</code> prop to
          <code> &lt;Notifications /&gt;</code>.
        </div>
      )}
    </div>
  );
}
