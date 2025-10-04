export async function fetchSession() {
  try {
    const res = await fetch("http://localhost:5000/api/session", {
      credentials: "include", // if using cookies
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.status === "success" ? data.session : null;
  } catch (err) {
    console.error("Failed to fetch session:", err);
    return null;
  }
}
