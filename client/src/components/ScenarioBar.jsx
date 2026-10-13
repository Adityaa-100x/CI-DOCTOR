import React from 'react';

export default function ScenarioBar({ activeScenario, onSelectScenario, isRunning, selectedRepoName }) {
  const scenarios = [
    {
      id: 'python_logic',
      index: '01',
      icon: '🐍',
      title: 'Python: Logic Error',
      chip: 'PYTEST'
    },
    {
      id: 'python_divide',
      index: '02',
      icon: '🔁',
      title: 'Python: ReAct Loop',
      chip: 'SELF-CORRECT'
    },
    {
      id: 'node_cart',
      index: '03',
      icon: '🟨',
      title: 'Node.js: Cart Logic',
      chip: 'NODE:TEST'
    },
    {
      id: 'testless_qa',
      index: '04',
      icon: '⚡',
      title: 'Zero-Tests: Auto-QA',
      chip: 'PILLAR 3'
    }
  ];

  return (
    <div className="sidebar-section">
      <div className="sidebar-section-header" style={{ justifyContent: 'space-between' }}>
        <span className="sidebar-section-tag">BENCHMARK SCENARIOS</span>
        {selectedRepoName && (
          <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', fontWeight: '800', background: 'var(--brutal-yellow)', padding: '1px 5px', border: '1px solid #000' }}>
            PR ➔ {selectedRepoName}
          </span>
        )}
      </div>
      <div className="sidebar-scenario-list">
        {scenarios.map(sc => (
          <button
            key={sc.id}
            className={`sidebar-scenario-btn ${activeScenario === sc.id ? 'active-scenario' : ''}`}
            onClick={() => onSelectScenario(sc.id)}
            disabled={isRunning}
          >
            <div className="scenario-btn-top">
              <span className="scenario-index">[{sc.index}]</span>
              <span className="scenario-chip">{sc.chip}</span>
            </div>
            <div className="scenario-btn-main">
              <span className="scenario-icon">{sc.icon}</span>
              <span className="scenario-title">{sc.title}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
