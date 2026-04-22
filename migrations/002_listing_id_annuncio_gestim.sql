-- Riferimento annuncio Gestim (tag XML <Codice>), tipicamente 7–9 caratteri (non l'id numerico <id>).

ALTER TABLE gestim_listings
  ADD COLUMN IF NOT EXISTS id_annuncio_gestim VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_gestim_listings_id_annuncio_gestim
  ON gestim_listings (id_annuncio_gestim);
