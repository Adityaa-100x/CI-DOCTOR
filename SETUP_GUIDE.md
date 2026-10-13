# 🩺 CI-Doctor: Complete Teammate Setup & Presentation Manual

Welcome to **CI-Doctor** (Universal Autonomous Self-Healing CI/CD Swarm built on the **MERN Stack + AI**). Follow this guide to set up and run the project on any Windows, macOS, or Linux machine in under 2 minutes.

---

## 📋 System Prerequisites

Make sure the following tools are installed:

| Tool | Minimum Version | Purpose | Required? |
|---|---|---|---|
| **Node.js** | `v18.0.0+` (v20 or v22 recommended) | Backend runtime, npm package manager, and sandbox execution | **Yes (Mandatory)** |
| **Git** | Any recent version | Cloning repository and git operations | **Yes (Mandatory)** |
| **Python** + `pytest` | `3.8+` | Running Python pytest sandbox scenarios ([01] & [02]) | Recommended (`pip install pytest`) |
| **MongoDB** | `v6.0+` | Session history persistence | *Optional* (In-memory storage is active by default) |
| **GitHub Token** | Personal Access Token | Opening live PRs on GitHub | *Optional* (Offline simulation mode works out of the box) |

---

## ⚡ Quick Start: 3-Step Setup

### Step 1: Clone the Repository
```bash
git clone <your-repository-url>
cd TechExpo
```

### Step 2: Install Dependencies & Build Frontend

You need to install packages for both the **server** and the **client**:

#### 1. Backend (`server`):
```bash
cd server
npm install
cd ..
```

#### 2. Frontend (`client`):
```bash
cd client
npm install
npm run build
cd ..
```
> *(The `npm run build` command compiles the React 18 Neo-Brutalist UI into `client/dist`, which Express serves on port 5000.)*

---

### Step 3: Run the Application

#### Windows (1-Click):
Double click **`start_presentation.bat`** in the project root.

#### Terminal (Cross-Platform: Windows / macOS / Linux):
From the project root (`TechExpo`):
```bash
node run.js
```
*(Or `cd server && npm start`)*

---

### Step 4: Open Mission Control

Open your browser to:
👉 **[http://localhost:5000/](http://localhost:5000/)**

Click any scenario button on the left sidebar (`[01] Python Logic`, `[02] ReAct Loop`, `[03] Node.js Cart`, `[04] Zero-Tests QA`) to trigger the autonomous self-healing agent!

---

## ⚙️ (Optional) Environment Configuration

If your teammate wants to connect real GitHub repositories or live Google Gemini AI:

1. Copy `.env.example` into `server/.env`:
   ```bash
   cp .env.example server/.env
   ```
2. Open `server/.env` and supply:
   - `GITHUB_TOKEN`: Classic GitHub PAT with `repo` and `workflow` scopes.
   - `GITHUB_REPO`: `owner/repo-name`
   - `GEMINI_API_KEY`: Free key from [Google AI Studio](https://aistudio.google.com/).
   - `MONGODB_URI`: (Optional) `mongodb://localhost:27017/ci-doctor`

> If no keys are provided, CI-Doctor automatically runs in **100% Reliable Viva Mode** with deterministic heuristics and simulated pull requests.

---

## 💻 Frontend Development Mode (Hot-Reload)

If your teammate wants to make real-time changes to the React code:

- **Terminal 1 (Backend):**
  ```bash
  cd server
  npm run dev
  ```
- **Terminal 2 (Frontend with Vite HMR):**
  ```bash
  cd client
  npm run dev
  ```
  Dashboard available at `http://localhost:5173/` (proxied to Express on `5000`).

---

## ❓ Common Troubleshooting

### 1. `Error: listen EADDRINUSE: address already in use :::5000`
- **Cause:** Another process is already running on port 5000.
- **Fix (Windows):**
  ```powershell
  Stop-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess -Force
  ```
- **Fix (macOS/Linux):**
  ```bash
  lsof -ti:5000 | xargs kill -9
  ```

### 2. Python Scenario fails with `pytest: command not found`
- **Fix:** Install pytest:
  ```bash
  pip install pytest
  ```
  *(Or run Scenario `[03] Node.js Cart Logic` which uses native Node.js and requires no Python!)*
