import { getApiUrl } from "./apiConfig";

const SAFEZONES_CACHE_KEY = "cachedSafezones";
const SAFEZONES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Fetch safezones with caching to localStorage
 * Validates coordinates before caching
 */
export const fetchSafezonesWithCache = async (token) => {
  try {
    // Try to get from cache first
    const cached = localStorage.getItem(SAFEZONES_CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      // If cache is still valid (less than 5 minutes old), return it
      if (Date.now() - timestamp < SAFEZONES_CACHE_TTL) {
        console.log(`✅ Loaded ${data.length} safezones from cache`);
        return data;
      }
    }

    // Cache expired or doesn't exist, fetch fresh data
    const safezonesEndpoint = getApiUrl('/api/safezones');
    const safezonesResponse = await fetch(safezonesEndpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const safezonesData = await safezonesResponse.json();

    if (safezonesData.status === "success") {
      const safezones = safezonesData.safezones || [];
      
      // Validate all safezones have valid coordinates
      const validSafezones = safezones.filter((sz) => {
        if (!sz.center || !sz.center.latitude || !sz.center.longitude) {
          console.warn(`⚠️ Skipping safezone ${sz.id} - invalid coordinates`);
          return false;
        }
        return true;
      });

      // Cache the valid safezones with timestamp
      localStorage.setItem(
        SAFEZONES_CACHE_KEY,
        JSON.stringify({
          data: validSafezones,
          timestamp: Date.now(),
        })
      );

      console.log(`✅ Loaded and cached ${validSafezones.length} safezones`);
      return validSafezones;
    }

    console.error("❌ Failed to fetch safezones:", safezonesData.message);
    return [];
  } catch (err) {
    console.error("❌ Error fetching safezones:", err);
    // Try to return cached data even if expired
    const cached = localStorage.getItem(SAFEZONES_CACHE_KEY);
    if (cached) {
      const { data } = JSON.parse(cached);
      console.log(`⚠️ Using expired cache with ${data.length} safezones`);
      return data;
    }
    return [];
  }
};

/**
 * Clear the safezones cache
 */
export const clearSafezonesCache = () => {
  localStorage.removeItem(SAFEZONES_CACHE_KEY);
  console.log("✅ Cleared safezones cache");
};

/**
 * Add new safezone to cache
 */
export const addSafezonesToCache = (newSafezones) => {
  const cached = localStorage.getItem(SAFEZONES_CACHE_KEY);
  let existing = [];
  
  if (cached) {
    const { data } = JSON.parse(cached);
    existing = data;
  }

  const updated = [...existing, ...newSafezones];
  localStorage.setItem(
    SAFEZONES_CACHE_KEY,
    JSON.stringify({
      data: updated,
      timestamp: Date.now(),
    })
  );
};
