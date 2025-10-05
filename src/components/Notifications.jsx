import React, { useState } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaThumbsUp, FaRegBell, FaTrashAlt } from 'react-icons/fa'; 
import './Notifications.css';
import './Notification.css';

const mockNotifications = [
  {
    id: 101,
    type: 'Complete',
    reportId: 1,
    title: 'Pickpocket Incident',
    status: 'Resolved',
    message: 'Your report "Pickpocket Incident" has been RESOLVED by the authorities.',
    icon: <FaCheckCircle className="icon-resolved" />,
    time: new Date(Date.now() - 60000 * 30).toISOString(), 
    isRead: false,
  },
  {
    id: 102,
    type: 'Status Update',
    reportId: 2,
    title: 'Fallen Electric Post',
    status: 'Ongoing',
    message: 'The status of your report "Fallen Electric Post" has been updated to ONGOING.',
    icon: <FaExclamationCircle className="icon-ongoing" />,
    time: new Date(Date.now() - 60000 * 120).toISOString(), 
    isRead: false,
  },
  {
    id: 103,
    type: 'Likes',
    reportId: 1,
    title: 'Pickpocket Incident',
    status: 'Resolved',
    message: 'Your report received 25 Likes from other residents.',
    icon: <FaThumbsUp className="icon-upvote" />,
    time: new Date(Date.now() - 60000 * 180).toISOString(), 
    isRead: true,
  },
  {
    id: 104,
    type: 'Status Update',
    reportId: 3,
    title: 'Garbage Overflowing',
    status: 'Pending',
    message: 'Your report "Garbage Overflowing" has been received and is currently PENDING.',
    icon: <FaRegBell className="icon-pending" />,
    time: new Date(Date.now() - 60000 * 300).toISOString(), 
    isRead: true,
  },
];

const formatTime = (isoString) => {
  const now = new Date();
  const date = new Date(isoString);
  const diffInMinutes = Math.floor((now - date) / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);

  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
  if (diffInHours < 24) return `${diffInHours} hours ago`;
  return date.toLocaleDateString();
};

function Notifications() {
  const [notifications, setNotifications] = useState(mockNotifications);
  const [activeFilter, setActiveFilter] = useState('All');

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
  };

  const markAsRead = (id) => {
    setNotifications(notifications.map(n => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const handleDeleteNotification = (e, id) => {
    e.stopPropagation(); 
    
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Reports' && (n.type === 'Status Update' || n.type === 'Complete')) return true; 
    if (activeFilter === 'Community' && n.type === 'Likes') return true;
    return false;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleNotificationClick = (id, reportId) => {
    markAsRead(id);
    console.log(`Navigating to report ${reportId}`);
  };

  const filters = ['All', 'Reports', 'Community'];

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <h2>Notifications ({unreadCount})</h2>
        {unreadCount > 0 && (
          <button className="mark-read-btn" onClick={markAllAsRead}>
            Mark All as Read
          </button>
        )}
      </div>
      
      <div className="notifications-filters">
        {filters.map(filter => (
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
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notif, index) => ( // Added 'index' for stagger
            <div
              key={notif.id}
              className={`notification-item ${notif.isRead ? 'read' : 'unread'}`}
              onClick={() => handleNotificationClick(notif.id, notif.reportId)}
              style={{ animationDelay: `${index * 0.05}s` }} // Staggered delay
            >
              <div className="notif-icon-container">
                {notif.icon}
              </div>
              <div className="notif-details">
                <p className="notif-message" dangerouslySetInnerHTML={{ __html: notif.message }} />
                <p className="notif-time">{formatTime(notif.time)}</p>
              </div>
                
              <div className="notification-actions">
                <button 
                    className="delete-notif-btn" 
                    onClick={(e) => handleDeleteNotification(e, notif.id)}
                    title="Delete Notification"
                >
                    <FaTrashAlt />
                </button>
              </div>

              {!notif.isRead && <span className="unread-dot" />}
            </div>
          ))
        ) : (
          <p className="no-notifications">You're all caught up! No notifications in this category.</p>
        )}
      </div>
    </div>
  );
}

// Dynamic top-right notifications
export function notify(message, type = "success", duration = 4000) {
  const notif = document.createElement("div");
  notif.className = `notif notif-${type}`;
  notif.textContent = message;

  document.body.appendChild(notif);

  setTimeout(() => {
    notif.style.opacity = "0";
    notif.style.transform = "translateX(50px)";
    setTimeout(() => document.body.removeChild(notif), 300);
  }, duration);
}


export default Notifications;