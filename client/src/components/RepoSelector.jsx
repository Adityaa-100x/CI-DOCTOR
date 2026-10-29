import React, { useState, useEffect } from 'react';

export default function RepoSelector({ onSelectRepo, selectedRepo, onRunLiveRepo, isRunning, humanInTheLoop, onToggleHumanInTheLoop }) {
  const [username, setUsername] = useState('');
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authUser, setAuthUser] = useState(null);
  const [repoFiles, setRepoFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('ALL');
  const [loadingFiles, setLoadingFiles] = useState(false);

  // GitHub Actions CI Monitor state
  const [workflowRuns, setWorkflowRuns] = useState([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [deployingCI, setDeployingCI] = useState(false);
  const [ciStatusMsg, setCiStatusMsg] = useState('');
  const [healingRunId, setHealingRunId] = useState(null);

  // Fetch candidate source files whenever selected repository changes
  useEffect(() => {
    if (!selectedRepo) {
      setRepoFiles([]);
      setSelectedFile('ALL');
      setWorkflowRuns([]);
      return;
    }

    setLoadingFiles(true);
    setSelectedFile('ALL');
    fetch(`/api/github/repo-files?repoFullName=${encodeURIComponent(selectedRepo.fullName)}&branch=${encodeURIComponent(selectedRepo.defaultBranch || 'main')}`)
      .then(res => res.json())
      .then(data => {
        setRepoFiles(data.files || []);
      })
      .catch(() => setRepoFiles([]))
      .finally(() => setLoadingFiles(false));

    fetchWorkflowRuns(selectedRepo.fullName);
  }, [selectedRepo?.fullName]);

  // Fetch real GitHub Actions workflow runs
  const fetchWorkflowRuns = (repoFullName) => {
    if (!repoFullName) return;
    setLoadingRuns(true);
    fetch(`/api/github/workflow-runs?repoFullName=${encodeURIComponent(repoFullName)}`)
      .then(res => res.json())
      .then(data => {
        setWorkflowRuns(data.runs || []);
      })
      .catch(() => setWorkflowRuns([]))
      .finally(() => setLoadingRuns(false));
  };

  // Deploy Real GitHub Actions CI Workflow to Developer's Repo
  const handleDeployCI = async () => {
    if (!selectedRepo) return;
    setDeployingCI(true);
    setCiStatusMsg('');
    try {
      const res = await fetch('/api/github/deploy-ci-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoFullName: selectedRepo.fullName,
          branch: selectedRepo.defaultBranch || 'main'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to deploy CI workflow');
      setCiStatusMsg(`✅ CI Workflow deployed to .github/workflows/ci.yml (Commit: ${data.commitSha})`);
      setTimeout(() => fetchWorkflowRuns(selectedRepo.fullName), 2000);
    } catch (err) {
      setCiStatusMsg(`❌ ${err.message}`);
    } finally {
      setDeployingCI(false);
    }
  };

  // Autonomous Self-Healing of a Failing GitHub Actions Run
  const handleHealRun = async (runId) => {
    if (!selectedRepo) return;
    setHealingRunId(runId);
    setCiStatusMsg(`🩺 Ingesting failure logs for Run #${runId}...`);
    try {
      const res = await fetch('/api/github/heal-workflow-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoFullName: selectedRepo.fullName,
          runId,
          branch: selectedRepo.defaultBranch || 'main',
          humanInTheLoop
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to trigger CI healing');
      setCiStatusMsg(`🚀 CI-Doctor swarm activated on failed run #${runId}!`);
    } catch (err) {
      setCiStatusMsg(`❌ ${err.message}`);
    } finally {
      setHealingRunId(null);
    }
  };

  // Auto-fetch authenticated user on mount
  useEffect(() => {
    fetch('/api/github/user')
      .then(res => res.json())
      .then(data => {
        if (data.user && data.user.login) {
          setAuthUser(data.user);
          setUsername(data.user.login);
          fetchRepos(data.user.login);
        } else {
          fetchRepos('');
        }
      })
      .catch(() => {});
  }, []);

  const fetchRepos = async (userToFetch) => {
    setLoading(true);
    setError('');
    try {
      const url = userToFetch ? `/api/github/repos?username=${encodeURIComponent(userToFetch)}` : '/api/github/repos';
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch repositories');
      }
      setRepos(data.repos || []);
      if (data.repos && data.repos.length > 0 && !selectedRepo) {
        onSelectRepo(data.repos[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchClick = (e) => {
    e.preventDefault();
    if (username.trim()) {
      fetchRepos(username.trim());
    }
  };

  const handleRepoChange = (e) => {
    const chosen = repos.find(r => r.fullName === e.target.value);
    if (chosen) {
      onSelectRepo(chosen);
    }
  };

  return (
    <div className="sidebar-section">
      <div className="sidebar-section-header">
        <span className="sidebar-section-tag">PROJECT WORKSPACE</span>
        {authUser && (
          <span className="sidebar-header-badge" title="Authenticated via GITHUB_TOKEN">
            @{authUser.login}
          </span>
        )}
      </div>

      {/* Developer Username Search Bar (Neo-Brutalist) */}
      <form onSubmit={handleFetchClick} className="brutal-input-group">
        <span className="brutal-input-addon">DEV</span>
        <input
          type="text"
          className="brutal-input"
          placeholder="GitHub username..."
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={isRunning}
        />
        <button type="submit" className="brutal-input-btn" disabled={loading || isRunning}>
          {loading ? '...' : 'LOAD'}
        </button>
      </form>

      {error && <div className="brutal-error-pill">{error}</div>}

      {/* Repo Dropdown */}
      {repos.length > 0 && (
        <div className="brutal-select-wrap">
          <select
            className="brutal-select"
            value={selectedRepo ? selectedRepo.fullName : ''}
            onChange={handleRepoChange}
            disabled={isRunning}
          >
            {repos.map(r => (
              <option key={r.fullName} value={r.fullName}>
                {r.name} · {r.language} {r.isPrivate ? '(Private)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Selected Repo Card */}
      {selectedRepo && (
        <div className="sidebar-scenario-btn active-repo-card">
          <div className="scenario-btn-top">
            <span className="scenario-index">🌿 {selectedRepo.defaultBranch || 'main'}</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <span className="scenario-chip" style={{ background: 'var(--brutal-cyan)', color: '#000' }}>
                {selectedRepo.language || 'POLYGLOT'}
              </span>
              <span className="scenario-chip" style={{ background: selectedRepo.isPrivate ? 'var(--brutal-purple)' : '#000', color: '#fff' }}>
                {selectedRepo.isPrivate ? 'PRIVATE' : 'PUBLIC'}
              </span>
            </div>
          </div>

          <div className="scenario-btn-main" style={{ marginTop: '4px', marginBottom: '8px' }}>
            <span className="scenario-icon">{selectedRepo.language === 'Python' ? '🐍' : selectedRepo.language === 'Java' ? '☕' : '🐙'}</span>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
              <span className="scenario-title" style={{ wordBreak: 'break-all' }}>
                {selectedRepo.fullName}
              </span>
            </div>
          </div>

          {/* Interactive Target File Selector */}
          <div className="target-file-group">
            <div className="target-file-header">
              <span className="target-file-label">🎯 AUDIT TARGET:</span>
              <span className="target-file-count">
                {loadingFiles ? 'Scanning tree...' : `${repoFiles.length} source file(s)`}
              </span>
            </div>
            <div className="brutal-select-wrap file-target-select">
              <select
                className="brutal-select"
                value={selectedFile}
                onChange={(e) => setSelectedFile(e.target.value)}
                disabled={isRunning || loadingFiles}
              >
                <option value="ALL">✨ All Candidate Files (Auto-Scan Swarm)</option>
                {repoFiles.map(f => (
                  <option key={f} value={f}>
                    📄 {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Zero-Trust Gate 5: Human Approval Gate Toggle */}
          <div className="human-loop-row">
            <label className="human-loop-label" title="Zero-Trust Gate 5: Requires human developer review and authorization before creating PR">
              <input
                type="checkbox"
                checked={humanInTheLoop}
                onChange={onToggleHumanInTheLoop}
                disabled={isRunning}
              />
              <span className="human-loop-text">🛡️ HUMAN APPROVAL GATE</span>
            </label>
            <span className={`gate-status-pill ${humanInTheLoop ? 'active' : 'inactive'}`}>
              {humanInTheLoop ? 'MANUAL' : 'AUTO'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
            <button
              type="button"
              className="brutal-action-btn"
              onClick={() => onRunLiveRepo(selectedRepo, 'analyze', selectedFile)}
              disabled={isRunning}
              title="Analyze repository code files, find logic & runtime bugs with Groq AI, fix them, and raise a live PR"
            >
              <span>{isRunning ? 'SWARM ENGAGED...' : (selectedFile !== 'ALL' ? `🔍 FIX [${selectedFile.split('/').pop()}]` : '🔍 ANALYZE CODE & AUTO-FIX PR')}</span>
            </button>

            <button
              type="button"
              className="brutal-action-btn secondary"
              onClick={() => onRunLiveRepo(selectedRepo, 'qa', selectedFile)}
              disabled={isRunning}
              title="Synthesize high-coverage unit tests with Groq AI, execute in sandbox, and commit test suite"
            >
              <span>{isRunning ? 'SWARM ENGAGED...' : (selectedFile !== 'ALL' ? `🧪 SYNTHESIZE TESTS FOR [${selectedFile.split('/').pop()}]` : '🧪 SYNTHESIZE QA TEST SUITE')}</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          REAL GITHUB ACTIONS CI LIVE MONITOR & HEALER
          ========================================================================= */}
      {selectedRepo && (
        <div className="ci-monitor-card">
          <div className="ci-monitor-header">
            <span className="ci-monitor-title">
              ⚡ GITHUB ACTIONS CI
            </span>
            <button
              type="button"
              className="ci-refresh-btn"
              onClick={() => fetchWorkflowRuns(selectedRepo.fullName)}
              disabled={loadingRuns}
              title="Fetch latest GitHub Actions workflow runs"
            >
              {loadingRuns ? '...' : '🔄 REFRESH'}
            </button>
          </div>

          {ciStatusMsg && (
            <div className="brutal-info-pill" style={{ marginBottom: '8px', wordBreak: 'break-all' }}>
              {ciStatusMsg}
            </div>
          )}

          {loadingRuns && workflowRuns.length === 0 ? (
            <div className="ci-empty-box">
              <span>Checking GitHub Actions workflow status...</span>
            </div>
          ) : workflowRuns.length === 0 ? (
            <div className="ci-empty-box">
              <span style={{ fontWeight: 800, color: '#000' }}>
                ⚠️ No CI workflow runs found in this repository.
              </span>
              <span>
                GitHub Actions is not yet active for <strong>{selectedRepo.name}</strong>. Deploy the real CI workflow so tests compile on push.
              </span>
              <button
                type="button"
                className="ci-deploy-btn"
                onClick={handleDeployCI}
                disabled={deployingCI || isRunning}
              >
                {deployingCI ? 'DEPLOYING CI WORKFLOW...' : '🚀 DEPLOY GITHUB ACTIONS CI'}
              </button>
            </div>
          ) : (
            <div className="ci-runs-list">
              {workflowRuns.map(r => {
                const isFail = r.conclusion === 'failure';
                const isSuccess = r.conclusion === 'success';
                const isRunningRun = r.status === 'in_progress' || r.status === 'queued';

                return (
                  <div key={r.id} className={`ci-run-item ${isFail ? 'failed' : ''}`}>
                    <div className="ci-run-top">
                      <span className={`ci-run-badge ${isFail ? 'failure' : isSuccess ? 'success' : isRunningRun ? 'in_progress' : ''}`}>
                        {isSuccess ? '✅ PASSED' : isFail ? '❌ FAILED' : isRunningRun ? '⏳ RUNNING' : `⚪ ${r.conclusion || r.status}`}
                      </span>
                      <a href={r.htmlUrl} target="_blank" rel="noopener noreferrer" className="ci-run-link" title="Open on GitHub">
                        #{r.runNumber} on GitHub ↗
                      </a>
                    </div>
                    <div className="ci-run-commit">
                      🌿 <strong>{r.branch}</strong> · <code>{r.commitSha}</code> {r.commitMessage}
                    </div>

                    {isFail && (
                      <button
                        type="button"
                        className="ci-heal-btn"
                        onClick={() => handleHealRun(r.id)}
                        disabled={isRunning || healingRunId === r.id}
                        title="Download real failure logs from GitHub Actions, isolate bug in sandbox, and raise verified fix PR"
                      >
                        {healingRunId === r.id ? 'INGESTING LOGS & HEALING...' : '🩺 AUTO-HEAL THIS CI FAILURE'}
                      </button>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                className="ci-deploy-btn"
                onClick={handleDeployCI}
                disabled={deployingCI || isRunning}
                style={{ marginTop: '8px', background: '#f5f5f0', fontSize: '0.65rem', padding: '5px' }}
                title="Update .github/workflows/ci.yml with latest compilation rules"
              >
                {deployingCI ? 'UPDATING...' : '⚙️ Re-deploy / Update CI.yml'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}