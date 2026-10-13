import React, { useState, useEffect } from 'react';

export default function RepoSelector({ onSelectRepo, selectedRepo, onRunLiveRepo, isRunning }) {
  const [username, setUsername] = useState('');
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authUser, setAuthUser] = useState(null);

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
          <span className="sidebar-header-badge">
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

      {/* Selected Repo Card (Styled exactly like Scenario Buttons) */}
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
            <span className="scenario-icon">🐙</span>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
              <span className="scenario-title" style={{ wordBreak: 'break-all' }}>
                {selectedRepo.fullName}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="brutal-action-btn"
            onClick={() => onRunLiveRepo(selectedRepo)}
            disabled={isRunning}
            title="Analyze repository AST, synthesize test suites, fix bugs with Groq, and open real PR"
          >
            <span>{isRunning ? 'SWARM ENGAGED...' : '⚡ HEAL LIVE REPO'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
