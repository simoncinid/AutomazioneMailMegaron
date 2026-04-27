import { createHash } from 'crypto';
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

export interface UpsertSummary {
  inserted: number;
  updated: number;
  unchanged: number;
  insertedKeys: string[];
  updatedKeys: string[];
  unchangedKeys: string[];
}

interface ExistingRow {
  id: number;
  matchKey: string;
  contentHash: string | null;
}

export function buildMatchKey(row: Pick<AgentInsertRow, 'external_agent_id'>): string {
  return row.external_agent_id && row.external_agent_id.trim().length > 0
    ? row.external_agent_id
    : '__no_external_id__';
}

export function computeContentHash(row: AgentInsertRow): string {
  const h = createHash('sha1');
  const fields: Array<unknown> = [
    row.external_agent_id,
    row.agency_external_id,
    row.name,
    row.email,
    row.phone,
    JSON.stringify(row.raw_json ?? {}),
  ];
  for (const f of fields) {
    h.update(f === null || f === undefined ? '\u0000' : String(f));
    h.update('\u0001');
  }
  return h.digest('hex');
}

async function loadExisting(
  agencyCode: string | null,
  siteCode: string | null
): Promise<Map<string, ExistingRow>> {
  const pool = getPool();
  const result = await pool.query<{
    id: number;
    match_key: string;
    content_hash: string | null;
  }>(
    `SELECT id,
            COALESCE(external_agent_id, '__no_external_id__') AS match_key,
            content_hash
     FROM gestim_agents
     WHERE COALESCE(agency_code, '') = COALESCE($1, '')
       AND COALESCE(site_code, '') = COALESCE($2, '')`,
    [agencyCode ?? '', siteCode ?? '']
  );
  const map = new Map<string, ExistingRow>();
  for (const r of result.rows) {
    map.set(r.match_key, { id: r.id, matchKey: r.match_key, contentHash: r.content_hash });
  }
  return map;
}

async function bulkInsert(items: Array<{ row: AgentInsertRow; hash: string }>): Promise<number> {
  if (items.length === 0) return 0;
  const pool = getPool();
  const values: unknown[] = [];
  const placeholders: string[] = [];
  let i = 0;
  for (const { row, hash } of items) {
    const ps = Array.from({ length: 10 }, () => `$${++i}`).join(', ');
    placeholders.push(`(${ps}, NOW(), NOW())`);
    values.push(
      row.import_run_id,
      row.agency_code,
      row.site_code,
      row.external_agent_id,
      row.agency_external_id,
      row.name,
      row.email,
      row.phone,
      JSON.stringify(row.raw_json),
      hash
    );
  }
  const sql = `INSERT INTO gestim_agents (
    import_run_id, agency_code, site_code, external_agent_id, agency_external_id, name, email, phone, raw_json,
    content_hash, created_at, updated_at
  ) VALUES ${placeholders.join(', ')}`;
  const result = await pool.query(sql, values);
  return result.rowCount ?? 0;
}

async function bulkUpdate(items: Array<{ id: number; row: AgentInsertRow; hash: string }>): Promise<number> {
  if (items.length === 0) return 0;
  const pool = getPool();

  const ids: number[] = [];
  const importRunIds: number[] = [];
  const agencyExternalIds: Array<string | null> = [];
  const names: Array<string | null> = [];
  const emails: Array<string | null> = [];
  const phones: Array<string | null> = [];
  const rawJsons: string[] = [];
  const hashes: string[] = [];
  for (const it of items) {
    ids.push(it.id);
    importRunIds.push(it.row.import_run_id);
    agencyExternalIds.push(it.row.agency_external_id);
    names.push(it.row.name);
    emails.push(it.row.email);
    phones.push(it.row.phone);
    rawJsons.push(JSON.stringify(it.row.raw_json));
    hashes.push(it.hash);
  }
  const sql = `
    UPDATE gestim_agents AS a SET
      import_run_id = u.import_run_id,
      agency_external_id = u.agency_external_id,
      name = u.name,
      email = u.email,
      phone = u.phone,
      raw_json = u.raw_json::jsonb,
      content_hash = u.content_hash,
      updated_at = NOW()
    FROM (
      SELECT
        UNNEST($1::int[])  AS id,
        UNNEST($2::int[])  AS import_run_id,
        UNNEST($3::text[]) AS agency_external_id,
        UNNEST($4::text[]) AS name,
        UNNEST($5::text[]) AS email,
        UNNEST($6::text[]) AS phone,
        UNNEST($7::text[]) AS raw_json,
        UNNEST($8::text[]) AS content_hash
    ) AS u
    WHERE a.id = u.id
  `;
  const result = await pool.query(sql, [
    ids,
    importRunIds,
    agencyExternalIds,
    names,
    emails,
    phones,
    rawJsons,
    hashes,
  ]);
  return result.rowCount ?? 0;
}

export async function upsertMany(
  rows: AgentInsertRow[],
  agencyCode: string | null,
  siteCode: string | null
): Promise<UpsertSummary> {
  const summary: UpsertSummary = {
    inserted: 0,
    updated: 0,
    unchanged: 0,
    insertedKeys: [],
    updatedKeys: [],
    unchangedKeys: [],
  };
  if (rows.length === 0) return summary;

  const existing = await loadExisting(agencyCode, siteCode);
  const toInsert: Array<{ row: AgentInsertRow; hash: string }> = [];
  const toUpdate: Array<{ id: number; row: AgentInsertRow; hash: string }> = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const key = buildMatchKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    const hash = computeContentHash(row);
    const ex = existing.get(key);
    if (!ex) {
      toInsert.push({ row, hash });
      summary.insertedKeys.push(key);
    } else if (ex.contentHash === hash) {
      summary.unchangedKeys.push(key);
    } else {
      toUpdate.push({ id: ex.id, row, hash });
      summary.updatedKeys.push(key);
    }
  }
  summary.inserted = await bulkInsert(toInsert);
  summary.updated = await bulkUpdate(toUpdate);
  summary.unchanged = summary.unchangedKeys.length;
  return summary;
}
