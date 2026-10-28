// Starts the API (backend) and the web app (frontend) together. Stop both with Ctrl+C.
// Commands are fixed strings below; no user input reaches the shell.
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const services = [
  { name: 'api', cwd: 'backend', cmd: 'npm start' },
  { name: 'web', cwd: 'frontend', cmd: 'npm run dev' },
];

const children = [];
let stopping = false;

function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  }
  process.exit(code);
}

for (const svc of services) {
  const child = spawn(svc.cmd, { cwd: `${root}${svc.cwd}`, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  const prefix = (stream, out) => {
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const line of lines) if (line.trim()) out.write(`[${svc.name}] ${line}\n`);
    });
  };
  prefix(child.stdout, process.stdout);
  prefix(child.stderr, process.stderr);
  child.on('exit', (code) => {
    if (!stopping) {
      process.stderr.write(`[${svc.name}] exited with code ${code}; stopping everything\n`);
      stopAll(code ?? 1);
    }
  });
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
process.stdout.write('Starting API on http://127.0.0.1:4000 and web app on http://127.0.0.1:5173 (Ctrl+C to stop)\n');
