import React, { useEffect, useMemo, useState } from "react";
import "./LoadingScreen.css";
import logo from "../assets/logo.png";

/**
 * LoadingScreen
 * Props:
 * - title: string (e.g., "Welcome back, Resident!")
 * - subtitle: string (additional line under the title)
 * - features: Array<{ title: string, description: string }>
 * - cycleMs: number (defaults to 3000)
 */
function LoadingScreen({ title, subtitle, features = [], cycleMs = 3000, stage = 'loading' }) {
  // Pair features into twos for alternating display
  const pairs = useMemo(() => {
    if (!features.length) return [];
    const result = [];
    for (let i = 0; i < features.length; i += 2) {
      result.push(features.slice(i, i + 2));
    }
    return result;
  }, [features]);

  const [pairIndex, setPairIndex] = useState(0);
  // cycleTick forces re-mount/re-animation of the same pair
  const [cycleTick, setCycleTick] = useState(0);

  useEffect(() => {
    // We always tick so that single-pair displays can re-run animations.
    const id = setInterval(() => {
      if (pairs.length > 1) {
        setPairIndex((i) => (i + 1) % pairs.length);
      }
      setCycleTick((t) => t + 1);
    }, cycleMs);
    return () => clearInterval(id);
  }, [pairs, cycleMs]);

  const activePair = pairs[pairIndex] || [];

  const rootClass = `loading-screen ${stage === 'exit' ? 'exit' : ''}`;

  return (
    <div className={rootClass} role="status" aria-live="polite">
      <div className="loading-backdrop" />
      <div className="loading-content">
        <img src={logo} className="loading-logo" alt="Community Guard" />
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
}

export default LoadingScreen;
