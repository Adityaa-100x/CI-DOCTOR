import React from 'react';

export default function PipelineRibbon({
  status = 'STANDBY',
  ecosystem = 'Python 3.13',
  track = 'Track 1: Suite Verified',
  latency = '0.00s',
  targetArtifact = 'src/calculator.py',
  sandboxEngine = 'Pytest • Ephemeral Sandbox'
}) {
  const getStatusClass = (st) => {
    switch (st) {
      case 'RESOLVED': return 'status-success';
      case 'FAILED': return 'status-error';
      case 'STANDBY': return 'status-standby';
      default: return 'status-running';
    }
  };

  return (
    <div className="glass-telemetry-ribbon">
      <div className="telemetry-item">
        <span className="telemetry-label">Status</span>
        <div className={`glass-status-pill ${getStatusClass(status)}`}>
          <span className="status-indicator-dot"></span>
          <span>{status}</span>
        </div>
      </div>

      <div className="telemetry-sep"></div>

      <div className="telemetry-item">
        <span className="telemetry-label">Ecosystem</span>
        <span className="telemetry-val pill-eco">{ecosystem}</span>
      </div>

      <div className="telemetry-sep"></div>

      <div className="telemetry-item">
        <span className="telemetry-label">Track</span>
        <span className="telemetry-val pill-track">{track}</span>
      </div>

      <div className="telemetry-sep"></div>

      <div className="telemetry-item">
        <span className="telemetry-label">Repair Latency</span>
        <span className="telemetry-val timer-val">{latency}</span>
      </div>

      <div className="telemetry-sep"></div>

      <div className="telemetry-item">
        <span className="telemetry-label">Target Artifact</span>
        <span className="telemetry-val mono-val">{targetArtifact}</span>
      </div>

      <div className="telemetry-sep"></div>

      <div className="telemetry-item">
        <span className="telemetry-label">Sandbox</span>
        <span className="telemetry-val pill-sandbox">{sandboxEngine}</span>
      </div>
    </div>
  );
}
