// utils/api.js
export async function fetchWithToken(url, options = {}) {
  const session = JSON.parse(localStorage.getItem("user"));
  const token = session?.token;

  if (!token) throw new Error("No session token found");

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
    Authorization: `Bearer ${token}`, // ✅ only backend token
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.message || "API request failed");
  }
  return response.json();
}
