# v1.0.10.0 — Onglet "Relances"

Remplace le fichier `Suivi-Epilation-Elise.xlsx`. Objectif : zero double saisie.

## Principe (valide avec Jordan)

**Opt-in** : une cliente entre dans le suivi parce qu'Elise l'a decidee (au feeling),
PAS automatiquement parce qu'elle a eu une epilation. Elise choisit **qui**,
l'app gere **quand**.

## Decisions actees

| Sujet | Choix |
|---|---|
| Emplacement | Nouvel onglet principal `Relances` (PAS le dashboard) |
| Sous-onglets | Par groupe (Epilation / Massages / HeadSpa), generes dynamiquement |
| Intervalle | Par cliente, modifiable. Defaut 28 j |
| Seuil "bientot" | 5 jours (celui de son fichier Excel) |
| Zones epilees | Champ libre, pre-rempli depuis le dernier RDV, editable |
| Dernier RDV | Calcule depuis les prestations + surcharge manuelle possible |
| Notes | Dans `client.notes` (ajout, sans ecraser) + affichees sur la page Relances |
| SMS | Modele pre-rempli editable, par groupe, stocke dans `parametres` |

## Pieges identifies (ne pas se tromper)

- ⚠️ `client.zones` = **"Zones sensibles"** (massage). Ce N'EST PAS les zones epilees.
  Ne pas reutiliser -> champ `precisions` dedie sur la ligne de relance.
- ⚠️ "Relance" existe deja pour les **prospects** (`actions.relance` / `relanceDate`) :
  relance commerciale one-shot. Concept DIFFERENT du cycle recurrent. Ne pas melanger
  dans l'UI ni dans le vocabulaire.
- ⚠️ Fidelite et Relances coexistent sur les massages (recompenser vs reveiller).
  Verifier que les deux pastilles ne se chevauchent pas dans la fiche client.
- ⚠️ Envoi SMS : on **n'envoie jamais** automatiquement. On pre-remplit, Elise envoie.

## Etapes

### 1. SQL — table `relances`
- [ ] `scripts/migration-relances.sql` idempotent (CREATE TABLE IF NOT EXISTS + RLS)
- Colonnes : `id` TEXT PK, `client_id` TEXT FK CASCADE, `groupe` TEXT,
  `precisions` TEXT, `intervalle_jours` INT DEFAULT 28, `dernier_rdv_override` DATE,
  `date_relance_override` DATE, `relancee` BOOL DEFAULT false, `relancee_le` DATE,
  `created_at` TIMESTAMPTZ
- `UNIQUE (client_id, groupe)` -> une cliente peut etre suivie Epilation ET Massage

### 2. data-manager.js
- [ ] `mapRelanceFromDb` / `mapRelanceToDb`
- [ ] CRUD : `addRelance`, `updateRelance`, `deleteRelanceById`, `getRelances`
- [ ] `getDernierRdvGroupe(clientId, groupe)` — max(date) des prestations du groupe
      (via `getGroupeForSoinId`), override prioritaire
