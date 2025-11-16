import React, { useState, useEffect } from 'react';
import { getAISuggestions, mapAIToFrontendCategory, formatConfidence, getConfidenceColor, categorizeIncident } from '../utils/aiService';
import './AICategorySelector.css';

/**
 * AICategorySelector Component
 * Displays AI-powered category suggestions based on incident description
 */
export default function AICategorySelector({ 
  description, 
  onSelectCategory, 
  selectedCategory,
  token
  ,
  isOwner = false,
  allFieldsFilled = false,
  aiAttemptsLeft = 3,
  onUseAI = () => {}
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [inlineValidation, setInlineValidation] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  // Fetch suggestions whenever description changes (limited to lightweight suggestions)
  useEffect(() => {
    if (!description || description.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const fetchSuggestions = async () => {
      setLoading(true);
      try {
        const sug = await getAISuggestions(description);
        setSuggestions(sug);
        if (sug.length > 0) {
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    // Add debounce to avoid too many requests
    const timer = setTimeout(fetchSuggestions, 500);
    return () => clearTimeout(timer);
  }, [description]);

  if (!description || description.trim().length < 3) {
    return null;
  }

  if (loading) {
    return (
      <div className="ai-suggestions-container">
        <div className="ai-loading">
          <span className="loading-spinner"></span>
          Analyzing your incident...
        </div>
      </div>
    );
  }

  // Analyze button click — opens modal and runs categorize
  const handleAnalyze = async () => {
    if (!description || description.trim().length < 5) return;
    setModalOpen(true);
    setAnalyzing(true);
    setAnalysisResult(null);

    try {
      // Try full categorize (requires token for auth); if token missing or categorize fails,
      // fall back to lightweight suggestions
      let result = null;
      if (token) {
        result = await categorizeIncident(description, token, 0);
      }

      if (!result) {
        // fall back to suggestions endpoint
        const suggestions = await getAISuggestions(description);
        if (suggestions.length > 0) {
          // convert suggestions into result-like structure
          result = {
            category: suggestions[0].category,
            frontend_category: suggestions[0].frontend_category || mapAIToFrontendCategory(suggestions[0].category),
            confidence: suggestions[0].confidence || 0,
            alternative_categories: suggestions.slice(1).map(s => ({ category: s.category, frontend_category: s.frontend_category || mapAIToFrontendCategory(s.category), confidence: s.confidence })),
            method: 'suggestion'
          };
        }
      }

      setAnalysisResult(result);
      setHasAnalyzed(true);
      // If the full categorize was used or a suggestion was produced, count as an attempt
      if (typeof onUseAI === 'function') {
        onUseAI();
      }
    } catch (err) {
      console.error('AI categorize failed:', err);
      setAnalysisResult(null);
    } finally {
      setAnalyzing(false);
    }
  };

  if (suggestions.length === 0 || !showSuggestions) {
    return null;
  }

  return (
    <div className="ai-suggestions-container">
      <div className="ai-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="ai-badge">💡 AI Suggestions</span>
          <p className="ai-subtext">Click the AI button to analyze your full report and apply a suggested category.</p>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            className="ai-analyze-btn"
            title={token ? 'Analyze with AI (premium)' : 'Analyze with AI (login required)'}
            onClick={handleAnalyze}
            disabled={!description || description.trim().length < 5 || aiAttemptsLeft <= 0}
          >
            Analyze
          </button>
          <span className="premium-badge" title="Premium feature">★</span>
        </div>
      </div>
      <div className="ai-header">
        <span className="ai-badge">💡 AI Suggestions</span>
        <p className="ai-subtext">Click to select a suggested category</p>
      </div>

      {/* Dot indicator shown above the AI inline container — prompts user to Analyze */}
      {isOwner && (suggestions && suggestions.length > 0 || hasAnalyzed) && (
        <div className="ai-top-dots" aria-hidden="true" style={{ marginBottom: 8 }}>
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
      )}

      <div className="ai-suggestions-list">
        {suggestions.slice(0, 3).map((suggestion, index) => {
          const frontendCategory = mapAIToFrontendCategory(suggestion.category);
          const confidence = suggestion.confidence;
          const confidencePercent = formatConfidence(confidence);
          const confidenceColor = getConfidenceColor(confidence);
          const isSelected = selectedCategory === frontendCategory;

          return (
            <div
              key={index}
              className={`ai-suggestion-item ${isSelected ? 'selected' : ''}`}
              onClick={() => {
                // Allow category selection only for report owner and when required fields are filled
                if (!isOwner) return;
                if (!allFieldsFilled) {
                  // show a small inline nudge for validating fields
                  setShowSuggestions(true); // keep suggestions open
                  // Use a small timeout state to show a validation message (handled below)
                  setInlineValidation(true);
                  setTimeout(() => setInlineValidation(false), 4000);
                  return;
                }
                if (typeof onUseAI === 'function') {
                  onUseAI();
                }
                onSelectCategory(frontendCategory);
              }}
              style={{
                borderLeftColor: confidenceColor,
              }}
            >
              <div className="suggestion-content">
                <div className="suggestion-category">
                  <span className="category-label">{frontendCategory}</span>
                  <span 
                    className="confidence-badge"
                    style={{ backgroundColor: confidenceColor }}
                  >
                    {confidencePercent}
                  </span>
                </div>
                <p className="suggestion-reason">
                  AI detected: {suggestion.category}
                </p>
              </div>
              {isSelected && (
                <div className="suggestion-checkmark">✓</div>
              )}
            </div>
          );
        })}
      </div>
      {/* Inline Validation / AI Recommendation (only for owners) */}
      {isOwner && (suggestions && suggestions.length > 0 || hasAnalyzed) && (
        <div className="ai-inline-container">
          <div className="ai-inline-body">
            {/* Only show the recommended category after the user analyzes */}
            {hasAnalyzed ? (
              <p className="ai-inline-recommend">AI recommends: <strong>{analysisResult?.frontend_category || mapAIToFrontendCategory(suggestions[0].category)}</strong></p>
            ) : (
              <p className="ai-inline-recommend" style={{ fontStyle: 'italic', color: '#555' }}>Press <strong>Analyze</strong> to see AI recommendation</p>
            )}
            <p className="ai-inline-note">You have <strong>{aiAttemptsLeft}</strong> free AI attempts left.</p>
            <div className="ai-inline-actions">
              <button
                className="ai-inline-accept"
                onClick={() => {
                  if (!allFieldsFilled) {
                    setInlineValidation(true);
                    setTimeout(() => setInlineValidation(false), 3000);
                    return;
                  }

                  // accept top suggestion
                  const frontend = analysisResult?.frontend_category || mapAIToFrontendCategory(suggestions[0].category);
                  if (!hasAnalyzed) {
                    // do not allow accepting a recommendation until the user analyzes
                    setInlineValidation(true);
                    setTimeout(() => setInlineValidation(false), 3000);
                    return;
                  }

                  if (typeof onUseAI === 'function') onUseAI();
                  onSelectCategory(frontend);
                }}
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
      {/* Modal for full AI analysis */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => { if (!analyzing) setModalOpen(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3>AI Analysis</h3>
            <p className="ai-subtext">Analyzing your report — the AI will suggest a category based on the full description.</p>

            {analyzing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 3 }}></div>
                <div>Analyzing your report...</div>
              </div>
            )}

            {!analyzing && analysisResult && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{mapAIToFrontendCategory(analysisResult.category)}</strong>
                  <span className="confidence-badge" style={{ backgroundColor: getConfidenceColor(analysisResult.confidence) }}>{formatConfidence(analysisResult.confidence)}</span>
                </div>
                <p className="ai-subtext">AI category: <strong>{analysisResult.category}</strong></p>

                {analysisResult.alternative_categories && analysisResult.alternative_categories.length > 0 && (
                  <div>
                    <p style={{ marginTop: 8, marginBottom: 6 }}>Alternatives:</p>
                    <ul>
                      {analysisResult.alternative_categories.map((alt, idx) => (
                        <li key={idx}>{mapAIToFrontendCategory(alt.category)} — {alt.category} ({formatConfidence(alt.confidence)})</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => {
                      const frontend = analysisResult.frontend_category || mapAIToFrontendCategory(analysisResult.category);
                      onSelectCategory(frontend);
                      setModalOpen(false);
                    }}
                  >Apply Category</button>
                  <button onClick={() => setModalOpen(false)}>Close</button>
                </div>
              </div>
            )}

            {!analyzing && !analysisResult && (
              <div>
                <p>No clear AI suggestion available. Try editing the description for clarity, or use the manual category selector.</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => setModalOpen(false)}>Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
