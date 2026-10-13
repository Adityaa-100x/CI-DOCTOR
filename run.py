"""
CI-Doctor Single-Command Runner
Launches the FastAPI backend and provides quick links for the Mission Control Dashboard.
"""

import sys
import os
import webbrowser
from pathlib import Path

# Add backend directory to PYTHONPATH
PROJECT_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = PROJECT_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

def print_banner():
    banner = """
    ===============================================================
       🩺  CI-Doctor — Autonomous GitHub Actions Build Fixer  🩺
    ===============================================================
    🚀 Server:             http://127.0.0.1:8000
    💻 Mission Control:    http://127.0.0.1:8000/
    📡 Webhook Receiver:   http://127.0.0.1:8000/api/webhook
    ===============================================================
    Press Ctrl+C to stop the server anytime.
    """
    print(banner)

if __name__ == "__main__":
    import uvicorn

    print_banner()

    # Automatically launch browser to dashboard
    try:
        webbrowser.open("http://127.0.0.1:8000/")
    except Exception:
        pass

    # Start FastAPI server without file-watcher reloading
    # This prevents uvicorn from restarting when sandbox/demo files are created or modified
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=False,
        app_dir=str(BACKEND_DIR)
    )
