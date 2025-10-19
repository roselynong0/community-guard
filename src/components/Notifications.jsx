import React, { useState, useEffect } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaThumbsUp, FaRegBell, FaTrashAlt } from 'react-icons/fa';
import axios from 'axios';
import './Notifications.css';
import './Notification.css';

const API_URL = "http://localhost:5000/api";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[Notifications] Rendering error:", error, info);
    this.setState({ error, info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20 }}>
          <h2>Notifications failed to load</h2>
          <p style={{ color: '#900' }}>An unexpected error occurred rendering this component.</p>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {String(this.state.error)}
            {this.state.info && '\n' + (this.state.info.componentStack || '')}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

function NotificationsInner({ token, session }) {
  // Accept either `session` (preferred) or `token` for backward compatibility
  const derivedToken = session?.token || token;
  const [activeFilter, setActiveFilter] = useState('All');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState(null);
  const [showRaw, setShowRaw] = useState(false);

  // ---------------- FETCH NOTIFICATIONS ----------------
  useEffect(() => {
    if (!derivedToken) {
      // No token -> not authenticated, show empty state
      setNotifications([]);
      setLoading(false);
      return;
    }

    const fetchNotifications = async () => {
      setLoading(true);
      console.log("[Notifications] fetchNotifications starting, token present?", !!derivedToken);
      try {
        const res = await axios.get(`${API_URL}/notifications`, {
          headers: { Authorization: `Bearer ${derivedToken}` },
        });
  console.log("[Notifications] fetch response:", res && res.data && res.data.notifications ? res.data.notifications.length : 'no-data', res.data);
        const raw = res.data.notifications || [];
        const incoming = (raw || []).map((n, idx) => {
          // Defensive normalization
          const id = n.id ?? n.notification_id ?? idx;
          const title = n.title ?? (typeof n.message === 'string' ? (n.message.slice(0, 60) || 'Notification') : 'Notification');
          const message = n.message ?? n.body ?? '';
          const type = n.type ?? 'Notification';
          const read = !!(n.read || n.is_read);
          const created_at = n.created_at ? String(n.created_at) : null;
          return { ...n, id, title, message, type, read, created_at };
        });
        setNotifications(incoming);
        console.log("[Notifications] setNotifications -> length:", incoming.length, incoming[0] || null);
      } catch (err) {
        console.error("Error fetching notifications:", err);
        setNotifications([]);
      } finally {
        setLoading(false);
        setLastChecked(new Date().toISOString());
      }
    };

    fetchNotifications();
  }, [derivedToken]);

  // ---------------- MARK AS READ ----------------
  const markAsRead = async (id) => {
    if (!derivedToken) return;
    try {
      await axios.post(`${API_URL}/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${derivedToken}` },
      });
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  // ---------------- DELETE NOTIFICATION ----------------
  const deleteNotification = async (id) => {
    if (!derivedToken) return;
    try {
      await axios.delete(`${API_URL}/notifications/${id}`, {
        headers: { Authorization: `Bearer ${derivedToken}` },
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  // ---------------- MARK ALL AS READ ----------------
  const markAllAsRead = async () => {
    if (!derivedToken) return;
    try {
      await axios.post(`${API_URL}/notifications/read_all`, {}, {
        headers: { Authorization: `Bearer ${derivedToken}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  // ---------------- RENDER ICON ----------------
  const renderIcon = (type) => {
    switch (type) {
      case "Complete": return <FaCheckCircle className="icon complete" />;
      case "Alert": return <FaExclamationCircle className="icon alert" />;
      case "Like": return <FaThumbsUp className="icon like" />;
      default: return <FaRegBell className="icon default" />;
    }
  };

  const KNOWN_FILTERS = ['Complete', 'Alert', 'Like'];
  const filteredNotifications = (notifications || []).filter(n => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Other') return !KNOWN_FILTERS.includes(n.type);
    return n.type === activeFilter;
  });

  // (replaced by displayedAllRead below)

  const [unreadOnly, setUnreadOnly] = useState(false);

  // Apply unreadOnly filter on top of the active filter
  const displayedNotifications = (filteredNotifications || []).filter(n =>
    unreadOnly ? !n.read : true
  );

  const displayedAllRead = displayedNotifications.length > 0 && displayedNotifications.every(n => n.read);

  return (
    <div className="notifications-page">
      <div className="header-row">
        <h2>Notifications</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className={`mark-read-btn ${displayedAllRead ? 'disabled' : ''}`}
            onClick={markAllAsRead}
            disabled={displayedAllRead}
          >
            Mark all as read
          </button>
          <button
            className={`history-btn ${unreadOnly ? 'active' : ''}`}
            onClick={() => setUnreadOnly(u => !u)}
            aria-pressed={unreadOnly}
            title={unreadOnly ? 'Show all notifications' : 'Show unread only'}
          >
            {unreadOnly ? 'Unread only' : 'All'}
          </button>
        </div>
      </div>

      <div className="notifications-filters">
        {['All', 'Complete', 'Alert', 'Like', 'Other'].map(filter => (
          <button
            key={filter}
            className={`filter-btn ${activeFilter === filter ? 'active' : ''}`}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="notifications-list">
        {loading ? (
          <div className="loading-block">
            <div className="spinner" aria-hidden="true" />
            <p className="loading-text">Checking notifications...</p>
          </div>
            ) : notifications.length === 0 ? (
          <div className="no-notifications-block">
            <h2 className="empty-header">Notifications</h2>
            <p className="no-notifications">No notifications yet.</p>
            {lastChecked && (
              <p className="notif-debug">Checked at: {new Date(lastChecked).toLocaleTimeString()} — fetched {notifications.length} notifications</p>
            )}
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <button className="filter-btn" onClick={() => setShowRaw(s => !s)}>
                    {showRaw ? 'Hide raw response' : 'Show raw response'}
                  </button>
                </div>
                {showRaw && (
                  <pre style={{ maxHeight: 240, overflow: 'auto', textAlign: 'left', background: '#fff', padding: 12, margin: 12 }}>
                    {JSON.stringify(notifications, null, 2)}
                  </pre>
                )}
          </div>
        ) : displayedNotifications.length === 0 ? (
          <p className="no-notifications">No notifications for this filter.</p>
        ) : (
          displayedNotifications.map(notif => (
            <div key={notif.id} className={`notification-item ${notif.read ? "read" : "unread"}`}>
              <div className="notif-icon-container">{renderIcon(notif.type)}</div>
              <div className="notif-details">
                <h4>{notif.title}</h4>
                <p className="notif-message">{notif.message}</p>
                <small className="notif-time">{new Date(notif.created_at).toLocaleString()}</small>
              </div>
              {!notif.read && <span className="unread-dot" />}
              <div className="notification-actions">
                {!notif.read && <button onClick={() => markAsRead(notif.id)}>Mark as read</button>}
                <button className="delete-notif-btn" onClick={() => deleteNotification(notif.id)}>
                  <FaTrashAlt />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Notifications(props) {
  return (
    <ErrorBoundary>
      <NotificationsInner {...props} />
    </ErrorBoundary>
  );
}

export default Notifications;