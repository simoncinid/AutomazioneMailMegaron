import { readdir, readFile } from 'fs/promises';
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
  const migrationsDir = path.join(__dirname, '../../migrations');
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const pool = getPool();
  let totalStatements = 0;
  for (const file of files) {
    const sqlPath = path.join(migrationsDir, file);
    const sql = await readFile(sqlPath, 'utf-8');
    const statements = sql
      .split(';')
      .map((s) => stripLeadingSqlComments(s.trim()))
      .filter((s) => s.length > 0);

    logger.info(`Migrazione: ${file} (${statements.length} statements)`);
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (!stmt) continue;
      await pool.query(stmt);
      totalStatements++;
    }
  }
  logger.info(`Migrazioni completate: ${files.length} file, ${totalStatements} statements`);
  await closePool();
}

run().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  logger.error(`Migrazione fallita: ${msg}`);
  process.exit(1);
});
