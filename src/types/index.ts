export interface GestimCallback {
  id: number;
  received_at: Date;
  method: string;
  headers_json: Record<string, unknown>;
  query_json: Record<string, unknown>;
  raw_url: string;
  zip_url: string | null;
  status: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface GestimImportRun {
  id: number;
  callback_id: number | null;
  zip_url: string;
  import_type: string;
  status: 'running' | 'success' | 'failed';
  started_at: Date;
  finished_at: Date | null;
  agency_code: string | null;
  site_code: string | null;
  files_found_json: Record<string, unknown>;
  total_listings_found: number | null;
  total_listings_imported: number | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface GestimLookup {
  id: number;
  import_run_id: number;
  agency_code: string | null;
  site_code: string | null;
  lookup_scope: string;
  lookup_group: string;
  lookup_key: string;
  lookup_value: string;
  language: string | null;
  raw_json: Record<string, unknown> | null;
  created_at: Date;
}

export interface GestimListing {
  id: number;
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
  created_at: Date;
  updated_at: Date;
}

export interface GestimAgency {
  id: number;
  import_run_id: number;
  agency_code: string | null;
  site_code: string | null;
  external_agency_id: string | null;
  name: string | null;
  status: string | null;
  email: string | null;
  phone: string | null;
  raw_json: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface GestimAgent {
  id: number;
  import_run_id: number;
  agency_code: string | null;
  site_code: string | null;
  external_agent_id: string | null;
  agency_external_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  raw_json: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface ParsedGestimFilename {
  agencyCode: string | null;
  siteCode: string;
  kind: 'annunci' | 'agenzie' | 'agenti' | 'lookup';
}

export interface LookupMap {
  [group: string]: { [key: string]: string };
}
