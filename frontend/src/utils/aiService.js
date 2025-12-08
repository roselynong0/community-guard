/**
 * AI Categorization Service
 * Provides functions to interact with backend AI endpoints
 */

import { getApiUrl } from './apiConfig';

// Mapping from AI categories to frontend categories
const AI_TO_FRONTEND_CATEGORY_MAP = {
  'theft': 'Crime',
  'fire': 'Hazard',
  'flood': 'Hazard',
  'accident': 'Concern',
  'violence': 'Crime',
  'harassment': 'Crime',
  'vandalism': 'Crime',
  'suspicious': 'Concern',
  'hazard': 'Hazard',
  'lostfound': 'Lost&Found',
  'other': 'Others',
};

// Get available categories from backend
export const getAvailableCategories = async () => {
  try {
    const response = await fetch(getApiUrl('/api/ai/categories'));
    if (!response.ok) {
      console.warn('Failed to fetch AI categories, using defaults');
      return null;
    }
    const data = await response.json();
    return data.categories || null;
  } catch (error) {
    console.warn('Error fetching AI categories:', error);
    return null;
  }
};

// Get AI categorization suggestions based on incident description
export const getAISuggestions = async (description) => {
  if (!description || description.trim().length < 3) {
    return [];
  }

    try {
    const authToken = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const response = await fetch(getApiUrl('/api/ai/categorize/suggestions'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: description }),
    });

    if (!response.ok) {
      console.warn('Failed to get AI suggestions');
      return [];
    }

    const data = await response.json();
    return data.suggestions || [];
  } catch (error) {
    console.warn('Error getting AI suggestions:', error);
    return [];
  }
};

// Get AI categorization for a complete incident description
export const categorizeIncident = async (description, token, images = 0) => {
  if (!description || description.trim().length < 5) {
    return null;
  }

  try {
    // Allow fallback to token in localStorage (some components use session, some localStorage)
    const authToken = token || localStorage.getItem('token');

    const response = await fetch(getApiUrl('/api/ai/categorize'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        description: description,
        images: images,
      }),
    });

    if (!response.ok) {
      console.warn('Failed to categorize incident');
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.warn('Error categorizing incident:', error);
    return null;
  }
};

// Map AI category to frontend category
export const mapAIToFrontendCategory = (aiCategory) => {
  return AI_TO_FRONTEND_CATEGORY_MAP[aiCategory] || 'Others';
};

// Get confidence level (High/Medium/Low)
export const getConfidenceLevel = (confidence) => {
  if (confidence >= 0.85) return 'High';
  if (confidence >= 0.65) return 'Medium';
  return 'Low';
};

// Get color for confidence level
export const getConfidenceColor = (confidence) => {
  if (confidence >= 0.85) return '#2a9d62'; // Green
  if (confidence >= 0.65) return '#f4b761'; // Orange
  return '#d9534f'; // Red
};

// Format confidence as percentage
export const formatConfidence = (confidence) => {
  return `${Math.round(confidence * 100)}%`;
};
