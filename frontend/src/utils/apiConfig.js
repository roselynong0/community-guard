// API Configuration
// This allows switching between development and production environments

// Auto-detect if we're on Vercel or localhost
const getBaseUrl = () => {
  // If running on Vercel (production/preview), use the same domain
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return window.location.origin; // Uses same domain as frontend
  }
  // For local development, use localhost backend
  return import.meta.env.VITE_API_URL || 'http://localhost:5000';
};

export const API_CONFIG = {
  // Use environment variable if available, fallback to localhost for development
  BASE_URL: getBaseUrl(),
  
  // API endpoints
  endpoints: {
    // Auth endpoints
    login: '/api/login',
    register: '/api/register',
    logout: '/api/logout',
    
    // Session endpoints
    sessions: '/api/sessions',
    
    // Profile endpoints
    profile: '/api/profile',
    
    // Reports endpoints
    reports: '/api/reports',
    stats: '/api/stats',
    
    // Notifications endpoints
    notifications: '/api/notifications',
    adminNotifications: '/api/admin/notifications',
    
    // User management endpoints
    users: '/api/users',
    verification: '/api/users/verification',
    
    // Email endpoints
    email: '/api/email',
    
    // Uploads
    uploads: '/uploads',
  }
};

// Helper function to build full URL
export const getApiUrl = (endpoint) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Export for backward compatibility
export const API_URL = API_CONFIG.BASE_URL;
