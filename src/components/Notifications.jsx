import React, { useState, useEffect } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaThumbsUp, FaRegBell, FaTrashAlt } from 'react-icons/fa';
import axios from 'axios';
import './Notifications.css';
import './Notification.css';

const API_URL = "http://localhost:5000/api";

function Notifications({ token }) {
  const [activeFilter, setActiveFilter] = useState('All');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // ---------------- FETCH NOTIFICATIONS ----------------
  useEffect(() => {
    if (!token) return;

    const fetchNotifications = async () => {
      try {
        const res = await axios.get(`${API_URL}/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setNotifications(res.data.notifications || []);
      } catch (err) {
        console.error("Error fetching notifications:", err);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [token]);

  // ---------------- MARK AS READ ----------------
  const markAsRead = async (id) => {
    if (!token) return;
    try {
      await axios.post(`${API_URL}/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
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
    if (!token) return;
    try {
      await axios.delete(`${API_URL}/notifications/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  // ---------------- MARK ALL AS READ ----------------
  const markAllAsRead = async () => {
    if (!token) return;
    try {
      await axios.post(`${API_URL}/notifications/read_all`, {}, {
        headers: { Authorization: `Bearer ${token}` },
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

  const filteredNotifications = notifications.filter(n =>
    activeFilter === 'All' || n.type === activeFilter
  );

  // Check if all notifications in current filter are read
  const allRead = filteredNotifications.length > 0 && filteredNotifications.every(n => n.read);

  if (loading) return <p className="loading-text">Loading notifications...</p>;

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <h2>Notifications</h2>
        <button
          className={`mark-read-btn ${allRead ? 'disabled' : ''}`}
          onClick={markAllAsRead}
          disabled={allRead} // disable button if all read
        >
          Mark all as read
        </button>
      </div>

      <div className="notifications-filters">
        {['All', 'Complete', 'Alert', 'Like'].map(filter => (
          <button
            key={filter}
            className={`filter-btn ${activeFilter === filter ? 'active' : ''}`}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* ---------------- NO NOTIFICATIONS MESSAGE ---------------- */}
      {notifications.length === 0 ? (
        <p className="no-notifications">No notifications yet.</p>
      ) : filteredNotifications.length === 0 ? (
        <p className="no-notifications">No notifications for this filter.</p>
      ) : (
        filteredNotifications.map(notif => (
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
  );
}

export default Notifications;