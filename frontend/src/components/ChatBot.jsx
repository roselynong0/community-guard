import React, { useState, useEffect, useRef } from "react";
import { FaTimes, FaComments, FaPaperPlane, FaSpinner, FaStar } from "react-icons/fa";
import "./ChatBot.css";

function ChatBot({ isOpen, onClose, token }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [aiMode, setAiMode] = useState("helper"); // "helper" (free) or "patrol" (premium)
  const messagesEndRef = useRef(null);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Add welcome message on first open or mode change
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeText = aiMode === "helper"
        ? "👋 Hello! I'm Community Helper. I provide basic support and system information. My knowledge is limited but I respond quickly.\n\nTip: Try 'Community Patrol' for advanced analytics and AI insights!"
        : "✨ Welcome to Community Patrol! I'm your premium AI assistant with full access to system analytics, risk prediction, and real-time insights.\n\nWhat would you like to know?";
      
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
  }, [isOpen, aiMode]);

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
      let response;
      
      if (aiMode === "patrol") {
        // Premium: Use conversational endpoint for natural conversation
        const body = JSON.stringify({
          text: messageText,
          user_role: "Barangay Official", // or from context
          include_analytics: true
        });
        
        response = await fetch("http://localhost:8000/api/ai/chat/converse", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: body,
        });
      } else {
        // Free: Use existing Flask chatbot
        const body = JSON.stringify({ message: messageText });
        
        response = await fetch("http://localhost:5000/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: body,
        });
      }

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();

      // Format response based on mode
      let responseText = "";
      
      if (aiMode === "patrol") {
        // Premium conversational response
        responseText = data.message || data.response || "Analysis complete.";
      } else {
        // Helper response
        responseText = data.response || data.answer || "I'm not sure how to respond to that.";
      }

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
    <div className={`chatbot-container ${isMinimized ? 'minimized' : ''}`}>
      {/* Chat Header */}
      <div className="chatbot-header">
        <div className="chatbot-title">
          <FaComments className="chatbot-icon" />
          <span>
            {aiMode === "patrol" ? "🔮 Community Patrol" : "👤 Community Helper"}
          </span>
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

      {/* Mode Selector Dropdown */}
      {!isMinimized && (
        <div className="chatbot-mode-selector">
          <label htmlFor="ai-mode">AI Mode:</label>
          <select
            id="ai-mode"
            value={aiMode}
            onChange={(e) => {
              setAiMode(e.target.value);
              setMessages([]); // Clear messages on mode change
            }}
            className="mode-select"
          >
            <option value="helper">
              👤 Community Helper (Free - Limited)
            </option>
            <option value="patrol">
              ✨ Community Patrol (Premium - Full Analytics)
            </option>
          </select>
        </div>
      )}

      {/* Chat Messages */}
      {!isMinimized && (
        <>
          <div className="chatbot-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`message message-${msg.type}`}>
                {msg.type === "bot" && (
                  <div className="message-avatar">
                    {aiMode === "patrol" ? "🔮" : <img src="/CommunityHelper.png" alt="Bot" className="avatar-image" />}
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
                <div className="message-avatar">{aiMode === "patrol" ? "🔮" : <img src="/CommunityHelper.png" alt="Bot" className="avatar-image" />}</div>
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
        </>
      )}
    </div>
  );
}

export default ChatBot;
