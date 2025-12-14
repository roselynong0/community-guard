import React, { useEffect, useMemo, useState, useCallback } from "react";
import { API_CONFIG } from "../../utils/apiConfig";
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
  FaExclamationTriangle,
  FaBell
} from 'react-icons/fa';

import { getApiUrl } from "../../utils/apiConfig";

import LoadingScreen from "../shared/LoadingScreen";


const getFinalNotificationType = (n) => {
    const textContext = String(n.title || '') + ' ' + String(n.message || '') + ' ' + String(n.type || '');
    const normalizedText = textContext.trim().toLowerCase();
    const notifType = String(n.type || '').toLowerCase();

    if (notifType === 'urgent_emergency' || notifType === 'emergency_alert' || notifType === 'emergency_report') {
        return 'emergency';
    }
    
    if (normalizedText.includes('emergency alert') || normalizedText.includes('🚨') || normalizedText.includes('community alert')) {
        return 'emergency';
    }

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
    
    // Emergency alert icons
    case 'emergency':
    case 'urgent_emergency':
    case 'emergency_alert':
    case 'emergency_report':
      return <FaBell className="icon icon-emergency" />;

    case 'account_alert':
    case 'security':
      return <FaUserShield className="icon icon-security" />;
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
  const [overlayExited, setOverlayExited] = useState(false);
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    }),
    [authToken]
  );

  useEffect(() => {
    if (loading) {
      setOverlayExited(false);
    }
  }, [loading]);


  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
  const res = await fetch(getApiUrl(API_CONFIG.endpoints.notifications), { headers });
      if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
      const data = await res.json();
      
      const list = (data?.notifications || []).map((n) => {
        
        const finalType = getFinalNotificationType(n);

        return {
          id: n.id,
          title: n.title ?? n.type ?? "Notification",
          message: n.message ?? n.content ?? "",
          type: finalType, 
          created_at: n.created_at ?? n.createdAt ?? new Date().toISOString(),
          read: Boolean(n.read),
        };
      });
      setNotifications(list);
      
      if (list.length > 0) {
        const animationDuration = (list.length * 80) + 500;
        
        setTimeout(() => {
          setLoading(false);
        }, animationDuration);
      } else {
        setLoading(false);
      }
    } catch (e) {
      setError(e.message || "Something went wrong loading notifications");
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const loadingFeatures = useMemo(
    () => [
      {
        title: "Notification Center",
        description: "Review community updates and alerts receive real time updates.",
      },
      {
        title: "Stay Informed",
        description: "Mark messages as read or clear outdated notices in one place.",
      },
    ],
    []
  );

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
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      const res = await fetch(getApiUrl(`/api/notifications/${id}/read`), {
        method: "POST",
        headers,
      });
      if (!res.ok) throw new Error(`Failed to mark as read (${res.status})`);
      const data = await res.json();
      if (data?.notification) {
        const srv = data.notification;
        setNotifications((prev) => prev.map((n) => (n.id === srv.id ? { ...n, read: Boolean(srv.is_read), created_at: srv.created_at ?? n.created_at } : n)));
      }
    } catch (e) {
      setError(e.message || "Failed to mark notification as read");
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
    }
  }

  async function deleteNotification(id) {
    try {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      const res = await fetch(getApiUrl(`/api/notifications/${id}`), {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error(`Failed to delete (${res.status})`);
    } catch (e) {
      setError(e.message || "Failed to delete notification");
      fetchNotifications();
    }
  }

  async function markAllRead() {
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      const res = await fetch(getApiUrl(`/api/notifications/read_all`), {
        method: "POST",
        headers,
      });
      if (!res.ok) throw new Error(`Failed to mark all as read (${res.status})`);
      const data = await res.json();
      if (data?.status !== 'success') {
        throw new Error(data?.message || 'Unexpected server response');
      }
    } catch (e) {
      setError(e.message || "Failed to mark all as read");
      fetchNotifications();
    }
  }


  const mainContent = (
    <div className={`notifications-container ${overlayExited ? "overlay-exited" : ""}`}>
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
            <FaCheckDouble className="icon" /> 
            <span className="btn-text">Mark All Read</span>
          </button>
          <button 
            className="btn icon-btn refresh" 
            onClick={fetchNotifications} 
            disabled={loading}
            title="Refresh notifications"
          >
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

      {visible.length > 0 ? (
        <ul className="notifications-list" role="list">
          {visible.map((n, index) => (
            <li 
              key={n.id} 
              className={`notification-item ${n.read ? "read" : "unread"}`}
              style={{ animationDelay: `${index * 0.08}s` }}
            >
              <div className="notif-icon-container">
                {getNotificationIcon(n.type)}
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
                    className="btn-action mark-read-btn" 
                    onClick={() => markRead(n.id)}
                    title="Mark as Read"
                  >
                    <FaCheck />
                  </button>
                )}
                <button 
                  className="btn-action delete-notif-btn" 
                  onClick={() => deleteNotification(n.id)}
                  title="Delete Notification"
                >
                    <FaTrashAlt />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        !loading && <div className="empty no-notifications">No notifications to show.</div>
      )}

      {!authToken && (
        <div className="notice warning" role="alert">
          No auth token detected. Pass <code>session</code> or <code>token</code> prop to
          <code> &lt;Notifications /&gt;</code>.
        </div>
      )}
    </div>
  );

  return (
    <LoadingScreen
      variant="inline"
      features={loadingFeatures}
      title={loading ? "Loading notifications..." : undefined}
      subtitle={loading ? "Fetching your latest alerts" : undefined}
      stage={loading ? "loading" : "exit"}
      successTitle="Notifications Ready!"
      inlineOffset="20vh"
      onExited={() => setOverlayExited(true)}
    >
      {mainContent}
    </LoadingScreen>
  );
}