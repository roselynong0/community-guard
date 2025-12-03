import React, { useEffect, useMemo, useState } from "react";
import { FaCheckCircle } from "react-icons/fa";
import "./LoadingScreen.css";
import logo from "../assets/logo.png";

function LoadingScreen({
  title,
  subtitle,
  features = [],
  cycleMs = 3000,
  stage = "loading",
  variant = "fullscreen",
  children,
  onExited,
  inlineOffset,
  inlineCenterScreen = false,
  successTitle = "Dashboard Complete!",
  successDuration = 700,
}) {
  const pairs = useMemo(() => {
    if (!features.length) return [];
    const result = [];
    for (let i = 0; i < features.length; i += 2) {
      result.push(features.slice(i, i + 2));
    }
    return result;
  }, [features]);

  const [pairIndex, setPairIndex] = useState(0);
  const [cycleTick, setCycleTick] = useState(0);
  const [inlineIndex, setInlineIndex] = useState(0);
  const EXIT_ANIMATION_MS = 420;
  const [showOverlay, setShowOverlay] = useState(stage !== "exit");
  const [showSuccess, setShowSuccess] = useState(false);
  const [animatingExit, setAnimatingExit] = useState(false);
  const [childrenReady, setChildrenReady] = useState(stage === "exit"); // Controls children visibility

  useEffect(() => {
    let tSuccess;
    let tExit;

    if (stage === "loading") {
      setShowOverlay(true);
      setShowSuccess(false);
      setAnimatingExit(false);
      setChildrenReady(false); // Hide children during loading
    } else if (stage === "exit") {
      setShowSuccess(true);

      tSuccess = setTimeout(() => {
        // Start the exit animation phase
        setAnimatingExit(true);

        tExit = setTimeout(() => {
          // Reveal children FIRST, then remove overlay
          setChildrenReady(true);
          
          // Small delay to let children start appearing before removing overlay completely
          requestAnimationFrame(() => {
            setAnimatingExit(false);
            setShowSuccess(false);
            setShowOverlay(false);
            if (typeof onExited === "function") onExited();
          });
        }, EXIT_ANIMATION_MS);
      }, typeof successDuration === 'number' ? successDuration : 700);
    }

    return () => {
      if (tSuccess) clearTimeout(tSuccess);
      if (tExit) clearTimeout(tExit);
    };
  }, [stage, onExited, successDuration]);

  useEffect(() => {
    const id = setInterval(() => {
      if (pairs.length > 1) {
        setPairIndex((i) => (i + 1) % pairs.length);
      }
      setCycleTick((t) => t + 1);
    }, cycleMs);
    return () => clearInterval(id);
  }, [pairs, cycleMs]);

  useEffect(() => {
    if (!features || features.length === 0) return undefined;
    const id = setInterval(() => {
      setInlineIndex((i) => (i + 1) % features.length);
      setCycleTick((t) => t + 1);
    }, cycleMs);
    return () => clearInterval(id);
  }, [features, cycleMs]);

  const activePair = pairs[pairIndex] || [];

  const rootClass = `loading-screen ${stage === "exit" || animatingExit ? "exit" : ""} ${showSuccess ? 'success' : ''}`;

  const fullscreen = (
    <div className={rootClass} role="status" aria-live="polite">
      <div className="loading-backdrop" />
      <div className="loading-content">
        <img src={logo} className="loading-logo" alt="Community Guard" width={68} height={68} loading="eager" fetchpriority="high" decoding="async" />
        <h2 className="loading-title">{title}</h2>
        {subtitle && <p className="loading-subtitle">{subtitle}</p>}

        <div className="loading-cards">
          {activePair.map((card, idx) => (
            <div
              key={`${pairIndex}-${cycleTick}-${idx}-${card.title}`}
              className={`loading-card ${idx === 0 ? "from-left" : "from-right"}`}
              style={{ animationDelay: `${idx * 140}ms` }}
            >
              <div className="loading-card-title">{card.title}</div>
              <div className="loading-card-desc">{card.description}</div>
            </div>
          ))}
        </div>

        <div className="loading-progress">
          <div className="loading-bar" />
        </div>

        <div className="loading-small">Loading…</div>
      </div>
    </div>
  );

  const inlineWrapper = (
    <div className="loading-inline-container">
      <div className={`loading-inline-children ${!childrenReady ? 'loading-hidden' : 'loading-revealed'}`}>
        {children}
      </div>

      {/* Overlay covering only the component area. */}
      {showOverlay && (
        <div
          className={`loading-inline-overlay ${inlineCenterScreen ? 'center-viewport' : ''} ${animatingExit ? "exit" : ""}`}
          role="status"
          aria-live="polite"
          style={
            inlineCenterScreen
              ? Object.assign(
                  {
                    position: "fixed",
                    inset: 0,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    pointerEvents: "auto",
                  },
                  inlineOffset ? { ["--loading-inline-vertical-offset"]: inlineOffset } : {}
                )
              : inlineOffset
              ? { ["--loading-inline-padding-top"]: inlineOffset }
              : undefined
          }
        >
          <div className={`loading-inline-card ${showSuccess ? 'success' : ''}`}>
            <div className="logo-holder">
              <img src={logo} className="loading-inline-logo" alt="Community Guard" width={56} height={56} loading="eager" fetchpriority="high" decoding="async" />
              {showSuccess && (
                <div className="success-icon" aria-hidden>
                  <FaCheckCircle />
                </div>
              )}
            </div>

            {showSuccess ? (
              <div className="loading-inline-title">{successTitle || 'Dashboard Complete!'}</div>
            ) : (
              title && <div className="loading-inline-title">{title}</div>
            )}

            {/* If features were provided, render a single compact card that switches (inline mode) */}
            {features && features.length > 0 && (
              <div className="loading-cards inline">
                {(() => {
                  const card = features[inlineIndex];
                  return (
                    <div
                      key={`${inlineIndex}-${cycleTick}-${card.title || inlineIndex}`}
                      className={`loading-card from-left`}
                      style={{ animationDelay: `0ms` }}
                    >
                      <div className="loading-card-title">{card.title}</div>
                      <div className="loading-card-desc">{card.description}</div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="loading-progress slim">
              <div className="loading-bar" />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (variant === "inline") return inlineWrapper;
  return showOverlay ? fullscreen : null;
}

export default LoadingScreen;