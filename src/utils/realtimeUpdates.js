// Real-time Updates Utility for Community Guard
// This utility provides real-time updates for both user and admin components

import { useEffect } from 'react';

export const useRealtimeReports = (token, fetchReports, interval = 5000) => {
  useEffect(() => {
    if (!token || !fetchReports) return;

    // Set up polling interval for real-time updates
    const pollInterval = setInterval(() => {
      console.log("🔄 Polling for report updates...");
      fetchReports();
    }, interval);

    // Cleanup interval on unmount
    return () => {
      clearInterval(pollInterval);
      console.log("🛑 Stopped polling for reports");
    };
  }, [token, fetchReports, interval]);
};

// Image error handling utilities
export const handleImageError = (e, imgUrl) => {
  console.error(`❌ Failed to load image: ${imgUrl}`);
  e.target.style.display = 'none'; // Hide broken images
};

export const handleImageLoad = (imgUrl) => {
  console.log(`✅ Image loaded: ${imgUrl}`);
};

// Update reports list with real-time changes
export const updateReportInList = (prevReports, updatedReport, action = 'update') => {
  switch (action) {
    case 'add':
      return [updatedReport, ...prevReports];
    case 'update':
      return prevReports.map(report => 
        report.id === updatedReport.id 
          ? { ...report, ...updatedReport }
          : report
      );
    case 'delete':
      return prevReports.filter(report => report.id !== updatedReport.id);
    default:
      return prevReports;
  }
};