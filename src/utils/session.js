// utils/session.js
export async function fetchSession() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;

    const res = await fetch("http://localhost:5000/api/sessions", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return null;

    const data = await res.json();

    if (data.status !== "success" || !data.sessions) return null;

    // Find the session that matches the stored token
    const currentSession = data.sessions.find(s => s.token === token);

    if (!currentSession) return null;

    // Check expiry on frontend
    const now = new Date();
    if (new Date(currentSession.expires_at) < now) {
      localStorage.removeItem("token");
      return null;
    }

    return { token, ...currentSession };
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
    await fetch("http://localhost:5000/api/logout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err) {
    console.error("Logout failed:", err);
  } finally {
    localStorage.removeItem("token");
    setSession(null);
  }
}