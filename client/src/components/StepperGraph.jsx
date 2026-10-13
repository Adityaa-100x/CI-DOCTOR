import React from 'react';

export default function StepperGraph({ activeStage = 'IDLE', ecosystem = 'Polyglot' }) {
  // Map internal agent states to stages 1..5
  const getStageState = (stageNum) => {
    if (activeStage === 'RESOLVED' || activeStage === 'COMPLETED') {
      return 'completed';
    }
    if (activeStage === 'IDLE' || activeStage === 'STANDBY') {
      return stageNum === 1 ? 'standby' : 'idle';
    }
    if (activeStage === 'PR_CREATING' || activeStage === 'create_pull_request') {
      return stageNum < 5 ? 'completed' : 'active';
    }
    if (activeStage === 'VERIFYING' || activeStage === 'PATCHING' || activeStage === 'reflection') {
      return stageNum < 4 ? 'completed' : stageNum === 4 ? 'active' : 'idle';
    }
    if (activeStage === 'read_file' || activeStage === 'INVESTIGATING') {
      return stageNum < 3 ? 'completed' : stageNum === 3 ? 'active' : 'idle';
    }
    if (activeStage === 'run_command_initial' || activeStage === 'write_file_repro') {
      return stageNum < 2 ? 'completed' : stageNum === 2 ? 'active' : 'idle';
    }
    return stageNum === 1 ? 'active' : 'idle';
  };

  const getStatusClass = (st) => {
    switch (st) {
      case 'RESOLVED': return 'state-success';
      case 'FAILED': return 'state-error';
      case 'STANDBY': return 'state-standby';
      default: return 'state-running';
    }
  };

  const stages = [
    { num: '01', name: 'Repo Profiler' },
    { num: '02', name: 'Bug Repro' },
    { num: '03', name: 'Diagnosis' },
    { num: '04', name: 'Sandbox Patch' },
    { num: '05', name: 'PR Dispatch' }
  ];

  return (
    <div className="sidebar-section stepper-section">
      <div className="sidebar-section-header">
        <span className="sidebar-section-tag">PIPELINE STAGES</span>
      </div>

      <div className="sidebar-status-meta">
        <div className={`status-badge ${getStatusClass(activeStage)}`}>
          <span className="status-label">STATUS</span>
          <span className="status-value">{activeStage}</span>
        </div>
        <div className="eco-badge">
          <span className="eco-label">ECO</span>
          <span className="eco-value">{ecosystem}</span>
        </div>
      </div>

      <div className="sidebar-stepper-list">
        {stages.map((st, idx) => {
          const state = getStageState(idx + 1);
          return (
            <div key={st.num} className={`sidebar-step-item step-${state}`}>
              <div className="step-left">
                <span className="step-num">{st.num}</span>
                <span className="step-name">{st.name}</span>
              </div>
              <div className="step-right">
                {state === 'completed' && <span className="step-check">✔</span>}
                {state === 'active' && <span className="step-pulse">⚡</span>}
                {state === 'idle' && <span className="step-idle-dot">·</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
