/**
 * Utility functions for managing read notification state in localStorage
 */

const STORAGE_KEY = 'readNewReportNotifications';

/**
 * Mark a report as read
 * @param {string} reportId - The report ID to mark as read
 */
export const markReportAsRead = (reportId) => {
  try {
    let readReportIds = new Set();
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      readReportIds = new Set(JSON.parse(stored));
    }
    readReportIds.add(reportId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(readReportIds)));
    console.log('📖 Report marked as read:', reportId);
  } catch (e) {
    console.warn('Failed to mark report as read:', e);
  }
};

/**
 * Get all read report IDs
 * @returns {Set} Set of read report IDs
 */
export const getReadReportIds = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch (e) {
    console.warn('Failed to load read report IDs:', e);
  }
  return new Set();
};

/**
 * Check if a report has been read
 * @param {string} reportId - The report ID to check
 * @returns {boolean} True if the report has been read
 */
export const isReportRead = (reportId) => {
  return getReadReportIds().has(reportId);
};

/**
 * Clear all read notifications (for testing or reset)
 */
export const clearReadNotifications = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('🧹 All read notifications cleared');
  } catch (e) {
    console.warn('Failed to clear read notifications:', e);
  }
};
