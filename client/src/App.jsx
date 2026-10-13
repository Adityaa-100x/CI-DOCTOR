import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

import Header from './components/Header';
import ScenarioBar from './components/ScenarioBar';
import StepperGraph from './components/StepperGraph';
import AgentMindStream from './components/AgentMindStream';
import DiffInspector from './components/DiffInspector';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState('STANDBY');
  const [ecosystem, setEcosystem] = useState('Python 3.13');
  const [targetArtifact, setTargetArtifact] = useState('src/calculator.py');
  const [diff, setDiff] = useState('');
  const [pr, setPr] = useState(null);
  const [activeScenario, setActiveScenario] = useState('python_logic');
  const [isRunning, setIsRunning] = useState(false);
  const [currentRunId, setCurrentRunId] = useState('94827163');

  useEffect(() => {
    // Connect Socket.io client to Express server
    const socket = io();

    socket.on('connect', () => {
      console.log('[Socket.io] Connected to CI-Doctor MERN backend.');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[Socket.io] Disconnected from server.');
      setIsConnected(false);
    });

    // Real-time telemetry events from Autonomous Agent
    socket.on('agent:action', (data) => {
      setLogs((prev) => [...prev, data]);

      if (data.actionType === 'thought' || data.actionType === 'tool_call') {
        setStatus('ANALYZING');
      }

      if (data.toolName === 'write_file') {
        setStatus('PATCHING');
      }

      if (data.toolName === 'run_command') {
        setStatus('VERIFYING');
      }

      if (data.toolName === 'create_pull_request') {
        setStatus('PR_DISPATCH');
      }

      if (data.meta) {
        if (data.meta.diff) {
          setDiff(data.meta.diff);
        }
        if (data.meta.pr) {
          setPr(data.meta.pr);
        }
        if (data.meta.durationSeconds) {
          setStatus('RESOLVED');
          setIsRunning(false);
        }
      }
    });

    socket.on('agent:profile', (profile) => {
      if (profile.language) setEcosystem(profile.language);
      if (profile.targetFile) setTargetArtifact(profile.targetFile);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const resetState = () => {
    setLogs([]);
    setDiff('');
    setPr(null);
    setStatus('STANDBY');
  };

  const handleSelectScenario = async (scenarioId) => {
    resetState();
    setActiveScenario(scenarioId);
    setIsRunning(true);
    setStatus('ANALYZING');

    const newRunId = Math.floor(Math.random() * 89999999 + 10000000).toString();
    setCurrentRunId(newRunId);

    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenarioId })
      });
      if (!response.ok) {
        throw new Error(`Simulation trigger failed (${response.status})`);
      }
    } catch (err) {
      console.error('Simulation error:', err);
      setStatus('FAILED');
      setIsRunning(false);
    }
  };

  const handleClear = () => {
    resetState();
  };

  return (
    <div className="app-shell">
      {/* Left Sidebar: Controls & Pipeline Ladder */}
      <aside className="app-sidebar">
        <Header
          isConnected={isConnected}
          currentRunId={currentRunId}
        />

        <div className="sidebar-scroll-body">
          <ScenarioBar
            activeScenario={activeScenario}
            onSelectScenario={handleSelectScenario}
            isRunning={isRunning}
          />

          <StepperGraph
            activeStage={status}
            ecosystem={ecosystem}
          />
        </div>

        <div className="sidebar-footer">
          <button className="brutalist-btn btn-clear-sidebar" onClick={handleClear} title="Clear terminal stream">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            <span>RESET STREAM</span>
          </button>
        </div>
      </aside>

      {/* Main Workbench: Full Height Dual Panes */}
      <main className="app-main-canvas">
        <div className="workspace-grid">
          <AgentMindStream logs={logs} />
          <DiffInspector
            diff={diff}
            targetFile={targetArtifact}
            pr={pr}
            isVerified={status === 'RESOLVED'}
          />
        </div>
      </main>
    </div>
  );
}
