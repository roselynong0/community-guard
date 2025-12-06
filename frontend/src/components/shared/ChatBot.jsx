import React, { useState, useEffect, useRef, useCallback } from "react";
import { FaTimes, FaComments, FaPaperPlane, FaSpinner, FaCrown } from "react-icons/fa";
import "./ChatBot.css";
import { API_CONFIG, getApiUrl } from "../../utils/apiConfig";
import ModalPortal from "./ModalPortal";

function ChatBot({ isOpen, onClose, token, isPremium = false, onPremiumRequired }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Usage limit state
  const [usageCount, setUsageCount] = useState(0);
  const [usageLimitReached, setUsageLimitReached] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const DAILY_LIMIT = 10; // 10 messages per day for non-premium users
  
  const messagesEndRef = useRef(null);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch current usage count from backend
  const fetchUsageCount = useCallback(async () => {
    if (!token || isPremium) return; // Premium users have no limit
    
    try {
      const response = await fetch(getApiUrl('/api/chatbot/usage'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const count = data.usage_count || 0;
        setUsageCount(count);
        setUsageLimitReached(count >= DAILY_LIMIT);
      }
    } catch (error) {
      console.error("Error fetching usage count:", error);
    }
  }, [token, isPremium, DAILY_LIMIT]);

  // Fetch usage on mount and when opening
  useEffect(() => {
    if (isOpen && !isPremium) {
      fetchUsageCount();
    }
  }, [isOpen, isPremium, fetchUsageCount]);

  // Clear messages and reset state when closing
  const handleClose = () => {
    setMessages([]);
    setInput("");
    onClose();
  };

  // Add welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeText = "👋 Hello! I'm your Community Helper. I'm here to provide support and answer questions about the Community Guard system.\n\nHow can I help you today?";
      
      setMessages([
        {
          id: 1,
          type: "bot",
          text: welcomeText,
          timestamp: new Date(),
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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

  const sendMessage = async () => {
    if (!input.trim()) return;

    // Check usage limit for non-premium users
    if (!isPremium && usageLimitReached) {
      setShowLimitModal(true);
      return;
    }

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
      // Increment usage count for non-premium users
      if (!isPremium) {
        const usageResponse = await fetch(getApiUrl('/api/chatbot/usage/increment'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (usageResponse.ok) {
          const usageData = await usageResponse.json();
          setUsageCount(usageData.usage_count);
          
          // Check if limit reached after increment
          if (usageData.status === 'limit_reached' || usageData.limit_reached) {
            setUsageLimitReached(true);
            setShowLimitModal(true);
            setLoading(false);
            return;
          }
        }
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

      if (!response.ok) {
        // Check if limit was reached (429 status)
        if (response.status === 429) {
          setUsageLimitReached(true);
          setShowLimitModal(true);
          setLoading(false);
          return;
        }
        throw new Error("Failed to get response");
      }

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
    <div className={`chatbot-container ${isPremium ? 'premium' : ''}`}>
      {/* Chat Header */}
      <div className={`chatbot-header ${isPremium ? 'premium-header' : ''}`}>
        <div className="chatbot-title">
          <FaComments className="chatbot-icon" />
          <span>Community Helper</span>
          {isPremium && <span className="premium-badge"><FaCrown /></span>}
        </div>
        <div className="chatbot-actions">
          <button className="chatbot-close-btn" onClick={handleClose} title="Close">
            <FaTimes />
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="chatbot-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message message-${msg.type}`}>
            {msg.type === "bot" && (
              <div className="message-avatar">
                <img src="/CommunityHelper.png" alt="Bot" className="avatar-image" />
              </div>
            )}
            <div className="message-content">
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
          placeholder="Ask me anything..."
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

      {/* Usage Limit Reached Modal */}
      {showLimitModal && (
        <ModalPortal>
          <div className="portal-modal-overlay" onClick={() => setShowLimitModal(false)}>
            <div className="portal-modal premium-limit-modal" onClick={(e) => e.stopPropagation()}>
              <div className="portal-modal-header">
                <h3>✨ Daily Limit Reached</h3>
                <button 
                  className="close-modal-btn"
                  onClick={() => setShowLimitModal(false)}
                  aria-label="Close modal"
                  title="Close"
                >
                  <FaTimes />
                </button>
              </div>
              <div className="portal-modal-body">
                <div className="limit-modal-content">
                  <div className="limit-icon">🚫</div>
                  <p>You've used all <strong>{DAILY_LIMIT}</strong> free messages for today.</p>
                  <p className="limit-detail">Your message limit will reset tomorrow.</p>
                  
                  <div className="premium-upgrade-section">
                    <div className="premium-benefits-title">✨ Upgrade to Premium</div>
                    <ul className="premium-benefits-list">
                      <li>💬 Unlimited chat messages</li>
                      <li>📊 Advanced analytics</li>
                      <li>⏱️ Unlimited Smart Filter</li>
                      <li>🚀 Priority support</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="portal-modal-actions">
                <button 
                  className="cancel-btn"
                  onClick={() => setShowLimitModal(false)}
                >
                  Maybe Later
                </button>
                <button 
                  className="confirm-btn premium-upgrade-btn"
                  onClick={() => {
                    setShowLimitModal(false);
                    handleClose();
                    // Trigger premium upgrade flow
                    if (onPremiumRequired) {
                      onPremiumRequired();
                    }
                  }}
                >
                  ✨ Upgrade Now
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

export default ChatBot;
