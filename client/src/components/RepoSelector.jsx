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
          // Default to empty or default search
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
    <div className="sidebar-section repo-selector-section">
      <div className="sidebar-section-header">
        <span className="sidebar-section-tag">PROJECT REPOSITORY</span>
      </div>

      {/* GitHub Username Input Bar */}
      <form onSubmit={handleFetchClick} className="repo-search-form">
        <div className="repo-input-wrap">
          <span className="repo-input-prefix">@</span>
          <input
            type="text"
            className="repo-input"
            placeholder="GitHub username..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isRunning}
          />
        </div>
        <button type="submit" className="repo-fetch-btn" disabled={loading || isRunning}>
          {loading ? '...' : 'LOAD'}
        </button>
      </form>

      {error && <div className="repo-error-banner">{error}</div>}

      {/* Dropdown Selector */}
      {repos.length > 0 ? (
        <div className="repo-dropdown-wrap">
          <select
            className="repo-select-box"
            value={selectedRepo ? selectedRepo.fullName : ''}
            onChange={handleRepoChange}
            disabled={isRunning}
          >
            {repos.map(r => (
              <option key={r.fullName} value={r.fullName}>
                {r.name} ({r.language}) {r.isPrivate ? '🔒' : ''}
              </option>
            ))}
          </select>
        </div>
      ) : (
        !loading && <div className="repo-empty-note">No repositories loaded. Enter a username above.</div>
      )}

      {/* Selected Repo Details Card */}
      {selectedRepo && (
        <div className="selected-repo-card">
          <div className="repo-card-header">
            <span className="repo-card-name" title={selectedRepo.fullName}>
              {selectedRepo.fullName}
            </span>
            <span className="repo-card-lang">{selectedRepo.language}</span>
          </div>
          <div className="repo-card-meta">
            <span className="repo-branch-pill">🌿 {selectedRepo.defaultBranch || 'main'}</span>
            <span className="repo-vis-pill">{selectedRepo.isPrivate ? 'PRIVATE' : 'PUBLIC'}</span>
          </div>

          <button
            className="brutalist-btn btn-run-repo"
            onClick={() => onRunLiveRepo(selectedRepo)}
            disabled={isRunning}
            title="Clone repository into sandbox, diagnose errors with Groq AI, and open real Pull Request"
          >
            <span className="btn-bolt">⚡</span>
            <span>{isRunning ? 'AGENT ACTIVE...' : 'HEAL LIVE REPO'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
