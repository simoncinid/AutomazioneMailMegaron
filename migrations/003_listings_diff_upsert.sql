-- Passaggio dal full-refresh (delete + reinsert) all'upsert "intelligente":
-- match su id_annuncio_gestim (fallback external_listing_id) entro stessa agency/site,
-- update solo se i contenuti cambiano (confronto via content_hash sha1 hex).

ALTER TABLE gestim_listings
  ADD COLUMN IF NOT EXISTS content_hash CHAR(40);

ALTER TABLE gestim_agencies
  ADD COLUMN IF NOT EXISTS content_hash CHAR(40);

ALTER TABLE gestim_agents
  ADD COLUMN IF NOT EXISTS content_hash CHAR(40);

DROP INDEX IF EXISTS idx_gestim_listings_agency_site_external;

-- Stesso schema dell'indice univoco sotto: elimina duplicati storici (mantieni la riga con id più alto).
DELETE FROM gestim_listings a
USING gestim_listings b
WHERE a.id < b.id
  AND COALESCE(a.agency_code, '') = COALESCE(b.agency_code, '')
  AND COALESCE(a.site_code, '') = COALESCE(b.site_code, '')
  AND COALESCE(a.id_annuncio_gestim, a.external_listing_id) = COALESCE(b.id_annuncio_gestim, b.external_listing_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gestim_listings_agency_site_match
  ON gestim_listings (
    COALESCE(agency_code, ''),
    COALESCE(site_code, ''),
    COALESCE(id_annuncio_gestim, external_listing_id)
  );

CREATE INDEX IF NOT EXISTS idx_gestim_agencies_agency_site_external
  ON gestim_agencies (agency_code, site_code, external_agency_id);

CREATE INDEX IF NOT EXISTS idx_gestim_agents_agency_site_external
  ON gestim_agents (agency_code, site_code, external_agent_id);
