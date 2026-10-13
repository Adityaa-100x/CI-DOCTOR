@echo off
title CI-Doctor Mission Control - MERN Stack Launcher
color 0A
cls
echo =====================================================================
echo    🩺  CI-Doctor: Universal Autonomous Self-Healing Swarm  🩺
echo                    [MERN STACK + AI AGENT]
echo =====================================================================
echo.
echo [1/2] Verifying Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not found in system PATH.
    echo Please install Node.js 18+ and try again.
    pause
    exit /b
)

echo [2/2] Launching CI-Doctor MERN Server...
echo.
echo ---------------------------------------------------------------------
echo  🚀 React Mission Control Dashboard:  http://localhost:5000/
echo  📡 GitHub Webhook Endpoint:          http://localhost:5000/api/webhook
echo  🗄️ Database:                         MongoDB / Mongoose ODM
echo ---------------------------------------------------------------------
echo.
echo Server is running. Press Ctrl+C to stop anytime.
echo.
node run.js
pause
