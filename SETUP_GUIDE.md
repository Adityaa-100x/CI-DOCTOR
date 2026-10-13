# 🩺 CI-Doctor: Complete Setup & Viva Presentation Manual

Welcome to **CI-Doctor**! This guide covers everything you need to run the application, connect it to GitHub Actions via Smee.io, or run a **100% offline 3-minute Viva demonstration**.

---

## 🚀 Quick Start (Running in 60 Seconds)

### Step 1: Install Python Dependencies
Open your PowerShell or terminal in `c:\Users\rajua\Documents\TechExpo`:
```powershell
pip install -r backend/requirements.txt
```

### Step 2: (Optional) Set up Environment Variables
If you want to connect to a real GitHub repository and use Google Gemini:
1. Copy `.env.example` to `.env`:
   ```powershell
   cp .env.example .env
   ```
2. Open `.env` and fill in:
   * `GITHUB_TOKEN`: A classic GitHub Personal Access Token with `repo` and `workflow` permissions.
   * `GITHUB_REPO`: `your-username/your-repo`
   * `GEMINI_API_KEY`: Your Gemini API key from [Google AI Studio](https://aistudio.google.com/).

> **Note:** If you don't provide these keys, **CI-Doctor automatically operates in High-Reliability Viva Mode**, using built-in deterministic heuristics and simulated PRs so you can present without relying on external internet or tokens!

### Step 3: Launch CI-Doctor
Run:
```powershell
python run.py
```
This automatically starts the server and opens the **Mission Control Dashboard** at:
👉 **[http://127.0.0.1:8000/](http://127.0.0.1:8000/)**

---

## 🎤 3-Minute Viva Presentation Script & Demo

When demonstrating to examiners, you have **two ways** to present:

### Option A: The 1-Click Interactive Dashboard Demo (Guaranteed 100% Reliability)
1. Open the dashboard at `http://127.0.0.1:8000/`.
2. Show examiners the **Mission Control interface**:
   - Point out the 5-stage pipeline: *Webhook ➔ Agent 1 (Logs) ➔ Agent 2 (Investigator) ➔ Agent 3 (Sandbox) ➔ Agent 4 (PR)*.
3. Click the **"⚡ Run Assertion Demo"** button on the top right.
4. Watch together with examiners as:
   - The status updates in real-time.
   - Terminal logs stream Agent 1 isolating `assert -1 == 5`.
   - Agent 2 analyzes the AST and pinpoints the subtraction bug in `src/calculator.py`.
   - Agent 3 spins up the isolated temp sandbox and verifies the fix with `pytest`.
   - Agent 4 opens the Pull Request with a unified code diff rendered on screen!

---

### Option B: The Live GitHub Webhook Demo (With a Real GitHub Repo)

1. **Get a free Smee.io URL**:
   - Go to [https://smee.io/](https://smee.io/) and click **"Start a new channel"**.
   - Copy the channel URL (e.g. `https://smee.io/abc123xyz`).
2. **Forward Smee to your local server**:
   - In a terminal, run:
     ```bash
     npx smee-client --url https://smee.io/abc123xyz --target http://127.0.0.1:8000/api/webhook
     ```
3. **Configure GitHub Repository Webhook**:
   - In your GitHub repo: Go to **Settings** ➔ **Webhooks** ➔ **Add webhook**.
   - **Payload URL**: Paste your Smee URL (`https://smee.io/abc123xyz`).
   - **Content type**: `application/json`.
   - **Which events?**: Select **"Let me select individual events"** ➔ Check **"Workflow runs"**.
   - Click **Add webhook**.
4. **Trigger the bug**:
   - Push a commit that breaks a test in `tests/test_calculator.py`.
   - Watch GitHub Actions turn red ❌.
   - Within 2 seconds, CI-Doctor receives the webhook and completes the fix automatically!

---

## ❓ Frequently Asked Viva Questions (Examiner Q&A)

### Q1: "Why don't you use Docker?"
> **Answer**: *"We architected a pluggable sandbox engine. For fast local testing and low-overhead demonstrations, it utilizes ephemeral scratch directories with isolated subprocess execution and strict timeouts. This executes in under 1 second without requiring heavy WSL2/Docker daemon overhead. For production multi-tenant cloud deployments, the interface can easily wrap Docker or Firecracker microVMs."*

### Q2: "How does the Agent Reflection Loop work?"
> **Answer**: *"When Agent 3 generates a patch, it doesn't assume the code works. It runs pytest in the sandbox. If tests fail, the exit code and stderr error output are fed back into the prompt, asking the agent to reflect on its previous mistake and revise the patch. We cap this at 3 iterations to prevent infinite loops."*

### Q3: "How do you extract logs from noisy GitHub terminal output?"
> **Answer**: *"GitHub logs contain hundreds of lines of runner initialization, environment setup, and dependency installations. Agent 1 strips ANSI escape sequences, filters out successful steps, and isolates the specific test failure block and traceback before passing it to downstream agents."*
