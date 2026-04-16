import { readFile } from 'fs/promises';
import path from 'path';
import { loadConfig } from '../config';
import { getPool, closePool } from './client';
import { logger } from '../utils/logger';

/** Rimuove commenti `--` e righe vuote in testa a uno statement (dopo split su `;`). */
function stripLeadingSqlComments(block: string): string {
  const lines = block.split('\n');
  const out: string[] = [];
  let started = false;
  for (const line of lines) {
    const t = line.trim();
    if (!started && (t === '' || t.startsWith('--'))) continue;
    started = true;
    out.push(line);
  }
  return out.join('\n').trim();
}

async function run(): Promise<void> {
  loadConfig();
  const sqlPath = path.join(__dirname, '../../migrations/001_initial_schema.sql');
  const sql = await readFile(sqlPath, 'utf-8');
  const statements = sql
    .split(';')
    .map((s) => stripLeadingSqlComments(s.trim()))
    .filter((s) => s.length > 0);

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
