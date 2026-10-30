import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { connectDB, isDbConnected } from './db/connection.js';
import { SessionService } from './models/Session.js';
import { AgentLogService } from './models/AgentLog.js';
import { AutonomousEngineerAgent } from './agent/autonomousAgent.js';
import { githubService } from './github/githubService.js';
import { llmProvider } from './agent/llm.js';
import { sandboxManager } from './sandbox/sandboxManager.js';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');

// Load environment variables from server/.env or project root .env
dotenv.config();
if (fs.existsSync(path.join(PROJECT_ROOT, '.env'))) {
  dotenv.config({ path: path.join(PROJECT_ROOT, '.env'), override: true });
}

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Initialize MongoDB Connection
await connectDB();

const agent = new AutonomousEngineerAgent(io);

// Socket.io Connection Handler
io.on('connection', (socket) => {
  console.log('[WebSocket] Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('[WebSocket] Client disconnected:', socket.id);
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    version: '2.0.0 (MERN)',
    database: isDbConnected() ? 'mongodb_connected' : 'in_memory_persistence',
    github_configured: githubService.isConfigured(),
    groq_configured: llmProvider.isLiveAIConfigured(),
    groq_model: llmProvider.model,
    target_repo: process.env.GITHUB_REPO || null
  });
});

// Developer Repository Discovery & Activation Endpoints
app.get('/api/github/user', async (req, res) => {
  try {
    const user = await githubService.getAuthenticatedUser();
    res.json({ user, configured: githubService.isConfigured() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/github/repos', async (req, res) => {
  try {
    const username = req.query.username || '';
    const repos = await githubService.listUserRepositories(username);
    res.json({ repos });
  } catch (err) {
    res.status(500).json({ error: err.message, repos: [] });
  }
});

app.get('/api/github/repo-files', async (req, res) => {
  const { repoFullName, branch } = req.query;
  if (!repoFullName) return res.status(400).json({ error: 'repoFullName is required' });
  try {
    const files = await githubService.listRepoSourceFiles(repoFullName, branch);
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message, files: [] });
  }
});

// Real GitHub Actions Workflow Runs
app.get('/api/github/workflow-runs', async (req, res) => {
  const { repoFullName } = req.query;
  if (!repoFullName) return res.status(400).json({ error: 'repoFullName is required' });
  try {
    const runsData = await githubService.getWorkflowRuns(repoFullName);
    res.json(runsData);
  } catch (err) {
    res.status(500).json({ error: err.message, total_count: 0, runs: [] });
  }
});

// Check Live Pull Request Status (Open, Merged, Closed)
app.get('/api/github/pr-status', async (req, res) => {
  const { repoFullName, prNumber } = req.query;
  if (!repoFullName || !prNumber) return res.status(400).json({ error: 'repoFullName and prNumber are required' });
  try {
    const prStatus = await githubService.getPullRequestStatus(repoFullName, parseInt(prNumber, 10));
    res.json({ pr: prStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deploy Real GitHub Actions CI Workflow to Developer's Repository
app.post('/api/github/deploy-ci-workflow', async (req, res) => {
  const { repoFullName, branch = 'main' } = req.body;
  if (!repoFullName) return res.status(400).json({ error: 'repoFullName is required' });
  try {
    const result = await githubService.deployCIWorkflow(repoFullName, branch);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Autonomous Healing of a Specific Failed GitHub Actions Workflow Run
app.post('/api/github/heal-workflow-run', async (req, res) => {
  const { repoFullName, runId, branch = 'main', humanInTheLoop = false } = req.body;
  if (!repoFullName || !runId) {
    return res.status(400).json({ error: 'repoFullName and runId are required' });
  }

  const sessionId = uuidv4().substring(0, 8);
  const tempCloneDir = path.join(PROJECT_ROOT, '.sandbox_clones', `${repoFullName.replace(/[/\\:]/g, '_')}_ci_${runId}_${sessionId}`);
  fs.mkdirSync(path.dirname(tempCloneDir), { recursive: true });

  try {
    console.log(`[CI Ingestion] Fetching real GitHub Actions failure logs for run #${runId} on '${repoFullName}'...`);
    const logsData = await githubService.getWorkflowRunJobLogs(repoFullName, runId);

    // Clone repository at the branch
    await githubService.cloneRepository(repoFullName, tempCloneDir, branch);

    // Trigger autonomous swarm with failure logs
    setTimeout(() => {
      agent.run({
        repoPath: tempCloneDir,
        repoName: repoFullName,
        branch,
        mode: 'ci_heal',
        humanInTheLoop,
        ciRunInfo: {
          runId,
          jobId: logsData.jobId,
          jobName: logsData.jobName,
          htmlUrl: logsData.htmlUrl
        },
        failureLogs: logsData.logs
      }).catch(err => console.error('[Agent CI Heal Error]', err));
    }, 100);

    res.json({
      status: 'ci_healing_started',
      repoFullName,
      runId,
      jobName: logsData.jobName,
      message: `Autonomous CI-Doctor swarm activated on failing GitHub Actions run #${runId}. Ingesting real logs...`
    });
  } catch (err) {
    console.error('[Heal Workflow Run Error]', err);
    res.status(500).json({ error: `Could not initialize CI healing for run #${runId}: ${err.message}` });
  }
});

app.get('/api/scenarios', (req, res) => {
  res.json({ scenarios: [] });
});

app.post('/api/github/analyze-user-repo', async (req, res) => {
  const { repoFullName, branch, mode = 'heal', humanInTheLoop = false, targetFile = null } = req.body;
  if (!repoFullName) {
    return res.status(400).json({ error: 'repoFullName is required (e.g. username/repo)' });
  }

  const sessionId = uuidv4().substring(0, 8);
  const tempCloneDir = path.join(PROJECT_ROOT, '.sandbox_clones', `${repoFullName.replace(/[/\\:]/g, '_')}_${sessionId}`);
  fs.mkdirSync(path.dirname(tempCloneDir), { recursive: true });

  try {
    if (repoFullName.startsWith('demo/')) {
      const scenarioKey = repoFullName.replace('demo/', '');
      const scenarioSource = path.join(__dirname, 'scenarios', scenarioKey);
      if (!fs.existsSync(scenarioSource)) {
        throw new Error(`Demo scenario '${scenarioKey}' not found at ${scenarioSource}`);
      }
      sandboxManager._copyRecursiveSync(scenarioSource, tempCloneDir);
      console.log(`[Scenarios] Loaded demo scenario '${scenarioKey}' into sandbox clone '${tempCloneDir}'`);
    } else {
      await githubService.cloneRepository(repoFullName, tempCloneDir, branch);
    }

    setTimeout(() => {
      agent.run({
        repoPath: tempCloneDir,
        repoName: repoFullName,
        branch: branch || 'main',
        mode,
        humanInTheLoop,
        targetFile
      }).catch(err => console.error('[Agent Error on Developer Repo]', err));
    }, 100);

    res.json({
      status: 'agent_started',
      repoFullName,
      mode,
      humanInTheLoop,
      targetFile,
      message: `Autonomous CI-Doctor swarm activated on '${repoFullName}'${targetFile ? ` [Target File: ${targetFile}]` : ''}.`
    });
  } catch (err) {
    console.error('[Clone Error]', err);
    res.status(500).json({ error: `Could not clone or load repository '${repoFullName}': ${err.message}` });
  }
});

// Zero-Trust Gate 5: Human-in-the-Loop PR Dispatch Authorization Endpoint
app.post('/api/github/dispatch-pr', async (req, res) => {
  const { repoFullName, branchName, title, body, changes, sessionId } = req.body;
  if (!repoFullName || !changes) {
    return res.status(400).json({ error: 'repoFullName and changes are required' });
  }

  try {
    console.log(`[Human Gate Approved] Dispatching PR for '${repoFullName}' on branch '${branchName}'...`);
    const prResult = await githubService.createPullRequest({
      repoFullName,
      branchName: branchName || `ci-doctor/fix-${Date.now()}`,
      baseBranch: 'main',
      title: title || 'fix(ci-doctor): verified autonomous repair',
      body: body || 'Patch verified and approved via CI-Doctor Human-in-the-Loop Gate.',
      changes
    });

    if (sessionId) {
      await SessionService.update(sessionId, {
        status: 'COMPLETED',
        prBranch: branchName,
        prTitle: title,
        prUrl: prResult.prUrl || null,
        prNumber: prResult.prNumber || null
      });
    }

    if (io) {
      io.emit('agent:action', {
        sessionId: sessionId || 'human_gate',
        actionType: 'status',
        content: `Human Gate Authorized: Live Pull Request #${prResult.prNumber || 42} dispatched to ${repoFullName}!`,
        level: 'success',
        meta: {
          pr: prResult,
          status: 'COMPLETED'
        }
      });
    }

    res.json({ success: true, pr: prResult });
  } catch (err) {
    console.error('[Dispatch PR Error]', err);
    res.status(500).json({ error: `Failed to dispatch PR: ${err.message}` });
  }
});

app.post('/api/webhook', async (req, res) => {
  const event = req.headers['x-github-event'] || '';
  const payload = req.body || {};

  if (event === 'workflow_run') {
    const action = payload.action;
    const conclusion = payload.workflow_run?.conclusion;

    if (action === 'completed' && conclusion === 'failure') {
      const repoName = payload.repository?.full_name;
      if (!repoName) return res.status(400).json({ error: 'Missing repository' });

      const sessionId = uuidv4().substring(0, 8);
      const tempCloneDir = path.join(PROJECT_ROOT, '.sandbox_clones', `${repoName.replace('/', '_')}_${sessionId}`);
      fs.mkdirSync(path.dirname(tempCloneDir), { recursive: true });

      setTimeout(async () => {
        try {
          await githubService.cloneRepository(repoName, tempCloneDir, payload.workflow_run.head_branch || 'main');
          await agent.run({ repoPath: tempCloneDir, repoName });
        } catch (e) {
          console.error('[Webhook Autonomous Run Error]', e);
        }
      }, 100);

      return res.json({ status: 'dispatched', message: `CI-Doctor Swarm activated for failing CI run on '${repoName}'.` });
    }
  }

  res.json({ status: 'ignored' });
});

app.get('/api/sessions', async (req, res) => {
  const sessions = await SessionService.listRecent();
  res.json(sessions);
});

app.get('/api/sessions/:id', async (req, res) => {
  const session = await SessionService.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const logs = await AgentLogService.getBySession(req.params.id);
  res.json({ session, logs });
});

// Serve Vite build in production if present
const clientDist = path.join(PROJECT_ROOT, 'client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  🩺 CI-Doctor MERN Server Active: http://localhost:${PORT}`);
  console.log(`  📡 WebSocket Bus: ws://localhost:${PORT}`);
  console.log(`=======================================================`);
});
