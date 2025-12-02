// utils/session.js
import { API_CONFIG, getApiUrl } from './apiConfig';

/**
 * Handle session expiration - shows notification and logs user out
 * @param {Function} setSession - State setter for session
 * @param {Function} setNotification - State setter for notification
 * @param {Function} navigate - React Router navigate function
 * @param {string} role - User role for redirect (admin, barangay, responder, or empty for resident)
 * @param {string} message - Custom message (optional)
 */
export function handleSessionExpired(setSession, setNotification, navigate, role = '', message = null) {
  const defaultMessage = 'Your session has expired. Please log in again to continue using Community Guard.';
  
  // Clear local storage
  localStorage.removeItem("token");
  localStorage.removeItem("session");
  sessionStorage.clear();
  
  // Set session to null
  if (setSession) {
    setSession(null);
  }
  
  // Show notification
  if (setNotification) {
    setNotification({
      message: message || defaultMessage,
      type: 'error'
    });
  }
  
  // Navigate to appropriate login page
  if (navigate) {
    const loginPath = role ? `/login?role=${role}` : '/login';
    navigate(loginPath);
  }
  
  console.log('🔐 Session expired - user logged out');
}

/**
 * Check if an API response indicates session expiration (401)
 * @param {Response} response - Fetch response object
 * @returns {boolean} - True if session expired
 */
export function isSessionExpired(response) {
  return response && (response.status === 401 || response.status === 403);
}

/**
 * Wrapper for API calls that handles session expiration automatically
 * @param {Function} apiCall - Async function that makes the API call
 * @param {Object} handlers - Object with setSession, setNotification, navigate, role
 * @returns {Promise} - Result of API call or null if session expired
 */
export async function withSessionCheck(apiCall, handlers) {
  try {
    const response = await apiCall();
    
    if (response && isSessionExpired(response)) {
      const data = await response.json().catch(() => ({}));
      const message = data.code === 'SESSION_EXPIRED' 
        ? 'Your session has expired. Please log in again.'
        : 'Session invalid. Please log in again.';
      
      handleSessionExpired(
        handlers.setSession,
        handlers.setNotification,
        handlers.navigate,
        handlers.role,
        message
      );
      return null;
    }
    
    return response;
  } catch (err) {
    console.error('API call failed:', err);
    throw err;
  }
}

