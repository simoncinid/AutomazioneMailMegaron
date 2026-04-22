-- Gestim Integration - Initial Schema

CREATE TABLE IF NOT EXISTS gestim_callbacks (
  id SERIAL PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method VARCHAR(10) NOT NULL,
  headers_json JSONB DEFAULT '{}',
  query_json JSONB DEFAULT '{}',
  raw_url TEXT NOT NULL,
  zip_url TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'received',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gestim_import_runs (
  id SERIAL PRIMARY KEY,
  callback_id INTEGER REFERENCES gestim_callbacks(id),
  zip_url TEXT NOT NULL,
  import_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  agency_code VARCHAR(50),
  site_code VARCHAR(50),
  files_found_json JSONB DEFAULT '{}',
  total_listings_found INTEGER,
  total_listings_imported INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gestim_lookups (
  id SERIAL PRIMARY KEY,
  import_run_id INTEGER NOT NULL REFERENCES gestim_import_runs(id) ON DELETE CASCADE,
  agency_code VARCHAR(50),
  site_code VARCHAR(50),
  lookup_scope VARCHAR(50) NOT NULL,
  lookup_group VARCHAR(100) NOT NULL,
  lookup_key VARCHAR(100) NOT NULL,
  lookup_value TEXT NOT NULL,
  language VARCHAR(10),
  raw_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gestim_agencies (
  id SERIAL PRIMARY KEY,
  import_run_id INTEGER NOT NULL REFERENCES gestim_import_runs(id) ON DELETE CASCADE,
  agency_code VARCHAR(50),
  site_code VARCHAR(50),
  external_agency_id VARCHAR(100),
  name TEXT,
  status VARCHAR(50),
  email VARCHAR(255),
  phone VARCHAR(50),
  raw_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gestim_agents (
  id SERIAL PRIMARY KEY,
  import_run_id INTEGER NOT NULL REFERENCES gestim_import_runs(id) ON DELETE CASCADE,
  agency_code VARCHAR(50),
  site_code VARCHAR(50),
  external_agent_id VARCHAR(100),
  agency_external_id VARCHAR(100),
  name TEXT,
  email VARCHAR(255),
  phone VARCHAR(50),
  raw_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gestim_listings (
  id SERIAL PRIMARY KEY,
  import_run_id INTEGER NOT NULL REFERENCES gestim_import_runs(id) ON DELETE CASCADE,
  agency_code VARCHAR(50),
  site_code VARCHAR(50),
  external_listing_id VARCHAR(100) NOT NULL,
  id_annuncio_gestim VARCHAR(100),
  title TEXT,
  contract_type VARCHAR(100),
  property_type VARCHAR(100),
  city VARCHAR(255),
  province VARCHAR(100),
  postal_code VARCHAR(20),
  address TEXT,
  zone VARCHAR(255),
  price NUMERIC,
  bedrooms INTEGER,
  bathrooms INTEGER,
  surface_m2 NUMERIC,
  description TEXT,
  raw_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one active listing per agency/site/external_id (for full refresh)
CREATE UNIQUE INDEX IF NOT EXISTS idx_gestim_listings_agency_site_external
  ON gestim_listings (COALESCE(agency_code, ''), COALESCE(site_code, ''), external_listing_id);

CREATE INDEX IF NOT EXISTS idx_gestim_listings_external_id ON gestim_listings(external_listing_id);
CREATE INDEX IF NOT EXISTS idx_gestim_listings_agency_site ON gestim_listings(agency_code, site_code);
CREATE INDEX IF NOT EXISTS idx_gestim_callbacks_received_at ON gestim_callbacks(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_gestim_import_runs_started_at ON gestim_import_runs(started_at DESC);
