import { getPool } from '../db/client';
import type { GestimImportRun } from '../types';

export interface CreateImportRunInput {
  callbackId: number | null;
  zipUrl: string;
  importType: string;
  agencyCode?: string | null;
  siteCode?: string | null;
  filesFoundJson?: Record<string, unknown>;
}

export async function createImportRun(input: CreateImportRunInput): Promise<GestimImportRun> {
  const pool = getPool();
  const result = await pool.query<GestimImportRun>(
    `INSERT INTO gestim_import_runs (callback_id, zip_url, import_type, status, agency_code, site_code, files_found_json)
     VALUES ($1, $2, $3, 'running', $4, $5, $6)
     RETURNING *`,
    [
      input.callbackId,
      input.zipUrl,
      input.importType,
      input.agencyCode ?? null,
      input.siteCode ?? null,
      JSON.stringify(input.filesFoundJson ?? {}),
    ]
  );
  return result.rows[0]!;
}

export async function completeImportRun(
  id: number,
  data: {
    totalListingsFound?: number;
    totalListingsImported?: number;
    errorMessage?: string | null;
  }
): Promise<void> {
  const pool = getPool();
  const status = data.errorMessage ? 'failed' : 'success';
  await pool.query(
    `UPDATE gestim_import_runs
     SET status = $1, finished_at = NOW(), total_listings_found = $2, total_listings_imported = $3, error_message = $4, updated_at = NOW()
     WHERE id = $5`,
    [status, data.totalListingsFound ?? null, data.totalListingsImported ?? null, data.errorMessage ?? null, id]
  );
}

export async function getLatestImportRun(): Promise<GestimImportRun | null> {
  const pool = getPool();
  const result = await pool.query<GestimImportRun>(
    'SELECT * FROM gestim_import_runs ORDER BY started_at DESC LIMIT 1'
  );
  return result.rows[0] ?? null;
}

export async function getById(id: number): Promise<GestimImportRun | null> {
  const pool = getPool();
  const result = await pool.query<GestimImportRun>(
    'SELECT * FROM gestim_import_runs WHERE id = $1',
    [id]
  );
  return result.rows[0] ?? null;
}
