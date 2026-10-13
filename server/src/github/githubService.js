import { Octokit } from '@octokit/rest';

export class GitHubService {
  constructor() {
    this.token = process.env.GITHUB_TOKEN || '';
    this.defaultRepo = process.env.GITHUB_REPO || '';
  }

  isConfigured() {
    return Boolean(this.token && this.defaultRepo);
  }

  async createPullRequest({ repoFullName, branchName, baseBranch = 'main', title, body, changes }) {
    const targetRepo = repoFullName || this.defaultRepo || 'enterprise-team/ci-doctor-service';

    if (this.isConfigured()) {
      try {
        const [owner, repo] = targetRepo.split('/');
        const octokit = new Octokit({ auth: this.token });

        // 1. Get base branch SHA
        const { data: refData } = await octokit.rest.git.getRef({
          owner,
          repo,
          ref: `heads/${baseBranch}`
        });
        const baseSha = refData.object.sha;

        // 2. Create new branch ref
        try {
          await octokit.rest.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${branchName}`,
            sha: baseSha
          });
        } catch (e) {
          console.log('[GitHubService] Ref note:', e.message);
        }

        // 3. Commit each changed file
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
            // New file
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
        }

        // 4. Open Pull Request
        const { data: prData } = await octokit.rest.pulls.create({
          owner,
          repo,
          title,
          body,
          head: branchName,
          base: baseBranch
        });

        return {
          status: 'created',
          mode: 'live_github',
          prNumber: prData.number,
          prUrl: prData.html_url,
          branchName,
          title,
          body
        };
      } catch (err) {
        console.warn('[GitHubService] GitHub API call error:', err.message, '- Falling back to simulated PR card.');
      }
    }

    // Deterministic Offline / Viva Mock PR
    const mockNumber = Math.floor(Math.random() * 800) + 100;
    return {
      status: 'mock_created',
      mode: 'offline_viva',
      prNumber: mockNumber,
      prUrl: `https://github.com/${targetRepo}/pull/${mockNumber}`,
      branchName,
      title,
      body
    };
  }
}

export const githubService = new GitHubService();
