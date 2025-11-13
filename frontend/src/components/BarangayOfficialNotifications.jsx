import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { API_CONFIG, getApiUrl } from "../utils/apiConfig";
import './Notifications.css';
import {
  FaInfoCircle,
  FaCheckCircle,
  FaSyncAlt,
  FaClock,
  FaTrashAlt,
  FaCheck,
  FaCheckDouble,
  FaSync,
  FaExclamationTriangle,
} from 'react-icons/fa';

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

  // Deleted/removed notifications
  if (normalizedText.includes('deleted') || normalizedText.includes('removed')) {
    return 'deleted';
  }

  // Report related keywords
  if (normalizedText.includes('report') || normalizedText.includes('alert') || normalizedText.includes('emergency')) {
    return 'report';
  }

  const genericType = String(n.type || 'info').trim().toLowerCase();
  if (genericType !== 'status update') return genericType;
  return 'info';
};

// Get notification icon based on type
const getNotificationIcon = (type) => {
  const t = (type || 'info').toLowerCase();
  switch (t) {
    case 'resolved':
    case 'success':
      return <FaCheckCircle className="icon icon-success" />;
    case 'pending':
      return <FaClock className="icon icon-pending" />;
    case 'ongoing':
      return <FaSyncAlt className="icon icon-warning" />;
    case 'report':
      return <FaExclamationTriangle className="icon icon-report" />;
    case 'deleted':
    case 'removed':
      return <FaTrashAlt className="icon icon-warning" />;
    default:
      return <FaInfoCircle className="icon icon-info" />;
  }
};

// Badge helpers
const getBadgeClass = (input) => {
  let t = '';
  let message = '';
  if (typeof input === 'string') {
    t = input.toLowerCase();
  } else if (input && typeof input === 'object') {
    t = String(input.type || '').toLowerCase();
    message = String(input.message || '') + ' ' + String(input.title || '');
  }

  const msg = message.toLowerCase();
  if (msg.includes('ongoing') || msg.includes('in-progress')) return 'ongoing';
  if (msg.includes('pending') || msg.includes('submitted') || msg.includes('waiting')) return 'pending';
  if (msg.includes('deleted') || msg.includes('removed')) return 'warning';

  if (t === 'success') return 'resolved';
  if (t === 'report' || t === 'alert') return 'report';
  return t || 'info';
};

const getBadgeLabel = (input) => {
  let t = '';
  let message = '';
  if (typeof input === 'string') {
    t = input.toLowerCase();
  } else if (input && typeof input === 'object') {
    t = String(input.type || '').toLowerCase();
    message = String(input.message || '') + ' ' + String(input.title || '');
  }

  const msg = message.toLowerCase();
  if (msg.includes('ongoing') || msg.includes('in-progress')) return 'Ongoing';
  if (msg.includes('pending') || msg.includes('submitted') || msg.includes('waiting')) return 'Pending';
  if (msg.includes('deleted') || msg.includes('removed')) return 'Deleted';

  switch (t) {
    case 'report':
    case 'alert':
      return 'Report Alert';
    case 'status update':
    case 'update':
      return 'Status Update';
    case 'pending':
      return 'Pending';
    case 'ongoing':
      return 'Ongoing';
    case 'resolved':
    case 'success':
      return 'Resolved';
    case 'deleted':
      return 'Deleted';
    default:
      return (t || 'Info').toString();
  }
};

// Get icon color class for styling
const getIconClassForNotification = (n) => {
  const t = String(n?.type || '').toLowerCase();
  const message = String(n?.message || '') + ' ' + String(n?.title || '');
  const msg = message.toLowerCase();
  
  if (t === 'report' || msg.includes('report') || msg.includes('new report')) {
    return 'icon-report';
  }
  if (msg.includes('deleted') || msg.includes('removed')) return 'icon-warning';
  if (msg.includes('ongoing') || msg.includes('in-progress') || t === 'ongoing') return 'icon-ongoing';
  if (msg.includes('pending') || msg.includes('submitted') || t === 'pending') return 'icon-pending';
  if (t === 'resolved' || t === 'success') return 'icon-success';
  return 'icon-info';
};

