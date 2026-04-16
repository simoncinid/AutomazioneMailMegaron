import { readFile } from 'fs/promises';
import path from 'path';
import { loadConfig } from '../config';
import { getPool, closePool } from './client';
import { logger } from '../utils/logger';

async function run(): Promise<void> {
  loadConfig();
  const sqlPath = path.join(__dirname, '../../migrations/001_initial_schema.sql');
  const sql = await readFile(sqlPath, 'utf-8');
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => {
      if (!s) return false;
      const firstLine = s
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.length > 0);
      return firstLine && !firstLine.startsWith('--');
    });

  const pool = getPool();
  logger.info({ statements: statements.length }, 'Running DB migrations');
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt) continue;
    await pool.query(stmt);
    logger.debug({ index: i + 1, total: statements.length }, 'Migration statement applied');
  }
  logger.info('Migrations completed');
  await closePool();
}

run().catch((err) => {
  logger.error({ err }, 'Migration failed');
  process.exit(1);
});
