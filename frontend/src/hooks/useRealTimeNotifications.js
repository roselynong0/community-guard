/**
 * useRealTimeNotifications Hook
 * 
 * Provides real-time notification toasts for:
 * 1. New reports posted in user's barangay
 * 2. Responder assignments
 * 3. Missed reports between sessions
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { API_CONFIG, getApiUrl } from '../utils/apiConfig';

/**
 * Hook to poll for new notifications and show toasts
 * @param {Object} options
 * @param {Object} options.session - Current user session
 * @param {string} options.token - Auth token
 * @param {Function} options.showToast - Toast display function (from Toast component ref)
 * @param {number} options.pollInterval - How often to check for new notifications (ms), default 30000 (30s)
 */
export function useRealTimeNotifications({ session, token, showToast, pollInterval = 30000 }) {
  const [lastChecked, setLastChecked] = useState(null);
  const [missedReportsCount, setMissedReportsCount] = useState(0);
  const [hasFetchedMissed, setHasFetchedMissed] = useState(false);
  const pollIntervalRef = useRef(null);
  const isInitializedRef = useRef(false);

  // Get user's barangay from session
  const userBarangay = session?.user?.address_barangay || null;
  const userId = session?.user?.id || null;

  /**
   * Fetch missed reports between last session and current session
   * Uses the /reports/missed_summary endpoint
   */
  const fetchMissedReports = useCallback(async () => {
    if (!token || hasFetchedMissed) return;

    try {
      // Use the dedicated missed_summary endpoint
      const res = await fetch(getApiUrl('/api/reports/missed_summary'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        setHasFetchedMissed(true);
        return;
      }
      
      const data = await res.json();
      const total = data.total || 0;
      const barangayCounts = data.barangays || {};
      
      // Get reports in user's barangay specifically
      const missedInBarangay = userBarangay ? (barangayCounts[userBarangay] || 0) : total;
      
      if (missedInBarangay > 0) {
        setMissedReportsCount(missedInBarangay);
        // Show toast after 2-3 seconds delay
        setTimeout(() => {
          if (showToast) {
            showToast(
              `📢 You missed ${missedInBarangay} report${missedInBarangay > 1 ? 's' : ''} in ${userBarangay || 'your area'} while you were away. Check it out!`,
              'info'
            );
          }
        }, 2500);
      }
      
      setHasFetchedMissed(true);
    } catch (err) {
      console.error('❌ Error fetching missed reports:', err);
      setHasFetchedMissed(true);
    }
  }, [token, userBarangay, showToast, hasFetchedMissed]);

  /**
   * Poll for new notifications (unread)
   */
  const pollNotifications = useCallback(async () => {
    if (!token || !userId) return;

    try {
      const res = await fetch(getApiUrl('/api/notifications?unread=true&limit=5'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) return;
      
      const data = await res.json();
      const notifications = data.notifications || data || [];
      
      // Filter notifications created after lastChecked
      const newNotifications = lastChecked 
        ? notifications.filter(n => new Date(n.created_at) > new Date(lastChecked))
        : [];
      
      // Show toast for new notifications
      newNotifications.forEach(notif => {
        if (showToast) {
          // Determine toast type based on notification type
          let toastType = 'info';
          if (notif.type?.includes('emergency') || notif.type?.includes('urgent')) {
            toastType = 'emergency';
          } else if (notif.type?.includes('success') || notif.type?.includes('approved')) {
            toastType = 'success';
          } else if (notif.type?.includes('alert') || notif.type?.includes('Report Alert')) {
            toastType = 'warning';
          }
          
          showToast(notif.message || notif.title, toastType);
        }
      });
      
      // Update lastChecked
      if (notifications.length > 0) {
        const latestTime = notifications.reduce((max, n) => {
          const t = new Date(n.created_at);
          return t > max ? t : max;
        }, new Date(0));
        setLastChecked(latestTime.toISOString());
      }
    } catch (err) {
      console.error('❌ Error polling notifications:', err);
    }
  }, [token, userId, lastChecked, showToast]);

  // Initialize - fetch missed reports on mount
  useEffect(() => {
    if (session && token && !isInitializedRef.current) {
      isInitializedRef.current = true;
      
      // Set initial lastChecked to now to avoid showing old notifications
      setLastChecked(new Date().toISOString());
      
      // Fetch missed reports after a short delay
      setTimeout(() => {
        fetchMissedReports();
      }, 1500);
    }
  }, [session, token, fetchMissedReports]);

  // Start polling for new notifications
  useEffect(() => {
    if (!session || !token || !isInitializedRef.current) return;

    // Start polling
    pollIntervalRef.current = setInterval(pollNotifications, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [session, token, pollInterval, pollNotifications]);

  return {
    missedReportsCount,
    lastChecked,
    refetch: pollNotifications
  };
}

/**
 * Hook specifically for checking responder assignments
 * @param {Object} options
 * @param {Object} options.session - Current user session
 * @param {string} options.token - Auth token
 * @param {Function} options.showToast - Toast display function
 */
export function useResponderAssignmentNotifications({ session, token, showToast }) {
  const lastAssignmentCheckRef = useRef(null);

  const userRole = session?.user?.role;
  const userId = session?.user?.id;

  const checkAssignments = useCallback(async () => {
    if (!token || !userId || userRole !== 'Responder') return;

    try {
      // Check for new assignment notifications
      const res = await fetch(getApiUrl('/api/notifications?unread=true&type=responder_assignment'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) return;
      
      const data = await res.json();
      const assignments = data.notifications || data || [];
      
      // Filter new assignments since last check
      const newAssignments = lastAssignmentCheckRef.current
        ? assignments.filter(a => new Date(a.created_at) > new Date(lastAssignmentCheckRef.current))
        : assignments.slice(0, 1); // Show at most 1 on first load
      
      newAssignments.forEach(assignment => {
        if (showToast) {
          showToast(
            `🚨 New Assignment: ${assignment.title || 'A report has been assigned to you'}`,
            'emergency'
          );
        }
      });
      
      lastAssignmentCheckRef.current = new Date().toISOString();
    } catch (err) {
      console.error('❌ Error checking responder assignments:', err);
    }
  }, [token, userId, userRole, showToast]);

  useEffect(() => {
    if (userRole === 'Responder' && token) {
      // Initial check
      checkAssignments();
      
      // Poll every 15 seconds for responders
      const interval = setInterval(checkAssignments, 15000);
      
      return () => clearInterval(interval);
    }
  }, [userRole, token, checkAssignments]);

  return { checkAssignments };
}

export default useRealTimeNotifications;