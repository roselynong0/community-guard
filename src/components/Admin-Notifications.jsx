import React, { useEffect, useMemo, useState, useCallback } from 'react';
import './Notifications.css';
import {
  FaInfoCircle,
  FaCheckCircle,
  FaSyncAlt,
  FaClock,
  FaTrashAlt,
  FaUser,
  FaCommentDots,
  FaBell,
  FaCheck,
  FaCheckDouble,
  FaExclamationTriangle,
} from 'react-icons/fa';

const API_URL = 'http://localhost:5000/api';

const getFinalNotificationType = (n) => {
  const textContext = String(n.title || '') + ' ' + String(n.message || '') + ' ' + String(n.type || '');
  const normalizedText = textContext.trim().toLowerCase();

  if (normalizedText.includes('resolved') || normalizedText.includes('complete') || normalizedText.includes('success')) {
    return 'resolved';
  }
  if (normalizedText.includes('verify') || normalizedText.includes('verification') || normalizedText.includes('account')) {
    return 'account_alert';
  }
  if (normalizedText.includes('pending') || normalizedText.includes('submitted') || normalizedText.includes('waiting')) {
    return 'pending';
  }
  if (normalizedText.includes('ongoing') || normalizedText.includes('in-progress')) {
    return 'ongoing';
  }
  // Account deletion / user removed
  if (normalizedText.includes('user deleted') || normalizedText.includes('account deleted') || (normalizedText.includes('deleted') && normalizedText.includes('user'))) {
    return 'account_deleted';
  }
  // Report related keywords
  if (normalizedText.includes('report') || normalizedText.includes('status')) {
    return 'report';
  }
  const genericType = String(n.type || 'info').trim().toLowerCase();
  if (genericType !== 'status update') return genericType;
  return 'info';
};

const getNotificationIcon = (type) => {
  const t = (type || 'info').toLowerCase();
  switch (t) {
    case 'resolved':
    case 'success':
      return <FaCheckCircle className="icon icon-success" />;
    case 'account_alert':
      // treat account_alert like a new report visually (exclamation icon)
      return <FaExclamationTriangle className="icon icon-report" />;
    case 'user':
      return <FaUser className="icon icon-security" />; // user icon for account actions
    case 'report':
      // new report posts use the exclamation triangle like the home dashboard
      return <FaExclamationTriangle className="icon icon-report" />;
    case 'warning':
    case 'ongoing':
      // ongoing status uses the sync/refresh icon (matching Home)
      return <FaSyncAlt className="icon icon-ongoing" />;
    case 'pending':
      return <FaClock className="icon icon-pending" />;
    case 'deleted':
    case 'report deleted':
      return <FaTrashAlt className="icon icon-warning" />;
    case 'account_deleted':
      // red trash icon for account deletions
      return <FaTrashAlt className="icon icon-delete" />;
    default:
      return <FaInfoCircle className="icon icon-info" />;
  }
};

// main icon shown at the left of each notification item
// per request: keep the exclamation triangle in front of report posts
const getMainIcon = (n) => {
  // if the notification relates to a report or is an account_alert, show the exclamation triangle
  const t = String(n?.type || '').toLowerCase();
  const message = String(n?.message || '') + ' ' + String(n?.title || '');
  const msg = message.toLowerCase();
  if (t === 'report' || t === 'account_alert' || msg.includes('report') || msg.includes("updated to") || msg.includes('new report')) {
    return <FaExclamationTriangle className="icon icon-report" />;
  }
  // fallback to the type-based icon
  return getNotificationIcon(t || 'info');
};

// badge helpers accept either a type string or the full notification object
const getBadgeClass = (input) => {
  let t = '';
  let message = '';
  if (typeof input === 'string') {
    t = input.toLowerCase();
  } else if (input && typeof input === 'object') {
    t = String(input.type || '').toLowerCase();
    message = String(input.message || '') + ' ' + String(input.title || '');
  }

  // If message explicitly mentions status, prefer that
  const msg = message.toLowerCase();
  if (msg.includes('ongoing') || msg.includes('in-progress') || msg.includes('ongoing')) return 'ongoing';
  if (msg.includes('pending') || msg.includes('submitted') || msg.includes('waiting')) return 'pending';

  // account / user deleted messages should show account-deleted badge
  if (msg.includes('user deleted') || msg.includes('account deleted') || (msg.includes('deleted') && msg.includes('user'))) return 'account-deleted';

  if (t === 'account_alert') return 'report';
  if (t === 'success') return 'resolved';
  if (t === 'account_deleted' || t === 'user deleted' || t === 'user_deleted') return 'account-deleted';
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

  switch (t) {
    case 'account_alert':
      return 'Report Alert';
    case 'account_deleted':
      return 'Account Deleted';
    case 'report':
      return 'Report';
    case 'pending':
      return 'Pending';
    case 'ongoing':
      return 'Ongoing';
    case 'resolved':
    case 'success':
      return 'Resolved';
    default:
      return (t || 'Info').toString();
  }
};

