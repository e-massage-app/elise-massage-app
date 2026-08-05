-- =====================================================================
-- REMISE A ZERO DES SUIVIS DE RELANCE APRES LES TESTS
-- Ne touche QUE la table `relances`.
-- Les RDV, prestations et fiches clientes ne sont PAS modifies.
-- =====================================================================

-- 1) Remettre les 5 suivis dans leur etat d'import initial
UPDATE relances SET precisions = 'Maillot intégral + aisselles + JE', intervalle_jours = 35,
  relancee = true,  relancee_le = NULL, dernier_rdv_override = NULL, date_relance_override = NULL
WHERE client_id = 'id_1780066934771_kd3n279wy' AND groupe = 'Épilation';

UPDATE relances SET precisions = 'Maillot semi-intégral + cuisses + 1/2 bras', intervalle_jours = 28,
  relancee = true,  relancee_le = NULL, dernier_rdv_override = NULL, date_relance_override = NULL
WHERE client_id = 'id_1782909632614_5o8ysjrwp' AND groupe = 'Épilation';

UPDATE relances SET precisions = 'Maillot simple + cuisses + fesses', intervalle_jours = 28,
  relancee = false, relancee_le = NULL, dernier_rdv_override = NULL, date_relance_override = NULL
WHERE client_id = 'id_1780525001901_8ioif2iex' AND groupe = 'Épilation';

UPDATE relances SET precisions = 'Maillot intégral + sourcils', intervalle_jours = 35,
  relancee = false, relancee_le = NULL, dernier_rdv_override = NULL, date_relance_override = NULL
WHERE client_id = 'id_1780146876623_av1bvrnd1' AND groupe = 'Épilation';

UPDATE relances SET precisions = 'Maillot intégral', intervalle_jours = 34,
  relancee = false, relancee_le = NULL, dernier_rdv_override = NULL, date_relance_override = NULL
WHERE client_id = 'id_1765221917633_xq0dgmaq3' AND groupe = 'Épilation';


-- 2) AVANT de supprimer : voir les suivis ajoutes pendant les tests
--    (lance cette requete SEULE d'abord, verifie, puis passe au 3)
SELECT r.id, c.prenom || ' ' || coalesce(c.nom,'') AS cliente, r.groupe, r.precisions
FROM relances r JOIN clients c ON c.id = r.client_id
WHERE NOT (r.groupe = 'Épilation' AND r.client_id IN (
  'id_1780066934771_kd3n279wy','id_1782909632614_5o8ysjrwp','id_1780525001901_8ioif2iex',
  'id_1780146876623_av1bvrnd1','id_1765221917633_xq0dgmaq3'));


-- 3) Supprimer ces suivis de test (a lancer seulement apres avoir vu le 2)
-- DELETE FROM relances
-- WHERE NOT (groupe = 'Épilation' AND client_id IN (
--   'id_1780066934771_kd3n279wy','id_1782909632614_5o8ysjrwp','id_1780525001901_8ioif2iex',
--   'id_1780146876623_av1bvrnd1','id_1765221917633_xq0dgmaq3'));


-- 4) RDV / prestations crees pendant les tests : A TOI de voir.
--    Je ne les supprime pas : impossible de distinguer un test d'un vrai RDV.
SELECT 'RDV' AS source, r.id, r.date, r.type,
       c.prenom || ' ' || coalesce(c.nom,'') AS cliente
FROM rdv r LEFT JOIN clients c ON c.id = r.client_id
WHERE r.created_at > now() - interval '1 day'
UNION ALL
SELECT 'PRESTATION', p.id, p.date, p.type,
       c.prenom || ' ' || coalesce(c.nom,'')
FROM prestations p LEFT JOIN clients c ON c.id = p.client_id
WHERE p.created_at > now() - interval '1 day'
ORDER BY 3 DESC;


-- 5) Controle final
SELECT c.prenom || ' ' || coalesce(c.nom,'') AS cliente, r.precisions,
       r.intervalle_jours, r.relancee, r.dernier_rdv_override, r.date_relance_override
FROM relances r JOIN clients c ON c.id = r.client_id ORDER BY c.nom;
