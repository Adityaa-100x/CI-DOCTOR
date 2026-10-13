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

  async run({ repoPath, repoName, branch = 'main', mode = 'heal', triggerEvent = null, maxTurns = 12 }) {
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

      // 1. Save to MongoDB via Mongoose
      await AgentLogService.append(logEntry);

      // 2. Stream to connected React clients via WebSockets
      if (this.io) {
        this.io.emit('agent:action', { ...logEntry, meta: data.meta });
      }
    };

    try {
      // Step 0: Sandbox Initialization
      await emitEvent('status', {
        content: `Cloning workspace for '${repoName}' into ephemeral isolated sandbox...`,
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
        content: `Commencing autonomous triage for '${repoName}'. Exploring sandbox directory tree to profile manifests and language ecosystem.`,
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

      const files = listResult.files || [];

      // Dynamic language & runner detection
      let language = 'Polyglot';
      let runnerCommand = '';
      let targetFile = '';
      let testFile = '';
      let testTrack = 'TEST_RICH';

      const hasPackageJson = files.includes('package.json');
      const hasPyproject = files.includes('pyproject.toml') || files.includes('requirements.txt') || files.some(f => f.endsWith('.py'));
      const hasGoMod = files.includes('go.mod') || files.some(f => f.endsWith('.go'));
      const hasCargo = files.includes('Cargo.toml');

      if (hasPackageJson) {
        language = 'Node.js (JavaScript)';
        // Detect test script from package.json if possible
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

        // Find primary JS/TS source files
        const jsSourceFiles = files.filter(f =>
          (f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.mjs')) &&
          !f.includes('.test.') &&
          !f.includes('.spec.') &&
          !f.startsWith('tests/') &&
          !f.startsWith('test/') &&
          !f.includes('config')
        );
        targetFile = jsSourceFiles.find(f => f.startsWith('src/') || f.startsWith('lib/')) || jsSourceFiles[0] || '';

        // Find test files
        const jsTestFiles = files.filter(f =>
          (f.includes('.test.') || f.includes('.spec.') || f.startsWith('tests/') || f.startsWith('test/')) &&
          (f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.mjs'))
        );
        testFile = jsTestFiles[0] || '';

      } else if (hasPyproject) {
        language = 'Python';
        runnerCommand = 'python -m pytest -v';

        // Find Python source files
        const pySourceFiles = files.filter(f =>
          f.endsWith('.py') &&
          !path.basename(f).startsWith('test_') &&
          !path.basename(f).endsWith('_test.py') &&
          !f.startsWith('tests/') &&
          !f.startsWith('test/')
        );
        targetFile = pySourceFiles.find(f => f.startsWith('src/') || f.startsWith('lib/')) || pySourceFiles[0] || '';

        // Find Python test files
        const pyTestFiles = files.filter(f =>
          f.endsWith('.py') &&
          (path.basename(f).startsWith('test_') || path.basename(f).endsWith('_test.py') || f.startsWith('tests/') || f.startsWith('test/'))
        );
        testFile = pyTestFiles[0] || '';

      } else if (hasGoMod) {
        language = 'Go';
        runnerCommand = 'go test ./...';
        const goSources = files.filter(f => f.endsWith('.go') && !f.endsWith('_test.go'));
        targetFile = goSources[0] || '';
        const goTests = files.filter(f => f.endsWith('_test.go'));
        testFile = goTests[0] || '';

      } else if (hasCargo) {
        language = 'Rust';
        runnerCommand = 'cargo test';
        const rustSources = files.filter(f => f.endsWith('.rs') && !f.includes('test'));
        targetFile = rustSources[0] || '';
      } else {
        // Fallback: pick first source code file found
        const codeFiles = files.filter(f => !f.startsWith('.') && !f.includes('/.'));
        targetFile = codeFiles.find(f => f.includes('src/') || f.endsWith('.py') || f.endsWith('.js')) || codeFiles[0] || 'README.md';
      }

      if (!testFile) {
        testTrack = 'TEST_LESS';
      }

      if (mode === 'qa') {
        testTrack = 'TEST_LESS';
      }

      await SessionService.update(sessionId, { language, targetFile });

      if (this.io) {
        this.io.emit('agent:profile', {
          language,
          testTrack,
          runnerCommand,
          targetFile,
          testFile
        });
      }

      await emitEvent('thought', {
        content: `Ecosystem identified: ${language}. Mode: ${mode.toUpperCase()}. Primary target file: '${targetFile || 'None'}' | Test suite: '${testFile || 'None detected'}'.`,
        level: 'info'
      });

      let lastErrorOutput = '';
      let patchedContent = '';
      let originalSourceContent = '';

      // If target file exists, read its original content
      if (targetFile) {
        await emitEvent('tool_call', {
          toolName: 'read_file',
          toolArgs: { path: targetFile },
          content: `Reading target source file '${targetFile}'...`
        });
        const readResult = await toolExecutor.execute('read_file', { path: targetFile });
        originalSourceContent = readResult.content;
        await emitEvent('observation', {
          toolName: 'read_file',
          content: readResult.output,
          level: 'info'
        });
      }

      // =========================================================================
      // BRANCH A: Autonomous Test Suite Synthesis (mode === 'qa' or ZERO tests)
      // =========================================================================
      if (mode === 'qa' || testTrack === 'TEST_LESS') {
        if (!targetFile || !originalSourceContent) {
          throw new Error(`Cannot synthesize tests: no suitable source file identified in '${repoName}'.`);
        }

        await emitEvent('thought', {
          content: `Zero unit tests found or QA mode requested. Engaging Groq AI (${llmProvider.model}) to synthesize high-coverage, idiomatic unit tests for '${targetFile}'.`,
          level: 'warning'
        });

        const synthTestCode = await llmProvider.synthesizeTests({
          sourceCode: originalSourceContent,
          targetFile,
          language
        });

        // Determine destination test file path
        let synthTestPath = '';
        if (language.includes('Python')) {
          synthTestPath = `tests/test_${path.basename(targetFile)}`;
          runnerCommand = 'python -m pytest -v';
        } else if (language.includes('Node')) {
          const baseName = path.basename(targetFile, path.extname(targetFile));
          synthTestPath = `tests/${baseName}.test.js`;
          runnerCommand = 'node --test';
        } else if (language.includes('Go')) {
          synthTestPath = targetFile.replace('.go', '_test.go');
          runnerCommand = 'go test ./...';
        } else {
          synthTestPath = `tests/test_${path.basename(targetFile)}`;
        }

        await emitEvent('tool_call', {
          toolName: 'write_file',
          toolArgs: { path: synthTestPath, content: synthTestCode },
          content: `Synthesizing reproduction test suite '${synthTestPath}'...`
        });

        await toolExecutor.execute('write_file', { path: synthTestPath, content: synthTestCode });

        await emitEvent('observation', {
          toolName: 'write_file',
          content: `Synthesized unit test suite written to '${synthTestPath}'. Running in sandbox to verify...`,
          level: 'success'
        });

        // Run the newly synthesized tests
        await emitEvent('tool_call', {
          toolName: 'run_command',
          toolArgs: { command: runnerCommand },
          content: `Executing '${runnerCommand}' in sandbox...`
        });

        const synthRun = await toolExecutor.execute('run_command', { command: runnerCommand });
        await emitEvent('observation', {
          toolName: 'run_command',
          content: synthRun.output,
          level: synthRun.passed ? 'success' : 'error'
        });

        // If tests fail because the source code has a bug, repair the source code
        if (!synthRun.passed) {
          lastErrorOutput = synthRun.output;
          await emitEvent('thought', {
            content: `Synthesized tests revealed a defect in '${targetFile}'. Prompting Groq AI to synthesize verified source fix.`,
            level: 'info'
          });

          const fixedSource = await llmProvider.synthesizeFix({
            brokenCode: originalSourceContent,
            errorOutput: lastErrorOutput,
            testCode: synthTestCode,
            targetFile,
            language
          });

          if (fixedSource && fixedSource !== originalSourceContent) {
            await emitEvent('tool_call', {
              toolName: 'write_file',
              toolArgs: { path: targetFile, content: fixedSource },
              content: `Applying fix to '${targetFile}'...`
            });
            await toolExecutor.execute('write_file', { path: targetFile, content: fixedSource });

            // Re-verify in sandbox
            const verifyRun = await toolExecutor.execute('run_command', { command: runnerCommand });
            await emitEvent('observation', {
              toolName: 'run_command',
              content: verifyRun.output,
              level: verifyRun.passed ? 'success' : 'error'
            });
          }
        }
      }

      // =========================================================================
      // BRANCH B: Autonomous CI Healing (mode === 'heal' and tests exist)
      // =========================================================================
      else {
        await emitEvent('thought', {
          content: `Running native test runner ('${runnerCommand}') to reproduce CI failure and capture compiler/test tracebacks.`,
          level: 'info'
        });

        await emitEvent('tool_call', {
          toolName: 'run_command',
          toolArgs: { command: runnerCommand },
          content: `Executing '${runnerCommand}' in isolated sandbox...`
        });

        const initialTestRun = await toolExecutor.execute('run_command', { command: runnerCommand });
        await emitEvent('observation', {
          toolName: 'run_command',
          content: initialTestRun.output,
          level: initialTestRun.passed ? 'success' : 'error'
        });

        if (initialTestRun.passed) {
          await emitEvent('thought', {
            content: `✅ All tests in '${repoName}' passed cleanly with Exit Code 0. CI pipeline is healthy; no code modifications required.`,
            level: 'success'
          });

          const totalDuration = Number(((Date.now() - startTime) / 1000).toFixed(2));
          await SessionService.update(sessionId, {
            status: 'COMPLETED',
            durationSeconds: totalDuration
          });

          await emitEvent('status', {
            content: `Repository CI check verified: 100% tests passing in ${totalDuration}s.`,
            level: 'success',
            meta: { durationSeconds: totalDuration }
          });

          return { success: true, sessionId, status: 'CLEAN_PASS', durationSeconds: totalDuration };
        }

        lastErrorOutput = initialTestRun.output;

        // Read test file if available
        let testCode = '';
        if (testFile) {
          try {
            const tr = await toolExecutor.execute('read_file', { path: testFile });
            testCode = tr.content || '';
          } catch (e) {}
        }

        // Call Groq AI to synthesize fix
        await emitEvent('thought', {
          content: `⚡ Live Groq AI (${llmProvider.model}) is diagnosing test failure. Synthesizing surgical patch for '${targetFile}'.`,
          level: 'info'
        });

        patchedContent = await llmProvider.synthesizeFix({
          brokenCode: originalSourceContent,
          errorOutput: lastErrorOutput,
          testCode,
          targetFile,
          language
        });

        if (!patchedContent || patchedContent === originalSourceContent) {
          throw new Error(`Groq AI could not generate a differentiated patch for '${targetFile}'.`);
        }

        await emitEvent('tool_call', {
          toolName: 'write_file',
          toolArgs: { path: targetFile, content: patchedContent },
          content: `Applying candidate patch to '${targetFile}'...`
        });

        await toolExecutor.execute('write_file', { path: targetFile, content: patchedContent });

        // Step 4: Verification in Sandbox
        await emitEvent('thought', {
          content: `Verifying candidate patch with '${runnerCommand}' in isolated sandbox...`,
          level: 'info'
        });

        let verifyRun = await toolExecutor.execute('run_command', { command: runnerCommand });
        await emitEvent('observation', {
          toolName: 'run_command',
          content: verifyRun.output,
          level: verifyRun.passed ? 'success' : 'error'
        });

        // Autonomous ReAct Reflection Loop if verification fails
        let reflectionTurn = 0;
        const maxReflectionTurns = 2;
        let candidateAttempt = patchedContent;

        while (!verifyRun.passed && reflectionTurn < maxReflectionTurns) {
          reflectionTurn++;
          await emitEvent('reflection', {
            content: `🔁 ReAct Reflection Turn ${reflectionTurn}/${maxReflectionTurns}: Candidate patch failed sandbox verification. Feeding traceback back to Groq AI for self-correction.`,
            level: 'warning'
          });

          const revisedPatch = await llmProvider.reflectAndFix({
            brokenCode: originalSourceContent,
            previousAttempt: candidateAttempt,
            failureOutput: verifyRun.output,
            testCode,
            targetFile,
            language
          });

          if (revisedPatch && revisedPatch !== candidateAttempt) {
            candidateAttempt = revisedPatch;
            await toolExecutor.execute('write_file', { path: targetFile, content: candidateAttempt });

            verifyRun = await toolExecutor.execute('run_command', { command: runnerCommand });
            await emitEvent('observation', {
              toolName: 'run_command',
              content: verifyRun.output,
              level: verifyRun.passed ? 'success' : 'error'
            });
          } else {
            break;
          }
        }

        if (!verifyRun.passed) {
          throw new Error(`Sandbox verification failed after ${reflectionTurn} reflection turns: ${verifyRun.output.substring(0, 300)}`);
        }
      }

      // Step 5: Generate Unified Diff & Dispatch Live Pull Request
      const diffs = toolExecutor.getUnifiedDiffs();
      const primaryDiff = diffs.map(d => d.diff).join('\n\n');

      if (!primaryDiff) {
        await emitEvent('thought', {
          content: `No code modifications were required. Repository is healthy.`,
          level: 'info'
        });
        return { success: true, sessionId };
      }

      const branchName = `ci-doctor/autonomous-fix-${sessionId}`;
      const prTitle = mode === 'qa'
        ? `test(ci): [${language}] autonomous unit test suite synthesized for ${targetFile || repoName}`
        : `fix(ci): [${language}] resolve build failure in ${targetFile || repoName}`;

      const prBody = `## 🩺 CI-Doctor Autonomous Build Fix\n\n` +
        `* **Repository**: \`${repoName}\`\n` +
        `* **Language Ecosystem**: \`${language}\`\n` +
        `* **Mode**: \`${mode.toUpperCase()}\`\n` +
        `* **Sandbox Status**: \`VERIFIED PASSED (Exit Code 0)\`\n` +
        `* **Command Executed**: \`${runnerCommand}\`\n` +
        `* **Engine**: \`Groq LPU (${llmProvider.model})\`\n\n` +
        `### 📝 Applied Changes\n\`\`\`diff\n${primaryDiff}\n\`\`\`\n`;

      await emitEvent('tool_call', {
        toolName: 'create_pull_request',
        toolArgs: { branch_name: branchName, title: prTitle },
        content: `Opening Pull Request on branch '${branchName}'...`
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
        content: `Build resolved and verified in ${totalDuration}s!`,
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

    } catch (err) {
      await emitEvent('status', {
        content: `Autonomous repair failed: ${err.message}`,
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
