// API Configuration
// This allows switching between development and production environments

// Dynamic getter for BASE_URL (called every time it's accessed at RUNTIME)
const getBaseUrl = () => {
  // ALWAYS check window location first (runtime detection)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const origin = window.location.origin;
    
    // Production: If on Vercel or any production domain, use the same origin
    // DO NOT use environment variables in production
    if (hostname.includes('vercel.app') || hostname.includes('community-guard.vercel.app')) {
      console.log('✅ Detected Vercel deployment, using:', origin);
      return origin;
    }
    
    // Development: If on localhost, use local backend
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Only on localhost do we check for environment variable
      const localApi = import.meta.env.VITE_API_URL;
      const apiUrl = localApi || 'http://localhost:5000';
      console.log('✅ Detected localhost, using:', apiUrl);
      return apiUrl;
    }
    
    // Any other domain: use same origin (production fallback)
    console.log('✅ Using same origin for domain:', origin);
    return origin;
  }
  
  // Server-side rendering fallback (should not happen in browser)
  console.warn('⚠️ Window not available, using empty string');
  return '';
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