- [ ] `getDateRelance(relance)` — override, sinon dernierRdv + intervalle
- [ ] `getStatutRelance(relance)` — ✅ relancee / 🔴 depassee / 🟠 <=5j / 🟢 a jour
- [ ] `marquerRelancee(id)` / `resetRelance(id)`
- [ ] Hook : creation RDV/prestation du groupe -> `relancee=false` + purge des
      overrides de date (l'intervalle par cliente, lui, est conserve)
- [ ] `getRelanceSmsTemplates()` / `setRelanceSmsTemplates()` (cle `parametres`)

### 3. UI — onglet Relances
- [ ] Bouton nav desktop + mobile (`showTab('relances')`)
- [ ] `<div id="relances" class="tab-content">` dans index.html
- [ ] Sous-onglets par groupe (reutiliser le pattern des onglets stats)
- [ ] Tableau : Cliente (+tel cliquable) | Precisions | Dernier RDV | Relance prevue |
      Statut | Notes | Actions
- [ ] Tri par date de relance croissante (urgentes en haut)
- [ ] Bouton "+ Ajouter au suivi" -> recherche client
- [ ] Actions : ✅ Relancee | 💬 SMS | ✏️ Editer | 🗑 Retirer du suivi
- [ ] Etat vide : "Aucune cliente suivie dans ce groupe"
- [ ] CSS aligne sur la DA de l'annuaire (`.annu-*`) — PAS de vert residuel

### 4. SMS
- [ ] Modal : message pre-rempli editable + boutons "Copier" et "Ouvrir SMS"
- [ ] Placeholders : `{prenom}`, `{precisions}`, `{dernierRdv}`
- [ ] Modeles par groupe, editables dans Parametres

### 5. Fiche client
- [ ] Pastille "Suivi relance" dans Vue d'ensemble (groupe + date + statut)
- [ ] Bouton "Ajouter / retirer du suivi"

### 6. Import des 5 clientes (EN DEUX TEMPS, aucune ecriture a l'aveugle)
- [ ] Etape A : SELECT de verification -> Jordan colle le resultat
- [ ] Etape B : INSERT genere a partir du resultat reel
- Donnees source (fichier Excel, 5 lignes) :
  Anne-Laure Nesi (35j) / Ines Oustani (28j) / Caroline Paccou (28j) /
  Zoe Veyssieres (35j) / Paulina Irish (34j)
- Notes a reporter : peau sensible, hypotrichose, fibromyalgie, retards, etc.

### 7. Finalisation
- [ ] Bump 1.0.9.6 -> 1.0.10.0 (package.json, index.html x2, CLAUDE.md)
- [ ] `CACHE_NAME` -> `elise-massage-v41`
- [ ] `node --check` sur les fichiers modifies
- [ ] Commit + push (SSH OK) + rappel Ctrl+Shift+R

## Review — implemente le 05/08/2026 (v1.0.10.0)

### Fait
- `scripts/migration-relances.sql` : table + RLS + correction Paulina + notes + import des 5. Joue en prod, controle OK.
- `data-manager.js` : mappers, CRUD DB-first avec rollback, calculs (dernier RDV par groupe,
  date de relance, statut), modeles SMS, hook `syncRelanceApresRdv`.
- `view-manager.js` : onglet Relances (sous-onglets par groupe, tri par urgence), modals
  ajout/edition/SMS/modeles, badges de navigation.
- `index.html` : onglet nav desktop + mobile, section Relances.
- `css/views.css` : styles specifiques (le reste reutilise la DA `.annu-*`).
- `client-services.js` : bloc "Suivi de relance" dans la fiche client.
- `app.js` : hooks apres creation RDV **et** apres creation prestation.

### Verification
Test Node sur le VRAI data-manager.js (pas une copie), avec les donnees reelles des
5 clientes : les 5 dates de relance calculees reproduisent son fichier Excel au jour pres.
8 controles cibles OK, dont le piege du massage d'Anne-Laure du 14/07 (correctement
ignore au profit de son epilation du 26/06) et le passage d'annee bissextile.

### Ecarts vs plan initial
- **Aucune date importee** (ni dernier RDV ni date de relance) : l'app les derive des
  prestations reelles. Impossible d'importer une date fausse. Decide en cours de route.
- **Statut "RDV prevu" ajoute** (hors fichier Excel) : evite de relancer une cliente qui a
  deja repris rendez-vous.
- `tasks/todo.md` NON ecrase (ancien audit persistance conserve) -> fichier dedie.

### Restant / a surveiller
- [ ] Test par Elise sur la prod (checklist fournie a Jordan)
- [ ] Keepalive Supabase toujours en echec quotidien (sujet distinct, non traite)
- [ ] Nettoyage possible des fonctions mortes de l'annuaire (`updateClientsList`,
      `generateCompactClientCard`, `generateClientTableRow`, `setViewMode`, `toggleSection`)
