import React, { useState, useEffect } from 'react';
import '../styles/IncidentCategorySelector.css';
import { FaSpinner, FaLightbulb, FaCheckCircle } from 'react-icons/fa';

/**
 * IncidentCategorySelector Component
 * Provides AI-powered incident categorization suggestions with manual override
 * Integrates with backend ML service for intelligent classification
 */
function IncidentCategorySelector({ reportDescription, reportImages, onCategorySelect, isOwner = false, allFieldsFilled = false, aiAttemptsLeft = 3, onUseAI = () => {} }) {
  const [suggestedCategory, setSuggestedCategory] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [inlineValidation, setInlineValidation] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  // Available incident categories
  const categories = [
    { id: 'theft', label: 'Theft/Robbery', icon: '🏪', color: '#e74c3c' },
    { id: 'fire', label: 'Fire/Explosion', icon: '🔥', color: '#e67e22' },
    { id: 'flood', label: 'Flood/Water', icon: '💧', color: '#3498db' },
    { id: 'accident', label: 'Accident', icon: '🚗', color: '#f39c12' },
    { id: 'violence', label: 'Violence/Assault', icon: '⚠️', color: '#c0392b' },
    { id: 'harassment', label: 'Harassment', icon: '📢', color: '#8e44ad' },
    { id: 'vandalism', label: 'Vandalism', icon: '🖼️', color: '#95a5a6' },
    { id: 'suspicious', label: 'Suspicious Activity', icon: '👁️', color: '#34495e' },
    { id: 'hazard', label: 'Hazard/Infrastructure', icon: '⚠️', color: '#d35400' },
    { id: 'other', label: 'Other', icon: '❓', color: '#95a5a6' },
    { id: 'lostfound', label: 'Lost & Found', icon: '🔎', color: '#2ecc71' },
  ];
  // Removed duplicate AI 'lostfound' category from available choices

  /**
   * Request AI categorization from backend
   */
  useEffect(() => {
    // do not auto-run prediction; user must press Analyze to reveal AI suggestions
    if (hasAnalyzed && reportDescription && reportDescription.trim().length > 10) {
      fetchCategoryPrediction(true);
    }
  }, [reportDescription, hasAnalyzed]);

  const fetchCategoryPrediction = async (userTriggered = false) => {
    if (!reportDescription) return;

    if (!allFieldsFilled) {
      setInlineValidation(true);
      setTimeout(() => setInlineValidation(false), 3000);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          description: reportDescription,
          images: reportImages ? reportImages.length : 0,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get category suggestion');
      }

      const data = await response.json();
      setSuggestedCategory(data.category);
      setConfidence(data.confidence);
      setShowSuggestion(true);

      // Auto-select if confidence is high
      if (data.confidence >= 0.85) {
        setSelectedCategory(data.category);
        if (onCategorySelect) {
          onCategorySelect(data.category, data.confidence);
        }
        if (userTriggered && typeof onUseAI === 'function') onUseAI();
      }
    } catch (err) {
      console.error('Categorization error:', err);
      setError('Could not suggest category. Please select manually.');
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    if (onCategorySelect) {
      onCategorySelect(categoryId, categoryId === suggestedCategory ? confidence : 0);
    }
  };

  const getConfidenceColor = (conf) => {
    if (conf >= 0.85) return '#27ae60'; // Green - High confidence
    if (conf >= 0.65) return '#f39c12'; // Orange - Medium confidence
    return '#e74c3c'; // Red - Low confidence
  };

  const getConfidenceLabel = (conf) => {
    if (conf >= 0.85) return 'High';
    if (conf >= 0.65) return 'Medium';
    return 'Low';
  };

  return (
    <div className="incident-category-selector">
      <div className="selector-header">
        <h3>Incident Category</h3>
        <p className="subtitle">What type of incident are you reporting?</p>
      </div>

      {/* AI Suggestion Banner */}
      {showSuggestion && suggestedCategory && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            className="ai-analyze-btn"
            onClick={() => {
              setHasAnalyzed(true);
              fetchCategoryPrediction(true);
            }}
            disabled={aiAttemptsLeft <= 0}
            title={aiAttemptsLeft <= 0 ? 'No AI attempts left' : 'Analyze with AI'}
            style={{ marginLeft: 8, background: '#7c5cff', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 8 }}
          >Analyze</button>
        </div>
        <div className="ai-suggestion-banner">
          <div className="suggestion-content">
            <FaLightbulb className="suggestion-icon" />
            <div className="suggestion-text">
              <span className="suggestion-label">AI Suggestion:</span>
              <span className="suggestion-category">
                {categories.find(cat => cat.id === suggestedCategory)?.label}
              </span>
            </div>
            <div
              className="confidence-badge"
              style={{ backgroundColor: getConfidenceColor(confidence) }}
            >
              {Math.round(confidence * 100)}% Confidence
            </div>
          </div>
          {loading && <FaSpinner className="spinner" />}
        </div>
        {/* Inline AI recommendation block (owner only) */}
        {isOwner && showSuggestion && (
          <>
            {/* Top dots above container */}
            <div className="ai-top-dots" aria-hidden="true" style={{ marginBottom: 8 }}>
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
            <div className="ai-inline-container">
            <div className="ai-inline-body">
              {hasAnalyzed ? (
                <p className="ai-inline-recommend">AI recommends: <strong>{categories.find(c => c.id === suggestedCategory)?.label || suggestedCategory}</strong></p>
              ) : (
                <p className="ai-inline-recommend" style={{ fontStyle: 'italic', color: '#555' }}>Press <strong>Analyze</strong> to see AI recommendation</p>
              )}
              <p className="ai-inline-note">You have <strong>{aiAttemptsLeft}</strong> free AI attempts left.</p>
              <div className="ai-inline-actions">
                <button
                  onClick={() => {
                    if (!allFieldsFilled) {
                      setInlineValidation(true);
                      setTimeout(() => setInlineValidation(false), 3000);
                      return;
                    }

                    // Accept AI suggestion
                    setSelectedCategory(suggestedCategory);
                    if (onCategorySelect) onCategorySelect(suggestedCategory, confidence);
                    if (!hasAnalyzed) {
                      setInlineValidation(true);
                      setTimeout(() => setInlineValidation(false), 3000);
                      return;
                    }
                    if (typeof onUseAI === 'function') onUseAI();
                  }}
                  className="ai-inline-accept"
                  disabled={aiAttemptsLeft <= 0}
                >
                  Accept AI Suggestion
                </button>
              </div>
              {inlineValidation && (
                <div className="ai-inline-validation">Please fill all required fields before using the AI helper.</div>
              )}
            </div>
          </div>
        )}
      )}

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Category Grid */}
      <div className="category-grid">
        {categories.map((category) => (
          <div
            key={category.id}
            className={`category-card ${selectedCategory === category.id ? 'selected' : ''} ${
              suggestedCategory === category.id ? 'suggested' : ''
            }`}
            onClick={() => handleCategorySelect(category.id)}
            style={{
              borderColor:
                selectedCategory === category.id || suggestedCategory === category.id
                  ? category.color
                  : '#e0e0e0',
              backgroundColor:
                selectedCategory === category.id || suggestedCategory === category.id
                  ? `${category.color}10`
                  : '#ffffff',
            }}
          >
            <div className="category-icon">{category.icon}</div>
            <div className="category-label">{category.label}</div>

            {/* Selection Checkmark */}
            {selectedCategory === category.id && (
              <FaCheckCircle
                className="checkmark"
                style={{ color: category.color }}
              />
            )}

            {/* AI Suggested Badge */}
            {suggestedCategory === category.id && !selectedCategory && (
              <div className="suggested-badge">
                <FaLightbulb /> AI
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Selected Category Display */}
      {selectedCategory && (
        <div className="selected-category-info">
          <div className="info-item">
            <span className="label">Selected Category:</span>
            <span className="value">
              {categories.find(cat => cat.id === selectedCategory)?.label}
            </span>
          </div>
          {selectedCategory === suggestedCategory && (
            <div className="info-item">
              <span className="label">AI Confidence:</span>
              <span
                className="value confidence"
                style={{ color: getConfidenceColor(confidence) }}
              >
                {getConfidenceLabel(confidence)} ({Math.round(confidence * 100)}%)
              </span>
            </div>
          )}
          {selectedCategory !== suggestedCategory && suggestedCategory && (
            <div className="info-item manual-override">
              <span className="label">Note:</span>
              <span className="value">
                You manually selected {categories.find(cat => cat.id === selectedCategory)?.label}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="loading-state">
          <FaSpinner className="spinner-animated" />
          <span>Analyzing incident description...</span>
        </div>
      )}
    </div>
  );
}

export default IncidentCategorySelector;
