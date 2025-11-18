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

    // PRIMARY: Try to fetch from backend API (fresh, authoritative source)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
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
              console.log("⏰ Stored session expired");
              localStorage.removeItem("token");
              localStorage.removeItem("session");
              return null;
            }

            // Update localStorage with fresh session data
            localStorage.setItem("session", JSON.stringify(currentSession));
            console.log("✅ Session validated from backend");
            return currentSession;
          }
        }
      } else if (res.status === 401) {
        // Token is invalid on backend
        console.log("❌ Token rejected by backend (401)");
        localStorage.removeItem("token");
        localStorage.removeItem("session");
        return null;
      }
    } catch (apiErr) {
      if (apiErr.name === 'AbortError') {
        console.warn("⏱️ API timeout - backend may be starting up, using cached session");
      } else {
        console.warn("⚠️ Failed to fetch from /api/sessions, falling back to localStorage:", apiErr.message);
      }
    }

    // FALLBACK: Use localStorage if API fails or times out
    const storedSession = localStorage.getItem("session");
    if (storedSession) {
      try {
        const session = JSON.parse(storedSession);
        
        // Check expiry on frontend
        const now = new Date();
        if (new Date(session.expires_at) < now) {
          console.log("⏰ Cached session expired");
          localStorage.removeItem("token");
          localStorage.removeItem("session");
          return null;
        }
        
        console.log("💾 Using cached session from localStorage (API unavailable or slow)");
        return session;
      } catch (parseErr) {
        console.warn("❌ Failed to parse stored session:", parseErr);
      }
    }

    console.log("❌ No valid session found");
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