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

app.get('/api/scenarios', (req, res) => {
  res.json([
    {
      id: 'python_logic',
      name: 'Python: Logic Error',
      language: 'Python 3.13',
      runner: 'pytest',
      icon: '🐍',
      track: 'Track 1: Suite Verified',
      description: 'Assertion error in src/calculator.py. Subtracts instead of adds.'
    },
    {
      id: 'python_divide',
      name: 'Python: Reflection Loop',
      language: 'Python 3.13',
      runner: 'pytest',
      icon: '🔁',
      track: 'Track 1: Reflection Loop',
      description: 'Zero-division bug triggering agent reflection loop until ValueError is raised.'
    },
    {
      id: 'node_cart',
      name: 'Node.js: Cart Logic',
      language: 'Node.js 22',
      runner: 'node:test',
      icon: '🟨',
      track: 'Track 1: Suite Verified',
      description: 'E-commerce discount bug in src/cart.js tested with native zero-dependency runner.'
    },
    {
      id: 'testless_qa',
      name: 'Test-Less: Auto-QA',
      language: 'Python / Polyglot',
      runner: 'Auto-QA Synthesizer',
      icon: '🧪',
      track: 'Track 2: Autonomous QA (Zero Tests)',
      description: 'Repository contains 0 tests. Agent synthesizes reproduction test and commits both fix + test in PR.'
    }
  ]);
});

app.post('/api/simulate', async (req, res) => {
  const scenario = req.body?.scenario || 'python_logic';
  let targetRepoPath = path.join(PROJECT_ROOT, 'demo_repo');
  let repoName = req.body?.targetRepo || process.env.GITHUB_REPO || 'enterprise-team/ci-doctor-demo';

  if (scenario === 'python_logic') {
    targetRepoPath = path.join(PROJECT_ROOT, 'demo_repo');
    const calcFile = path.join(targetRepoPath, 'src/calculator.py');
    fs.mkdirSync(path.dirname(calcFile), { recursive: true });
    fs.writeFileSync(calcFile, `# Injected Logic Error
def add(a: int, b: int) -> int:
    return a - b  # \u274c BUG: Subtracting instead of adding

def multiply(a: int, b: int) -> int:
    return a * b

def divide(a: int, b: int) -> float:
    if b == 0:
        raise ValueError("Cannot divide by zero")
    return a / b
`, 'utf-8');

  } else if (scenario === 'python_divide') {
    targetRepoPath = path.join(PROJECT_ROOT, 'demo_repo');
    const calcFile = path.join(targetRepoPath, 'src/calculator.py');
    fs.mkdirSync(path.dirname(calcFile), { recursive: true });
    fs.writeFileSync(calcFile, `# Injected Zero Division Bug
def add(a: int, b: int) -> int:
    return a + b

def multiply(a: int, b: int) -> int:
    return a * b

def divide(a: int, b: int) -> float:
    # \u274c BUG: No guard against zero
    return a / b
`, 'utf-8');

  } else if (scenario === 'node_cart') {
    targetRepoPath = path.join(PROJECT_ROOT, 'demo_repo_node');
    repoName = 'enterprise-team/cart-microservice';
    const cartFile = path.join(targetRepoPath, 'src/cart.js');
    fs.mkdirSync(path.dirname(cartFile), { recursive: true });
    fs.writeFileSync(cartFile, `// E-Commerce Cart Service
function calculateSubtotal(items) {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function calculateTotal(items, discountRate = 0) {
    const subtotal = calculateSubtotal(items);
    const discountAmount = subtotal * discountRate;
    // \u274c BUG: Adding discount instead of subtracting
    return Number((subtotal + discountAmount).toFixed(2));
}

module.exports = { calculateSubtotal, calculateTotal };
`, 'utf-8');

  } else if (scenario === 'testless_qa') {
    targetRepoPath = path.join(PROJECT_ROOT, 'demo_repo_testless');
    repoName = 'enterprise-team/tax-settlement-service';
    const taxFile = path.join(targetRepoPath, 'src/tax_calculator.py');
    fs.mkdirSync(path.dirname(taxFile), { recursive: true });
    fs.writeFileSync(taxFile, `# Financial Tax Service (Zero Unit Tests)
def calculate_total(price: float, tax_rate: float) -> float:
    # \u274c BUG: Subtracting tax instead of adding
    return round(price - (price * tax_rate), 2)
`, 'utf-8');
  }

  // Launch Autonomous Agent
  setTimeout(() => {
    agent.run({
      repoPath: targetRepoPath,
      repoName
    }).catch(err => console.error('[Agent Engine Error]', err));
  }, 100);

  res.json({
    status: 'agent_started',
    scenario,
    repoName,
    message: `Autonomous Agent activated for '${scenario}'. Streaming live via WebSockets.`
  });
});

app.post('/api/analyze-repo', async (req, res) => {
  const repoPath = req.body?.repoPath || path.join(PROJECT_ROOT, 'demo_repo');
  const repoName = req.body?.repoName || path.basename(repoPath);

  if (!fs.existsSync(repoPath)) {
    return res.status(404).json({ error: `Directory '${repoPath}' not found on server.` });
  }

  setTimeout(() => {
    agent.run({ repoPath, repoName }).catch(err => console.error('[Agent Error]', err));
  }, 100);

  res.json({
    status: 'agent_started',
    repoPath,
    repoName
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
  const { repoFullName, branch } = req.body;
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
        repoName: repoFullName
      }).catch(err => console.error('[Agent Error on Developer Repo]', err));
    }, 100);

    res.json({
      status: 'agent_started',
      repoFullName,
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
      const repoName = payload.repository?.full_name || 'external/repo';
      // In webhook mode, analyzes demo repo or target repo
      setTimeout(() => {
        agent.run({
          repoPath: path.join(PROJECT_ROOT, 'demo_repo'),
          repoName
        }).catch(console.error);
      }, 100);
      return res.json({ status: 'dispatched', message: 'CI-Doctor Agent swarm activated from GitHub webhook.' });
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
