import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { createTwoFilesPatch } from 'diff';

export class SandboxManager {
  constructor() {
    this.baseDir = path.join(os.tmpdir(), 'ci_doctor_sandboxes');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async createSandbox(sourceRepoDir, sessionId) {
    const absSource = path.resolve(sourceRepoDir);
    const sandboxDir = path.join(this.baseDir, `session_${sessionId}_${Date.now()}`);

    if (fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }

    // Copy directory recursively ignoring git, node_modules, caches
    this._copyRecursiveSync(absSource, sandboxDir);
    return sandboxDir;
  }

  _copyRecursiveSync(src, dest) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });

    const entries = fs.readdirSync(src, { withFileTypes: true });
    const ignored = new Set(['.git', 'node_modules', '__pycache__', '.pytest_cache', '.venv', 'dist', 'build', '.next']);

    for (const entry of entries) {
      if (ignored.has(entry.name)) continue;

      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this._copyRecursiveSync(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  _resolveSafePath(sandboxDir, relativePath) {
    const cleanRel = relativePath.replace(/^(\.\.(\/|\\|$))+/, '').replace(/^[/\\]+/, '');
    const target = path.resolve(sandboxDir, cleanRel);
    if (!target.startsWith(path.resolve(sandboxDir))) {
      throw new Error(`Security Exception: Access denied outside sandbox path '${relativePath}'`);
    }
    return target;
  }

  readFile(sandboxDir, relativePath) {
    const target = this._resolveSafePath(sandboxDir, relativePath);
    if (!fs.existsSync(target)) {
      throw new Error(`File '${relativePath}' not found in sandbox.`);
    }
    if (fs.statSync(target).isDirectory()) {
      throw new Error(`Path '${relativePath}' is a directory, not a file.`);
    }
    return fs.readFileSync(target, 'utf-8');
  }

  writeFile(sandboxDir, relativePath, content) {
    const target = this._resolveSafePath(sandboxDir, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf-8');
    return content.length;
  }

  listDirectory(sandboxDir, relDir = '.') {
    const target = this._resolveSafePath(sandboxDir, relDir);
    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
      return [];
    }

    const results = [];
    const walk = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (['.git', 'node_modules', '__pycache__', '.pytest_cache', '.venv'].includes(entry.name)) continue;
        const full = path.join(dir, entry.name);
        const rel = path.relative(sandboxDir, full).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          walk(full);
        } else {
          results.push(rel);
        }
      }
    };
    walk(target);
    return results;
  }

  searchCode(sandboxDir, query) {
    const allFiles = this.listDirectory(sandboxDir);
    const matches = [];
    const queryLower = query.toLowerCase();

    for (const rel of allFiles) {
      if (['.png', '.jpg', '.ico', '.pyc', '.zip'].some(ext => rel.endsWith(ext))) continue;
      try {
        const content = this.readFile(sandboxDir, rel);
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.toLowerCase().includes(queryLower)) {
            matches.push({ file: rel, line: idx + 1, content: line.trim() });
          }
        });
      } catch (e) {
        // ignore unreadable
      }
    }
    return matches.slice(0, 25);
  }

  async runCommand(sandboxDir, command, timeoutSeconds = 25) {
    const startTime = Date.now();
    const env = {
      ...process.env,
      PYTHONPATH: `${sandboxDir}${path.delimiter}${process.env.PYTHONPATH || ''}`,
      NODE_PATH: `${sandboxDir}${path.delimiter}${process.env.NODE_PATH || ''}`
    };

    return new Promise((resolve) => {
      exec(command, {
        cwd: sandboxDir,
        env,
        timeout: timeoutSeconds * 1000,
        maxBuffer: 1024 * 1024 * 5
      }, (error, stdout, stderr) => {
        const durationSeconds = Number(((Date.now() - startTime) / 1000).toFixed(2));
        const exitCode = error ? (error.code ?? 1) : 0;
        resolve({
          exitCode,
          passed: exitCode === 0,
          stdout: stdout || '',
          stderr: stderr || (error ? error.message : ''),
          durationSeconds,
          command
        });
      });
    });
  }

  generateUnifiedDiff(origContent, newContent, filename) {
    const patch = createTwoFilesPatch(
      `a/${filename}`,
      `b/${filename}`,
      origContent || '',
      newContent || '',
      '',
      '',
      { context: 3 }
    );
    return patch;
  }

  cleanup(sandboxDir) {
    if (sandboxDir && fs.existsSync(sandboxDir)) {
      try {
        fs.rmSync(sandboxDir, { recursive: true, force: true });
      } catch (e) {
        // ignore cleanup warning
      }
    }
  }
}

export const sandboxManager = new SandboxManager();
