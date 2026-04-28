-- =============================================================================
-- MIGRATION : Fix persistance — colonnes manquantes pour mappers
-- =============================================================================
-- Contexte : audit révélé que 6 champs JS ne sont jamais persistés car les
-- colonnes correspondantes n'existent pas en BDD. Ce script ajoute les colonnes
-- manquantes de façon idempotente.
--
-- Usage : Supabase Dashboard -> SQL Editor -> coller -> Run
-- Sans danger : utilise ADD COLUMN IF NOT EXISTS, exécutable plusieurs fois.
-- =============================================================================

-- 1) RDV : lien vers bon cadeau (bug "Jenny la Bouclette")
ALTER TABLE rdv
  ADD COLUMN IF NOT EXISTS bon_cadeau_id TEXT;

-- 2) Prestations : lien vers bon cadeau (corrige le filtre du CA)
ALTER TABLE prestations
  ADD COLUMN IF NOT EXISTS bon_cadeau_id TEXT;

-- 3) Dépenses : marqueurs pour la dédup des abonnements auto-générés (Planity etc.)
ALTER TABLE depenses
  ADD COLUMN IF NOT EXISTS type           TEXT,
  ADD COLUMN IF NOT EXISTS abonnement_nom TEXT;

-- 4) Clients & prospects : champ "Société" du formulaire jamais persisté
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS societe TEXT;

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS societe TEXT,
  ADD COLUMN IF NOT EXISTS parrain TEXT;

-- 5) Collaborateurs : champ "Poste" du formulaire jamais persisté
ALTER TABLE collaborateurs
  ADD COLUMN IF NOT EXISTS poste TEXT;

-- =============================================================================
-- Index utiles (perf des futures queries de filtrage)
-- =============================================================================

-- Pour la dédup des abonnements (modal-manager.js:genererDepensesAbonnements)
CREATE INDEX IF NOT EXISTS idx_depenses_type_user
  ON depenses (user_id, type, abonnement_nom, date)
  WHERE type IS NOT NULL;

-- Pour retrouver le RDV d'un bon cadeau (view-manager.js:1695)
CREATE INDEX IF NOT EXISTS idx_rdv_bon_cadeau
  ON rdv (bon_cadeau_id)
  WHERE bon_cadeau_id IS NOT NULL;

-- Pour exclure les prestations payées en bon cadeau du calcul de CA (calculations.js)
CREATE INDEX IF NOT EXISTS idx_prestations_bon_cadeau
  ON prestations (bon_cadeau_id)
  WHERE bon_cadeau_id IS NOT NULL;

-- =============================================================================
-- Vérification post-migration
-- =============================================================================
-- Lance les SELECT suivants après le ALTER pour confirmer :

-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'rdv' AND column_name = 'bon_cadeau_id';
-- > Doit renvoyer 1 ligne : bon_cadeau_id | text

-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'depenses' AND column_name IN ('type', 'abonnement_nom');
-- > Doit renvoyer 2 lignes
