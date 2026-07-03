# Audit Persistance Supabase — Elise Massage PWA

> **TL;DR** : 14 chemins de perte de données totale + 6 champs droppés silencieusement par les mappers + 16+ callsites avec erreurs Supabase avalées en silence + détection offline insuffisante. La migration Electron→PWA a laissé énormément de `saveData()` orphelins (no-op).

---

## 🔴 P0 — PERTE DE DONNÉES TOTALE (rien n'arrive en BDD)

### Mappers/Schéma incomplets (champs droppés à l'écriture)

- [ ] **F1** — `prestations.bon_cadeau_id` : ajouter colonne BDD + mapper. **Casse le CA** (filtre `!p.bonCadeauId` inopérant après reload). Lu dans calculations.js:245, 340, 353, 548, 623, 790, 833 + utils-services.js:1266, 1439.
- [ ] **F2** — `depenses.type` + `depenses.abonnement_nom` : ajouter colonnes + mappers. **Cause des doublons Planity**.
- [ ] **F3** — `rdv.bon_cadeau_id` : ajouter colonne + mapper. **Casse le flow attribution bon cadeau** (lu view-manager.js:749, 1695 + form-manager.js:773-792).
- [ ] **F4** — `clients.societe` + `prospects.societe` : ajouter colonnes + mappers. Champ "Société" du formulaire jamais persisté.
- [ ] **F5** — `prospects.parrain` : ajouter colonne + mapper (existe déjà côté clients).
- [ ] **F6** — `collaborateurs.poste` : ajouter colonne + mapper.

### `saveData()` orphelins (ajouter insertEntity/updateEntity/deleteEntity)

- [ ] **F7** — modal-manager.js:6020-6032 `handleAttribuerRdvBonSubmit` ⚠️ **BUG JENNY LA BOUCLETTE** : remplacer `saveData()` par `insertEntity('rdv', ...)` + `updateEntity('bons_cadeaux', bon.id, ...)` pour le bénéficiaire.
- [ ] **F8** — modal-manager.js:2841 `handleCollaborateurFormSubmit` : appeler `insertEntity('collaborateurs', ...)`.
- [ ] **F9** — modal-manager.js:2902 `handleCollaborateurEditSubmit` : appeler `updateEntity('collaborateurs', ...)`.
- [ ] **F10** — form-manager.js:665 `deleteCollaborateur` : appeler `deleteEntity('collaborateurs', ...)`.
- [ ] **F11** — view-manager.js:1494-1529 `toggleJourInstitut` : appeler `saveParametresToDb()` + `insertEntity/deleteEntity('depenses', ...)` pour la dépense loyer 30€.
- [ ] **F12** — modal-manager.js:3186 `migrerMoyensPaiement` : itérer `updateEntity('prestations', ...)` pour chaque prestation modifiée.
- [ ] **F13** — modal-manager.js:2076-2105 `saveAbonnement / toggleAbonnement / deleteAbonnement` : tous appellent `saveData()` no-op au lieu de `saveParametresToDb()`.
- [ ] **F14** — view-manager.js:2013 `saveAnnuaireViewPrefs` : appeler `saveParametresToDb()`.
- [ ] **F15** — client-services.js:1662 `removeTagFromPersonUI` : appeler `updateEntity` sur la table de la personne.
- [ ] **F16** — client-services.js:1687 `deleteTagConfirm` : itérer `updateEntity` sur clients+prospects + persister `customTags`.
- [ ] **F17** — client-services.js:1793 `createTagFromManagement` : persister `customTags`.
- [ ] **F18** — `customTags` n'a aucune table ni aucune entrée parametres : décider d'un stockage (parametres ou nouvelle table) puis persister.

---

## 🟠 P1 — ÉCHECS SILENCIEUX (la donnée pourrait être en BDD ou pas, l'utilisateur ne sait jamais)

