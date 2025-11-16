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
      {/* Only show inline container if owner and all fields filled */}
      {isOwner && allFieldsFilled && (
        <>
          {/* Dot indicator at top of inline container */}
          <div className="ai-top-dots" aria-hidden="true">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>

          {/* AI Inline Container - Shows Analyze Button First, Then Recommendation */}
          <div className="ai-inline-container">
            <div className="ai-inline-body">
              {/* Step 1: Show Analyze Button & Attempts Info (BEFORE Analyzing) */}
              {!hasAnalyzed ? (
                <>
                  <p className="ai-inline-recommend">🤖 Ready for AI Analysis?</p>
                  <p className="ai-inline-note">
                    You have <strong>{aiAttemptsLeft}</strong> free AI analysis attempt{aiAttemptsLeft !== 1 ? 's' : ''} available
                  </p>
                  <div className="ai-inline-actions">
                    <button
                      className="ai-inline-accept"
                      onClick={handleAnalyze}
                      disabled={aiAttemptsLeft <= 0}
                      title={aiAttemptsLeft <= 0 ? 'No AI attempts left' : 'Click to analyze with AI'}
                    >
                      ✨ Analyze with AI
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Step 2: Show AI Recommendation AFTER Analysis */}
                  <p className="ai-inline-recommend">
                    ✅ AI Recommends: <strong>{analysisResult?.frontend_category || mapAIToFrontendCategory(suggestions[0]?.category)}</strong>
                  </p>
                  <p className="ai-inline-note">
                    Confidence: <strong>{formatConfidence(analysisResult?.confidence || 0)}</strong>
                  </p>
                  <div className="ai-inline-actions">
                    <button
                      className="ai-inline-accept"
                      onClick={() => {
                        const frontend = analysisResult?.frontend_category || mapAIToFrontendCategory(suggestions[0]?.category);
                        if (typeof onUseAI === 'function') onUseAI();
                        onSelectCategory(frontend);
                      }}
                      disabled={aiAttemptsLeft <= 0}
                    >
                      ✓ Accept Recommendation
                    </button>
                  </div>
                </>
              )}
              {inlineValidation && (
                <div className="ai-inline-validation">⚠️ Please fill all required fields before using the AI helper.</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Show suggestions list if not owner or fields not filled */}
      {(!isOwner || !allFieldsFilled) && (
        <>
          <div className="ai-header">
            <span className="ai-badge">💡 Community Helper</span>
            <p className="ai-subtext">Get instant category suggestions based on your report details.</p>
          </div>
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
                    if (!allFieldsFilled) {
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
        </>
      )}
      {/* Modal for full AI analysis - HIDDEN */}
      {/* {modalOpen && (
        <div className="modal-overlay" onClick={() => { if (!analyzing) setModalOpen(false); }}>
          <div className="ai-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header">
              <h3>✨ AI Analysis</h3>
              <button 
                className="modal-close-btn" 
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
            <p className="ai-modal-subtext">Analyzing your report — the AI will suggest a category based on the full description.</p>

            {analyzing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px', justifyContent: 'center' }}>
                <div className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 3 }}></div>
                <div>Analyzing your report...</div>
              </div>
            )}

            {!analyzing && analysisResult && (
              <div className="ai-modal-result">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <strong style={{ fontSize: 16 }}>{mapAIToFrontendCategory(analysisResult.category)}</strong>
                  <span className="confidence-badge" style={{ backgroundColor: getConfidenceColor(analysisResult.confidence), padding: '6px 12px' }}>
                    {formatConfidence(analysisResult.confidence)}
                  </span>
                </div>
                <p className="ai-modal-category">AI detected: <strong>{analysisResult.category}</strong></p>

                {analysisResult.alternative_categories && analysisResult.alternative_categories.length > 0 && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(244, 183, 97, 0.2)' }}>
                    <p style={{ marginBottom: 8, fontWeight: 600, color: '#333' }}>Alternative suggestions:</p>
                    <ul style={{ margin: 0, paddingLeft: 16, color: '#666', fontSize: 13 }}>
                      {analysisResult.alternative_categories.map((alt, idx) => (
                        <li key={idx} style={{ marginBottom: 4 }}>
                          {mapAIToFrontendCategory(alt.category)} ({formatConfidence(alt.confidence)})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button
                    className="ai-modal-btn ai-modal-btn-primary"
                    onClick={() => {
                      const frontend = analysisResult.frontend_category || mapAIToFrontendCategory(analysisResult.category);
                      onSelectCategory(frontend);
                      setModalOpen(false);
                    }}
                  >✓ Apply Category</button>
                  <button 
                    className="ai-modal-btn ai-modal-btn-secondary"
                    onClick={() => setModalOpen(false)}
                  >Cancel</button>
                </div>
              </div>
            )}

            {!analyzing && !analysisResult && (
              <div style={{ padding: '16px', textAlign: 'center' }}>
                <p style={{ color: '#666', marginBottom: 16 }}>No clear AI suggestion available. Try editing the description for clarity, or use the manual category selector.</p>
                <button 
                  className="ai-modal-btn ai-modal-btn-secondary"
                  onClick={() => setModalOpen(false)}
                  style={{ width: '100%' }}
                >Close</button>
              </div>
            )}
          </div>
        </div>
      )} */}
    </div>
  );
}
