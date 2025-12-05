import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaCheck, FaCrown, FaStar, FaArrowLeft, FaShieldAlt } from "react-icons/fa";
import { getApiUrl } from "../../utils/apiConfig";
import ModalPortal from "../shared/ModalPortal";
import LoadingScreen from "../shared/LoadingScreen";
import "./Premium.css";

export default function Premium({ token }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [overlayExited, setOverlayExited] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [notification, setNotification] = useState(null);
  const [currentPlan, setCurrentPlan] = useState("free"); // free, basic, pro, enterprise
  const [processing, setProcessing] = useState(false);

  const loadingFeatures = [
    { title: "Premium Plans", description: "Loading available subscription options." },
    { title: "Your Benefits", description: "Preparing exclusive premium features." },
  ];

  // Show notification
  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Fetch current premium status
  useEffect(() => {
    const fetchPremiumStatus = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(getApiUrl('/api/profile'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.status === "success" && data.profile?.onpremium) {
            // Mock: determine plan based on some logic or just set to basic
            setCurrentPlan("basic");
          }
        }
      } catch (error) {
        console.error("Error fetching premium status:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPremiumStatus();
  }, [token]);

  // Premium plans data (in Philippine Pesos)
  const plans = [
    {
      id: "basic",
      name: "Basic",
      icon: <FaStar />,
      price: 199,
      period: "month",
      description: "Perfect for getting started with premium features",
      features: [
        "📊 Monthly report summaries",
        "⏱️ 50 Smart Filter uses/month",
        "📈 Basic analytics dashboard",
        "📧 Email support",
      ],
      popular: false,
      color: "#3b82f6",
    },
    {
      id: "pro",
      name: "Pro",
      icon: <FaCrown />,
      price: 499,
      period: "month",
      description: "Most popular choice for barangay officials",
      features: [
        "📊 Monthly report summaries",
        "⏱️ Unlimited Smart Filter usage",
        "📈 Advanced analytics & insights",
        "🗺️ Priority hotspot mapping",
        "🚀 Priority support (24/7)",
        "📱 Mobile notifications",
      ],
      popular: true,
      color: "#f39c12",
    },
  ];

  // Handle plan selection
  const handleSelectPlan = (plan) => {
    if (plan.id === currentPlan) {
      showNotification("You're already subscribed to this plan!", "caution");
      return;
    }
    setSelectedPlan(plan);
    setShowConfirmModal(true);
  };

  // Handle subscription (mock)
  const handleSubscribe = async () => {
    setProcessing(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setProcessing(false);
    setShowConfirmModal(false);
    setCurrentPlan(selectedPlan.id);
    showNotification(`🎉 Successfully subscribed to ${selectedPlan.name} plan!`, "premium");
    
    // Navigate back to dashboard after a short delay
    setTimeout(() => {
      navigate("/barangay/dashboard");
    }, 2000);
  };

  const content = (
    <div className={`premium-page ${overlayExited ? 'overlay-exited' : ''}`}>
      {/* Header */}
      <div className="premium-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <FaArrowLeft /> Back
        </button>
        <div className="header-content">
          <div className="header-icon">
            <FaCrown />
          </div>
          <h1>Upgrade to Premium</h1>
          <p>Unlock powerful features to better serve your community</p>
        </div>
      </div>

      {/* Current Plan Badge */}
      {currentPlan !== "free" && (
        <div className="current-plan-badge">
          <FaShieldAlt />
          <span>Current Plan: <strong>{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</strong></span>
        </div>
      )}

      {/* Plans Grid */}
      <div className="plans-grid">
        {plans.map((plan) => (
          <div 
            key={plan.id} 
            className={`plan-card ${plan.popular ? 'popular' : ''} ${currentPlan === plan.id ? 'current' : ''}`}
            style={{ '--plan-color': plan.color }}
          >
            {plan.popular && (
              <div className="popular-badge">
                <FaStar /> Most Popular
              </div>
            )}
            
            {currentPlan === plan.id && (
              <div className="current-badge">
                <FaCheck /> Current Plan
              </div>
            )}

            <div className="plan-icon" style={{ color: plan.color }}>
              {plan.icon}
            </div>
            
            <h2 className="plan-name">{plan.name}</h2>
            <p className="plan-description">{plan.description}</p>
            
            <div className="plan-price">
              <span className="currency">₱</span>
              <span className="amount">{plan.price.toLocaleString()}</span>
              <span className="period">/{plan.period}</span>
            </div>

            <ul className="plan-features">
              {plan.features.map((feature, index) => (
                <li key={index}>
                  <FaCheck className="check-icon" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button 
              className={`plan-btn ${currentPlan === plan.id ? 'current' : ''}`}
              onClick={() => handleSelectPlan(plan)}
              disabled={currentPlan === plan.id}
            >
              {currentPlan === plan.id ? 'Current Plan' : 'Choose Plan'}
            </button>
          </div>
        ))}
      </div>

      {/* Features Comparison */}
      <div className="features-section">
        <h2>✨ Why Go Premium?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Monthly Report Summaries</h3>
            <p>Get comprehensive monthly analytics and trends for your barangay's incident reports.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⏱️</div>
            <h3>Unlimited Smart Filter</h3>
            <p>Use AI-powered filtering without limits to quickly categorize and prioritize reports.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📈</div>
            <h3>Advanced Analytics</h3>
            <p>Deep insights into crime patterns, peak hours, and predictive analysis for your area.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🚀</div>
            <h3>Priority Support</h3>
            <p>Get faster response times and dedicated assistance from our support team.</p>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="faq-section">
        <h2>Frequently Asked Questions</h2>
        <div className="faq-grid">
          <div className="faq-item">
            <h4>Can I cancel anytime?</h4>
            <p>Yes! You can cancel your subscription at any time. Your premium features will remain active until the end of your billing period.</p>
          </div>
          <div className="faq-item">
            <h4>Is there a free trial?</h4>
            <p>We offer a 7-day free trial for all premium plans. No credit card required to start!</p>
          </div>
          <div className="faq-item">
            <h4>How do I pay?</h4>
            <p>We accept GCash, Maya, credit/debit cards, and bank transfers. All payments are secure and encrypted.</p>
          </div>
          <div className="faq-item">
            <h4>Can I upgrade my plan later?</h4>
            <p>Absolutely! You can upgrade or downgrade your plan at any time. We'll prorate the difference.</p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedPlan && (
        <ModalPortal>
          <div className="modal-overlay premium-confirm-overlay" onClick={() => !processing && setShowConfirmModal(false)}>
            <div className="modal premium-confirm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="confirm-header">
                <div className="confirm-icon" style={{ color: selectedPlan.color }}>
                  {selectedPlan.icon}
                </div>
                <h3>Confirm Subscription</h3>
              </div>

              <div className="confirm-body">
                <div className="confirm-plan">
                  <span className="plan-label">{selectedPlan.name} Plan</span>
                  <span className="plan-price">₱{selectedPlan.price.toLocaleString()}/{selectedPlan.period}</span>
                </div>

                <div className="confirm-details">
                  <p>You're about to subscribe to the <strong>{selectedPlan.name}</strong> plan.</p>
                  <ul>
                    {selectedPlan.features.slice(0, 4).map((feature, i) => (
                      <li key={i}>{feature}</li>
                    ))}
                  </ul>
                </div>

                <div className="payment-note">
                  <p>💳 This is a demo. No actual payment will be processed.</p>
                </div>
              </div>

              <div className="confirm-actions">
                <button 
                  className="cancel-btn"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={processing}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-btn"
                  onClick={handleSubscribe}
                  disabled={processing}
                  style={{ background: `linear-gradient(135deg, ${selectedPlan.color}, ${selectedPlan.color}dd)` }}
                >
                  {processing ? (
                    <>
                      <span className="spinner"></span>
                      Processing...
                    </>
                  ) : (
                    <>✨ Subscribe Now</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Toast Notification */}
      {notification && (
        <ModalPortal>
          <div 
            className={`notif notif-${notification.type}`}
            role="alert" 
            aria-live="assertive"
          >
            {notification.message}
          </div>
        </ModalPortal>
      )}
    </div>
  );

  return (
    <LoadingScreen
      variant="inline"
      features={loadingFeatures}
      title={loading ? "Loading Premium Plans..." : undefined}
      subtitle={loading ? "Preparing subscription options" : undefined}
      stage={loading ? "loading" : "exit"}
      onExited={() => setOverlayExited(true)}
      inlineOffset="18vh"
    >
      {content}
    </LoadingScreen>
  );
}