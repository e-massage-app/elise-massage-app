-- =====================================================================
-- MIGRATION RELANCES — v1.0.10.0
-- Idempotent : rejouable sans risque, aucune suppression de donnees.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLE relances
--    client_id en TEXT (clients.id est TEXT, PAS uuid — verifie en base
--    le 05/08/2026 ; scripts/schema-supabase.sql est perime sur ce point)
--    Dates en TEXT : convention de l'app (prestations.date est deja TEXT)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS relances (
  id                    TEXT PRIMARY KEY,
  user_id               UUID NOT NULL REFERENCES auth.users(id),
  client_id             TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  groupe                TEXT NOT NULL,
  precisions            TEXT,
  intervalle_jours      INTEGER NOT NULL DEFAULT 28,
  dernier_rdv_override  TEXT,
  date_relance_override TEXT,
  relancee              BOOLEAN NOT NULL DEFAULT false,
  relancee_le           TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS relances_client_groupe_uniq
  ON relances (client_id, groupe);
CREATE INDEX IF NOT EXISTS relances_client_idx ON relances (client_id);

ALTER TABLE relances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_data" ON relances;
CREATE POLICY "users_own_data" ON relances FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- 2. CORRECTION FICHE PAULINA IRISH (validee par Jordan le 05/08/2026)
--    Orthographe : "Paolina" -> "Paulina" + ajout du telephone
-- ---------------------------------------------------------------------
UPDATE clients
SET prenom    = 'Paulina',
    telephone = coalesce(nullif(telephone, ''), '07 87 48 17 61')
WHERE id = 'id_1765221917633_xq0dgmaq3';


-- ---------------------------------------------------------------------
-- 3. NOTES CLIENTES (issues du fichier Excel)
--    AJOUT en fin de notes existantes — jamais d'ecrasement.
--    Le garde NOT LIKE rend chaque UPDATE rejouable sans doublon.
-- ---------------------------------------------------------------------
UPDATE clients
SET notes = coalesce(nullif(notes, '') || E'\n', '')
            || 'Peau sensible, hypotrichose, planning qui change souvent'
WHERE id = 'id_1780066934771_kd3n279wy'
  AND coalesce(notes, '') NOT LIKE '%hypotrichose%';

UPDATE clients
SET notes = coalesce(nullif(notes, '') || E'\n', '')
            || 'Maillot semi-intégral mais n''a presque rien, très rapide ! Cliente adorable ++'
WHERE id = 'id_1782909632614_5o8ysjrwp'
  AND coalesce(notes, '') NOT LIKE '%Cliente adorable%';

UPDATE clients
SET notes = coalesce(nullif(notes, '') || E'\n', '')
            || 'Peau sensible, fibromyalgie, arrive souvent avec 2/3 minutes de retard'
WHERE id = 'id_1780525001901_8ioif2iex'
  AND coalesce(notes, '') NOT LIKE '%fibromyalgie%';

UPDATE clients
SET notes = coalesce(nullif(notes, '') || E'\n', '')
            || 'Serveuse Mile End Café, trop gentille'
WHERE id = 'id_1780146876623_av1bvrnd1'
  AND coalesce(notes, '') NOT LIKE '%Mile End%';


-- ---------------------------------------------------------------------
-- 4. IMPORT DES 5 SUIVIS EPILATION
--    AUCUNE DATE IMPORTEE : l'app derive le dernier RDV des prestations
--    reelles (filtrees par groupe). Impossible d'importer une date fausse.
--    Seul est importe ce qu'Elise a decide et que l'app ne peut deviner :
--    les zones, l'intervalle, et le flag "deja relancee".
-- ---------------------------------------------------------------------
INSERT INTO relances (id, user_id, client_id, groupe, precisions, intervalle_jours, relancee)
VALUES
  ('id_1785888000001_rlnesi', 'a202db6e-2f5c-4c33-9ce7-8b14dde15327',
   'id_1780066934771_kd3n279wy', 'Épilation',
   'Maillot intégral + aisselles + JE', 35, true),

  ('id_1785888000002_rloust', 'a202db6e-2f5c-4c33-9ce7-8b14dde15327',
   'id_1782909632614_5o8ysjrwp', 'Épilation',
   'Maillot semi-intégral + cuisses + 1/2 bras', 28, true),

  ('id_1785888000003_rlpacc', 'a202db6e-2f5c-4c33-9ce7-8b14dde15327',
   'id_1780525001901_8ioif2iex', 'Épilation',
   'Maillot simple + cuisses + fesses', 28, false),

  ('id_1785888000004_rlveys', 'a202db6e-2f5c-4c33-9ce7-8b14dde15327',
   'id_1780146876623_av1bvrnd1', 'Épilation',
   'Maillot intégral + sourcils', 35, false),

  ('id_1785888000005_rlirish', 'a202db6e-2f5c-4c33-9ce7-8b14dde15327',
   'id_1765221917633_xq0dgmaq3', 'Épilation',
   'Maillot intégral', 34, false)
ON CONFLICT (client_id, groupe) DO NOTHING;


-- ---------------------------------------------------------------------
-- 5. CONTROLE FINAL
-- ---------------------------------------------------------------------
SELECT c.prenom || ' ' || coalesce(c.nom, '') AS cliente,
       r.precisions,
       r.intervalle_jours,
       r.relancee,
       left(coalesce(c.notes, '(aucune)'), 60) AS notes
FROM relances r
JOIN clients c ON c.id = r.client_id
ORDER BY c.nom;
