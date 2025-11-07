// API Configuration
// This allows switching between development and production environments

// Dynamic getter for BASE_URL (called every time it's accessed)
const getBaseUrl = () => {
  // First, check if VITE_API_URL is explicitly set (for local development)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Check if we're in browser
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // If on Vercel, use the same origin (works for all Vercel URLs)
    if (hostname.includes('vercel.app')) {
      return window.location.origin;
    }
    
    // If on localhost, use local backend
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
  }
  
  // Fallback
  return 'http://localhost:5000';
};

export const API_CONFIG = {
  // Make BASE_URL a getter so it's evaluated at runtime, not build time
  get BASE_URL() {
    return getBaseUrl();
  },
  
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
