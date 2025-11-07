// API Configuration
// This allows switching between development and production environments

// Dynamic getter for BASE_URL (called every time it's accessed)
const getBaseUrl = () => {
  // Check if we're in browser (runtime detection)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // If on Vercel or any vercel.app domain, use the same origin
    if (hostname.includes('vercel.app') || hostname.includes('community-guard')) {
      console.log('Detected Vercel deployment, using:', window.location.origin);
      return window.location.origin;
    }
    
    // If on localhost, check for VITE_API_URL first, then use local backend
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      console.log('Detected localhost, using:', apiUrl);
      return apiUrl;
    }
  }
  
  // Fallback to environment variable or localhost
  const fallback = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  console.log('Using fallback:', fallback);
  return fallback;
};

export const API_CONFIG = {
  // Make BASE_URL a getter so it's evaluated at runtime, not build time
  get BASE_URL() {
    const url = getBaseUrl();
    // Log for debugging (remove in production if needed)
    if (typeof window !== 'undefined' && !window.__API_LOGGED__) {
      console.log('🌐 API Configuration:', {
        hostname: window.location.hostname,
        apiBaseUrl: url,
        isVercel: window.location.hostname.includes('vercel.app'),
        isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      });
      window.__API_LOGGED__ = true;
    }
    return url;
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
