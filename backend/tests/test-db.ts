import { Pool } from 'pg';
import { runMigrations } from '../src/db/migrate.js';
import { createPool } from '../src/db/pool.js';
import { runSeed } from '../src/db/seed.js';

const TEST_DB_NAME = 'catraca_test';

export async function ensureTestDatabase(): Promise<Pool> {
  const adminUrl =
    process.env.ADMIN_DATABASE_URL ??
    'postgresql://catraca:catraca@localhost:5432/postgres';
  const adminPool = new Pool({ connectionString: adminUrl });
  try {
    const res = await adminPool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [TEST_DB_NAME]
    );
    if (res.rows.length === 0) {
      await adminPool.query(`CREATE DATABASE ${TEST_DB_NAME}`);
    }
  } finally {
    await adminPool.end();
  }

  const testUrl =
    process.env.DATABASE_URL ??
    `postgresql://catraca:catraca@localhost:5432/${TEST_DB_NAME}`;
  const pool = createPool(testUrl);
  await runMigrations(pool);
  return pool;
}

export async function resetTestDatabase(pool: Pool): Promise<void> {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await runMigrations(pool);
  await runSeed(pool);
}
