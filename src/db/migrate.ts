import 'dotenv/config';
import { readdir, readFile } from 'fs/promises';
import { loadConfig } from '../config';
import path from 'path';
import { getPool } from './client';
import { logger } from '../utils/logger';

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');

async function ensureMigrationsTable(pool: ReturnType<typeof getPool>): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(pool: ReturnType<typeof getPool>): Promise<Set<string>> {
  const result = await pool.query<{ name: string }>('SELECT name FROM _migrations ORDER BY id');
  return new Set(result.rows.map((r) => r.name));
}

async function run(): Promise<void> {
  loadConfig();
  const pool = getPool();
  await ensureMigrationsTable(pool);
  const applied = await getAppliedMigrations(pool);

  const files = await readdir(MIGRATIONS_DIR);
  const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort();

  for (const file of sqlFiles) {
    const name = file.replace('.sql', '');
    if (applied.has(name)) {
      logger.info({ migration: name }, 'Migration already applied');
      continue;
    }

    logger.info({ migration: name }, 'Applying migration');
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = await readFile(filePath, 'utf-8');
    await pool.query(sql);
    await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [name]);
    logger.info({ migration: name }, 'Migration applied');
  }

  logger.info('All migrations complete');
}

run().catch((err) => {
  logger.error({ err }, 'Migration failed');
  process.exit(1);
});