- [ ] **F19** — Modifier `_persist` (business-services.js:6-18) : en cas d'erreur, afficher un toast rouge à l'utilisateur ET propager l'exception au lieu d'avaler.
- [ ] **F20** — Idem pour les ~16 try/catch silencieux dans client-services.js (lignes 60, 64, 74, 78, 94-98, 104, 131-134, 166-171, 1309, 1322, 1624) et modal-manager.js:2165.
- [ ] **F21** — `saveTagsSelection` (client-services.js:1620-1624) : ajouter le `await` manquant devant `updateEntity`.
- [ ] **F22** — `RdvDuplication.saveAndDuplicate` (modal-manager.js:417) : ajouter `await` devant `BusinessServices.createRdv`.
- [ ] **F23** — `PrestationDuplication.saveAndDuplicate` (modal-manager.js:575) : ajouter `await` devant `BusinessServices.createPrestation`.
- [ ] **F24** — `handleParametresFormSubmit` (modal-manager.js:3289) : ajouter `await` devant `DataManager.saveParametres`.
- [ ] **F25** — `addCampaignPeriod / endCampaignPeriod / updateCampaignPeriod / deleteCampaignPeriod / setValiditeBonsCadeauxMois / addSoin / updateSoin / deleteSoin / addCategorie / updateCategorie / archiveCategorie` (data-manager.js : 9 callsites) : ajouter les `await` manquants devant `saveParametresToDb()`.
- [ ] **F26** — `handleBonCadeauFormSubmit` (modal-manager.js:5818, 5821) : ajouter `await` devant `BusinessServices.updateBonCadeau / createBonCadeau`.

---

## 🟡 P2 — RACE CONDITIONS (cache muté avant DB)

- [ ] **F27** — Inverser l'ordre dans **toutes** les fonctions de business-services.js et client-services.js : appeler la DB en premier, n'écrire dans `appData.X` qu'après succès. Sur erreur, afficher toast et NE PAS muter le cache.
  - Liste précise : business-services.js lignes 42-49, 55-59, 71-80, 90-117, 155-163, 196-197, 206-213, 251-252, 281-286, 295-296, 435-436, 446-464, 472-473, 484-486, 495-497, 506-509, 532-533 + client-services.js:59-78, 90-97, 103-104, 128-133, 161-170, 1306-1322, 1620-1624 + app.js:316-322.

---

## 🟢 P3 — DÉTECTION OFFLINE & QUALITÉ

- [ ] **F28** — Remplacer `navigator.onLine` par un ping périodique (toutes les 30s) HEAD `https://ixuwialfycbzvliezliv.supabase.co/rest/v1/parametres?select=id&limit=1`. Si timeout/erreur ≥ 3x → afficher l'overlay offline.
- [ ] **F29** — `saveParametresToDb()` n'utilise que `upsert`, donc les `delete parametres.X` (cf. disconnectFromGoogleAds, clearApiKey) ne suppriment pas en DB. Implémenter une vraie sync (DELETE des clés absentes du cache).
- [ ] **F30** — Nettoyer `bons_cadeaux.client_id` (DEAD_DB) ou s'en servir.
- [ ] **F31** — Nettoyer `client-services.js:67-68` (assignements `statut`/`actions` dans la branche client — reliquat).
- [ ] **F32** — Nettoyer `rdv.lieu` dans `attribuerRdvBonCadeau` (jamais lu ailleurs).

---

## Cleanup BDD post-fix

- [ ] **C1** — SQL pour supprimer les doublons d'abonnement (Planity et autres) en gardant le plus ancien :
```sql
DELETE FROM depenses
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY date, fournisseur, notes ORDER BY created_at) AS rn
    FROM depenses
    WHERE notes = 'Genere automatiquement'
  ) t WHERE rn > 1
);
```
- [ ] **C2** — Si confirmé manquant : ré-insérer le RDV "Rituel douceur premium" de Jenny la Bouclette avec `created_at = '2026-04-27...'`.
- [ ] **C3** — Backfill `prestations.bon_cadeau_id` pour les prestations payées en bon cadeau (matcher via date/heure/clientId vs bons_cadeaux).

---

## Stratégie d'implémentation proposée

**Commit 1 — Migration BDD** (ALTER TABLE pour F1, F2, F3, F4, F5, F6) + bump version
**Commit 2 — Fix mappers** (data-manager.js : aligner avec nouvelles colonnes)
**Commit 3 — Fix saveData() orphelins** (F7-F18) + bump version
**Commit 4 — Fix échecs silencieux & race** (F19-F27) + toast d'erreur global + bump version
**Commit 5 — Détection offline réelle + cleanup** (F28+) + bump version
**Cleanup SQL** (C1, C2, C3) à part dans Supabase Dashboard

À chaque commit : push → vérifier sur app.elise-massage.fr → valider avec toi avant de passer au suivant.
