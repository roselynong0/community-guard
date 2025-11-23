/**
 * Generalized Notification Service
 * Handles real-time notifications with optimized polling and WebSocket support
 */

import { getApiUrl } from './apiConfig';

// Polling storage
let pollingIntervalRef = null;
let eventSourceRef = null;
let toastCallback = null;
let notificationCountCallback = null;
let lastSeenNotifications = {}; // Track last notification ID per role

/**
 * Register callback for toast notifications
 * @param {Function} callback - Function to display toast (message, type)
 */
export const registerToastCallback = (callback) => {
  toastCallback = callback;
};

/**
 * Register callback for notification count updates
 * @param {Function} callback - Function to update count (count)
 */
export const registerNotificationCountCallback = (callback) => {
  notificationCountCallback = callback;
};

/**
 * Show toast notification
 * @param {string} message - Toast message
 * @param {string} type - Toast type: 'info', 'success', 'warning', 'error', 'deleted', 'approved'
 */
const showToast = (message, type = 'info') => {
  if (toastCallback) {
    toastCallback(message, type);
  }
};

/**
 * Update notification count in layout
 * @param {number} count - New notification count
 */
const updateNotificationCount = (count) => {
  if (notificationCountCallback) {
    notificationCountCallback(count);
  }
};

/**
 * Start real-time notifications via Server-Sent Events (SSE) using fetch + ReadableStream
 * NOTE: This SSE implementation is deprecated. The system now uses polling for simplicity.
 * Kept for future implementation if backend SSE stream endpoint is available.
 * @param {string} token - Authentication token
 * @param {string} role - User role: 'Admin', 'Barangay Official', 'Responder', 'Resident'
 */
export const startNotificationSSE = (token, role) => {
  if (!token || eventSourceRef) return;

  console.log(`⚠️  SSE is disabled. Using polling instead for role: ${role || 'User'}`);
  return; // Disabled - use polling instead
};

/**
 * Stop SSE connection
 */
export const stopNotificationSSE = () => {
  if (eventSourceRef && eventSourceRef.isSSE && eventSourceRef.abortController) {
    eventSourceRef.abortController.abort();
    eventSourceRef = null;
    console.log('✅ SSE connection closed');
  } else if (eventSourceRef) {
    eventSourceRef = null;
  }
};

/**
 * FALLBACK: Start polling for real-time notifications (if SSE not available)
 * Optimized with:
 * - Request deduplication (don't send if request in flight)
 * - Adaptive polling (slower when idle, faster when active)
 * - Early exit on 401 to avoid cascading auth errors
 * @param {string} token - Authentication token
 * @param {string} role - User role: 'Admin', 'Barangay Official', 'Responder', or null for regular users
 * @param {number} pollInterval - Base polling interval in milliseconds (default: 10000ms)
 */
