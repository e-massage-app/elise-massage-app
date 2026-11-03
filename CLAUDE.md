# Instructions Claude - Elise Massage PWA

## Projet
PWA de gestion pour Elise Massage, deployee sur GitHub Pages avec Supabase comme backend.

## Deploiement

### Push vers GitHub
Le push en ligne de commande **fonctionne** depuis le 15/07/2026 (`git push origin main` via Claude).

**Contexte multi-comptes GitHub (important) :**
L'utilisateur a plusieurs comptes GitHub. Le Credential Manager Windows est cale sur
`neaujordan` (= Tiimizy + Installizy), qui n'a **aucun acces** a ce repo -> tout remote
HTTPS renvoie un 403. Le repo appartient au compte **`e-massage-app`** (gamezoneyt@gmail.com).

**Solution en place :** cle SSH dediee + alias, qui contourne le Credential Manager.
- Cle : `~/.ssh/id_ed25519_emassage` (enregistree sur le compte `e-massage-app`)
- Alias dans `~/.ssh/config` : `Host github.com-emassage` -> `IdentityFile ~/.ssh/id_ed25519_emassage` + `IdentitiesOnly yes`
- Remote : `git@github.com-emassage:e-massage-app/elise-massage-app.git`
- Verification : `ssh -T git@github.com-emassage` doit repondre `Hi e-massage-app!`

**NE PAS TOUCHER** au `Host github.com` standard, au Credential Manager, ni a la cle
`~/.ssh/id_ed25519` : les projets pros de l'utilisateur (Tiimizy, Installizy, Graphidesk,
GreenFork) en dependent. L'alias `github.com-emassage` est isole et ne concerne que ce repo.

**Procedure :** commit + `git push origin main` via Claude, puis rappeler a l'utilisateur
de faire **Ctrl+Shift+R** (le cache HTTP du navigateur est distinct du cache du service worker).

### GitHub Pages
- Repo : `e-massage-app/elise-massage-app` (prive)
- URL : `https://app.elise-massage.fr` (custom domain via CNAME OVH)
- URL alternative : `https://e-massage-app.github.io/elise-massage-app/`
- Branche : `main` / root `/`
- Chaque push declenche un re-deploy automatique (~1-2min)

### Supabase
- Projet : `e-massage-app's Project`
- URL : `https://ixuwialfycbzvliezliv.supabase.co`
- Region : EU West (Ireland)
- User Elise UID : `a202db6e-2f5c-4c33-9ce7-8b14dde15327`
- Keepalive : GitHub Action quotidien a 6h UTC

## Stack technique
- Frontend : Vanilla HTML/CSS/JS (pas de framework)
- Backend : Supabase (PostgreSQL + Auth + RLS)
- Hebergement : GitHub Pages (gratuit)
- PWA : manifest.json + service worker (cache assets uniquement, pas de mode offline)
- IDs : format TEXT (`id_timestamp_random`), PAS des UUID

## Architecture des donnees
- Cache en memoire (`appData`) pour la performance des getters
- Chaque mutation CRUD ecrit dans Supabase + met a jour le cache
- `saveData()` est un no-op (chaque operation sauve individuellement)
- Mapping camelCase (JS) <-> snake_case (DB) via fonctions `mapXxxFromDb/ToDb`

## Fichiers cles
- `js/config.js` : credentials Supabase (anon key)
- `js/core/data-manager.js` : coeur de l'app, CRUD Supabase + cache
- `js/auth.js` : login/logout Supabase
- `js/app.js` : initialisation, auth check, offline detection
- `scripts/migrate-data.js` : migration JSON -> Supabase (la service_role key est lue via env var SUPABASE_SERVICE_ROLE_KEY, jamais commitee)
- `scripts/migration-fix-persistance.sql` : migration SQL idempotente ajoutant les colonnes manquantes (bon_cadeau_id, type, abonnement_nom, societe, parrain, poste)
- `scripts/schema-supabase.sql` : schema BDD complet, releve sur la vraie base le 2026-11-02 et essaye a blanc
  (reconstruit les 14 tables, la securite RLS et les declencheurs) ; a reprendre apres chaque migration
- `js/core/encaissements.js` : LA regle d'encaissement (ce que les clientes ont paye), utilisee par tous les ecrans
- `js/gestion/` : onglet Gestion (calculs purs, donnees de ses tables `gestion_*`, ecran) ; plan dans `tasks/todo-tresorerie.md`
- `scripts/migration-gestion.sql` : tables de l'onglet Gestion (appliquee le 2026-11-02)
- `js/core/google-ads.js` + `supabase/functions/google-ads/` : Google Ads passe par une fonction Supabase
  en LECTURE SEULE ; les cles (jeton developpeur, secret OAuth) sont des secrets Supabase, la connexion
  Google est dans la table `google_ads_connexion` (`scripts/migration-google-ads.sql`). Plan :
  `tasks/todo-google-ads.md`. Ne JAMAIS remettre une cle Google dans le code (depot public)
- `js/analytics/evolution-*.js` : graphique « Évolution » d'Analytics (calculs purs + ecran) ; les filtres
  du haut d'Analytics (Annee, Mois, « Ce mois-ci ») pilotent toute la page. Plan : `tasks/todo-analytics.md`
