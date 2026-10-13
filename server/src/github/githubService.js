import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export class GitHubService {
  constructor() {
    this.token = process.env.GITHUB_TOKEN || '';
    this.defaultRepo = process.env.GITHUB_REPO || '';
  }

  isConfigured() {
    this.token = process.env.GITHUB_TOKEN || '';
    return Boolean(this.token);
  }

  getOctokit() {
    this.token = process.env.GITHUB_TOKEN || '';
    return new Octokit(this.token ? { auth: this.token } : {});
  }

  /**
   * Fetch authenticated user info if token is provided
   */
  async getAuthenticatedUser() {
    if (!this.token) return null;
    try {
      const octokit = this.getOctokit();
      const { data } = await octokit.rest.users.getAuthenticated();
      return {
        login: data.login,
        name: data.name,
        avatar_url: data.avatar_url,
        html_url: data.html_url,
        public_repos: data.public_repos,
        total_private_repos: data.total_private_repos
      };
    } catch (err) {
      console.warn('[GitHubService] Could not get authenticated user:', err.message);
      return null;
    }
  }

  /**
   * List repositories for a given username or for the authenticated developer
   */
  async listUserRepositories(username = '') {
    const octokit = this.getOctokit();
    try {
      let reposData = [];
      if (username) {
        console.log(`[GitHubService] Fetching repos for user '${username}'...`);
        const { data } = await octokit.rest.repos.listForUser({
          username,
          sort: 'updated',
          per_page: 50
        });
        reposData = data;
      } else if (this.token) {
        console.log('[GitHubService] Fetching authenticated developer repos...');
        const { data } = await octokit.rest.repos.listForAuthenticatedUser({
          sort: 'updated',
          per_page: 50,
          affiliation: 'owner,collaborator'
        });
        reposData = data;
      }

      return reposData.map(r => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        description: r.description || 'No description provided.',
        language: r.language || 'Polyglot',
        stars: r.stargazers_count,
        defaultBranch: r.default_branch || 'main',
        isPrivate: r.private,
        htmlUrl: r.html_url,
        updatedAt: r.updated_at
      }));
    } catch (err) {
      console.error(`[GitHubService] Error listing repos for '${username}':`, err.message);
      throw new Error(`Failed to fetch repositories for '${username}': ${err.message}`);
    }
  }

  /**
   * Clone repository into target sandbox directory for autonomous analysis
   */
  async cloneRepository(repoFullName, targetDir, branch = '') {
    this.token = process.env.GITHUB_TOKEN || '';
    const cloneUrl = this.token
      ? `https://x-access-token:${this.token}@github.com/${repoFullName}.git`
      : `https://github.com/${repoFullName}.git`;

    const branchFlag = branch ? `--branch ${branch}` : '';
    const cloneCmd = `git clone --depth 1 ${branchFlag} ${cloneUrl} "${targetDir}"`;

    console.log(`[GitHubService] Cloning '${repoFullName}' into sandbox '${targetDir}'...`);
    execSync(cloneCmd, { stdio: 'pipe', timeout: 30000 });
    return targetDir;
  }

  /**
   * Create a live Pull Request with the autonomous fixes on the developer's repository
   */
  async createPullRequest({ repoFullName, branchName, baseBranch = 'main', title, body, changes }) {
    this.token = process.env.GITHUB_TOKEN || '';
    const targetRepo = repoFullName || this.defaultRepo || 'enterprise-team/ci-doctor-service';

    if (this.isConfigured()) {
      try {
        console.log(`[GitHubService] Opening live Pull Request on GitHub repo: ${targetRepo}`);
        const [owner, repo] = targetRepo.split('/');
        if (!owner || !repo) {
          throw new Error(`Invalid GITHUB_REPO format '${targetRepo}'. Expected 'owner/repo'.`);
        }

        const octokit = this.getOctokit();

        // 1. Fetch repo metadata to find default branch
        let actualBaseBranch = baseBranch;
        try {
          const { data: repoMeta } = await octokit.rest.repos.get({ owner, repo });
          if (repoMeta.default_branch) {
            actualBaseBranch = repoMeta.default_branch;
          }
        } catch (e) {
          console.warn('[GitHubService] Could not fetch repo meta, using baseBranch:', actualBaseBranch);
        }

        // 2. Get base branch commit SHA
        const { data: refData } = await octokit.rest.git.getRef({
          owner,
          repo,
          ref: `heads/${actualBaseBranch}`
        });
        const baseSha = refData.object.sha;

        // 3. Create new feature branch ref
        try {
          await octokit.rest.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${branchName}`,
            sha: baseSha
          });
          console.log(`[GitHubService] Branch created: ${branchName}`);
        } catch (e) {
          console.log(`[GitHubService] Branch note:`, e.message);
        }

        // 4. Commit each changed file to the new branch
        for (const [filePath, content] of Object.entries(changes)) {
          let fileSha = undefined;
          try {
            const { data: fileData } = await octokit.rest.repos.getContent({
              owner,
              repo,
              path: filePath,
              ref: branchName
            });
            fileSha = fileData.sha;
          } catch (e) {
            // New file being created
          }

          await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: filePath,
            message: `fix(ci): autonomous verified repair for ${filePath}`,
            content: Buffer.from(content).toString('base64'),
            branch: branchName,
            sha: fileSha
          });
          console.log(`[GitHubService] Committed patch for ${filePath}`);
        }

        // 5. Open the Pull Request on GitHub
        const { data: prData } = await octokit.rest.pulls.create({
          owner,
          repo,
          title,
          body: body + `\n\n---\n*🩺 Powered by CI-Doctor Autonomous Agent (MERN + Groq AI LPU)*`,
          head: branchName,
          base: actualBaseBranch
        });

        console.log(`[GitHubService] PR #${prData.number} successfully created: ${prData.html_url}`);

        return {
          status: 'created',
          mode: 'live_github',
          prNumber: prData.number,
          prUrl: prData.html_url,
          branchName,
          targetRepo,
          title,
          body
        };
      } catch (err) {
        console.error('[GitHubService] Live GitHub API Error:', err.message);
        return {
          status: 'failed',
          mode: 'live_github',
          error: err.message,
          branchName,
          targetRepo,
          title,
          body
        };
      }
    }

    // If no credentials provided
    return {
      status: 'failed',
      mode: 'live_github',
      error: 'GITHUB_TOKEN is not configured in environment. Cannot dispatch Pull Request to GitHub.',
      branchName,
      targetRepo,
      title,
      body
    };
  }
}

export const githubService = new GitHubService();