export async function fetchSession() {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      console.log("🔐 No token found in localStorage");
      return null;
    }

    console.log("🔐 Token found, validating session...");

    // Check cached session first for instant access
    const storedSession = localStorage.getItem("session");
    let cachedSession = null;
    
    if (storedSession) {
      try {
        cachedSession = JSON.parse(storedSession);
        const now = new Date();
        const expiresAt = new Date(cachedSession.expires_at);
        // If the session has an explicit ended_at it should be considered ended
        const endedAt = cachedSession.ended_at ? new Date(cachedSession.ended_at) : null;

        // If cached session is expired or ended, clear it
        if (expiresAt < now || (endedAt && endedAt < now)) {
          console.log("⏰ Cached session expired");
          localStorage.removeItem("token");
          localStorage.removeItem("session");
          return null;
        }
      } catch (parseErr) {
        console.warn("❌ Failed to parse stored session:", parseErr);
        cachedSession = null;
      }
    }

    // PRIMARY: Try to fetch from backend API (fresh, authoritative source)
    const tryFetchSessions = async (url) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return res;
      } catch (e) {
        clearTimeout(timeoutId);
        throw e;
      }
    };

    try {
      const endpoint = API_CONFIG.endpoints.sessions;
      let res;

      try {
        res = await tryFetchSessions(getApiUrl(endpoint));
      } catch (firstErr) {
        // First attempt failed — try fallbacks before giving up.
        console.warn('⚠️ Primary sessions fetch failed, attempting fallbacks:', firstErr && firstErr.message);

        const fallbacks = [];
        try {
          const envUrl = import.meta && import.meta.env && import.meta.env.VITE_API_URL;
          if (envUrl && envUrl.replace) fallbacks.push(`${envUrl.replace(/\/+$/, '')}${endpoint}`);
        } catch {
          // Ignore error if env URL is not available
        }
        // Try same-origin API path if different
        try {
          if (typeof window !== 'undefined') {
            fallbacks.push(`${window.location.origin.replace(/\/+$/, '')}${endpoint}`);
          }
        } catch {
          // Ignore error if window is not available
        }

        // Last-resort known backend
        fallbacks.push(`https://community-guard-1.onrender.com${endpoint}`);

        let got = null;
        for (const url of fallbacks) {
          try {
            res = await tryFetchSessions(url);
            got = { res, url };
            console.log('🔁 Fallback sessions fetch succeeded for', url);
            break;
          } catch (e) {
            console.warn('fallback fetch failed for', url, e && e.message);
          }
        }

        if (!got) throw firstErr; // rethrow original
      }

      if (res && res.ok) {
        const data = await res.json();

        if (data.status === "success" && data.sessions && data.sessions.length > 0) {
          // Find the session that matches the stored token
          const currentSession = data.sessions.find(s => s.token === token);

          if (currentSession) {
            // Check expiry on frontend
            const now = new Date();
            if (new Date(currentSession.expires_at) < now) {
              console.log("⏰ Backend session expired");
              localStorage.removeItem("token");
              localStorage.removeItem("session");
              return null;
            }

            // Update localStorage with fresh session data (include ended_at if present)
            // If role or user details are missing, fetch profile to confirm
            try {
              if (!currentSession.user || !currentSession.user.role) {
                const profileRes = await fetch(getApiUrl(API_CONFIG.endpoints.profile), {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (profileRes && profileRes.ok) {
                  const profileData = await profileRes.json();
                  // profile endpoint may return { status, user } or full user object
                  const userObj = profileData && profileData.user ? profileData.user : profileData;
                  if (userObj) {
                    currentSession.user = Object.assign({}, currentSession.user || {}, userObj);
                  }
                }
              }
            } catch (e) {
              console.warn('⚠️ Profile fetch failed while verifying session user:', e && e.message);
            }

            localStorage.setItem("session", JSON.stringify(currentSession));
            console.log("✅ Session validated from backend");
            return currentSession;
          } else {
            console.log("⚠️ Token not found in backend sessions list");
            // Don't immediately clear - might be a sync issue
            if (cachedSession) {
              console.log("💾 Using cached session while backend syncs");
              return cachedSession;
            }
          }
        }
      } else if (res && res.status === 401) {
        // Token is definitely invalid on backend
        console.log("❌ Token rejected by backend (401) - clearing session");
        localStorage.removeItem("token");
        localStorage.removeItem("session");
        return null;
      } else if (res && res.status === 404) {
        // Backend route not found - keep cached session to avoid clearing on deployment issues
        console.warn("⚠️ Backend /api/sessions returned 404 - using cached session");
        if (cachedSession) {
          return cachedSession;
        }
      } else {
        console.warn(`⚠️ Backend returned status ${res ? res.status : 'no response'} - using cached session if available`);
        if (cachedSession) {
          return cachedSession;
        }
      }
    } catch (apiErr) {
      if (apiErr && apiErr.name === 'AbortError') {
        console.warn("⏱️ API timeout - backend may be starting up, using cached session");
      } else {
        console.warn("⚠️ Failed to fetch sessions after fallbacks:", apiErr && apiErr.message);
      }
      // On network errors, use cached session to keep user logged in
      if (cachedSession) {
        console.log("💾 Using cached session (backend unavailable)");
        return cachedSession;
      }
    }

    console.log("❌ No valid session found (backend and cache unavailable)");
    return null;
  } catch (err) {
    console.error("❌ Failed to fetch session:", err);
    return null;
  }
}

export async function logout(setSession) {
  const token = localStorage.getItem("token");
  if (!token) {
    setSession(null);
    return;
  }

  try {
    await fetch(getApiUrl(API_CONFIG.endpoints.logout), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err) {
    console.error("Logout failed:", err);
  } finally {
    localStorage.removeItem("token");
    localStorage.removeItem("session");
    sessionStorage.clear();
    setSession(null);
  }
}