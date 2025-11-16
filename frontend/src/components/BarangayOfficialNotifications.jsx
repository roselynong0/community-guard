import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { API_CONFIG, getApiUrl } from "../utils/apiConfig";
import './Notifications.css';
import {
  FaInfoCircle,
  FaCheckCircle,
  FaSyncAlt,
  FaClock,
  FaTrashAlt,
  FaUser,
  FaExclamationTriangle,
  FaCheckDouble,
  FaSync,
  FaCheck,
} from 'react-icons/fa';

const getFinalNotificationType = (n) => {
  const textContext = String(n.title || '') + ' ' + String(n.message || '') + ' ' + String(n.type || '');
  const normalizedText = textContext.trim().toLowerCase();

  // Status updates from responders
  if (normalizedText.includes('status updated') || normalizedText.includes('updated to')) {
    const msg = normalizedText;
    if (msg.includes('resolved')) return 'resolved';
    if (msg.includes('ongoing') || msg.includes('in-progress')) return 'ongoing';
    if (msg.includes('pending')) return 'pending';
    return 'status_update';
  }

  if (normalizedText.includes('resolved') || normalizedText.includes('complete') || normalizedText.includes('success')) {
    return 'resolved';
  }

  if (normalizedText.includes('pending') || normalizedText.includes('submitted') || normalizedText.includes('waiting')) {
    return 'pending';
  }

  if (normalizedText.includes('ongoing') || normalizedText.includes('in-progress')) {
    return 'ongoing';
  }

  // New post from user in their barangay
  if (normalizedText.includes('new post') || normalizedText.includes('new report')) {
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
    case 'pending':
      return <FaClock className="icon icon-pending" />;
    case 'ongoing':
    case 'in-progress':
      return <FaSyncAlt className="icon icon-ongoing" />;
    case 'report':
      return <FaExclamationTriangle className="icon icon-report" />;
    case 'status_update':
      return <FaSyncAlt className="icon icon-warning" />;
    default:
      return <FaInfoCircle className="icon icon-info" />;
  }
};

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
  if (msg.includes('resolved')) return 'resolved';
  if (msg.includes('ongoing') || msg.includes('in-progress')) return 'ongoing';
  if (msg.includes('pending')) return 'pending';

  if (t === 'report') return 'report';
  if (t === 'status_update') return 'ongoing';
  if (t === 'success') return 'resolved';
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
  if (msg.includes('resolved')) return 'Resolved';
  if (msg.includes('ongoing') || msg.includes('in-progress')) return 'Ongoing';
  if (msg.includes('pending')) return 'Pending';

  switch (t) {
    case 'report':
      return 'New Post';
    case 'status_update':
      return 'Status Update';
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

const getIconClassForNotification = (n) => {
  const t = String(n?.type || '').toLowerCase();
  const message = String(n?.message || '') + ' ' + String(n?.title || '');
  const msg = message.toLowerCase();
  
  if (t === 'report' || msg.includes('new post') || msg.includes('new report')) {
    return 'icon-report';
  }
  if (msg.includes('resolved') || t === 'resolved') return 'icon-success';
  if (msg.includes('ongoing') || msg.includes('in-progress') || t === 'ongoing') return 'icon-ongoing';
  if (msg.includes('pending') || t === 'pending') return 'icon-pending';
  return 'icon-info';
};

const getIconClassForActorRole = (actor) => {
  if (!actor || !actor.role) return 'icon-info';
  const role = String(actor.role).toLowerCase();
  switch (role) {
    case 'admin':
      return 'icon-admin';
    case 'barangay official':
      return 'icon-barangay';
    case 'responder':
      return 'icon-responder';
    default:
      return 'icon-resident';
  }
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
  const [statusFilter, setStatusFilter] = useState('All');

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(getApiUrl('/api/barangay/notifications'), { headers });
      if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
      const data = await res.json();

      const notifs = (data.notifications || []).map((n) => {
        const finalType = getFinalNotificationType(n);
        return {
          id: `barangay-${n.id}`,
          raw_id: n.id,
          title: n.title || n.type || 'Barangay Notification',
          message: n.message || '',
          type: finalType,
          created_at: n.created_at || new Date().toISOString(),
          is_read: Boolean(n.is_read),
          actor: n.actor || null,
          source: 'barangay'
        };
      });

      setNotifications(notifs);
    } catch (e) {
      setError(e.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markBarangayRead = async (rawId) => {
    try {
      setNotifications(prev => prev.map(n => (n.raw_id === rawId ? { ...n, is_read: true } : n)));
      const res = await fetch(getApiUrl(`/api/barangay/notifications/${rawId}/read`), { method: 'POST', headers });
      if (!res.ok) throw new Error(`Failed to mark read (${res.status})`);
      const data = await res.json();
      if (data?.notification) {
        setNotifications(prev => prev.map(n => (n.raw_id === rawId ? { ...n, is_read: Boolean(data.notification.is_read) } : n)));
      }
    } catch (e) {
      setNotifications(prev => prev.map(n => (n.raw_id === rawId ? { ...n, is_read: false } : n)));
      setError(e.message || 'Failed to mark barangay notification read');
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllBarangayRead = async () => {
    if (unreadCount === 0) return;
    try {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      const res = await fetch(getApiUrl('/api/barangay/notifications/read_all'), { method: 'POST', headers });
      if (!res.ok) throw new Error(`Failed to mark all read (${res.status})`);
      const data = await res.json();
      if (data?.status !== 'success' && !data?.updated_count) {
        throw new Error(data?.message || 'Unexpected response');
      }
    } catch (e) {
      setError(e.message || 'Failed to mark all barangay notifications as read');
      fetchNotifications();
    }
  };

  const deleteBarangayNotification = async (rawId) => {
    try {
      setNotifications(prev => prev.filter(n => n.raw_id !== rawId));
      const res = await fetch(getApiUrl(`/api/barangay/notifications/${rawId}`), { method: 'DELETE', headers });
      if (!res.ok) throw new Error(`Failed to delete (${res.status})`);
    } catch (e) {
      setError(e.message || 'Failed to delete barangay notification');
      fetchNotifications();
    }
  };

  const filtered = notifications.filter(n => {
    if (statusFilter === 'Unread' && n.is_read) return false;
    if (statusFilter === 'Read' && !n.is_read) return false;
    return true;
  });

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <div className="left"><h2>Barangay Notifications</h2></div>
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
          </div>
          <button className="btn icon-btn mark-all" onClick={markAllBarangayRead} disabled={loading || unreadCount === 0} title="Mark all as read">
            <FaCheckDouble className="icon" />
            <span className="btn-text">Mark All Read</span>
          </button>
          <button className="btn icon-btn refresh" onClick={fetchNotifications} disabled={loading}>Refresh</button>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}

      {loading ? (
        <div className="loading-block"><div className="spinner"/><p>Loading notifications…</p></div>
      ) : filtered.length === 0 ? (
        <div className="no-notifications">No notifications.</div>
      ) : (
        <ul className="notifications-list">
          {filtered.map(n => (
            <li key={n.id} className={`notification-item ${n.is_read ? 'read' : 'unread'}`}>
              <div className="notif-icon-container">{getNotificationIcon(n.type)}</div>
              <div className="notif-details">
                <div className="notif-header">
                  <p className="notif-title"><strong>{n.title}</strong></p>
                  <div className={`notif-badge ${getBadgeClass(n)}`} title={`Status: ${getBadgeLabel(n)}`} aria-hidden>
                    <span className="badge-icon small-icon">{getNotificationIcon(getBadgeClass(n))}</span>
                    <span className="badge-text">{getBadgeLabel(n)}</span>
                  </div>
                </div>

                <p className="notif-message" style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>{n.message}</p>
                <small className="notif-time">{new Date(n.created_at).toLocaleString()}</small>

                {n.actor ? (
                  <div style={{ marginTop: 6, color: '#444', fontStyle: 'italic' }}>By: {n.actor.firstname || ''} {n.actor.lastname || ''} ({n.actor.role || 'Resident'})</div>
                ) : null}
              </div>
              <div className="notification-actions">
                {!n.is_read && (
                  <button className="btn-action mark-read-btn" onClick={() => markBarangayRead(n.raw_id)} title="Mark as read">
                    <FaCheck />
                  </button>
                )}
                <button className="btn-action delete-notif-btn" onClick={() => deleteBarangayNotification(n.raw_id)} title="Delete notification">
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
