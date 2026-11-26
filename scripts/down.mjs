import { spawnSync } from 'node:child_process';

console.log('Encerrando e removendo containers do Catraca...');
const result = spawnSync('docker', ['compose', '--profile', 'test', 'down', '--remove-orphans'], {
  stdio: 'inherit'
});

if (result.error) {
  console.error('Falha ao executar docker compose down:', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
