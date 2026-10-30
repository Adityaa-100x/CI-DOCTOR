import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
   * Fetch recent GitHub Actions workflow runs for a repository
   */
  async getWorkflowRuns(repoFullName) {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) return { total_count: 0, runs: [] };
    const octokit = this.getOctokit();
    try {
      // 1. Fetch currently open PRs to know which feature branches are still active
      let openBranches = new Set();
      try {
        const { data: openPRs } = await octokit.rest.pulls.list({
          owner,
          repo,
          state: 'open',
          per_page: 50
        });
        openBranches = new Set(openPRs.map(p => p.head.ref));
      } catch (e) {
        console.warn('[GitHubService] Could not list open PRs for filtering:', e.message);
      }

      // 2. Fetch recent workflow runs
      const { data } = await octokit.rest.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        per_page: 15
      });

      // 3. Filter out workflow runs for feature branches whose PRs are already closed or merged
      const activeRuns = (data.workflow_runs || []).filter(r => {
        // Keep main / master branch runs
        if (!r.head_branch || r.head_branch === 'main' || r.head_branch === 'master') {
          return true;
        }
        // If it's a feature branch (e.g. ci-doctor/...), only keep if the PR is currently OPEN
        if (r.head_branch.startsWith('ci-doctor/')) {
          return openBranches.has(r.head_branch);
        }
        return openBranches.has(r.head_branch);
      }).slice(0, 5);

      const runs = activeRuns.map(r => ({
        id: r.id,
        name: r.name,
        runNumber: r.run_number,
        status: r.status, // "queued", "in_progress", "completed"
        conclusion: r.conclusion, // "success", "failure", "cancelled", etc.
        htmlUrl: r.html_url,
        branch: r.head_branch,
        commitSha: r.head_sha ? r.head_sha.substring(0, 7) : '',
        commitMessage: r.head_commit?.message || 'Push commit',
        author: r.head_commit?.author?.name || r.actor?.login || 'developer',
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));

      return {
        total_count: runs.length,
        runs
      };
    } catch (err) {
      console.warn(`[GitHubService] Could not list workflow runs for '${repoFullName}':`, err.message);
      return { total_count: 0, runs: [], error: err.message };
    }
  }

  /**
   * Check live status of a pull request (open, closed, merged)
   */
  async getPullRequestStatus(repoFullName, prNumber) {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo || !prNumber) return null;
    const octokit = this.getOctokit();
    try {
      const { data } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      });
      return {
        number: data.number,
        state: data.state, // 'open' | 'closed'
        merged: data.merged || Boolean(data.merged_at),
        mergedAt: data.merged_at,
        htmlUrl: data.html_url,
        title: data.title
      };
    } catch (err) {
      console.warn(`[GitHubService] Could not get PR #${prNumber} status:`, err.message);
      return null;
    }
  }

  /**
   * Synthesize and deploy a real GitHub Actions CI workflow file (.github/workflows/ci.yml)
   */
  async deployCIWorkflow(repoFullName, branch = 'main') {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) throw new Error(`Invalid repo format '${repoFullName}'`);
    const octokit = this.getOctokit();

    // 1. Detect language / files in repo
    const files = await this.listRepoSourceFiles(repoFullName, branch);
    let ciYamlContent = '';

    const hasJava = files.some(f => f.endsWith('.java'));
    const hasPython = files.some(f => f.endsWith('.py'));
    const hasNode = files.some(f => f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('package.json'));

    if (hasJava) {
      ciYamlContent = `name: CI Build & Test

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  verify:
    name: Java Compilation & Integrity Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Compile Java Sources
        run: |
          echo "=== CI-Doctor: Intelligent CI Build & Verification ==="
          
          # If triggered by a Pull Request, verify modified files in PR to avoid unrelated legacy failures
          if [ "\${{ github.event_name }}" = "pull_request" ]; then
            echo "Event: Pull Request #\${{ github.event.pull_request.number }}"
            git fetch origin \${{ github.base_ref }} --depth=1 || true
            
            # Find Java files changed in this PR
            CHANGED=\$(git diff --name-only origin/\${{ github.base_ref }}...HEAD | grep '\\.java$' || true)
            if [ -z "\$CHANGED" ]; then
              echo "No Java files modified in this Pull Request. Verification passed."
              exit 0
            fi
            echo "Modified Java files to verify in PR:"
            echo "\$CHANGED"
            TARGET_FILES="\$CHANGED"
          else
            echo "Event: Push to \${{ github.ref_name }}"
            TARGET_FILES=\$(find . -name "*.java")
          fi

          FAILURES=0
          while IFS= read -r f; do
            [ -z "\$f" ] && continue
            [ ! -f "\$f" ] && continue
            echo "Compiling: \$f"
            if ! javac "\$f"; then
              echo "COMPILATION_ERROR in \$f"
              FAILURES=\$((FAILURES + 1))
            fi
          done <<< "\$TARGET_FILES"

          if [ \$FAILURES -gt 0 ]; then
            echo "❌ CI FAILED: \$FAILURES Java file(s) failed compilation."
            exit 1
          fi
          echo "SUCCESS: All verified Java sources compiled without syntax or type errors."
`;
    } else if (hasPython) {
      ciYamlContent = `name: Python CI

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  verify:
    name: Python Syntax & Test Verification
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Compile Python Sources
        run: |
          echo "=== CI-Doctor: Intelligent Python Verification ==="
          if [ "\${{ github.event_name }}" = "pull_request" ]; then
            git fetch origin \${{ github.base_ref }} --depth=1 || true
            TARGETS=\$(git diff --name-only origin/\${{ github.base_ref }}...HEAD | grep '\\.py$' || true)
            if [ -z "\$TARGETS" ]; then
              echo "No Python files modified in PR."
              exit 0
            fi
          else
            TARGETS=\$(git ls-files '*.py')
          fi

          python -m py_compile \$TARGETS
          echo "SUCCESS: Python syntax valid."
`;
    } else {
      ciYamlContent = `name: Node.js CI

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  verify:
    name: Node.js Syntax & Build Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Verify JavaScript Syntax
        run: |
          echo "=== CI-Doctor: Intelligent JavaScript Verification ==="
          if [ "\${{ github.event_name }}" = "pull_request" ]; then
            git fetch origin \${{ github.base_ref }} --depth=1 || true
            TARGETS=\$(git diff --name-only origin/\${{ github.base_ref }}...HEAD | grep -E '\\.(js|mjs|cjs|ts|jsx|tsx)$' || true)
            if [ -z "\$TARGETS" ]; then
              echo "No JS files modified in PR."
              exit 0
            fi
          else
            TARGETS=\$(git ls-files '*.js' '*.mjs' 2>/dev/null)
          fi

          for f in \$TARGETS; do
            [ -f "\$f" ] && node --check "\$f"
          done
          echo "SUCCESS: JavaScript syntax valid."
`;
    }

    // 2. Fetch repo metadata for actual default branch if not specified
    let targetBranch = branch;
    try {
      const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
      if (!branch || branch === 'main') {
        targetBranch = repoData.default_branch || 'main';
      }
    } catch (e) {}

    const workflowPath = '.github/workflows/ci.yml';
    let fileSha = undefined;

    try {
      const { data: existingFile } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: workflowPath,
        ref: targetBranch
      });
      fileSha = existingFile.sha;
    } catch (e) {
      // File does not exist yet
    }

    const { data: commitResult } = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: workflowPath,
      message: 'ci: deploy automated GitHub Actions CI workflow [CI-Doctor]',
      content: Buffer.from(ciYamlContent).toString('base64'),
      branch: targetBranch,
      sha: fileSha
    });

    console.log(`[GitHubService] Deployed CI workflow to '${repoFullName}' on branch '${targetBranch}'. Commit: ${commitResult.commit.sha}`);

    return {
      success: true,
      commitSha: commitResult.commit.sha.substring(0, 7),
      commitUrl: commitResult.commit.html_url,
      workflowPath,
      branch: targetBranch
    };
  }

  /**
   * Download raw logs for a workflow run's failing job
   */
  async getWorkflowRunJobLogs(repoFullName, runId) {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) throw new Error('Invalid repoFullName');
    const octokit = this.getOctokit();
    this.token = process.env.GITHUB_TOKEN || '';

    const { data: jobsData } = await octokit.rest.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: runId
    });

    const jobs = jobsData.jobs || [];
    if (jobs.length === 0) {
      throw new Error(`No jobs found for workflow run #${runId}`);
    }

    const targetJob = jobs.find(j => j.conclusion === 'failure') || jobs[0];

    const logUrl = `https://api.github.com/repos/${owner}/${repo}/actions/jobs/${targetJob.id}/logs`;
    const response = await fetch(logUrl, {
      headers: {
        'Authorization': this.token ? `Bearer ${this.token}` : '',
        'User-Agent': 'CI-Doctor',
        'Accept': 'application/vnd.github.v3+json'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to download job logs (${response.status}): ${errText}`);
    }

    const logs = await response.text();
    return {
      runId,
      jobId: targetJob.id,
      jobName: targetJob.name,
      conclusion: targetJob.conclusion,
      htmlUrl: targetJob.html_url,
      logs
    };
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
   * List source files in a repository or scenario for user-targeted auditing
   */
  async listRepoSourceFiles(repoFullName, branch = 'main') {
    const codeExtensions = new Set([
      '.java', '.py', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
      '.go', '.rs', '.cpp', '.c', '.h', '.hpp', '.cs', '.php', '.rb'
    ]);

    // 1. Handle Demo Scenarios
    if (repoFullName.startsWith('demo/')) {
      const scenarioKey = repoFullName.replace('demo/', '');
      const scenarioPath = path.resolve(__dirname, '../scenarios', scenarioKey);
      if (fs.existsSync(scenarioPath)) {
        const results = [];
        const walk = (dir) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (['.git', 'node_modules', '__pycache__', '.pytest_cache'].includes(entry.name)) continue;
            const full = path.join(dir, entry.name);
            const rel = path.relative(scenarioPath, full).replace(/\\/g, '/');
            if (entry.isDirectory()) {
              walk(full);
            } else {
              const ext = path.extname(entry.name).toLowerCase();
              if (codeExtensions.has(ext)) results.push(rel);
            }
          }
        };
        walk(scenarioPath);
        return results;
      }
      return [];
    }

    // 2. Handle GitHub Repositories via Git Tree API
    const octokit = this.getOctokit();
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) return [];

    try {
      let commitSha = branch || 'main';
      try {
        const { data: refData } = await octokit.rest.git.getRef({
          owner,
          repo,
          ref: `heads/${branch || 'main'}`
        });
        commitSha = refData.object.sha;
      } catch (refErr) {
        const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
        const { data: refData } = await octokit.rest.git.getRef({
          owner,
          repo,
          ref: `heads/${repoData.default_branch}`
        });
        commitSha = refData.object.sha;
      }

      const { data: treeData } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: commitSha,
        recursive: 'true'
      });

      const sourceFiles = (treeData.tree || [])
        .filter(item => item.type === 'blob')
        .map(item => item.path)
        .filter(p => {
          const ext = path.extname(p).toLowerCase();
          if (!codeExtensions.has(ext)) return false;
          if (p.includes('node_modules/') || p.includes('.git/') || p.includes('dist/') || p.includes('build/')) return false;
          return true;
        });

      return sourceFiles;
    } catch (err) {
      console.warn(`[GitHubService] Could not list source files for '${repoFullName}':`, err.message);
      return [];
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

    // Offline / Demo scenarios support
    if (targetRepo.startsWith('demo/')) {
      const prNum = Math.floor(Math.random() * 899 + 100);
      console.log(`[GitHubService] Generating simulated verified PR for scenario '${targetRepo}': PR #${prNum}`);
      return {
        status: 'created',
        mode: 'demo_simulated',
        prNumber: prNum,
        prUrl: `https://github.com/paneertikkadedo/${targetRepo.replace('demo/', '')}/pull/${prNum}`,
        branchName,
        targetRepo,
        title,
        body
      };
    }

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