- v1.2.0.0 (audit `tasks/audit-2026-11-02.md`) :
  - `js/core/persistance.js` : les parametres ne s'ecrivent que s'ils ont change (plus d'ecrasement par une
    vieille copie), lecture de toutes les tables par pages de 1000 (aucune limite), format de sauvegarde
  - regles pures testees : `js/core/bons-cadeaux.js` (statut effectif, expiration), `js/core/rdv-prestations.js`
    (lien prestation -> RDV par `rdv_id`), `js/core/abonnements.js` (id stable `abonnement_id`),
    `js/core/google-ads-calculs.js` (un seul calcul du cache Google Ads), `js/core/regles-ecrans.js`
  - sauvegarde : fonction Supabase `sauvegarde-hebdo` (lundi 06:00 UTC via pg_cron, e-mail Resend a Elise,
    compte Resend de Jordan depuis le 2026-11-03 : domaine elise-massage.fr, expediteur no-reply@,
    secrets RESEND_API_KEY / SAUVEGARDE_DESTINATAIRE / SAUVEGARDE_SECRET + Vault `sauvegarde_secret`),
    `scripts/migration-sauvegarde-hebdo.sql`. Copie de securite avant migration : schema prive `sauvegarde`
    (tables `*_20261102`, non expose par l'API)
  - `scripts/migration-rdv-id.sql` (appliquee le 2026-11-02) : `prestations.rdv_id`, `depenses.abonnement_id`
  - `tests/apercu-app.html` : le VRAI logiciel sur une fausse base en memoire (verifier qu'une version demarre)
- `js/ui/calendrier-reglages.js` : picto ⚙ du calendrier (jours fermes, vacances / fermetures exceptionnelles,
  couleur / opacite / hachures). Cle `calendrier` de `parametres`, ecrite seule (dans CLES_PARAMETRES_A_PART).
  Un jour ferme est seulement colore : un RDV y reste possible. Apercu : `tests/apercu-calendrier.html`
- Bon cadeau a imprimer (v1.2.1.0, plan `tasks/todo-bon-cadeau-pdf.md`) : `js/ui/bon-cadeau-pdf.js` (fenetre,
  apercu, PDF via pdf-lib 1.17.1 + fontkit 1.1.1 figes) + `js/core/bon-cadeau-carte.js` (regles pures testees).
  Le texte est pose sur le PDF VECTORIEL d'Elise (`assets/bon-cadeau/bon-vierge.pdf`) : jamais d'image aplatie.
  Polices : `scripts/polices-bon-cadeau.py` (Raleway a chiffres alignes renommee, emojis PLEINS tires de
  Twemoji ; dessins alignes sur 4 octets, sinon le sous-ensemble de pdf-lib les abime). Textes imprimes
  gardes dans `bons_cadeaux.carte` (`scripts/migration-bon-cadeau-carte.sql`, appliquee le 2026-11-03)
- Carte cadeau payee par CB sur le site (v1.3.0.0, plan `tasks/todo-carte-cadeau-en-ligne.md`) : fonction
  `supabase/functions/carte-cadeau` (SumUp « hosted checkout », notification toujours reverifiee aupres de
  SumUp, bon + PDF + e-mails rejouables sans doublon) ; regles pures `js/core/carte-cadeau-commande.js` ;
  le PDF vient de `creerPdf` (`js/core/bon-cadeau-carte.js`), le MEME que le bouton 🖨️. Table
  `commandes_carte_cadeau` + tache pg_cron `carte-cadeau-relance` (`scripts/migration-carte-cadeau-en-ligne.sql`).
  Secret `SUMUP_API_KEY` : tant que c'est la cle du compte de test, commandes « essai » (aucun bon, rien a
  Elise). Deployer en joignant les 3 fichiers `js/core` importes, chemins depuis la racine du depot
  (point d'entree `supabase/functions/carte-cadeau/index.ts`)
- ApexCharts est charge SANS version (`cdn.jsdelivr.net/npm/apexcharts` = la derniere, 8.x en nov. 2026) :
  tout apercu doit charger la meme URL, sinon on teste une autre bibliotheque que celle du logiciel
- `tests/` : `npm test` (Node, sans dependance) ; `tests/apercu-gestion.html` et `tests/apercu-analytics.html`
  = l'onglet avec des donnees fictives
- `tasks/prive/` : documents avec les chiffres d'Elise, ignores par Git. Le depot est visible publiquement :
  aucun montant personnel dans le code, les tests ou les commits

## Versioning
- Format : `X.Y.Z.W` ou X.Y = version PWA, Z.W = heritage version Electron
- Version actuelle : `1.2.1.0` (bon cadeau a imprimer en PDF depuis l'app, sur le visuel d'Elise, emojis pleins)
- **OBLIGATOIRE** : a chaque modification demandee par l'utilisateur, proposer un bump de version et attendre validation
- Mettre a jour la version dans 3 endroits : `package.json`, `index.html` (burger menu + footer)
- Puis **`node scripts/estampiller-version.js`** : repose `?v=X.Y.Z.W` sur tous les
  `<script src="js/...">` et `<link href="css/...">`. Sans cette etape, le cache HTTP
  du navigateur peut resservir un ancien JS sous un index.html a jour (constate en
  v1.0.18.2 : `google-ads-roi.js` perime alors que le HTML annoncait la bonne version)
- Ne pas oublier le numero de cache du service worker dans `sw.js` (`elise-massage-vNN`)
- Le numero de version sert a verifier que la derniere version est deployee

## Regles
- Ne JAMAIS modifier le projet Electron original (`elise-massage-app/`)
- Toujours tester les modifications sur la PWA deployee
- La service_role key Supabase ne doit JAMAIS etre commitee (utiliser env var SUPABASE_SERVICE_ROLE_KEY)
- Apres chaque commit, rappeler a l'utilisateur de push via GitHub Desktop
