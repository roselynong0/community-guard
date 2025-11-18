import { useEffect, useRef } from 'react';
import { getApiUrl } from '../utils/apiConfig';

/**
 * Custom hook for polling notifications and displaying toast alerts
 * @param {React.RefObject} toastRef - Reference to Toast component
 * @param {Object} session - Current user session
 * @param {number} pollingInterval - Polling interval in milliseconds (default: 5000)
 */
export const useNotificationPolling = (toastRef, session, pollingInterval = 5000) => {
  const lastNotificationIdRef = useRef(new Set());
  const pollingIntervalRef = useRef(null);

  useEffect(() => {
    if (!session || !session.token || !toastRef?.current) {
      return;
    }

    const pollNotifications = async () => {
      try {
        const response = await fetch(getApiUrl('/api/notifications'), {
          headers: { Authorization: `Bearer ${session.token}` },
        });

        if (!response.ok) return;

        const data = await response.json();
        if (data.status === 'success' && data.notifications) {
          const notifications = data.notifications;

          // Filter for unread, recent notifications
          notifications.forEach((notif) => {
            const notifId = notif.id;
            
            // Only show new notifications that we haven't shown before
            if (!lastNotificationIdRef.current.has(notifId)) {
              lastNotificationIdRef.current.add(notifId);

              // Determine notification type based on content or custom field
              let toastType = notif.notification_type || 'info';
              let message = notif.message || 'New notification';

              // Custom handling for specific notification types
              if (notif.type === 'report_approval') {
                toastType = 'success';
                message = `Your report "${notif.title || 'Report'}" has been approved!`;
              } else if (notif.type === 'new_report_in_barangay') {
                toastType = 'info';
                message = `New report in your barangay: "${notif.title || 'Report'}"`;
              } else if (notif.type === 'report_assigned') {
                toastType = 'info';
                message = `New report assigned to you: "${notif.title || 'Report'}"`;
              } else if (notif.type === 'verification_update') {
                toastType = 'warning';
                message = 'Please update your information to get verified.';
              }

              // Show toast if message is defined
              if (message) {
                toastRef.current.show(message, toastType);
              }
            }
          });
        }
      } catch (error) {
        console.error('Error polling notifications:', error);
      }
    };

    // Initial poll
    pollNotifications();

    // Set up polling interval
    pollingIntervalRef.current = setInterval(pollNotifications, pollingInterval);

    // Cleanup
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [session, toastRef, pollingInterval]);
};
