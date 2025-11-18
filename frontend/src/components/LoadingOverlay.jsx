import React from 'react'
import './LoadingOverlay.css'

const MVPS = [
  'Incident Reporting',
  'Admin Dashboard',
  'Interactive Maps',
  'Real-time Notifications',
  'Role-Based Dashboards',
  'Session Management',
]

export default function LoadingOverlay() {
  // show 4 cards in the strip but cycle through the available MVPs
  const cards = [MVPS[0], MVPS[1], MVPS[2], MVPS[3]]

  return (
    <div className="cg-loading-overlay" role="status" aria-live="polite">
      <div className="cg-loader-wrap">
        <div className="cg-shield-wrap" aria-hidden>
          <svg className="cg-shield-svg" viewBox="0 0 64 80" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="cg-grad" x1="0%" x2="100%">
                <stop offset="0%" stopColor="#7b61ff" />
                <stop offset="50%" stopColor="#00d4ff" />
                <stop offset="100%" stopColor="#00ff9d" />
              </linearGradient>
            </defs>
            <path d="M32 2 L58 12 L58 36 C58 54 44 68 32 76 C20 68 6 54 6 36 L6 12 Z" fill="url(#cg-grad)" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
            <path d="M32 10 L48 18 L48 36 C48 50 40 60 32 66 C24 60 16 50 16 36 L16 18 Z" fill="rgba(255,255,255,0.08)" />
          </svg>
        </div>

        <div className="cg-mvp-strip" aria-hidden>
          {cards.map((c, i) => (
            <div className="mvp-card" key={i} style={{ ['--i']: i }}>
              <div className="mvp-title">{c}</div>
              <div className="mvp-lines">
                <span />
                <span />
              </div>
            </div>
          ))}
        </div>

        <div className="cg-loader-lines" aria-hidden>
          <div className="line l1" />
          <div className="line l2" />
        </div>

        <div className="cg-loader-text">Loading…</div>
      </div>
    </div>
  )
}
