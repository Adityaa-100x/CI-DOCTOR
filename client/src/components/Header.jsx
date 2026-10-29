import React from 'react';

export default function Header() {
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
            CI-DOCTOR
          </div>
          <div className="brand-sub">Autonomous Self-Healing CI/CD</div>
        </div>
      </div>
    </div>
  );
}

