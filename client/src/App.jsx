import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

import Header from './components/Header';
import RepoSelector from './components/RepoSelector';
import StepperGraph from './components/StepperGraph';
import AgentMindStream from './components/AgentMindStream';
import DiffInspector from './components/DiffInspector';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState('STANDBY');
  const [ecosystem, setEcosystem] = useState('Polyglot');
  const [targetArtifact, setTargetArtifact] = useState('');
  const [diff, setDiff] = useState('');
  const [pr, setPr] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentRunId, setCurrentRunId] = useState('94827163');
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [humanInTheLoop, setHumanInTheLoop] = useState(false);
  const [pendingPr, setPendingPr] = useState(null);
  const [isApproving, setIsApproving] = useState(false);
  const [health, setHealth] = useState({
    groq_configured: false,
    github_configured: false,
    target_repo: null
  });

  const fetchHealth = () => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(() => {});
  };

  useEffect(() => {
    fetchHealth();

    // Auto-restore most recent audit session if available
    fetch('/api/sessions')
      .then(res => res.json())
      .then(sessions => {
        if (sessions && sessions.length > 0) {
          const latest = sessions[0];
          fetch(`/api/sessions/${latest.sessionId}`)
            .then(r => r.json())
            .then(data => {
              if (data.logs && data.logs.length > 0) {
                setLogs(data.logs);
              }
              if (data.session) {
                if (data.session.diff) setDiff(data.session.diff);
                if (data.session.prUrl) {
                  setPr({
                    prUrl: data.session.prUrl,
                    prNumber: data.session.prNumber,
                    title: data.session.prTitle,
                    branchName: data.session.prBranch
                  });
                }
                if (data.session.status === 'COMPLETED') setStatus('RESOLVED');
                if (data.session.language) setEcosystem(data.session.language);
                if (data.session.targetFile) setTargetArtifact(data.session.targetFile);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});

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
        if (data.meta.pendingPr) {
          setPendingPr(data.meta.pendingPr);
        }
        if (data.meta.status === 'AWAITING_APPROVAL') {
          setStatus('AWAITING_APPROVAL');
          setIsRunning(false);
        } else if (data.meta.durationSeconds) {
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
    setPendingPr(null);
    setStatus('STANDBY');
  };

  const handleApprovePr = async () => {
    if (!pendingPr) return;
    setIsApproving(true);
    try {
      const response = await fetch('/api/github/dispatch-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingPr)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to dispatch PR');
      setPr(data.pr);
      setStatus('RESOLVED');
      setPendingPr(null);
    } catch (err) {
      console.error('Approve PR Error:', err);
      alert(`Approval Error: ${err.message}`);
    } finally {
      setIsApproving(false);
    }
  };

  // Launch Autonomous Agent on the developer's live selected repository
  const handleRunLiveRepo = async (repo, mode = 'analyze', targetFile = 'ALL') => {
    if (!repo) return;
    resetState();
    setIsRunning(true);
    setStatus('ANALYZING');
    setEcosystem(repo.language || 'Polyglot');

    const newRunId = Math.floor(Math.random() * 89999999 + 10000000).toString();
    setCurrentRunId(newRunId);

    try {
      const response = await fetch('/api/github/analyze-user-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoFullName: repo.fullName,
          branch: repo.defaultBranch,
          mode,
          humanInTheLoop,
          targetFile: targetFile !== 'ALL' ? targetFile : null
        })
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Server responded with ${response.status}`);
      }
    } catch (err) {
      console.error('Run Live Repo Error:', err);
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
        <Header />

        <div className="sidebar-scroll-body">
          {/* Developer Project / Repository Selector & Live Action Station */}
          <RepoSelector
            selectedRepo={selectedRepo}
            onSelectRepo={setSelectedRepo}
            onRunLiveRepo={handleRunLiveRepo}
            isRunning={isRunning}
            humanInTheLoop={humanInTheLoop}
            onToggleHumanInTheLoop={() => setHumanInTheLoop(prev => !prev)}
          />

          {/* 5-Stage Animated Pipeline Ladder */}
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
            targetFile={targetArtifact || (selectedRepo ? `${selectedRepo.name}/...` : 'Workspace Artifact')}
            pr={pr}
            status={status}
            pendingPr={pendingPr}
            isApproving={isApproving}
            onApprovePr={handleApprovePr}
            isVerified={status === 'RESOLVED' || status === 'AWAITING_APPROVAL' || Boolean(pr)}
          />
        </div>
      </main>
    </div>
  );
}
