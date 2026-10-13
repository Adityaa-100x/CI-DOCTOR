# 🩺 CI-Doctor — Universal Autonomous Self-Healing CI/CD Swarm

> **Full MERN Stack (MongoDB, Express, React, Node.js) + Autonomous AI Agent Swarm that listens to broken GitHub Actions runs across ANY language or framework, autonomously explores the project AST, executes tests in isolated sandboxes, self-corrects via reflection loops, and opens verified Pull Requests on isolated branches.**

---

## 🌟 The Vision & MERN + AI Architecture

```
[Developer Pushes Code to GitHub] ──> [CI / Test Suite Fails ❌]
                                                    │
                                                    ▼ (Webhook: workflow_run / push)
                                     [Smee.io / Local API Relay]
                                                    │
                                                    ▼
                       [Express.js & Socket.io Real-Time Event Hub]
                                                    │
                     ┌──────────────────────────────┴──────────────────────────────┐
                     │                                                             │
                     ▼                                                             ▼
       [Autonomous ReAct AI Agent]                                     [React 18 Mission Control UI]
       - Google Gemini AI / ReAct Loop Engine                         - Real-Time Socket.io Mind Stream
       - Tool 1: list_directory(path)                                 - 1-Click Polyglot Scenario Launcher
       - Tool 2: read_file(path) & AST Inspector                      - Live 5-Stage Animated Stepper
       - Tool 3: run_command(cmd) in Isolated Sandbox                 - Syntax-Highlighted Diff Viewer
       - Tool 4: write_file(path, patch)                              - Ready-to-Merge Pull Request Card
       - Tool 5: create_pull_request(branch, title)                                │
                     │                                                             │
                     ▼                                                             │
       [Ephemeral Multi-Runtime Sandbox]                                           │
       - Ephemeral workspace in OS scratch directory                               │
       - Executes Pytest, Node:test, Go Test, Cargo                                │
       - 🔁 Reflection Loop: Self-corrects on stderr                               │
                     │                                                             │
                     ▼                                                             │
       [MongoDB & Mongoose Database Layer] <───────────────────────────────────────┘
       - Persists Sessions, MTTR Latencies, Diffs, and ReAct Thought Traces
```

---

## 🛠️ Complete MERN Technology Stack

| Layer | Technology | Role in Architecture |
|---|---|---|
| **Frontend** | **React 18 + Vite** | Hyper-modern dark-mode dashboard with glassmorphism and real-time state |
| **Styling** | **Custom Vanilla CSS3** | Luxury design system with fluid animations, glowing status indicators, and responsive grid |
| **Backend** | **Express.js & Node.js 22** | High-throughput asynchronous REST API and GitHub webhook ingestion |
| **Real-Time Bus** | **Socket.io** | Sub-millisecond bidirectional event streaming of Agent thoughts and terminal logs |
| **Database** | **MongoDB & Mongoose ODM** | Persistent storage for session histories, MTTR metrics, and step-by-step ReAct logs |
| **AI Agent Core** | **Autonomous ReAct Loop** | Tool-calling reasoning loop (Thought $\rightarrow$ Action $\rightarrow$ Observation $\rightarrow$ Reflection) |
| **AI Intelligence** | **Google Gemini (google-genai)** | State-of-the-art LLM code analysis, AST reasoning, and patch synthesis |
| **Sandbox Isolation** | **Ephemeral Child Processes** | Isolated scratch workspace enforcing timeouts, process isolation, and exit code proofs |
| **Version Control** | **GitHub Octokit REST API** | Automated branch creation (`ci-doctor/fix-...`), commits, and Pull Requests |

---

## 🚀 Key Advantages for Viva / TechExpo Judges

1. **True Autonomous Agent (Not Static Scripts)**:
   - Operates a genuine **ReAct Agent Loop** with tool execution (`list_directory`, `read_file`, `run_command`, `write_file`, `create_pull_request`).
   - Examiners can watch the AI **think, choose a tool, inspect the error output, self-correct, and verify with tests**.

2. **Universal Polyglot Scope (Pillar 2)**:
   - Analyzes projects irrespective of language or framework: **Python** (`pytest`), **Node.js/TypeScript** (`node:test`, `npm test`), and **Go**.

3. **Pillar 3: Test-Agnostic Healing (Auto-QA)**:
   - When a repository has **zero unit tests**, CI-Doctor synthesizes an autonomous reproduction test fixture to prove the bug, verifies the patch against it, and commits **BOTH** the fix and the new test suite to the PR!

4. **Zero-Trust Verification & Reflection Loop**:
   - The AI never trusts its own output. A patch is only approved if executed in an isolated sandbox returning **Exit Code 0**.

5. **100% Deterministic Offline Viva Mode**:
   - Guaranteed presentation reliability: works with live Gemini AI + GitHub tokens, or in zero-latency offline mode without failing at the venue.

---

## 📂 Project Directory Structure

```
TechExpo/
├── server/                      # MERN Backend (Express, Node, MongoDB, Socket.io, AI Agent)
│   ├── src/
│   │   ├── agent/
│   │   │   ├── autonomousAgent.js # ReAct Autonomous Loop (Thought -> Tool -> Observation)
│   │   │   ├── tools.js           # Agent Tools (File I/O, Command Execution, PR Creation)
│   │   │   ├── prompts.js         # System Prompt & Engineering Rules
│   │   │   └── llm.js             # Google Gemini AI Integration & Viva Engine
│   │   ├── models/
│   │   │   ├── Session.js         # Mongoose Model for Swarm Sessions
│   │   │   └── AgentLog.js        # Mongoose Model for ReAct Step Telemetry
│   │   ├── sandbox/
│   │   │   └── sandboxManager.js  # Ephemeral Multi-Runtime Sandbox & Diff Generator
│   │   ├── github/
│   │   │   └── githubService.js   # GitHub REST API / Webhooks / Octokit PR Dispatcher
│   │   ├── db/
│   │   │   └── connection.js      # Resilient MongoDB / In-Memory Persistence Layer
│   │   └── server.js              # Express REST APIs & Socket.io WebSocket Hub
│   └── package.json
├── client/                      # MERN Frontend (React 18, Vite, Custom CSS)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx         # Global Header with Live Connection Badges
│   │   │   ├── ScenarioBar.jsx    # 1-Click Polyglot Scenario Launcher
│   │   │   ├── PipelineRibbon.jsx # MTTR Latency, Ecosystem Pill, Track Badge
│   │   │   ├── StepperGraph.jsx   # 5-Stage Animated Pipeline Stepper
│   │   │   ├── AgentMindStream.jsx# Real-Time ReAct Terminal (Thoughts & Tool Calls)
│   │   │   └── DiffInspector.jsx  # Syntax-Highlighted Unified Diff & PR Card
│   │   ├── App.jsx                # Main Application State & Socket.io Controller
│   │   ├── index.css              # Custom Luxury Dark Theme Design System
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── demo_repo/                   # Target Python Codebase (Logic Bug & Reflection Loop)
├── demo_repo_node/              # Target Node.js Codebase (E-commerce Cart Logic Bug)
├── demo_repo_testless/          # Target Zero-Test Codebase (Auto-QA Synthesis)
├── run.js                       # Unified Server Runner
└── start_presentation.bat       # Windows 1-Click Presenter Launcher
```

---

## ⚡ Quick Start

```powershell
# 1. Launch the server (or double-click start_presentation.bat)
node run.js

# 2. Open Mission Control in browser:
# http://localhost:5000/
```

Click any demo scenario button in the top toolbar to watch the autonomous agent explore the workspace, execute tests, synthesize patches, and generate verified Pull Requests!
