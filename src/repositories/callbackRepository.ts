import { getPool } from '../db/client';
import type { GestimCallback } from '../types';

export interface CreateCallbackInput {
  method: string;
  headersJson: Record<string, unknown>;
  queryJson: Record<string, unknown>;
  rawUrl: string;
  zipUrl: string | null;
  status?: string;
  notes?: string | null;
}

export async function createCallback(input: CreateCallbackInput): Promise<GestimCallback> {
  const pool = getPool();
  const result = await pool.query<GestimCallback>(
    `INSERT INTO gestim_callbacks (method, headers_json, query_json, raw_url, zip_url, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.method,
      JSON.stringify(input.headersJson),
      JSON.stringify(input.queryJson),
      input.rawUrl,
      input.zipUrl,
      input.status ?? 'received',
      input.notes ?? null,
    ]
  );
  return result.rows[0]!;
}

export async function getLatestWithZipUrl(): Promise<GestimCallback | null> {
  const pool = getPool();
  const result = await pool.query<GestimCallback>(
    `SELECT * FROM gestim_callbacks
     WHERE zip_url IS NOT NULL AND zip_url != ''
     ORDER BY received_at DESC
     LIMIT 1`
  );
  return result.rows[0] ?? null;
}

export async function getById(id: number): Promise<GestimCallback | null> {
  const pool = getPool();
  const result = await pool.query<GestimCallback>(
    'SELECT * FROM gestim_callbacks WHERE id = $1',
    [id]
  );
  return result.rows[0] ?? null;
}

export async function getLatest(): Promise<GestimCallback | null> {
  const pool = getPool();
  const result = await pool.query<GestimCallback>(
    'SELECT * FROM gestim_callbacks ORDER BY received_at DESC LIMIT 1'
  );
  return result.rows[0] ?? null;
}
