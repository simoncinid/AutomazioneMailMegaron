import { getPool } from '../db/client';
import type { GestimListing } from '../types';

export interface ListingSearchResult {
  externalListingId: string;
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

export async function findByExternalId(
  externalListingId: string
): Promise<ListingSearchResult | null> {
  const pool = getPool();
  const result = await pool.query<{
    external_listing_id: string;
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
    `SELECT external_listing_id, title, city, zone, address, price, property_type, contract_type,
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

export async function deleteByAgencyAndSite(
  agencyCode: string | null,
  siteCode: string | null
): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    'DELETE FROM gestim_listings WHERE COALESCE(agency_code, \'\') = COALESCE($1, \'\') AND COALESCE(site_code, \'\') = COALESCE($2, \'\') RETURNING id',
    [agencyCode ?? '', siteCode ?? '']
  );
  return result.rowCount ?? 0;
}

export async function insertMany(rows: ListingInsertRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const pool = getPool();
  const values: unknown[] = [];
  const placeholders: string[] = [];
  let i = 0;
  for (const row of rows) {
    const cols = 18;
    const ps = Array.from({ length: cols }, () => `$${++i}`).join(', ');
    placeholders.push(`(${ps})`);
    values.push(
      row.import_run_id,
      row.agency_code,
      row.site_code,
      row.external_listing_id,
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
      JSON.stringify(row.raw_json)
    );
  }
  const sql = `INSERT INTO gestim_listings (
    import_run_id, agency_code, site_code, external_listing_id, title, contract_type, property_type,
    city, province, postal_code, address, zone, price, bedrooms, bathrooms, surface_m2, description, raw_json
  ) VALUES ${placeholders.join(', ')}`;
  const result = await pool.query(sql, values);
  return result.rowCount ?? 0;
}
