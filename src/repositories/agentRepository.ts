import { getPool } from '../db/client';

export interface AgentInsertRow {
  import_run_id: number;
  agency_code: string | null;
  site_code: string | null;
  external_agent_id: string | null;
  agency_external_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  raw_json: Record<string, unknown>;
}

export async function deleteByAgencyAndSite(
  agencyCode: string | null,
  siteCode: string | null
): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    'DELETE FROM gestim_agents WHERE COALESCE(agency_code, \'\') = COALESCE($1, \'\') AND COALESCE(site_code, \'\') = COALESCE($2, \'\') RETURNING id',
    [agencyCode ?? '', siteCode ?? '']
  );
  return result.rowCount ?? 0;
}

export async function insertMany(rows: AgentInsertRow[]): Promise<number> {
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
      row.external_agent_id,
      row.agency_external_id,
      row.name,
      row.email,
      row.phone,
      JSON.stringify(row.raw_json)
    );
  }
  const sql = `INSERT INTO gestim_agents (
    import_run_id, agency_code, site_code, external_agent_id, agency_external_id, name, email, phone, raw_json
  ) VALUES ${placeholders.join(', ')}`;
  const result = await pool.query(sql, values);
  return result.rowCount ?? 0;
}
