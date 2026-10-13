import React, { useState, useEffect, useRef } from 'react';

export default function AgentMindStream({ logs = [] }) {
  const [filter, setFilter] = useState('all');
  const terminalRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'thoughts') return log.actionType === 'thought' || log.actionType === 'reflection';
    if (filter === 'tools') return log.actionType === 'tool_call' || log.actionType === 'observation';
    if (filter === 'errors') return log.level === 'error' || log.level === 'warning';
    return true;
  });

  const getTag = (log) => {
    switch (log.actionType) {
      case 'thought':
        return { label: 'THOUGHT 💭', className: 'tag-thought' };
      case 'tool_call':
        return { label: `TOOL 🛠️ (${log.toolName || 'EXEC'})`, className: 'tag-tool' };
      case 'observation':
        return { label: 'OBSERVE 👁️', className: 'tag-observe' };
      case 'reflection':
        return { label: 'REFLECT 🔁', className: 'tag-reflect' };
      default:
        return { label: 'SYSTEM ⚡', className: 'tag-system' };
    }
  };

  return (
    <section className="brutalist-card pane-card terminal-card">
      <div className="brutalist-pane-header">
        <div className="terminal-dots">
          <span className="dot dot-red"></span>
          <span className="dot dot-yellow"></span>
          <span className="dot dot-green"></span>
        </div>
        <div className="pane-title">
          <span className="terminal-glyph">&gt;_</span>
          <span>AGENT_REASONING_CONSOLE</span>
        </div>
        <div className="pane-controls">
          <div className="brutalist-tabs">
            {['all', 'thoughts', 'tools', 'errors'].map(f => (
              <button
                key={f}
                className={`tab-btn ${filter === f ? 'active-tab' : ''}`}
                onClick={() => setFilter(f)}
              >
                [{f.toUpperCase()}]
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="terminal-container">
        <div className="terminal-body" ref={terminalRef}>
          {filteredLogs.length === 0 ? (
            <div className="log-entry system">
              <span className="log-time">00:00:00</span>
              <span className="log-tag tag-system">READY</span>
              <span className="log-msg">Agent standby. Select a repository on the left and engage the autonomous CI healer or QA test suite synthesizer.</span>
            </div>
          ) : (
            filteredLogs.map((log, index) => {
              const tag = getTag(log);
              const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '00:00:00';
              return (
                <div key={index} className={`log-entry ${log.level || 'info'} action-${log.actionType}`}>
                  <span className="log-time">{timeStr}</span>
                  <span className={`log-tag ${tag.className}`}>{tag.label}</span>
                  <div className="log-msg-wrap">
                    <pre className="log-msg">{log.content}</pre>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