export default function BarangayOfficialNotifications({ session }) {
  const token = session?.token || '';
  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // All | Unread | Read

  // Fetch barangay official notifications
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(getApiUrl('/api/barangay/notifications'), { headers });
      if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
      const data = await res.json();
      
      // Process notifications
      const notifs = (data.notifications || []).map((n) => {
        const finalType = getFinalNotificationType(n);
        return {
          id: n.id,
          raw_id: n.id,
          title: n.title || n.type || 'Notification',
          message: n.message || '',
          type: finalType,
          created_at: n.created_at || new Date().toISOString(),
          is_read: Boolean(n.is_read || n.read),
        };
      });

      setNotifications(notifs);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  // Fetch on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Mark single notification as read
  const markNotificationRead = async (rawId) => {
    try {
      const res = await fetch(getApiUrl(`/api/barangay/notifications/${rawId}/read`), {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.raw_id === rawId ? { ...n, is_read: true } : n))
        );
      }
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  // Mark all as read
  const markAllRead = async () => {
    try {
      const res = await fetch(getApiUrl('/api/barangay/notifications/read_all'), {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      }
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  // Delete notification
  const deleteNotification = async (rawId) => {
    try {
      const res = await fetch(getApiUrl(`/api/barangay/notifications/${rawId}`), {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.raw_id !== rawId));
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Filter notifications based on status filter
  const filtered = notifications.filter((n) => {
    if (statusFilter === 'All') return true;
    if (statusFilter === 'Unread') return !n.is_read;
    if (statusFilter === 'Read') return n.is_read;
    return true;
  });

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
      ' ' + date.toLocaleDateString();
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
            <button
              className={`filter-btn ${statusFilter === 'All' ? 'active' : ''}`}
              onClick={() => setStatusFilter('All')}
            >
              All
            </button>
            <button
              className={`filter-btn ${statusFilter === 'Unread' ? 'active' : ''}`}
              onClick={() => setStatusFilter('Unread')}
            >
              Unread ({unreadCount})
            </button>
            <button
              className={`filter-btn ${statusFilter === 'Read' ? 'active' : ''}`}
              onClick={() => setStatusFilter('Read')}
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
            <FaCheckDouble className="icon" /> <span className="btn-text">Mark All Read</span>
          </button>
          <button
            className="btn icon-btn refresh"
            onClick={fetchNotifications}
            disabled={loading}
            title="Refresh notifications"
          >
            <FaSync className="icon" /> <span className="btn-text">Refresh</span>
          </button>
        </div>
      </div>

      {error && <div className="notice error" role="alert">{error}</div>}

      {loading ? (
        <div className="loading loading-block" aria-busy="true" aria-live="polite">
          <div className="spinner"></div>Loading notifications…
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty no-notifications">No notifications to show.</div>
      ) : (
        <ul className="notifications-list" role="list">
          {filtered.map((n) => (
            <li key={n.id} className={`notification-item ${n.is_read ? 'read' : 'unread'}`}>
              <div className={`notif-icon-container ${getIconClassForNotification(n)}`}>
                {getNotificationIcon(getFinalNotificationType(n))}
              </div>
              <div className="notif-details">
                <div className="notif-header">
                  <p className="notif-title"><strong>{n.title}</strong></p>
                  <span className={`badge badge-${getBadgeClass(n)}`}>
                    {getBadgeLabel(n)}
                  </span>
                </div>
                <p className="notif-message">{n.message}</p>
                <p className="notif-time">{formatTime(n.created_at)}</p>
              </div>
              <div className="notification-actions">
                {!n.is_read && (
                  <button
                    className="btn-action mark-read-btn"
                    onClick={() => markNotificationRead(n.raw_id)}
                    title="Mark as Read"
                  >
                    <FaCheck />
                  </button>
                )}
                <button
                  className="btn-action delete-notif-btn"
                  onClick={() => deleteNotification(n.raw_id)}
                  title="Delete Notification"
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
