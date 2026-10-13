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

app.post('/api/github/analyze-user-repo', async (req, res) => {
  const { repoFullName, branch, mode = 'heal' } = req.body;
  if (!repoFullName) {
    return res.status(400).json({ error: 'repoFullName is required (e.g. username/repo)' });
  }

  const sessionId = uuidv4().substring(0, 8);
  const tempCloneDir = path.join(PROJECT_ROOT, '.sandbox_clones', `${repoFullName.replace('/', '_')}_${sessionId}`);
  fs.mkdirSync(path.dirname(tempCloneDir), { recursive: true });

  try {
    await githubService.cloneRepository(repoFullName, tempCloneDir, branch);

    setTimeout(() => {
      agent.run({
        repoPath: tempCloneDir,
        repoName: repoFullName,
        mode
      }).catch(err => console.error('[Agent Error on Developer Repo]', err));
    }, 100);

    res.json({
      status: 'agent_started',
      repoFullName,
      mode,
      message: `Autonomous CI-Doctor swarm activated on '${repoFullName}'. Pull Request will be dispatched upon resolution.`
    });
  } catch (err) {
    console.error('[Clone Error]', err);
    res.status(500).json({ error: `Could not clone repository '${repoFullName}': ${err.message}` });
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
