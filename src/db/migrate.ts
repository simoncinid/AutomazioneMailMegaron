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

async function ensureMigrationsTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const pool = getPool();
  const result = await pool.query<{ filename: string }>('SELECT filename FROM schema_migrations');
  return new Set(result.rows.map((r) => r.filename));
}

/** DB già popolato prima dell'introduzione di schema_migrations: segna come applicate le migrazioni già effettive. */
async function bootstrapExistingDb(files: string[]): Promise<void> {
  const pool = getPool();
  const applied = await getAppliedMigrations();
  if (applied.size > 0) return;

  const legacy = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'gestim_callbacks'
     LIMIT 1`
  );
  if (legacy.rowCount === 0) return;

  logger.info('Bootstrap schema_migrations per database esistente');

  for (const file of files) {
    if (file.startsWith('003_')) {
      const col = await pool.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'gestim_listings' AND column_name = 'content_hash'
         LIMIT 1`
      );
      if (col.rowCount === 0) break;
    }

    await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
  }
}

async function runMigrationFile(file: string, sqlPath: string): Promise<number> {
  const pool = getPool();
  const sql = await readFile(sqlPath, 'utf-8');
  const statements = sql
    .split(';')
    .map((s) => stripLeadingSqlComments(s.trim()))
    .filter((s) => s.length > 0);

  logger.info(`Migrazione: ${file} (${statements.length} statements)`);
  for (const stmt of statements) {
    await pool.query(stmt);
  }

  await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
  return statements.length;
}

async function run(): Promise<void> {
  loadConfig();
  const migrationsDir = path.join(__dirname, '../../migrations');
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  await ensureMigrationsTable();
  await bootstrapExistingDb(files);
  const applied = await getAppliedMigrations();

  let totalStatements = 0;
  let filesRun = 0;
  for (const file of files) {
    if (applied.has(file)) {
      logger.info(`Migrazione già applicata: ${file}`);
      continue;
    }

    const sqlPath = path.join(migrationsDir, file);
    totalStatements += await runMigrationFile(file, sqlPath);
    filesRun++;
  }

  logger.info(
    `Migrazioni completate: ${filesRun} file eseguiti, ${files.length - filesRun} già applicati, ${totalStatements} statements`
  );
  await closePool();
}

run().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  logger.error(`Migrazione fallita: ${msg}`);
  process.exit(1);
});
