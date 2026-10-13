import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(`
===============================================================
   🩺  CI-Doctor — Universal Autonomous Self-Healing Swarm  🩺
                       [MERN STACK + AI]
===============================================================
 🚀 Express & Socket Server:   http://localhost:5000
 💻 React Mission Control:     http://localhost:5000/
 📡 GitHub Webhook Endpoint:   http://localhost:5000/api/webhook
 🗄️ Database:                 MongoDB / Mongoose ODM
===============================================================
`);

const serverProcess = spawn('node', ['src/server.js'], {
  cwd: path.join(__dirname, 'server'),
  stdio: 'inherit',
  shell: true
});

serverProcess.on('exit', (code) => {
  console.log(`[CI-Doctor] Server exited with code ${code}`);
  process.exit(code || 0);
});

process.on('SIGINT', () => {
  serverProcess.kill('SIGINT');
  process.exit(0);
});
