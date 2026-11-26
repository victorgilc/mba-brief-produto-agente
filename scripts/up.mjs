import { spawnSync } from 'node:child_process';

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.error) {
    console.error(`Falha ao executar ${cmd}:`, result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function waitForHealth(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return true;
      }
    } catch {
      // retry until healthy
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

console.log('Subindo Catraca (PostgreSQL + App) via Docker Compose...');
run('docker', ['compose', 'up', '-d', '--build', '--wait']);

const port = process.env.PORT || '3000';
const healthUrl = `http://localhost:${port}/health`;
const ok = await waitForHealth(healthUrl);
if (!ok) {
  console.error(`Aplicacao nao respondeu 200 em ${healthUrl}`);
  process.exit(1);
}

console.log(`Catraca pronto em http://localhost:${port}`);
