import React, { useState, useEffect, useRef, useCallback } from "react";
import { FaTimes, FaComments, FaPaperPlane, FaSpinner, FaRobot, FaBell, FaCheck, FaTimesCircle } from "react-icons/fa";
import "./ChatBot.css";
import { API_CONFIG, getApiUrl } from "../utils/apiConfig";

function ChatBot({ isOpen, onClose, token, autoEvaluationTrigger = false, isPremium = false, onEvaluationComplete }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasNewEvaluation, setHasNewEvaluation] = useState(false);
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [showConfirmPrompt, setShowConfirmPrompt] = useState(false);
  const [autoApproveLoading, setAutoApproveLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const hasLoadedEvaluation = useRef(false);
  const hasShownPrompt = useRef(false);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-approve HIGH/CRITICAL reports
  const autoApproveReports = useCallback(async () => {
    if (!token) return null;
    
    setAutoApproveLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/chat/auto-approve-priority-reports'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      }
      return null;
    } catch (error) {
      console.error("Error auto-approving reports:", error);
      return null;
    } finally {
      setAutoApproveLoading(false);
    }
  }, [token]);

  // Handle confirmation acceptance
  const handleConfirmEvaluation = async () => {
    setShowConfirmPrompt(false);
    
    // First, auto-approve HIGH/CRITICAL reports
    const approvalResult = await autoApproveReports();
    
    if (approvalResult && approvalResult.approved_count > 0) {
      // Add auto-approval message
      const approvalMessage = {
        id: Date.now(),
        type: "bot",
        text: `✅ AUTO-APPROVED ${approvalResult.approved_count} HIGH/CRITICAL Report(s)\n\n` +
              approvalResult.approved_reports.map(r => 
                `• ${r.title} (${r.priority} - ${r.category})`
              ).join('\n') +
              `\n\n📋 These reports are now marked as approved in the system.`,
        timestamp: new Date(),
        isApproval: true,
      };
      setMessages(prev => [...prev, approvalMessage]);
    }
    
    // Then fetch AI evaluation summary
    await fetchAIEvaluationSummary();
    
    // Notify parent component
    if (onEvaluationComplete) {
      onEvaluationComplete(approvalResult);
    }
  };

  // Handle confirmation decline
  const handleDeclineEvaluation = () => {
    setShowConfirmPrompt(false);
    hasShownPrompt.current = true;
    
    const declineMessage = {
      id: Date.now(),
      type: "bot",
      text: "👋 No problem! You can always request an AI evaluation later by clicking the 'AI Evaluation' button or typing 'evaluate' in the chat.\n\nHow else can I help you today?",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, declineMessage]);
  };

  // Fetch AI evaluation summary for premium users
  const fetchAIEvaluationSummary = useCallback(async () => {
    if (!token || !isPremium || hasLoadedEvaluation.current) return;
    
    setEvaluationLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/chat/ai-evaluation-summary'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 'success' && data.data?.has_evaluations) {
          hasLoadedEvaluation.current = true;
          setHasNewEvaluation(true);
          
          // Add AI evaluation summary as a bot message
          const evaluationMessage = {
            id: Date.now(),
            type: "bot",
            text: data.chat_message,
            timestamp: new Date(),
            isEvaluation: true,
          };
          
          setMessages(prev => {
            // Check if we already have an evaluation message
            const hasEvalMsg = prev.some(m => m.isEvaluation);
            if (hasEvalMsg) return prev;
            return [...prev, evaluationMessage];
          });
        }
      }
    } catch (error) {
      console.error("Error fetching AI evaluation summary:", error);
    } finally {
      setEvaluationLoading(false);
    }
  }, [token, isPremium]);

  // Add welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeText = isPremium 
        ? "👋 Hello! I'm your Community Helper with Premium AI features.\n\n✨ As a Premium user, I can provide:\n• AI Auto-Evaluation of reports by priority\n• Auto-approval of HIGH/CRITICAL reports\n• Detailed analysis summaries\n\nHow can I help you today?"
        : "👋 Hello! I'm your Community Helper. I'm here to provide support and answer questions about the Community Guard system.\n\nHow can I help you today?";
      
      setMessages([
        {
          id: 1,
          type: "bot",
          text: welcomeText,
          timestamp: new Date(),
        },
      ]);
      
      // If premium user and auto-triggered, show confirmation prompt
      if (isPremium && token && autoEvaluationTrigger && !hasShownPrompt.current) {
        setTimeout(() => {
          setShowConfirmPrompt(true);
        }, 500);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isPremium]);

  // Handle auto-evaluation trigger from parent
  useEffect(() => {
    if (autoEvaluationTrigger && isOpen && isPremium && token && !hasShownPrompt.current) {
      // Show confirmation prompt instead of directly fetching
      setShowConfirmPrompt(true);
    }
  }, [autoEvaluationTrigger, isOpen, isPremium, token]);

  const formatText = (text) => {
    return text.replace(/\*\*/g, '');
  };

  const renderText = (text) => {
    return formatText(text).split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        {index < formatText(text).split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  // Handle quick action for AI evaluation
  const handleQuickEvaluation = async () => {
    if (!isPremium) {
      const upgradeMessage = {
        id: Date.now(),
        type: "bot",
        text: "✨ AI Auto-Evaluation is a Premium feature.\n\nUpgrade to Premium to unlock:\n• Automatic priority filtering\n• Real-time report evaluation\n• Priority-based summaries\n• Unlimited Smart Filter usage",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, upgradeMessage]);
      return;
    }
    
    hasLoadedEvaluation.current = false;
    await fetchAIEvaluationSummary();
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const messageText = input;

    // Add user message
    const userMessage = {
      id: Date.now(),
      type: "user",
      text: messageText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Check if user is asking for AI evaluation
      const lowerMessage = messageText.toLowerCase();
      if (isPremium && (
        lowerMessage.includes('evaluate') || 
        lowerMessage.includes('evaluation') || 
        lowerMessage.includes('priority') || 
        lowerMessage.includes('auto filter') ||
        lowerMessage.includes('ai summary')
      )) {
        // Fetch fresh AI evaluation
        hasLoadedEvaluation.current = false;
        await fetchAIEvaluationSummary();
        setLoading(false);
        return;
      }

      // Use Flask chatbot endpoint only
      const body = JSON.stringify({ message: messageText });
      
      const response = await fetch(getApiUrl('/api/chat'), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: body,
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      const responseText = data.response || data.answer || "I'm not sure how to respond to that.";

      // Add bot response
      const botMessage = {
        id: Date.now() + 1,
        type: "bot",
        text: formatText(responseText),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = {
        id: Date.now() + 1,
        type: "bot",
        text: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`chatbot-container ${isMinimized ? 'minimized' : ''} ${isPremium ? 'premium' : ''}`}>
      {/* Chat Header */}
      <div className={`chatbot-header ${isPremium ? 'premium-header' : ''}`}>
        <div className="chatbot-title">
          <FaComments className="chatbot-icon" />
          <span>Community Helper</span>
          {isPremium && <span className="premium-badge">✨ Premium</span>}
          {hasNewEvaluation && <FaBell className="notification-indicator" />}
        </div>
        <div className="chatbot-actions">
          <button
            className="chatbot-minimize-btn"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? "Expand" : "Minimize"}
          >
            {isMinimized ? "+" : "−"}
          </button>
          <button className="chatbot-close-btn" onClick={onClose} title="Close">
            <FaTimes />
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      {!isMinimized && (
        <>
          {/* Quick Actions for Premium Users */}
          {isPremium && (
            <div className="chatbot-quick-actions">
              <button 
                className="quick-action-btn"
                onClick={handleQuickEvaluation}
                disabled={evaluationLoading}
                title="Get AI Auto-Evaluation Summary"
              >
                <FaRobot /> {evaluationLoading ? 'Loading...' : 'AI Evaluation'}
              </button>
            </div>
          )}
          
          <div className="chatbot-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`message message-${msg.type} ${msg.isEvaluation ? 'evaluation-message' : ''}`}>
                {msg.type === "bot" && (
                  <div className="message-avatar">
                    <img src="/CommunityHelper.png" alt="Bot" className="avatar-image" />
                  </div>
                )}
                <div className={`message-content ${msg.isEvaluation ? 'evaluation-content' : ''}`}>
                  <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {renderText(msg.text)}
                  </p>
                  <span className="message-time">
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {msg.type === "user" && <div className="message-avatar">👤</div>}
              </div>
            ))}
            {loading && (
              <div className="message message-bot">
                <div className="message-avatar">
                  <img src="/CommunityHelper.png" alt="Bot" className="avatar-image" />
                </div>
                <div className="message-content">
                  <div className="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="chatbot-input-container">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              placeholder={isPremium ? "Ask about reports, priorities, or type 'AI evaluation'..." : "Ask me anything..."}
              className="chatbot-input"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="chatbot-send-btn"
              title="Send message"
            >
              {loading ? <FaSpinner className="spinner" /> : <FaPaperPlane />}
            </button>
          </div>
        </>
      )}

      {/* Confirmation Prompt Modal */}
      {showConfirmPrompt && (
        <div className="chatbot-confirm-overlay">
          <div className="chatbot-confirm-modal">
            <div className="confirm-icon">
              <FaRobot />
            </div>
            <h3>AI Report Evaluation</h3>
            <p>
              Would you like the Community Helper to evaluate pending reports?
            </p>
            <p className="confirm-details">
              This will:
              <br />• Analyze reports by priority (Critical, High, Medium, Low)
              <br />• <strong>Auto-approve HIGH and CRITICAL reports</strong>
              <br />• Generate an evaluation summary
            </p>
            <div className="confirm-actions">
              <button 
                className="confirm-decline-btn"
                onClick={handleDeclineEvaluation}
                disabled={autoApproveLoading}
              >
                <FaTimesCircle /> Not Now
              </button>
              <button 
                className="confirm-accept-btn"
                onClick={handleConfirmEvaluation}
                disabled={autoApproveLoading}
              >
                {autoApproveLoading ? (
                  <>
                    <FaSpinner className="spinner" /> Processing...
                  </>
                ) : (
                  <>
                    <FaCheck /> Yes, Evaluate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatBot;
