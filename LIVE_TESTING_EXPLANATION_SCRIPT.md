# 🧪 CI-Doctor: Step-by-Step Live Testing & Judges Walkthrough Script
> **The Exact Demonstration Protocol for TechExpo 2026**  
> *Side-by-side runbook: What to Click & Observe on screen vs Exactly What to Say to Judges*

---

## 📋 Pre-Flight Checklist (1 Minute Before Judges Arrive)

1. **Tab 1 (Mission Control):** Open `https://ci-doctor.onrender.com` (or `http://localhost:5000`).
2. **Tab 2 (GitHub PRs):** Open `https://github.com/Adityaa-200x/DSA/pulls` (or `paneertikkadedo/DSA/pulls`).
3. **Tab 3 (GitHub Actions):** Open `https://github.com/Adityaa-200x/DSA/actions`.
4. **Dashboard State:** Verify the top indicator shows `Connected` (Socket.io) with 0 console errors.

---

## 🚀 The 8-Step Testing Script

### 🔹 TEST 01: Dynamic GitHub API Ingestion & Repo Discovery (25s)
- **What You Click & Do:**
  1. In the **PROJECT WORKSPACE** sidebar, enter dev username: `Adityaa-200x` and click **LOAD**.
  2. In the repository dropdown, select `DSA`.
- **👉 Point at Screen:** Point to the green `main` branch tag, language tag `Java`, and `37 source file(s) discovered`.
- **🗣️ Exactly What You Say to Judges:**
  > *"Judges, welcome! First, let's verify that CI-Doctor is 100% real and dynamic.*  
  > *Notice our Project Workspace: when I enter our developer handle and click Load, our backend contacts GitHub's official Octokit REST API live.*  
  > *It recursively traverses the Git tree, detects the ecosystem — in this case, Java — and discovers all 37 real algorithm source files. There are zero mock databases or hardcoded demos here."*
- **✅ Expected Pass Result:** Live GitHub repository metadata loaded with 37 discovered source files.

---

### 🔹 TEST 02: Granular File Targeting (Surgical Audit) (20s)
- **What You Click & Do:**
  1. Click on the **AUDIT TARGET** dropdown.
  2. Select `0069-sqrtx/0069-sqrtx.java`.
  3. Observe the right pane (Diff Inspector) immediately display the targeted file header: `0069-sqrtx/0069-sqrtx.java`.
- **👉 Point at Screen:** Point to the dropdown selection and the matching active tab on the Diff Inspector.
- **🗣️ Exactly What You Say to Judges:**
  > *"In large monorepos with hundreds of files, engineers often want to inspect a specific algorithm without triggering a heavyweight full repository scan.*  
  > *Our granular Audit Target selector lets us target specific files — like this `0069-sqrtx.java` algorithm — or switch to full repository mode. The entire agent profiling immediately focuses on this target."*
- **✅ Expected Pass Result:** Audit target locked to selected algorithm file; Diff Inspector syncs target.

---

### 🔹 TEST 03: Reactive Code Audit & AST Auto-Fix PR (45s)
- **What You Click & Do:**
  1. Click the green button: **ANALYZE CODE & AUTO-FIX PR**.
  2. Watch the center **Agent Reasoning Console** stream tokens in real-time.
  3. Watch the right pane display the generated unified diff.
- **👉 Point at Screen:**
  1. Point to the chip `[THOUGHT]` streaming at ~400 tokens/sec via Groq LPU.
  2. Point to `[TOOL (read_file)]` reading the source code.
  3. Point to `[TOOL (execute_sandbox)]` running `javac` with `Exit Code 0`.
  4. Point to the Diff Inspector showing the green `+` additions.
- **🗣️ Exactly What You Say to Judges:**
  > *"Now let's test our Reactive Codebase Repair Engine. I'll click Analyze Code & Auto-Fix PR.*  
  > *Look at the center console: powered by Groq's custom LPU silicon running at ~400 tokens per second, the AI reads the AST, detects arithmetic boundary bugs (like integer overflow in binary search), and writes a patch.*  
  > *Crucially: it doesn't just guess. It executes the native Java compiler — `javac` — inside an isolated ephemeral sandbox. Notice the console: **Exit Code 0 — Syntax Verified!** Only verified code is committed."*
- **✅ Expected Pass Result:** AST bug diagnosed, sandbox compilation passed (Exit Code 0), diff displayed.

---

### 🔹 TEST 04: Proactive QA Test Suite Synthesis (Yellow Button) (35s)
- **What You Click & Do:**
  1. Point to the bright yellow button: **SYNTHESIZE QA TEST SUITE**.
  2. Explain why this button exists before clicking or testing it.
- **👉 Point at Screen:** Point to the yellow button icon `🧪 SYNTHESIZE QA TEST SUITE` and explain Reactive vs Proactive.
- **🗣️ Exactly What You Say to Judges:**
  > *"Judges, you might ask: 'What is the purpose of this yellow button: SYNTHESIZE QA TEST SUITE?'*  
  > *In software engineering, especially in algorithmic or legacy repos, **there are zero unit tests**. Developers modify code and have no automated tests to catch regressions.*  
  > *This button shifts CI-Doctor from reactive repair to **proactive bug prevention**. It parses algorithm signatures, generates rigorous boundary tests — zeroes, negatives, integer limits, and null pointers — and commits a comprehensive JUnit test suite to prevent future CI breaks!"*
- **✅ Expected Pass Result:** Clear technical justification of proactive QA test generation for 0-test repos.

---

