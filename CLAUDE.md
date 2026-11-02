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
- `scripts/schema-supabase.sql` : schema BDD complet
- `js/core/encaissements.js` : LA regle d'encaissement (ce que les clientes ont paye), utilisee par tous les ecrans
- `js/gestion/` : onglet Gestion (calculs purs, donnees de ses tables `gestion_*`, ecran) ; plan dans `tasks/todo-tresorerie.md`
- `scripts/migration-gestion.sql` : tables de l'onglet Gestion (appliquee le 2026-11-02)
- `js/core/google-ads.js` + `supabase/functions/google-ads/` : Google Ads passe par une fonction Supabase
  en LECTURE SEULE ; les cles (jeton developpeur, secret OAuth) sont des secrets Supabase, la connexion
  Google est dans la table `google_ads_connexion` (`scripts/migration-google-ads.sql`). Plan :
  `tasks/todo-google-ads.md`. Ne JAMAIS remettre une cle Google dans le code (depot public)
- `js/analytics/evolution-*.js` : graphique « Évolution » d'Analytics (calculs purs + ecran) ; les filtres
  du haut d'Analytics (Annee, Mois, « Ce mois-ci ») pilotent toute la page. Plan : `tasks/todo-analytics.md`
- ApexCharts est charge SANS version (`cdn.jsdelivr.net/npm/apexcharts` = la derniere, 8.x en nov. 2026) :
  tout apercu doit charger la meme URL, sinon on teste une autre bibliotheque que celle du logiciel
- `tests/` : `npm test` (Node, sans dependance) ; `tests/apercu-gestion.html` et `tests/apercu-analytics.html`
  = l'onglet avec des donnees fictives
- `tasks/prive/` : documents avec les chiffres d'Elise, ignores par Git. Le depot est visible publiquement :
  aucun montant personnel dans le code, les tests ou les commits

## Versioning
- Format : `X.Y.Z.W` ou X.Y = version PWA, Z.W = heritage version Electron
- Version actuelle : `1.1.2.2` (Gestion : la liste des categories flotte au-dessus de la fenetre, plus d'ascenseur force ni de liste coupee)
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
