// ✅ Your existing code unchanged above...
// API Configuration
// This allows switching between development and production environments

const getBaseUrl = () => {
  // Allow explicit override from Vite env (deployments should set this)
  try {
    const envUrl = import.meta && import.meta.env && import.meta.env.VITE_API_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.length > 0) {
      console.log('✅ Using VITE_API_URL from env:', envUrl);
      return envUrl.replace(/\/+$/, '');
    }
  } catch (e) {
    // ignore in non-module contexts
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const origin = window.location.origin;
    
    // Check for production Vercel deployment - default to Render backend
    // (still allow explicit VITE_API_URL override above)
    if (hostname.includes('vercel.app') || hostname.includes('community-guard.vercel.app')) {
      const renderApi = 'https://community-guard-1.onrender.com';
      console.log('✅ Detected Vercel deployment, using Render backend:', renderApi);
      return renderApi;
    }

    // Local development - use local backend
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const localApi = 'http://localhost:5000';
      console.log('✅ Detected localhost, using local backend:', localApi);
      return localApi;
    }

    console.log('✅ Using same origin for domain:', origin);
    return origin;
  }

  console.warn('⚠️ Window not available, using empty string');
  return '';
};

export const API_CONFIG = {
  get BASE_URL() {
    const url = getBaseUrl();
    if (typeof window !== 'undefined' && !window.__API_LOGGED__) {
      console.log('🌐 API Configuration:', {
        hostname: window.location.hostname,
        apiBaseUrl: url,
        isVercel: window.location.hostname.includes('vercel.app'),
        isLocalhost:
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1',
      });
      window.__API_LOGGED__ = true;
    }
    return url;
  },

  endpoints: {
    // Maps endpoints
    hotspots: '/api/hotspots',  // Now available via maps_bp
    safezones: '/api/safezones',
    map_reports: '/api/map_reports',
    hotspotsRefresh: '/api/hotspots/refresh',
    hotspotsAutoCheck: '/api/hotspots/auto-check',
    hotspotsCheckAll: '/api/hotspots/check-all-barangays',
    // Authentication
    login: '/api/login',
    register: '/api/register',
    logout: '/api/logout',
    sessions: '/api/sessions',
    profile: '/api/profile',
    reports: '/api/reports',
    stats: '/api/stats',
    notifications: '/api/notifications',
    adminNotifications: '/api/admin/notifications',
    users: '/api/users',
    verification: '/api/users/verification',
    email: '/api/email',
    uploads: '/uploads',
    health: '/api/health',
  }
};

export const getApiUrl = (endpoint) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Backward compatibility
export const API_URL = API_CONFIG.BASE_URL;

export const healthCheck = async () => {
  const res = await fetch(getApiUrl(API_CONFIG.endpoints.health));
  return res.json();
};