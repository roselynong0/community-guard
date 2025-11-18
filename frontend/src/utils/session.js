// utils/session.js
import { API_CONFIG, getApiUrl } from './apiConfig';

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
        
        // If cached session is expired, clear it
        if (expiresAt < now) {
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
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout for better cold start tolerance
      
      const res = await fetch(getApiUrl(API_CONFIG.endpoints.sessions), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
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

            // Update localStorage with fresh session data
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
      } else if (res.status === 401) {
        // Token is definitely invalid on backend
        console.log("❌ Token rejected by backend (401) - clearing session");
        localStorage.removeItem("token");
        localStorage.removeItem("session");
        return null;
      } else if (res.status === 404) {
        // Backend route not found - keep cached session to avoid clearing on deployment issues
        console.warn("⚠️ Backend /api/sessions returned 404 - using cached session");
        if (cachedSession) {
          return cachedSession;
        }
      } else {
        console.warn(`⚠️ Backend returned status ${res.status} - using cached session if available`);
        if (cachedSession) {
          return cachedSession;
        }
      }
    } catch (apiErr) {
      if (apiErr.name === 'AbortError') {
        console.warn("⏱️ API timeout - backend may be starting up, using cached session");
      } else {
        console.warn("⚠️ Failed to fetch from /api/sessions:", apiErr.message);
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