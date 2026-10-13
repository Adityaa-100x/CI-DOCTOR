import React from 'react';

export default function Header({ isConnected, currentRunId }) {
  return (
    <div className="sidebar-brand-block">
      <div className="header-brand">
        <div className="brand-logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            <circle cx="12" cy="12" r="3.5"/>
          </svg>
        </div>
        <div className="brand-meta">
          <div className="brand-title">
            CI-DOCTOR <span className="brand-tag">MERN</span>
          </div>
          <div className="brand-sub">Autonomous Self-Healing CI/CD</div>
        </div>
      </div>

      <div className="sidebar-meta-row">
        <div className={`status-pill ${isConnected ? 'online' : 'offline'}`}>
          <span className="status-blink-dot"></span>
          <span className="status-text">{isConnected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
        <div className="run-stamp">
          <span className="stamp-label">RUN</span>
          <span className="stamp-val">#{currentRunId || '94827163'}</span>
        </div>
      </div>
    </div>
  );
}
