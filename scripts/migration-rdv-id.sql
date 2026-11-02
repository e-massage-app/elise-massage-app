-- =============================================================================
-- MIGRATION v1.2.0.0 : liens stables prestation -> RDV et depense -> abonnement
-- =============================================================================
-- A APPLIQUER AVANT DE DEPLOYER LA v1.2.0.0 : le logiciel envoie ces deux
-- colonnes a chaque enregistrement de prestation et de depense ; sans elles,
-- Supabase refuse l'enregistrement.
--
-- Faire d'abord une sauvegarde complete de la base (decision de Jordan, I9).
--
-- Usage : Supabase Dashboard -> SQL Editor -> coller -> Run
-- Sans danger : ADD COLUMN IF NOT EXISTS, executable plusieurs fois.
-- =============================================================================

-- 1) Prestations : identifiant du RDV dont elles sont nees (« Valider la prestation »).
--    Avant, le lien se deduisait de la date + heure + fiche : modifier l'heure du
--    RDV le cassait (doublon au calendrier, carte cadeau non liberee).
ALTER TABLE prestations
  ADD COLUMN IF NOT EXISTS rdv_id TEXT;

-- 2) Depenses : identifiant de l'abonnement qui les a generees.
--    Avant, le nom servait de cle : renommer un abonnement recreait la depense du mois.
ALTER TABLE depenses
  ADD COLUMN IF NOT EXISTS abonnement_id TEXT;

-- 3) (Facultatif) Rattrapage des prestations deja transformees : on renseigne
--    rdv_id seulement quand le creneau (fiche + date + heure) designe UN seul RDV
--    transforme et UNE seule prestation. Les autres gardent l'ancienne regle
--    (meme date + heure + fiche), que le logiciel applique toujours sans rdv_id.
UPDATE prestations p
SET rdv_id = r.id
FROM rdv r
WHERE p.rdv_id IS NULL
  AND r.transforme_en_prestation = true
  AND r.user_id = p.user_id
  AND r.client_id = p.client_id
  AND r.date = p.date
  AND r.heure = p.heure
  AND (SELECT count(*) FROM rdv r2
        WHERE r2.user_id = p.user_id AND r2.client_id = p.client_id
          AND r2.date = p.date AND r2.heure = p.heure
          AND r2.transforme_en_prestation = true) = 1
  AND (SELECT count(*) FROM prestations p2
        WHERE p2.user_id = p.user_id AND p2.client_id = p.client_id
          AND p2.date = p.date AND p2.heure = p.heure) = 1;

-- Verification (doit lister les deux colonnes) :
-- SELECT table_name, column_name FROM information_schema.columns
--  WHERE (table_name = 'prestations' AND column_name = 'rdv_id')
--     OR (table_name = 'depenses' AND column_name = 'abonnement_id');
