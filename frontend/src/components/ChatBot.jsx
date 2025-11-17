import React, { useState, useEffect, useRef } from "react";
import { X, MessageCircle, Send, Loader, Sparkles } from "lucide-react";
import "./ChatBot.css";

function ChatBot({ isOpen, onClose, token }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedModel, setSelectedModel] = useState("community-helper"); // "community-helper" or "community-patrol"
  const messagesEndRef = useRef(null);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Add welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const modelName = selectedModel === "community-patrol" ? "Community Patrol" : "Community Helper";
      setMessages([
        {
          id: 1,
          type: "bot",
          text: `👋 Hello! I'm ${modelName}. ${selectedModel === "community-patrol" ? "✨ I'm powered by advanced AI (Ollama) for enhanced incident analysis. " : ""}I can help you understand our system, answer questions about features, and provide insights about incident reports. What would you like to know?`,
          timestamp: new Date(),
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedModel]);

  const formatText = (text) => {
    // Remove markdown-style bold (**text**) markers
    return text.replace(/\*\*/g, '');
  };

  const renderText = (text) => {
    // Split text by newlines and render as separate lines
    return formatText(text).split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        {index < formatText(text).split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    // Store message before clearing input
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
      let apiEndpoint = "http://localhost:5000/api/chat";
      let requestBody = { message: messageText };

      // For Community Patrol (Ollama), use enhanced endpoint with emergency search
      if (selectedModel === "community-patrol") {
        requestBody.search_emergency = messageText.toLowerCase().includes("emergency");
      }

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();

      // Add bot response
      const botMessage = {
        id: Date.now() + 1,
        type: "bot",
        text: formatText(data.response || data.answer || "I'm not sure how to respond to that."),
        timestamp: new Date(),
        model: selectedModel,
        sources: data.sources || [], // For Ollama responses
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
          <MessageCircle className="chatbot-icon" size={18} />
          <span>
            {selectedModel === "community-patrol" ? (
              <>
                <Sparkles className="sparkle-icon" size={14} />
                Community Patrol
              </>
            ) : (
              "Community Helper"
            )}
          </span>
        </div>
        
        {/* Model Selector */}
        <div className="chatbot-model-selector">
          <select 
            value={selectedModel} 
            onChange={(e) => setSelectedModel(e.target.value)}
            className="model-dropdown"
            title="Switch between AI models"
          >
            <option value="community-helper">Community Helper (Fast)</option>
            <option value="community-patrol">Community Patrol (✨ Premium)</option>
          </select>
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
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      {!isMinimized && (
        <>
          <div className="chatbot-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`message message-${msg.type}`}>
                {msg.type === "bot" && <div className="message-avatar"><img src="/CommunityHelper.png" alt="Bot" className="avatar-image" /></div>}
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
                <div className="message-avatar"><img src="/CommunityHelper.png" alt="Bot" className="avatar-image" /></div>
                <div className="message-content">
                  <div className="loading-dots">
                    <Loader className="spinner-icon" size={16} />
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
              {loading ? <Loader className="spinner" size={16} /> : <Send size={16} />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default ChatBot;
