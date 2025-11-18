/**
 * Utility for tracking notifications that have been marked as read
 * Prevents them from showing again in polling
 */

const READ_NOTIFICATIONS_KEY = 'readNotifications';

/**
 * Mark a notification as read (don't show again in polling)
 * @param {number} notificationId - The notification ID to mark as read
 */
export const markNotificationAsRead = (notificationId) => {
  try {
    const stored = localStorage.getItem(READ_NOTIFICATIONS_KEY) || '[]';
    const readIds = JSON.parse(stored);
    if (!readIds.includes(notificationId)) {
      readIds.push(notificationId);
      localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(readIds));
      console.log('📖 Notification marked as read:', notificationId);
    }
  } catch (e) {
    console.warn('Failed to mark notification as read:', e);
  }
};

/**
 * Get all read notification IDs
 * @returns {Array} Array of read notification IDs
 */
export const getReadNotificationIds = () => {
  try {
    const stored = localStorage.getItem(READ_NOTIFICATIONS_KEY) || '[]';
    return JSON.parse(stored);
  } catch (e) {
    console.warn('Failed to load read notification IDs:', e);
    return [];
  }
};

/**
 * Check if a notification has been read
 * @param {number} notificationId - The notification ID to check
 * @returns {boolean} True if the notification has been read
 */
export const isNotificationRead = (notificationId) => {
  return getReadNotificationIds().includes(notificationId);
};

/**
 * Clear all read notifications
 */
export const clearReadNotifications = () => {
  try {
    localStorage.removeItem(READ_NOTIFICATIONS_KEY);
    console.log('🧹 All read notifications cleared');
  } catch (e) {
    console.warn('Failed to clear read notifications:', e);
  }
};
