// utils/session.js
import { API_CONFIG, getApiUrl } from './apiConfig';

export async function fetchSession() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;

    // PRIMARY: Fetch from backend API (fresh, authoritative source)
    try {
      const res = await fetch(getApiUrl(API_CONFIG.endpoints.sessions), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();

        if (data.status === "success" && data.sessions && data.sessions.length > 0) {
          // Find the session that matches the stored token
          const currentSession = data.sessions.find(s => s.token === token);

          if (currentSession) {
            // Check expiry on frontend
            const now = new Date();
            if (new Date(currentSession.expires_at) < now) {
              localStorage.removeItem("token");
              localStorage.removeItem("session");
              return null;
            }

            // Update localStorage with fresh session data
            localStorage.setItem("session", JSON.stringify(currentSession));
            return currentSession;
          }
        }
      }
    } catch (apiErr) {
      console.warn("Failed to fetch from /api/sessions, falling back to localStorage:", apiErr);
    }

    // FALLBACK: Use localStorage if API fails
    const storedSession = localStorage.getItem("session");
    if (storedSession) {
      try {
        const session = JSON.parse(storedSession);
        
        // Check expiry on frontend
        const now = new Date();
        if (new Date(session.expires_at) < now) {
          localStorage.removeItem("token");
          localStorage.removeItem("session");
          return null;
        }
        
        console.warn("Using cached session from localStorage (API was unavailable)");
        return session;
      } catch (parseErr) {
        console.warn("Failed to parse stored session:", parseErr);
      }
    }

    return null;
  } catch (err) {
    console.error("Failed to fetch session:", err);
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