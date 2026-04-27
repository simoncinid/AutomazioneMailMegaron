import { createHash } from 'crypto';
import { getPool } from '../db/client';

export interface ListingSearchResult {
  externalListingId: string;
  idAnnuncioGestim: string | null;
  title: string | null;
  city: string | null;
  zone: string | null;
  address: string | null;
  price: number | null;
  propertyType: string | null;
  contractType: string | null;
  surfaceM2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  updatedAt: string;
}

export interface ListingInsertRow {
  import_run_id: number;
  agency_code: string | null;
  site_code: string | null;
  external_listing_id: string;
  id_annuncio_gestim: string | null;
  title: string | null;
  contract_type: string | null;
  property_type: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  address: string | null;
  zone: string | null;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  surface_m2: number | null;
  description: string | null;
  raw_json: Record<string, unknown>;
}

export interface ExistingListingRow {
  id: number;
  matchKey: string;
  contentHash: string | null;
}

export interface UpsertSummary {
  inserted: number;
  updated: number;
  unchanged: number;
  insertedKeys: string[];
  updatedKeys: string[];
  unchangedKeys: string[];
}

/** Chiave usata per "trovare lo stesso annuncio": id_annuncio_gestim, fallback external_listing_id. */
export function buildMatchKey(row: Pick<ListingInsertRow, 'id_annuncio_gestim' | 'external_listing_id'>): string {
  return row.id_annuncio_gestim && row.id_annuncio_gestim.trim().length > 0
    ? row.id_annuncio_gestim
    : row.external_listing_id;
}

/**
 * SHA1 hex stabile sui campi che ci interessa monitorare (compresi raw_json serializzato).
 * 40 byte/record vs tenere in RAM tutto il JSON di centinaia di annunci esistenti.
 */
export function computeContentHash(row: ListingInsertRow): string {
  const h = createHash('sha1');
  const fields: Array<unknown> = [
    row.id_annuncio_gestim,
    row.title,
    row.contract_type,
    row.property_type,
    row.city,
    row.province,
    row.postal_code,
    row.address,
    row.zone,
    row.price,
    row.bedrooms,
    row.bathrooms,
    row.surface_m2,
    row.description,
    JSON.stringify(row.raw_json ?? {}),
  ];
  for (const f of fields) {
    h.update(f === null || f === undefined ? '\u0000' : String(f));
    h.update('\u0001');
  }
  return h.digest('hex');
}

