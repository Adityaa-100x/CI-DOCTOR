import { sandboxManager } from '../sandbox/sandboxManager.js';
import { githubService } from '../github/githubService.js';

export class AgentToolExecutor {
  constructor(sandboxDir, repoName, baseBranch = 'main') {
    this.sandboxDir = sandboxDir;
    this.repoName = repoName;
    this.baseBranch = baseBranch;
    this.appliedChanges = new Map(); // path -> newContent
    this.originalContents = new Map(); // path -> origContent
  }

  async execute(toolName, args = {}) {
    switch (toolName) {
      case 'list_directory': {
        const dir = args.path || '.';
        const files = sandboxManager.listDirectory(this.sandboxDir, dir);
        return {
          status: 'success',
          files,
          count: files.length,
          output: `Found ${files.length} files in '${dir}':\n${files.join('\n')}`
        };
      }

      case 'read_file': {
        const filePath = args.path;
        if (!filePath) throw new Error("Argument 'path' is required for read_file");
        const content = sandboxManager.readFile(this.sandboxDir, filePath);
        if (!this.originalContents.has(filePath)) {
          this.originalContents.set(filePath, content);
        }
        return {
          status: 'success',
          path: filePath,
          content,
          lines: content.split('\n').length,
          output: `[${filePath}] (${content.split('\n').length} lines):\n${content}`
        };
      }

      case 'search_code': {
        const query = args.query;
        if (!query) throw new Error("Argument 'query' is required for search_code");
        const matches = sandboxManager.searchCode(this.sandboxDir, query);
        return {
          status: 'success',
          query,
          matches,
          output: `Found ${matches.length} matches for '${query}':\n` + 
            matches.map(m => `${m.file}:${m.line} -> ${m.content}`).join('\n')
        };
      }

      case 'run_command': {
        const command = args.command;
        if (!command) throw new Error("Argument 'command' is required for run_command");
        const result = await sandboxManager.runCommand(this.sandboxDir, command, args.timeoutSeconds || 25);
        return {
          status: result.passed ? 'success' : 'failed',
          exitCode: result.exitCode,
          passed: result.passed,
          stdout: result.stdout,
          stderr: result.stderr,
          durationSeconds: result.durationSeconds,
          command,
          output: `Command: '${command}' (Exit Code: ${result.exitCode}, ${result.durationSeconds}s)\n` +
            (result.stdout ? `[STDOUT]:\n${result.stdout}\n` : '') +
            (result.stderr ? `[STDERR]:\n${result.stderr}` : '')
        };
      }

      case 'write_file': {
        const filePath = args.path;
        const content = args.content;
        if (!filePath || content === undefined) throw new Error("Arguments 'path' and 'content' are required for write_file");
        
        // Save original if not already recorded
        if (!this.originalContents.has(filePath)) {
          try {
            this.originalContents.set(filePath, sandboxManager.readFile(this.sandboxDir, filePath));
          } catch (e) {
            this.originalContents.set(filePath, ''); // new file
          }
        }

        sandboxManager.writeFile(this.sandboxDir, filePath, content);
        this.appliedChanges.set(filePath, content);

        return {
          status: 'success',
          path: filePath,
          bytesWritten: content.length,
          output: `Successfully updated '${filePath}' (${content.length} bytes written).`
        };
      }

      case 'create_pull_request': {
        const branchName = args.branch_name || `ci-doctor/autonomous-fix-${Date.now()}`;
        const title = args.title || 'fix(ci): autonomous verified repair';
        const body = args.body || 'Autonomous repair generated and verified in isolated sandbox.';

        const changesObj = Object.fromEntries(this.appliedChanges);
        const prResult = await githubService.createPullRequest({
          repoFullName: this.repoName,
          branchName,
          baseBranch: this.baseBranch,
          title,
          body,
          changes: changesObj
        });

        return {
          status: 'success',
          pr: prResult,
          output: `Pull Request created on branch '${branchName}': ${prResult.prUrl}`
        };
      }

      default:
        throw new Error(`Unknown tool '${toolName}' requested by agent.`);
    }
  }

  getUnifiedDiffs() {
    const diffs = [];
    for (const [filePath, newContent] of this.appliedChanges.entries()) {
      const origContent = this.originalContents.get(filePath) || '';
      const diff = sandboxManager.generateUnifiedDiff(origContent, newContent, filePath);
      diffs.push({ filePath, diff });
    }
    return diffs;
  }
}
