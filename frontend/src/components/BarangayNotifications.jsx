import React, { useEffect, useMemo, useState, } from "react";
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
  FaExclamationTriangle
} from 'react-icons/fa';

import { API_CONFIG, getApiUrl } from "../utils/apiConfig";
// ... existing code ...
const API_URL = getApiUrl(API_CONFIG.endpoints.notifications); 

// Determine the type of notification
const getFinalNotificationType = (n) => {
    const textContext = String(n.title || '') + ' ' + String(n.message || '') + ' ' + String(n.type || '');
    const normalizedText = textContext.trim().toLowerCase();

    if (normalizedText.includes('resolved') || normalizedText.includes('complete') || normalizedText.includes('success')) {
        return 'resolved';
    }

    if (normalizedText.includes('pending') || normalizedText.includes('submitted') || normalizedText.includes('waiting')) {
        return 'pending';
    }
    if (normalizedText.includes('ongoing') || normalizedText.includes('in-progress')) {
        return 'ongoing';
    }
    
    // Only keep report/alert notifications
    if (normalizedText.includes('report') || normalizedText.includes('alert') || normalizedText.includes('emergency')) {
        return 'report';
    }

    return 'info'; 
};

// Map type to icon
const getNotificationIcon = (type) => {
  switch (type.toLowerCase()) {
    case 'resolved':
      return <FaCheckCircle className="icon icon-success" />;
    case 'pending':
      return <FaClock className="icon icon-pending" />;
    case 'ongoing':
      return <FaSyncAlt className="icon icon-warning" />;
    case 'report':
      return <FaExclamationTriangle className="icon icon-report" />;
    default:
      return <FaInfoCircle className="icon icon-info" />;
  }
};

export default function BarangayNotifications({ session, token }) {
  const authToken = session?.token || token || "";

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, _setError] = useState("");
  const [filter, setFilter] = useState("all"); 
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    }),
    [authToken]
  );

  // Dummy notifications for demo
  useEffect(() => {
    const dummyNotifs = [
      {
        id: '1',
        title: 'Fire Incident Report',
        message: 'Fire reported at Zone 3. Immediate action required.',
        type: 'report',
        created_at: new Date().toISOString(),
        read: false,
      },
      {
        id: '2',
        title: 'Flood Alert',
        message: 'River levels rising in Zone 5. Evacuation advised.',
        type: 'report',
        created_at: new Date().toISOString(),
        read: true,
      },
      {
        id: '3',
        title: 'Resolved Road Obstruction',
        message: 'Road obstruction in Barangay 2 has been cleared.',
        type: 'resolved',
        created_at: new Date().toISOString(),
        read: false,
      },
      {
        id: '4',
        title: 'Ongoing Traffic Incident',
        message: 'Traffic disruption at Main Street due to accident.',
        type: 'ongoing',
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
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + 
             ' ' + date.toLocaleDateString();
  };

  const markRead = (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const deleteNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // Refresh handler uses setLoading so the variable is used and the UI shows the loading state
  const refreshNotifications = async () => {
    setLoading(true);
    _setError("");
    try {
      const res = await fetch(`${API_URL}/notifications`, { headers });
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data = await res.json();
      // Accept either an array or an object with a `notifications` array
      if (Array.isArray(data)) {
        setNotifications(data);
      } else if (data && Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
      }
    } catch (err) {
      _setError("Failed to refresh notifications.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <div className="left">
          <h2>
            Barangay Notifications
            <span className="badge" aria-label={`${unreadCount} unread`}>
              {unreadCount}
            </span>
          </h2>
        </div>
        <div className="right">
          <div className="filter-button-group">
            <button className={`filter-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All</button>
            <button className={`filter-btn ${filter === "unread" ? "active" : ""}`} onClick={() => setFilter("unread")}>Unread ({unreadCount})</button>
            <button className={`filter-btn ${filter === "read" ? "active" : ""}`} onClick={() => setFilter("read")}>Read</button>
          </div>

          <button className="btn icon-btn mark-all" onClick={markAllRead} disabled={loading || unreadCount === 0} title="Mark all as read">
            <FaCheckDouble className="icon" /> <span className="btn-text">Mark All Read</span>
          </button>
          <button className="btn icon-btn refresh" onClick={refreshNotifications} disabled={loading} title="Refresh notifications">
            <FaSync className="icon" /> <span className="btn-text">Refresh</span>
          </button>
        </div>
      </div>

      {error && <div className="notice error" role="alert">{error}</div>}

      {loading ? (
        <div className="loading loading-block" aria-busy="true" aria-live="polite">
          <div className="spinner"></div>Loading notifications…
        </div>
      ) : visible.length === 0 ? (
        <div className="empty no-notifications">No notifications to show.</div>
      ) : (
        <ul className="notifications-list" role="list">
          {visible.map((n) => (
            <li key={n.id} className={`notification-item ${n.read ? "read" : "unread"}`}>
              <div className="notif-icon-container">{getNotificationIcon(getFinalNotificationType(n))}</div>
              <div className="notif-details">
                <p className="notif-message"><strong>{n.title}</strong>: {n.message}</p>
                <p className="notif-time">{formatTime(n.created_at)}</p>
              </div>
              <div className="notification-actions">
                {!n.read && <button className="btn-action mark-read-btn" onClick={() => markRead(n.id)} title="Mark as Read"><FaCheck /></button>}
                <button className="btn-action delete-notif-btn" onClick={() => deleteNotification(n.id)} title="Delete Notification"><FaTrashAlt /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}