-- Migration v1.0.9.0 - Fidelite clients
-- Idempotente : peut etre relancee sans risque.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS sans_fidelite BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fidelite_atteinte JSONB DEFAULT '[]'::jsonb;

-- Verification
SELECT
  COUNT(*) AS total_clients,
  COUNT(*) FILTER (WHERE sans_fidelite = TRUE) AS clients_sans_fidelite,
  COUNT(*) FILTER (WHERE fidelite_atteinte != '[]'::jsonb) AS clients_avec_paliers
FROM clients;