export async function findByExternalId(
  externalListingId: string
): Promise<ListingSearchResult | null> {
  const pool = getPool();
  const result = await pool.query<{
    external_listing_id: string;
    id_annuncio_gestim: string | null;
    title: string | null;
    city: string | null;
    zone: string | null;
    address: string | null;
    price: number | null;
    property_type: string | null;
    contract_type: string | null;
    surface_m2: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    updated_at: Date;
  }>(
    `SELECT external_listing_id, id_annuncio_gestim, title, city, zone, address, price, property_type, contract_type,
            surface_m2, bedrooms, bathrooms, updated_at
     FROM gestim_listings
     WHERE external_listing_id = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [externalListingId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    externalListingId: row.external_listing_id,
    idAnnuncioGestim: row.id_annuncio_gestim,
    title: row.title,
    city: row.city,
    zone: row.zone,
    address: row.address,
    price: row.price != null ? Number(row.price) : null,
    propertyType: row.property_type,
    contractType: row.contract_type,
    surfaceM2: row.surface_m2 != null ? Number(row.surface_m2) : null,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Carica in memoria SOLO {id, matchKey, contentHash} per gli annunci dell'agency/site.
 * Volutamente niente raw_json/title/ecc.: con migliaia di record la differenza in RAM è enorme.
 */
export async function loadExistingForUpsert(
  agencyCode: string | null,
  siteCode: string | null
): Promise<Map<string, ExistingListingRow>> {
  const pool = getPool();
  const result = await pool.query<{
    id: number;
    match_key: string;
    content_hash: string | null;
  }>(
    `SELECT id,
            COALESCE(id_annuncio_gestim, external_listing_id) AS match_key,
            content_hash
     FROM gestim_listings
     WHERE COALESCE(agency_code, '') = COALESCE($1, '')
       AND COALESCE(site_code, '') = COALESCE($2, '')`,
    [agencyCode ?? '', siteCode ?? '']
  );
  const map = new Map<string, ExistingListingRow>();
  for (const r of result.rows) {
    map.set(r.match_key, { id: r.id, matchKey: r.match_key, contentHash: r.content_hash });
  }
  return map;
}

const INSERT_COLUMNS = 20;

async function bulkInsert(rows: Array<{ row: ListingInsertRow; hash: string }>): Promise<number> {
  if (rows.length === 0) return 0;
  const pool = getPool();
  const values: unknown[] = [];
  const placeholders: string[] = [];
  let i = 0;
  for (const { row, hash } of rows) {
    const ps = Array.from({ length: INSERT_COLUMNS }, () => `$${++i}`).join(', ');
    placeholders.push(`(${ps}, NOW(), NOW())`);
    values.push(
      row.import_run_id,
      row.agency_code,
      row.site_code,
      row.external_listing_id,
      row.id_annuncio_gestim,
      row.title,
      row.contract_type,
      row.property_type,
      row.city,
      row.province,
      row.postal_code,
      row.address,
      row.zone,
      row.price,
      row.bedrooms,
      row.bathrooms,
      row.surface_m2,
      row.description,
      JSON.stringify(row.raw_json),
      hash
    );
  }
  const sql = `INSERT INTO gestim_listings (
    import_run_id, agency_code, site_code, external_listing_id, id_annuncio_gestim, title, contract_type, property_type,
    city, province, postal_code, address, zone, price, bedrooms, bathrooms, surface_m2, description, raw_json,
    content_hash, created_at, updated_at
  ) VALUES ${placeholders.join(', ')}`;
  const result = await pool.query(sql, values);
  return result.rowCount ?? 0;
}

/**
 * UPDATE batch via UNNEST: una sola query per tutti i record cambiati.
 * Aggiorna anche updated_at = NOW() solo per le righe toccate.
 */
async function bulkUpdate(items: Array<{ id: number; row: ListingInsertRow; hash: string }>): Promise<number> {
  if (items.length === 0) return 0;
  const pool = getPool();

  const ids: number[] = [];
  const importRunIds: number[] = [];
  const idAnnunci: Array<string | null> = [];
  const titles: Array<string | null> = [];
  const contractTypes: Array<string | null> = [];
  const propertyTypes: Array<string | null> = [];
  const cities: Array<string | null> = [];
  const provinces: Array<string | null> = [];
  const postalCodes: Array<string | null> = [];
  const addresses: Array<string | null> = [];
  const zones: Array<string | null> = [];
  const prices: Array<number | null> = [];
  const bedrooms: Array<number | null> = [];
  const bathrooms: Array<number | null> = [];
  const surfaces: Array<number | null> = [];
  const descriptions: Array<string | null> = [];
  const rawJsons: string[] = [];
  const hashes: string[] = [];

  for (const it of items) {
    ids.push(it.id);
    importRunIds.push(it.row.import_run_id);
    idAnnunci.push(it.row.id_annuncio_gestim);
    titles.push(it.row.title);
    contractTypes.push(it.row.contract_type);
    propertyTypes.push(it.row.property_type);
    cities.push(it.row.city);
    provinces.push(it.row.province);
    postalCodes.push(it.row.postal_code);
    addresses.push(it.row.address);
    zones.push(it.row.zone);
    prices.push(it.row.price);
    bedrooms.push(it.row.bedrooms);
    bathrooms.push(it.row.bathrooms);
    surfaces.push(it.row.surface_m2);
    descriptions.push(it.row.description);
    rawJsons.push(JSON.stringify(it.row.raw_json));
    hashes.push(it.hash);
  }

  const sql = `
    UPDATE gestim_listings AS l SET
      import_run_id = u.import_run_id,
      id_annuncio_gestim = u.id_annuncio_gestim,
      title = u.title,
      contract_type = u.contract_type,
      property_type = u.property_type,
      city = u.city,
      province = u.province,
      postal_code = u.postal_code,
      address = u.address,
      zone = u.zone,
      price = u.price,
      bedrooms = u.bedrooms,
      bathrooms = u.bathrooms,
      surface_m2 = u.surface_m2,
      description = u.description,
      raw_json = u.raw_json::jsonb,
      content_hash = u.content_hash,
      updated_at = NOW()
    FROM (
      SELECT
        UNNEST($1::int[])      AS id,
        UNNEST($2::int[])      AS import_run_id,
        UNNEST($3::text[])     AS id_annuncio_gestim,
        UNNEST($4::text[])     AS title,
        UNNEST($5::text[])     AS contract_type,
        UNNEST($6::text[])     AS property_type,
        UNNEST($7::text[])     AS city,
        UNNEST($8::text[])     AS province,
        UNNEST($9::text[])     AS postal_code,
        UNNEST($10::text[])    AS address,
        UNNEST($11::text[])    AS zone,
        UNNEST($12::numeric[]) AS price,
        UNNEST($13::int[])     AS bedrooms,
        UNNEST($14::int[])     AS bathrooms,
        UNNEST($15::numeric[]) AS surface_m2,
        UNNEST($16::text[])    AS description,
        UNNEST($17::text[])    AS raw_json,
        UNNEST($18::text[])    AS content_hash
    ) AS u
    WHERE l.id = u.id
  `;

  const result = await pool.query(sql, [
    ids,
    importRunIds,
    idAnnunci,
    titles,
    contractTypes,
    propertyTypes,
    cities,
    provinces,
    postalCodes,
    addresses,
    zones,
    prices,
    bedrooms,
    bathrooms,
    surfaces,
    descriptions,
    rawJsons,
    hashes,
  ]);
  return result.rowCount ?? 0;
}

/**
 * Strategia upsert "intelligente":
 * - carica solo {id, matchKey, contentHash} delle righe esistenti per agency/site;
 * - per ogni nuova riga calcola hash e decide INSERT / UPDATE / SKIP;
 * - esegue al massimo 2 query batch (insert + update).
 */
export async function upsertMany(
  rows: ListingInsertRow[],
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

  const existing = await loadExistingForUpsert(agencyCode, siteCode);

  const toInsert: Array<{ row: ListingInsertRow; hash: string }> = [];
  const toUpdate: Array<{ id: number; row: ListingInsertRow; hash: string }> = [];

  const seenInBatch = new Set<string>();
  for (const row of rows) {
    const key = buildMatchKey(row);
    if (seenInBatch.has(key)) continue;
    seenInBatch.add(key);

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
