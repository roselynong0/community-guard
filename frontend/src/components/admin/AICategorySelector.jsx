import React, { useState, useEffect } from 'react';
import { getAISuggestions, mapAIToFrontendCategory, formatConfidence, getConfidenceColor, categorizeIncident } from '../../utils/aiService';
import './AICategorySelector.css';

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

  // Fetch suggestions
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

  const handleAnalyze = async () => {
    if (!description || description.trim().length < 5) return;
    setModalOpen(true);
    setAnalyzing(true);
    setAnalysisResult(null);

    try {
      let result = null;
      if (token) {
        result = await categorizeIncident(description, token, 0);
      }

      if (!result) {
        const suggestions = await getAISuggestions(description);
        if (suggestions.length > 0) {
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
      {isOwner && allFieldsFilled && (
        <>
          <div className="ai-top-dots" aria-hidden="true">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>

          {/* AI Inline Container */}
          <div className="ai-inline-container">
            <div className="ai-inline-body">
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
    </div>
  );
}