export const startNotificationPolling = (token, role, pollInterval = 10000) => {
  if (!token) return;

  const getEndpoint = () => {
    // Map roles to their specific endpoints - IMPORTANT: Only call the endpoint for the current layout
    const roleMap = {
      'Admin': '/api/admin/admin_notifications',           // Admin layout only
      'Barangay Official': '/api/barangay/notifications',  // Barangay layout only
      'Responder': '/api/responder/notifications',         // Responder layout only
      'Resident': '/api/notifications',                    // Regular resident layout
    };
    return roleMap[role] || '/api/notifications'; // Default to regular user endpoint
  };

  const endpoint = getEndpoint();
  let lastNotificationCount = 0;
  let requestInFlight = false; // Prevent request stacking
  let consecutiveIdleCycles = 0; // Track idle polling cycles
  let currentInterval = pollInterval; // Adaptive interval
  let lastErrorTime = null;

  const poll = async () => {
    // Skip if request already in flight (prevents stacking)
    if (requestInFlight) {
      console.debug('Notification poll already in flight, skipping');
      return;
    }

    // Skip if we just got an error (exponential backoff: 5s, 10s, 15s max)
    if (lastErrorTime) {
      const timeSinceError = Date.now() - lastErrorTime;
      const backoffTime = Math.min(currentInterval * 1.5, 15000);
      if (timeSinceError < backoffTime) {
        return;
      }
      lastErrorTime = null; // Reset error backoff
    }

    requestInFlight = true;

    try {
      const res = await fetch(getApiUrl(endpoint), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        // Add signal for potential future abort functionality
        signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined,
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Don't log auth errors on every poll - just once
          if (!lastErrorTime) {
            console.warn('Notification polling: Unauthorized - polling will stop', { endpoint, role });
          }
          lastErrorTime = Date.now();
          return;
        }
        throw new Error(`Notification fetch failed (${res.status})`);
      }

      const data = await res.json();
      
      // Determine which notification array to use based on role
      let notifications = [];
      if (role === 'Admin') {
        notifications = data.admin_notifications || [];
      } else if (role === 'Barangay Official') {
        notifications = data.notifications || [];
      } else if (role === 'Responder') {
        notifications = data.notifications || [];
      } else {
        // Treat any non-special role as Resident
        notifications = data.notifications || [];
      }

      // Get unread count
      const unreadCount = notifications.filter(n => !n.is_read).length;

      // Update count if changed
      if (unreadCount !== lastNotificationCount) {
        updateNotificationCount(unreadCount);
        lastNotificationCount = unreadCount;
        consecutiveIdleCycles = 0; // Reset idle counter when activity detected
      } else {
        consecutiveIdleCycles++;
      }

      // Process new notifications (show toast for unread ones)
      processNewNotifications(notifications, role);
    } catch (error) {
      console.error('Notification polling error:', error);
      lastErrorTime = Date.now();
    } finally {
      requestInFlight = false;
    }
  };

  // Initial poll
  poll();

  // Set up interval polling with adaptive timing
  const adaptiveInterval = setInterval(() => {
    // If no activity for 3+ cycles, increase interval (adaptive slowdown when idle)
    if (consecutiveIdleCycles >= 3) {
      currentInterval = Math.min(pollInterval * 2, 30000); // Max 30s when idle
    } else {
      currentInterval = pollInterval; // Reset to base interval when active
    }
    
    poll();
  }, pollInterval);

  return adaptiveInterval;
};

/**
 * Process notifications and show toast for new/unread ones sequentially
 * @param {Array} notifications - Array of notification objects
 * @param {string} role - User role
 */
const processNewNotifications = (notifications, role) => {
  // Get previously seen notification IDs from sessionStorage
  // Normalize storage key to use lowercase role name (fallback to 'resident')
  const storageKey = `lastSeenNotifications_${(role || 'Resident').toLowerCase()}`;
  const lastSeenStr = sessionStorage.getItem(storageKey) || '[]';
  let lastSeenIds = [];
  
  try {
    lastSeenIds = JSON.parse(lastSeenStr);
  } catch {
    lastSeenIds = [];
  }

  // Filter new notifications
  const newNotifications = notifications.filter(n => !lastSeenIds.includes(n.id));

  // Get unread notifications only
  const unreadNotifications = newNotifications.filter(n => !n.is_read);

  // Show toasts sequentially with 4 second delay between them
  const toastDelay = 4000; // 4 seconds delay between toasts
  unreadNotifications.forEach((notification, index) => {
    setTimeout(() => {
      const toastData = generateToastMessage(notification, role);
      if (toastData) {
        showToast(toastData.message, toastData.type);
      }
    }, index * toastDelay);
  });

  // Update seen IDs
  const allIds = notifications.map(n => n.id);
  sessionStorage.setItem(storageKey, JSON.stringify(allIds));
};

/**
 * Generate human-readable toast message based on notification type and role
 * @param {Object} notification - Notification object
 * @param {string} role - User role
 * @returns {Object} { message: string, type: string }
 */
