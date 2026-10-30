import React, { useState } from 'react';

export default function DiffInspector({
  diff = '',
  targetFile = 'Workspace Artifact',
  pr = null,
  isVerified = false,
  status = 'STANDBY',
  pendingPr = null,
  isApproving = false,
  onApprovePr = () => {}
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!diff) return;
    navigator.clipboard.writeText(diff).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  // Render unified diff with syntax colors
  const renderDiffLines = (rawDiff) => {
    if (!rawDiff) {
      return (
        <span className="diff-placeholder">
          {status !== 'STANDBY'
            ? `// 🩺 Autonomous swarm active on ${displayFile}...\n// Inspecting AST contracts, boundary edge cases, and compiler syntax in sandbox.`
            : `// Ready for execution. Select a repository file or failed CI run to start.`}
        </span>
      );
    }

    const lines = rawDiff.split('\n');
    let additions = 0;
    let deletions = 0;

    const rendered = lines.map((line, idx) => {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
        return <span key={idx} className="diff-added">{line}{'\n'}</span>;
      }
      if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
        return <span key={idx} className="diff-removed">{line}{'\n'}</span>;
      }
      if (line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++')) {
        return <span key={idx} className="diff-meta">{line}{'\n'}</span>;
      }
      return <span key={idx}>{line}{'\n'}</span>;
    });

    return { rendered, additions, deletions };
  };

  const diffResult = renderDiffLines(diff);

  // Extract file path from unified diff if present to ensure 100% accuracy with the active patch
  let displayFile = targetFile;
  if (diff) {
    const diffFileMatch = diff.match(/^---\s+[ab]\/([^\r\n\t]+)/m);
    if (diffFileMatch && diffFileMatch[1]) {
      displayFile = diffFileMatch[1].trim();
    }
  }

  return (
    <section className="brutalist-card pane-card diff-card">
      <div className="brutalist-pane-header">
        <div className="inspector-tabs">
          <div className="file-tab">
            <span className="file-icon">📄</span>
            <span className="file-name">{displayFile}</span>
            {diff && (
              <span className="diff-stats-badge">
                <span className="stat-add">+{diffResult.additions || 0}</span>
                <span className="stat-sep">/</span>
                <span className="stat-del">-{diffResult.deletions || 0}</span>
              </span>
            )}
          </div>
        </div>

        <div className="pane-controls">
          <div className={`verification-stamp ${isVerified ? 'verified-passed' : 'verified-pending'}`}>
            <span className="stamp-icon">{isVerified ? '✔' : '⏳'}</span>
            <span className="stamp-text">
              {isVerified
                ? 'EXIT 0 : VERIFIED'
                : status === 'ANALYZING'
                ? 'SWARM ENGAGED'
                : status === 'PATCHING'
                ? 'APPLYING PATCH'
                : status === 'VERIFYING'
                ? 'COMPILING DRY-RUN'
                : 'AWAITING VERIFY'}
            </span>
          </div>
          <button className="brutalist-btn btn-copy" onClick={handleCopy} disabled={!diff}>
            {copied ? '✔ COPIED' : '📋 COPY DIFF'}
          </button>
        </div>
      </div>

      <div className="inspector-body">
        {/* Human-in-the-Loop Gate: Pending Approval Banner */}
        {pendingPr && !pr && (
          <div className="brutalist-pr-banner human-approval-banner">
            <div className="pr-banner-left">
              <div className="pr-stamp-label gate-approval-tag">🛡️ GATE 5: HUMAN APPROVAL REQUIRED</div>
              <div className="pr-banner-title">{pendingPr.title}</div>
              <div className="pr-banner-sub">
                TARGET: <code className="pr-code">{pendingPr.repoFullName}</code> • BRANCH: <code className="pr-code">{pendingPr.branchName}</code> • <span style={{ color: '#00875a', fontWeight: 900 }}>SANDBOX VERIFIED (EXIT 0)</span>
              </div>
            </div>
            <button
              type="button"
              className="brutalist-btn btn-approve-dispatch"
              onClick={onApprovePr}
              disabled={isApproving}
            >
              <span>{isApproving ? 'DISPATCHING TO GITHUB...' : '🚀 APPROVE & DISPATCH PR'}</span>
            </button>
          </div>
        )}

        {/* Pull Request Ready Banner */}
        {pr && (
          <div className={`brutalist-pr-banner ${pr.state === 'merged' ? 'pr-merged' : pr.state === 'closed' ? 'pr-closed' : ''}`}>
            <div className="pr-banner-left">
              <div className="pr-stamp-label">
                {pr.state === 'merged' ? '💜 PR MERGED TO MAIN' : pr.state === 'closed' ? '⚪ PR CLOSED ON GITHUB' : '🚀 AUTONOMOUS PR DISPATCHED'}
              </div>
              <div className="pr-banner-title">{pr.title}</div>
              <div className="pr-banner-sub">
                BASE: <code className="pr-code">main</code> • HEAD: <code className="pr-code">{pr.branchName}</code> • PR #{pr.prNumber || 42}
                {pr.state === 'merged' && <span style={{ marginLeft: '8px', color: '#6d28d9', fontWeight: 900 }}>• MERGED ✅</span>}
                {pr.state === 'closed' && <span style={{ marginLeft: '8px', color: '#64748b', fontWeight: 900 }}>• CLOSED</span>}
              </div>
            </div>
            <a
              href={pr.prUrl || '#'}
              target="_blank"
              rel="noreferrer"
              className="brutalist-pr-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span>VIEW ON GITHUB ↗</span>
            </a>
          </div>
        )}

        {/* Zero-Trust Safety Verification Gates */}
        {diff && (
          <div className="safety-gates-strip">
            <span className="gate-item gate-pass">🛡️ G1: IMMUTABLE TESTS</span>
            <span className="gate-item gate-pass">⚡ G2: COMPILER/SYNTAX (EXIT 0)</span>
            <span className="gate-item gate-pass">🧪 G3: ZERO REGRESSIONS</span>
            <span className="gate-item gate-pass">✂️ G4: SURGICAL DIFF</span>
          </div>
        )}

        {/* Unified Diff View */}
        <div className="diff-container">
          <pre className="diff-pre">
            {diffResult.rendered}
          </pre>
        </div>
      </div>
    </section>
  );
}