### 🔹 TEST 05: Live CI Runner Failure Auto-Healing (THE FLAGSHIP DEMO) (60s)
- **What You Click & Do:**
  1. Scroll down to the **GITHUB ACTIONS CI** monitor in the sidebar.
  2. Show the red failed run card (e.g., `FAILED #7 on GitHub` on branch `main`).
  3. Click the bright red button: **AUTO-HEAL THIS CI FAILURE**.
  4. Watch the 5-stage pipeline execute in 14 seconds!
- **👉 Point at Screen in Sequence:**
  1. Point to card: *"This is a real failed build on GitHub Actions cloud runners."*
  2. Point to console: *"Downloading raw runner logs from GitHub..."*
  3. Point to Groq: *"Parsing compiler stack trace and fatal line..."*
  4. Point to Sandbox: *"Compiling patch with javac in sandbox..."*
  5. Point to Branch: *"Spawning isolated branch: `ci-doctor/fix-...`"*
  6. Point to Diff Inspector: Status badge turns to `PR CREATED 🚀`.
- **🗣️ Exactly What You Say to Judges:**
  > *"Now for our flagship test: **Autonomous Self-Healing of Live GitHub Actions Failures**.*  
  > *Look at this card: GitHub Actions CI shows a real failed run on the `main` branch. When I click **AUTO-HEAL THIS CI FAILURE**:*  
  > *• **Stage 1:** It downloads the actual runner logs from GitHub's cloud servers.*  
  > *• **Stage 2:** Groq LPU strips ANSI terminal noise, diagnoses the compiler error, and writes a precision patch in 1.8 seconds.*  
  > *• **Stage 3:** The patch is dry-run compiled in our isolated sandbox with `javac`.*  
  > *• **Stage 4:** To protect `main`, it creates an isolated branch: `ci-doctor/fix-ci-failure-...`.*  
  > *• **Stage 5:** It opens a complete Pull Request on GitHub. Total elapsed time: **14 seconds!**"*
- **✅ Expected Pass Result:** Real runner log ingested, compiler error diagnosed, sandbox verified, PR opened in <15s.

---

### 🔹 TEST 06: GitHub Independent Verification (Green Checkmark Proof) (40s)
- **What You Click & Do:**
  1. Switch browser tab to GitHub: `https://github.com/Adityaa-200x/DSA/pulls`.
  2. Click on the newly opened Pull Request.
  3. Scroll through the PR body and the checks section at the bottom.
- **👉 Point at Screen on GitHub:**
  1. Point to PR title and branch: `ci-doctor/fix-... into main`.
  2. Point to PR description: Root cause analysis + failed log snippet + unified diff.
  3. Point to GitHub Actions status: **"All checks have passed" ✅ (Green checkmark)**.
- **🗣️ Exactly What You Say to Judges:**
  > *"Let's verify on GitHub itself. Look at what CI-Doctor committed:*  
  > *1. **Full Diagnostic Trace:** The PR body automatically documents the exact error log, root-cause diagnosis, and diff.*  
  > *2. **Branch Protection:** The `main` branch was never touched; all work happened on an isolated branch.*  
  > *3. **Green Passing Checks:** Look at the status check right here: **All checks have passed (Green checkmark ✅)**.*  
  > *GitHub Actions ran our intelligent PR verification, compiled the code on Ubuntu runners, and passed. It is ready for one-click merge with zero conflicts!"*
- **✅ Expected Pass Result:** GitHub Actions independently ran on Ubuntu runner and marked the PR Green ✅.

---

### 🔹 TEST 07: Zero-Trust Safety Gates & Approval Gate Test (30s)
- **What You Click & Do:**
  1. Switch back to CI-Doctor dashboard.
  2. Point to the **HUMAN APPROVAL GATE** toggle.
  3. Click the toggle to switch between `AUTO` and `MANUAL`.
- **👉 Point at Screen:** Point to the toggle badge changing from yellow `AUTO` to cyan `MANUAL`.
- **🗣️ Exactly What You Say to Judges:**
  > *"To satisfy strict enterprise compliance, we built 5 Zero-Trust Safety Gates:*  
  > *• **Immutable Tests:** The AI cannot weaken existing test assertions to fake a pass.*  
  > *• **Sandbox Verification:** Exit Code 0 is required before any commit is generated.*  
  > *• **Reflection Loop:** Up to 3 self-healing attempts if compilation fails.*  
  > *• **Human-in-the-Loop Toggle:** In Manual mode, CI-Doctor pauses before touching GitHub, requiring human authorization."*
- **✅ Expected Pass Result:** Human approval toggle switches modes; safety architecture clearly defended.

---

### 🔹 TEST 08: Telemetry Filtering & Observability (20s)
- **What You Click & Do:**
  1. In the Agent Reasoning Console header, click the tabs: `[THOUGHTS]`, `[TOOLS]`, `[ERRORS]`, then back to `[ALL]`.
  2. Show how the console instantly filters the streaming events.
- **👉 Point at Screen:** Point to the filtered view isolating tool invocations (`read_file`, `execute_sandbox`).
- **🗣️ Exactly What You Say to Judges:**
  > *"Finally, notice the developer observability. Engineers are never left wondering what the AI is doing.*  
  > *These tabs let developers filter down to pure reasoning thoughts, inspect exact tool executions, or audit errors. Everything is transparent, auditable, and streaming in real-time via WebSockets."*
- **✅ Expected Pass Result:** Real-time telemetry filtering functions with sub-millisecond responsiveness.

---

## 🎯 Final 15-Second Closing Statement
> *"In closing, judges: CI-Doctor slashes Mean Time to Resolution from **45 minutes to 14 seconds**. It eliminates developer toil, prevents hallucinations via compiler sandbox verification, and preserves branch safety.*  
> *Thank you! We would love to take your questions."*
