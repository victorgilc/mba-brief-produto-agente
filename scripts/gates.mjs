import { spawnSync } from 'node:child_process';

function runCapture(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8' });
}

function runInherit(cmd, args) {
  return spawnSync(cmd, args, { stdio: 'inherit' });
}

const ps = runCapture('docker', ['compose', 'ps', '--status', 'running', '--services']);
const runningServices = (ps.stdout || '')
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean);

const dbAlreadyRunning = runningServices.includes('db');
let exitCode = 0;

try {
  if (!dbAlreadyRunning) {
    console.log('Subindo banco temporario para os gates...');
    const upDb = runInherit('docker', ['compose', 'up', '-d', '--wait', 'db']);
    if (upDb.status !== 0) {
      process.exit(upDb.status ?? 1);
    }
  }

  console.log('Executando gates (typecheck, build frontend e testes automatizados)...');
  const testRun = runInherit('docker', ['compose', '--profile', 'test', 'run', '--rm', '--build', 'test']);
  exitCode = testRun.status ?? 1;
} finally {
  if (!dbAlreadyRunning) {
    console.log('Limpando containers temporarios de teste...');
    runInherit('docker', ['compose', '--profile', 'test', 'down', '--remove-orphans']);
  }
}

process.exit(exitCode);