const generateToastMessage = (notification, role) => {
  const msg = String(notification.message || '').toLowerCase();
  const title = String(notification.title || '').toLowerCase();
  const content = `${title} ${msg}`.trim().toLowerCase();

  // Regular User Messages
  if (!role) {
    if (content.includes('report deleted') || content.includes('post deleted')) {
      return { message: '🗑️ Your post had been deleted due to violations!', type: 'deleted' };
    }
    if (content.includes('approved') || content.includes('post accepted') || content.includes('post approved')) {
      return { message: '✅ Your post has been approved!', type: 'approved' };
    }
    if (content.includes('rejected') || content.includes('post rejected')) {
      return { message: '❌ Your post has been rejected!', type: 'error' };
    }
    if (content.includes('status updated') || content.includes('updated to')) {
      if (content.includes('resolved')) {
        return { message: '✅ Your report status has been updated to Resolved!', type: 'info' };
      }
      if (content.includes('ongoing') || content.includes('in-progress')) {
        return { message: '🔄 Your report status has been updated to Ongoing!', type: 'info' };
      }
      if (content.includes('pending')) {
        return { message: '⏳ Your report is Pending!', type: 'info' };
      }
      return { message: '📝 Your report status has been updated!', type: 'info' };
    }
    if (content.includes('pending') && !content.includes('status')) {
      return { message: '⏳ Your report is under review!', type: 'info' };
    }
    return null;
  }

  // Barangay Official Messages
  if (role === 'Barangay Official') {
    if (content.includes('new post') || content.includes('new report')) {
      const reportTitle = notification.title?.split(':')[0] || 'A report';
      return { message: `📍 ${reportTitle} has been posted by a resident!`, type: 'info' };
    }
    if (content.includes('status updated') || content.includes('updated to')) {
      if (content.includes('resolved')) {
        return { message: '✅ A responder has marked a report as Resolved!', type: 'info' };
      }
      if (content.includes('ongoing') || content.includes('in-progress')) {
        return { message: '🔄 A responder is now responding to a report!', type: 'info' };
      }
      return { message: '📝 A responder updated a report status!', type: 'info' };
    }
    return null;
  }
  // Responder Messages
  if (role === 'Responder') {
    if (content.includes('approved') || content.includes('post accepted')) {
      return { message: '✅ Your post has been approved by the Barangay Official!', type: 'approved' };
    }
    if (content.includes('status updated') || content.includes('updated to')) {
      if (content.includes('resolved')) {
        return { message: '✅ Report marked as Resolved!', type: 'info' };
      }
      if (content.includes('ongoing') || content.includes('in-progress')) {
        return { message: '🔄 Status updated to Ongoing!', type: 'info' };
      }
      return { message: '📝 Report status has been updated!', type: 'info' };
    }
    return null;
  }

  // Admin Messages
  if (role === 'Admin') {
    if (content.includes('new post') || content.includes('new report')) {
      return { message: '📍 New report has been submitted!', type: 'info' };
    }
    if (content.includes('status updated') || content.includes('updated to')) {
      return { message: '📝 Report status has been updated!', type: 'info' };
    }
    if (content.includes('report deleted') || content.includes('post deleted')) {
      return { message: '🗑️ A report has been deleted!', type: 'deleted' };
    }
    if (content.includes('user deleted') || content.includes('account deleted')) {
      return { message: '👤 A user account has been deleted!', type: 'deleted' };
    }
    if (content.includes('verified')) {
      return { message: '✔️ A user has been verified!', type: 'info' };
    }
    return null;
  }

  return null;
};

/**
 * Stop notification polling
 * @param {number} intervalId - ID returned from startNotificationPolling
 */
export const stopNotificationPolling = (intervalId) => {
  if (intervalId) {
    clearInterval(intervalId);
  }
};

/**
 * Mark a notification as read and update count
 * @param {string} token - Authentication token
 * @param {number|string} notificationId - Notification ID
 * @param {string} role - User role
 * @returns {Promise<boolean>} Success status
 */
export const markNotificationAsRead = async (token, notificationId, role) => {
  if (!token) return false;

  try {
    const res = await fetch(getApiUrl('/api/notifications/mark-read'), {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notification_id: notificationId }),
    });

    if (!res.ok) {
      console.error(`Failed to mark notification as read (${res.status})`);
      return false;
    }

    // Immediately trigger a count update by fetching fresh count
    const newCount = await fetchNotificationCount(token, role);
    updateNotificationCount(newCount);

    return true;
  } catch (error) {
    console.error('Mark as read error:', error);
    return false;
  }
};

/**
 * Fetch notification count without polling
 * @param {string} token - Authentication token
 * @param {string} role - User role
 * @returns {Promise<number>} Unread notification count
 */
export const fetchNotificationCount = async (token, role) => {
  if (!token) return 0;

  const roleMap = {
    'Admin': '/api/admin/admin_notifications',
    'Barangay Official': '/api/barangay/notifications',
    'Responder': '/api/responder/notifications',
  };
  
  const endpoint = roleMap[role] || '/api/notifications';

  try {
    const res = await fetch(getApiUrl(endpoint), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) return 0;

    const data = await res.json();
    let notifications = [];
    
    if (role === 'Admin') {
      notifications = data.admin_notifications || [];
    } else {
      notifications = data.notifications || [];
    }

    return notifications.filter(n => !n.is_read).length;
  } catch (error) {
    console.error('Fetch notification count error:', error);
    return 0;
  }
};
