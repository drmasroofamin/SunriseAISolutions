import { spawn } from 'node:child_process';

// Run both parts together so `npm run dev` includes enquiry delivery.
const processes = [
  spawn(process.execPath, ['--env-file-if-exists=.env.server.local', 'server/index.js'], {
    stdio: 'inherit',
    env: { ...process.env, PORT: process.env.API_PORT || '3001', HOST: '127.0.0.1' },
  }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0', ...process.argv.slice(2)], {
    stdio: 'inherit',
  }),
];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of processes) if (child.exitCode === null) child.kill('SIGTERM');
}
for (const child of processes) {
  child.on('error', () => { console.error('Could not start the development servers.'); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code || 1); });
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
