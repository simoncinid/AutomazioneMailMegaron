import { getPool } from '../db/client';

export interface LookupInsertRow {
  import_run_id: number;
  agency_code: string | null;
  site_code: string | null;
  lookup_scope: string;
  lookup_group: string;
  lookup_key: string;
  lookup_value: string;
  language: string | null;
  raw_json: Record<string, unknown> | null;
}

export async function insertMany(rows: LookupInsertRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const pool = getPool();
  const values: unknown[] = [];
  const placeholders: string[] = [];
  let i = 0;
  for (const row of rows) {
    const ps = Array.from({ length: 9 }, () => `$${++i}`).join(', ');
    placeholders.push(`(${ps})`);
    values.push(
      row.import_run_id,
      row.agency_code,
      row.site_code,
      row.lookup_scope,
      row.lookup_group,
      row.lookup_key,
      row.lookup_value,
      row.language,
      row.raw_json ? JSON.stringify(row.raw_json) : null
    );
  }
  const sql = `INSERT INTO gestim_lookups (
    import_run_id, agency_code, site_code, lookup_scope, lookup_group, lookup_key, lookup_value, language, raw_json
  ) VALUES ${placeholders.join(', ')}`;
  const result = await pool.query(sql, values);
  return result.rowCount ?? 0;
}

export async function deleteByImportRunId(importRunId: number): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    'DELETE FROM gestim_lookups WHERE import_run_id = $1 RETURNING id',
    [importRunId]
  );
  return result.rowCount ?? 0;
}
