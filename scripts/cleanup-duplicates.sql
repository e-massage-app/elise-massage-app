-- =============================================================================
-- CLEANUP : Supprimer les doublons d'abonnements auto-generes
-- =============================================================================
-- Contexte : avant le fix mappers (commit 93d8c33), la dedup dans
-- genererDepensesAbonnements() echouait apres chaque reload car les champs
-- type et abonnement_nom n'etaient pas persistes. Resultat : +1 ligne Planity
-- par session d'app. Ce script garde la plus ANCIENNE de chaque doublon
-- (date + fournisseur + notes='Genere automatiquement') et supprime le reste.
--
-- A LANCER UNE SEULE FOIS, apres le deploiement de la version 1.0.6.0.
-- =============================================================================

-- 1) Apercu : combien de doublons ?
SELECT date, fournisseur, COUNT(*) AS nb, SUM(montant) AS total_actuel
FROM depenses
WHERE notes = 'Genere automatiquement'
GROUP BY date, fournisseur
HAVING COUNT(*) > 1
ORDER BY date DESC, fournisseur;

-- 2) Apercu : qu'est-ce qui va etre supprime (en gardant le plus ancien) ?
WITH ranked AS (
  SELECT id, date, fournisseur, montant, created_at,
         ROW_NUMBER() OVER (PARTITION BY date, fournisseur, notes ORDER BY created_at) AS rn
  FROM depenses
  WHERE notes = 'Genere automatiquement'
)
SELECT id, date, fournisseur, montant, created_at, rn
FROM ranked
WHERE rn > 1
ORDER BY date DESC, fournisseur, rn;

-- 3) SUPPRESSION (decommenter pour executer)
-- ATTENTION : passe en prod uniquement apres avoir verifie l'apercu ci-dessus
-- DELETE FROM depenses
-- WHERE id IN (
--   SELECT id FROM (
--     SELECT id, ROW_NUMBER() OVER (
--       PARTITION BY date, fournisseur, notes ORDER BY created_at
--     ) AS rn
--     FROM depenses
--     WHERE notes = 'Genere automatiquement'
--   ) t
--   WHERE rn > 1
-- );

-- 4) Apres suppression : backfill des champs type/abonnement_nom sur les
-- depenses-abonnement existantes pour que la dedup fonctionne correctement
-- a partir de maintenant (decommenter pour executer)
-- UPDATE depenses
-- SET type = 'abonnement-auto',
--     abonnement_nom = fournisseur
-- WHERE notes = 'Genere automatiquement'
--   AND type IS NULL;

-- 5) Verification finale : plus de doublons ?
-- SELECT date, fournisseur, COUNT(*) AS nb
-- FROM depenses
-- WHERE notes = 'Genere automatiquement'
-- GROUP BY date, fournisseur
-- HAVING COUNT(*) > 1;
-- > Doit retourner 0 ligne.