// return an icon color class for the main/left icon; used to color the recipient avatar to match
const getIconClassForNotification = (n) => {
  const t = String(n?.type || '').toLowerCase();
  const message = String(n?.message || '') + ' ' + String(n?.title || '');
  const msg = message.toLowerCase();
  if (t === 'report' || t === 'account_alert' || msg.includes('report') || msg.includes('new report') || msg.includes('updated to')) {
    return 'icon-report';
  }
  // account deletion -> red trash color
  if (t === 'account_deleted' || t === 'user deleted' || t === 'user_deleted' || msg.includes('user deleted') || msg.includes('account deleted')) return 'icon-delete';
  if (msg.includes('ongoing') || msg.includes('in-progress') || t === 'ongoing') return 'icon-ongoing';
  if (msg.includes('pending') || msg.includes('submitted') || t === 'pending') return 'icon-pending';
  if (t === 'resolved' || t === 'success') return 'icon-success';
  if (t === 'user') return 'icon-security';
  return 'icon-info';
};

export default function AdminNotifications({ session }) {
  const token = session?.token || '';
  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // All | Unread | Read
  const [categoryFilter, setCategoryFilter] = useState('All'); // All | Report | Account

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/admin/admin_notifications`, { headers });
      if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
      const data = await res.json();
      // Only admin-focused notifications (admin_notifications endpoint)
      const adminNotifs = (data.admin_notifications || []).map((n) => {
        const finalType = getFinalNotificationType(n);
        return {
          id: `admin-${n.id}`,
          raw_id: n.id,
          title: n.title || n.type || 'Admin Notification',
          message: n.message || '',
          type: finalType,
          created_at: n.created_at || new Date().toISOString(),
          is_read: Boolean(n.is_read),
          recipient: n.recipient || null,
          actor: n.actor || null,
          source: 'admin'
        };
      });

      setNotifications(adminNotifs);
    } catch (e) {
      setError(e.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markAdminRead = async (rawId) => {
    try {
      // optimistic update
      setNotifications(prev => prev.map(n => (n.raw_id === rawId ? { ...n, is_read: true } : n)));
      const res = await fetch(`${API_URL}/admin/admin_notifications/${rawId}/read`, { method: 'POST', headers });
      if (!res.ok) throw new Error(`Failed to mark read (${res.status})`);
      const data = await res.json();
      if (data?.notification) {
        setNotifications(prev => prev.map(n => (n.raw_id === rawId ? { ...n, is_read: Boolean(data.notification.is_read) } : n)));
      }
    } catch (e) {
      // revert optimistic change on failure
      setNotifications(prev => prev.map(n => (n.raw_id === rawId ? { ...n, is_read: false } : n)));
      setError(e.message || 'Failed to mark admin notification read');
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllAdminRead = async () => {
    if (unreadCount === 0) return;
    try {
      // optimistic
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      const res = await fetch(`${API_URL}/admin/admin_notifications/read_all`, { method: 'POST', headers });
      if (!res.ok) throw new Error(`Failed to mark all read (${res.status})`);
      const data = await res.json();
      if (data?.status !== 'success' && !data?.updated_count) {
        // fallback to refetch if server didn't acknowledge
        throw new Error(data?.message || 'Unexpected response');
      }
      // otherwise we assume success; if server returns notifications we could reconcile
    } catch (e) {
      setError(e.message || 'Failed to mark all admin notifications as read');
      // refresh to restore authoritative state
      fetchNotifications();
    }
  };

  const deleteAdminNotification = async (rawId) => {
    try {
      // optimistic remove
      setNotifications(prev => prev.filter(n => n.raw_id !== rawId));
      const res = await fetch(`${API_URL}/admin/admin_notifications/${rawId}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(`Failed to delete (${res.status})`);
      // Optionally validate response
    } catch (e) {
      setError(e.message || 'Failed to delete admin notification');
      fetchNotifications(); // refresh to restore state
    }
  };

  const filtered = notifications.filter(n => {
    // status filter
    if (statusFilter === 'Unread' && n.is_read) return false;
    if (statusFilter === 'Read' && !n.is_read) return false;

    // category filter
    if (categoryFilter === 'Report') {
      // include notifications that reference a report in the title/message or have type 'report'
      const title = String(n.title || '').toLowerCase();
      const msg = String(n.message || '').toLowerCase();
      const t = String(n.type || '').toLowerCase();
      if (!(title.includes('report') || msg.includes('report') || t === 'report')) return false;
    }
    if (categoryFilter === 'Account') {
      const titleLow = String(n.title || '').toLowerCase();
      const msgLow = String(n.message || '').toLowerCase();
      const typeLow = String(n.type || '').toLowerCase();

      // If the title explicitly mentions a report, prefer report classification
      if (titleLow.includes('report')) return false;

      // Include when type is account_alert or title/message mention "account"
      if (!(typeLow === 'account_alert' || titleLow.includes('account') || msgLow.includes('account'))) return false;
    }

    return true;
  });

  // compute unread count inline when rendering to avoid unused-variable lint warnings

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <div className="left"><h2><FaBell /> Admin Notifications</h2></div>
        <div className="right">
          <div className="filter-controls" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#444' }}>Status</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
                <option value="All">All</option>
                <option value="Unread">Unread ({notifications.filter(n => !n.is_read).length})</option>
                <option value="Read">Read</option>
              </select>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#444' }}>Category</span>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="filter-select">
                <option value="All">All</option>
                <option value="Report">Report</option>
                <option value="Account">Account</option>
              </select>
            </label>
          </div>
          <button className="btn icon-btn mark-all" onClick={markAllAdminRead} disabled={loading || unreadCount === 0} title="Mark all as read">
            <FaCheckDouble className="icon" />
            <span className="btn-text">Mark All Read</span>
          </button>
          <button className="btn icon-btn refresh" onClick={fetchNotifications} disabled={loading}>Refresh</button>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}

      {loading ? (
        <div className="loading loading-block"><div className="spinner"/>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="no-notifications">No notifications.</div>
      ) : (
        <ul className="notifications-list">
          {filtered.map(n => (
            <li key={n.id} className={`notification-item ${n.is_read ? 'read' : 'unread'}`}>
              <div className="notif-icon-container">{getMainIcon(n)}</div>
              <div className="notif-details">
                <div className="notif-header">
                  <p className="notif-title"><strong>{n.title}</strong></p>
                  {/* Badge next to title showing status (Pending/Ongoing/Resolved) */}
                  {/* Badge uses mapped class/label so account_alert adopts report styling and resolved uses resolved styling */}
                  <div className={`notif-badge ${getBadgeClass(n)}`} title={`Status: ${getBadgeLabel(n)}`} aria-hidden>
                    <span className="badge-icon small-icon">{getNotificationIcon(getBadgeClass(n))}</span>
                    <span className="badge-text">{getBadgeLabel(n)}</span>
                  </div>
                </div>

                {/* Human-friendly message on the next line */}
                <p className="notif-message">{n.message}</p>
                <small className="notif-time">{new Date(n.created_at).toLocaleString()}</small>

                {n.recipient ? (
                  <div className="notif-to" style={{ marginTop: 8, color: '#555', display: 'flex', alignItems: 'center' }}>
                    <span className="recipient-icon small-icon" style={{ marginRight: 8 }}>
                      <FaUser className={`icon ${getIconClassForNotification(n)}`} />
                    </span>
                    <span>To: {n.recipient.firstname} {n.recipient.lastname} &lt;{n.recipient.email}&gt;</span>
                  </div>
                ) : null}

                {n.actor ? (
                  <div style={{ marginTop: 6, color: '#444', fontStyle: 'italic' }}>By: {n.actor.firstname || ''} {n.actor.lastname || ''}</div>
                ) : null}
              </div>
              <div className="notification-actions">
                {!n.is_read && (
                  <button className="btn-action mark-read-btn" onClick={() => markAdminRead(n.raw_id)} title="Mark as read">
                    <FaCheck />
                  </button>
                )}
                <button className="btn-action delete-notif-btn" onClick={() => deleteAdminNotification(n.raw_id)} title="Delete notification">
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
