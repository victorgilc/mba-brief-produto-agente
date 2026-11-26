import { buildApp } from './app.js';
import { config } from './config.js';
import { runMigrations } from './db/migrate.js';
import { createPool } from './db/pool.js';
import { runSeed } from './db/seed.js';

async function main() {
  const pool = createPool();
  await runMigrations(pool);
  await runSeed(pool);

  const app = await buildApp({ pool });

  const shutdown = async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await app.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error('Failed to start Catraca server:', err);
  process.exit(1);
});
