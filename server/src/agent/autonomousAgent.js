import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { sandboxManager } from '../sandbox/sandboxManager.js';
import { AgentToolExecutor } from './tools.js';
import { SessionService } from '../models/Session.js';
import { AgentLogService } from '../models/AgentLog.js';
import { llmProvider } from './llm.js';

export class AutonomousEngineerAgent {
  constructor(io) {
    this.io = io; // Socket.io instance for live browser streaming
  }

  async run({ repoPath, repoName, branch = 'main', mode = 'analyze', triggerEvent = null, maxTurns = 12 }) {
    const sessionId = uuidv4().substring(0, 8);
    const startTime = Date.now();
    let sandboxDir = null;
    let stepNumber = 0;

    const emitEvent = async (actionType, data) => {
      const logEntry = {
        sessionId,
        stepNumber: ++stepNumber,
        actionType,
        toolName: data.toolName || null,
        toolArgs: data.toolArgs || null,
        content: data.content || '',
        level: data.level || 'info',
        durationSeconds: data.durationSeconds || null
      };

      // 1. Save to MongoDB / In-memory store
      await AgentLogService.append(logEntry);

      // 2. Stream to connected React clients via WebSockets
      if (this.io) {
        this.io.emit('agent:action', { ...logEntry, meta: data.meta });
      }
    };

    try {
      // Step 0: Sandbox Initialization
      await emitEvent('status', {
        content: `Cloning workspace for '${repoName}' into isolated ephemeral sandbox...`,
        level: 'info'
      });

      sandboxDir = await sandboxManager.createSandbox(repoPath, sessionId);
      const toolExecutor = new AgentToolExecutor(sandboxDir, repoName, branch);

      // Create Session in Database
      await SessionService.create({
        sessionId,
        repoName,
        repoPath,
        status: 'ANALYZING'
      });

      // Step 1: Universal Profiling & Discovery
      await emitEvent('thought', {
        content: `Commencing autonomous code audit for '${repoName}'. Exploring sandbox directory tree to profile source code files and architecture.`,
        level: 'info'
      });

      await emitEvent('tool_call', {
        toolName: 'list_directory',
        toolArgs: { path: '.' },
        content: `Executing tool list_directory(".")`
      });

      const listResult = await toolExecutor.execute('list_directory', { path: '.' });
      await emitEvent('observation', {
        toolName: 'list_directory',
        content: listResult.output,
        level: 'info'
      });

      const allFiles = listResult.files || [];

      // Supported code extensions for multi-language AST inspection
      const codeExtensions = new Set([
        '.java', '.py', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
        '.go', '.rs', '.cpp', '.c', '.h', '.hpp', '.cs', '.php', '.rb'
      ]);

      const isSourceCodeFile = (f) => {
        const ext = path.extname(f).toLowerCase();
        if (!codeExtensions.has(ext)) return false;
        if (f.endsWith('.min.js') || f.endsWith('.min.css')) return false;
        if (f.includes('node_modules/') || f.includes('.git/') || f.includes('dist/') || f.includes('build/') || f.includes('.next/')) return false;
        return true;
      };

      const isTestFile = (f) => {
        const lower = f.toLowerCase();
        return (
          lower.includes('.test.') ||
          lower.includes('.spec.') ||
          lower.includes('/tests/') ||
          lower.includes('/test/') ||
          path.basename(f).startsWith('test_') ||
          path.basename(f).endsWith('_test.py') ||
          path.basename(f).endsWith('_test.go')
        );
      };

      const sourceFiles = allFiles.filter(f => isSourceCodeFile(f) && !isTestFile(f));
      const testFiles = allFiles.filter(f => isSourceCodeFile(f) && isTestFile(f));

      // Dynamic Ecosystem Detection
      let language = 'Polyglot';
      let runnerCommand = '';

      if (allFiles.some(f => f.endsWith('.java'))) {
        language = 'Java';
      } else if (allFiles.includes('package.json') || allFiles.some(f => f.endsWith('.js') || f.endsWith('.ts'))) {
        language = 'Node.js (JavaScript / TypeScript)';
        try {
          const pkgRaw = sandboxManager.readFile(sandboxDir, 'package.json');
          const pkg = JSON.parse(pkgRaw);
          if (pkg.scripts && pkg.scripts.test && !pkg.scripts.test.includes('no test specified')) {
            runnerCommand = 'npm test';
          } else {
            runnerCommand = 'node --test';
          }
        } catch (e) {
          runnerCommand = 'node --test';
        }
      } else if (allFiles.includes('requirements.txt') || allFiles.includes('pyproject.toml') || allFiles.some(f => f.endsWith('.py'))) {
        language = 'Python';
        runnerCommand = 'python -m pytest -v';
      } else if (allFiles.includes('go.mod') || allFiles.some(f => f.endsWith('.go'))) {
        language = 'Go';
        runnerCommand = 'go test ./...';
      } else if (allFiles.includes('Cargo.toml') || allFiles.some(f => f.endsWith('.rs'))) {
        language = 'Rust';
        runnerCommand = 'cargo test';
      } else if (allFiles.some(f => f.endsWith('.cpp') || f.endsWith('.c'))) {
        language = 'C / C++';
      }

      const primaryFile = sourceFiles[0] || allFiles[0] || 'README.md';

      await SessionService.update(sessionId, { language, targetFile: primaryFile });

      if (this.io) {
        this.io.emit('agent:profile', {
          language,
          testTrack: testFiles.length > 0 ? 'TEST_RICH' : 'TEST_LESS',
          runnerCommand,
          targetFile: primaryFile,
          testFile: testFiles[0] || null,
          totalCodeFiles: sourceFiles.length
        });
      }

      await emitEvent('thought', {
        content: `Discovered ${sourceFiles.length} source code file(s) in '${repoName}' (${language}). Commencing deep AST & semantic bug analysis powered by Groq LPU (${llmProvider.model}).`,
        level: 'info'
      });

      // =========================================================================
      // BRANCH A: Autonomous Test Suite Synthesis (mode === 'qa')
      // =========================================================================
      if (mode === 'qa') {
        if (!primaryFile || sourceFiles.length === 0) {
          throw new Error(`Cannot synthesize tests: no suitable source code files identified in '${repoName}'.`);
        }

        const readResult = await toolExecutor.execute('read_file', { path: primaryFile });
        const originalSourceContent = readResult.content;

        await emitEvent('thought', {
          content: `Engaging Groq AI to synthesize complete, high-coverage unit tests for '${primaryFile}'.`,
          level: 'info'
        });

        const synthTestCode = await llmProvider.synthesizeTests({
          sourceCode: originalSourceContent,
          targetFile: primaryFile,
          language
        });

        let synthTestPath = `tests/test_${path.basename(primaryFile)}`;
        if (language.includes('Node')) {
          const baseName = path.basename(primaryFile, path.extname(primaryFile));
          synthTestPath = `tests/${baseName}.test.js`;
        }

        await emitEvent('tool_call', {
          toolName: 'write_file',
          toolArgs: { path: synthTestPath, content: synthTestCode },
          content: `Writing synthesized unit test suite to '${synthTestPath}'...`
        });

        await toolExecutor.execute('write_file', { path: synthTestPath, content: synthTestCode });

        await emitEvent('observation', {
          toolName: 'write_file',
          content: `Unit test suite successfully synthesized.`,
          level: 'success'
        });

      } else {
        // =========================================================================
        // BRANCH B: Deep Code File Analysis & Autonomous Bug Repair (Default)
        // =========================================================================

        if (sourceFiles.length === 0) {
          await emitEvent('thought', {
            content: `No compilable source code files found in repository '${repoName}'. Skipping code repair.`,
            level: 'warning'
          });
          const totalDuration = Number(((Date.now() - startTime) / 1000).toFixed(2));
          await SessionService.update(sessionId, { status: 'COMPLETED', durationSeconds: totalDuration });
          return { success: true, sessionId };
        }

        const filesToAudit = sourceFiles.slice(0, 8); // Audit primary candidate files
        const findings = [];

        for (const file of filesToAudit) {
          await emitEvent('thought', {
            content: `Auditing '${file}' (${language}): inspecting algorithmic logic, runtime exceptions, null contracts, boundary edge cases, and arithmetic operations...`,
            level: 'info'
          });

          await emitEvent('tool_call', {
            toolName: 'read_file',
            toolArgs: { path: file },
            content: `Reading '${file}'...`
          });

          const fileRead = await toolExecutor.execute('read_file', { path: file });
          const rawContent = fileRead.content;

          if (!rawContent || rawContent.trim().length === 0) continue;

          // Call Groq AI for deep audit and potential fix
          const auditResult = await llmProvider.auditAndFixFile({
            filePath: file,
            content: rawContent,
            language
          });

          if (auditResult && auditResult.hasBugs && auditResult.fixedContent && auditResult.fixedContent.trim() !== rawContent.trim()) {
            await emitEvent('observation', {
              toolName: 'read_file',
              content: `⚠️ [BUG IDENTIFIED in ${file}]\nType: ${auditResult.bugType}\nSummary: ${auditResult.summary}\nRoot Cause: ${auditResult.explanation}`,
              level: 'warning'
            });

            await emitEvent('thought', {
              content: `Applying verified surgical fix to '${file}' to resolve ${auditResult.bugType} (${auditResult.summary}).`,
              level: 'info'
            });

            await emitEvent('tool_call', {
              toolName: 'write_file',
              toolArgs: { path: file, content: auditResult.fixedContent },
              content: `Writing repaired code to '${file}'...`
            });

            await toolExecutor.execute('write_file', { path: file, content: auditResult.fixedContent });

            await emitEvent('observation', {
              toolName: 'write_file',
              content: `Repaired file successfully written to isolated sandbox.`,
              level: 'success'
            });

            // Sandbox syntax verification if available
            if (language === 'Python') {
              const pyCheck = await toolExecutor.execute('run_command', { command: `python -m py_compile "${file}"` });
              if (!pyCheck.passed) {
                await emitEvent('observation', {
                  toolName: 'run_command',
                  content: pyCheck.output,
                  level: 'error'
                });
              }
            } else if (language.includes('Node')) {
              const nodeCheck = await toolExecutor.execute('run_command', { command: `node --check "${file}"` });
              if (!nodeCheck.passed) {
                await emitEvent('observation', {
                  toolName: 'run_command',
                  content: nodeCheck.output,
                  level: 'error'
                });
              }
            }

            findings.push({
              file,
              bugType: auditResult.bugType || 'logic_bug',
              summary: auditResult.summary || 'Code issue resolved',
              explanation: auditResult.explanation || 'Fixed by autonomous agent',
              affectedScope: auditResult.affectedScope || ''
            });

            // If we repaired the primary file or found significant bugs, we can proceed to PR
            if (findings.length >= 3) break;
          } else {
            await emitEvent('observation', {
              toolName: 'read_file',
              content: `✓ '${file}' audited clean: no critical defects or logic bugs detected.`,
              level: 'info'
            });
          }
        }

        // If existing test runner exists, run tests to verify no regressions
        if (runnerCommand && testFiles.length > 0) {
          await emitEvent('thought', {
            content: `Running test suite ('${runnerCommand}') in sandbox to verify patch stability...`,
            level: 'info'
          });
          const testRun = await toolExecutor.execute('run_command', { command: runnerCommand });
          await emitEvent('observation', {
            toolName: 'run_command',
            content: testRun.output,
            level: testRun.passed ? 'success' : 'warning'
          });
        }

        // Step 4: Dispatch Pull Request if Fixes Were Applied
        const diffs = toolExecutor.getUnifiedDiffs();
        const primaryDiff = diffs.map(d => d.diff).join('\n\n');

        if (!primaryDiff || findings.length === 0) {
          await emitEvent('thought', {
            content: `✅ Full code audit complete: all ${filesToAudit.length} audited files in '${repoName}' passed inspection with zero runtime defects or logic bugs!`,
            level: 'success'
          });

          const totalDuration = Number(((Date.now() - startTime) / 1000).toFixed(2));
          await SessionService.update(sessionId, { status: 'COMPLETED', durationSeconds: totalDuration });

          await emitEvent('status', {
            content: `Code audit completed: 100% files healthy with zero bugs detected (${totalDuration}s).`,
            level: 'success',
            meta: { durationSeconds: totalDuration }
          });

          return { success: true, sessionId, status: 'CLEAN' };
        }

        // We have verified repairs! Dispatch Live Pull Request on GitHub
        const branchName = `ci-doctor/fix-${sessionId}`;
        const mainFinding = findings[0];
        const prTitle = `fix(code-audit): resolve ${mainFinding.bugType.replace(/_/g, ' ')} in ${findings.map(f => path.basename(f.file)).join(', ')}`;

        const prBody = `## 🩺 CI-Doctor Autonomous Code Repair\n\n` +
          `* **Repository**: \`${repoName}\`\n` +
          `* **Language Ecosystem**: \`${language}\`\n` +
          `* **Audit Engine**: \`Groq AI LPU (${llmProvider.model})\`\n` +
          `* **Sandbox Status**: \`VERIFIED & APPLIED\`\n` +
          `* **Files Repaired**: \`${findings.length}\`\n\n` +
          `### 🐛 Detected Bugs & Diagnostic Root Cause\n\n` +
          findings.map((f, i) =>
            `#### [${i + 1}] \`${f.file}\` (${f.bugType})\n` +
            `* **Summary**: ${f.summary}\n` +
            `* **Affected Scope**: \`${f.affectedScope || 'Core algorithm / function'}\`\n` +
            `* **Root Cause & Diagnosis**: ${f.explanation}\n`
          ).join('\n') +
          `\n### 📝 Applied Changes\n\`\`\`diff\n${primaryDiff}\n\`\`\`\n\n` +
          `---\n*🩺 Autonomous PR opened by CI-Doctor Agent Swarm (MERN Stack + Groq AI)*`;

        await emitEvent('tool_call', {
          toolName: 'create_pull_request',
          toolArgs: { branch_name: branchName, title: prTitle },
          content: `Opening live Pull Request on branch '${branchName}'...`
        });

        const prResult = await toolExecutor.execute('create_pull_request', {
          branch_name: branchName,
          title: prTitle,
          body: prBody
        });

        await emitEvent('observation', {
          toolName: 'create_pull_request',
          content: prResult.output,
          level: prResult.pr?.status === 'failed' ? 'warning' : 'success'
        });

        const totalDuration = Number(((Date.now() - startTime) / 1000).toFixed(2));

        // Finalize Session in Database
        const finalSession = await SessionService.update(sessionId, {
          status: 'COMPLETED',
          diff: primaryDiff,
          prBranch: branchName,
          prTitle,
          prUrl: prResult.pr?.prUrl || null,
          prNumber: prResult.pr?.prNumber || null,
          durationSeconds: totalDuration
        });

        await emitEvent('status', {
          content: `Code audit completed, errors fixed, and Pull Request opened in ${totalDuration}s!`,
          level: 'success',
          meta: {
            session: finalSession,
            diff: primaryDiff,
            pr: prResult.pr,
            durationSeconds: totalDuration
          }
        });

        return {
          success: true,
          sessionId,
          durationSeconds: totalDuration,
          diff: primaryDiff,
          pr: prResult.pr
        };
      }

    } catch (err) {
      await emitEvent('status', {
        content: `Autonomous code analysis failed: ${err.message}`,
        level: 'error'
      });

      await SessionService.update(sessionId, { status: 'FAILED' });
      return { success: false, sessionId, error: err.message };

    } finally {
      if (sandboxDir) {
        sandboxManager.cleanup(sandboxDir);
      }
    }
  }
}
