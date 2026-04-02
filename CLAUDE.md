# Instructions Claude - Elise Massage PWA

## Projet
PWA de gestion pour Elise Massage, deployee sur GitHub Pages avec Supabase comme backend.

## Deploiement

### Push vers GitHub
**IMPORTANT** : Le git push ne fonctionne PAS en ligne de commande car le credential manager est configure pour le compte Tiimizy.

**Procedure obligatoire :**
1. Faire le commit normalement via Claude (`git add` + `git commit`)
2. **Rappeler a l'utilisateur** : "Ouvre GitHub Desktop, selectionne le repo `elise-massage-app`, et clique sur **Push origin** pour publier les changements."
3. Attendre la confirmation de l'utilisateur avant de continuer

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
- User Elise UID : `3bdf06ef-9bbe-4777-9ae4-68f7cd94d127`
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
- `scripts/migrate-data.js` : migration JSON -> Supabase (contient service_role key)
- `scripts/schema-supabase.sql` : schema BDD complet

## Versioning
- Format : `X.Y.Z.W` ou X.Y = version PWA, Z.W = heritage version Electron
- Version actuelle : `1.0.5.2` (PWA 1.0, basee sur Electron 5.2)
- **OBLIGATOIRE** : a chaque modification demandee par l'utilisateur, proposer un bump de version et attendre validation
- Mettre a jour la version dans 3 endroits : `package.json`, `index.html` (burger menu + footer)
- Le numero de version sert a verifier que la derniere version est deployee

## Regles
- Ne JAMAIS modifier le projet Electron original (`elise-massage-app/`)
- Toujours tester les modifications sur la PWA deployee
- Le fichier `scripts/migrate-data.js` contient la service_role key - ne PAS l'exposer publiquement
- Apres chaque commit, rappeler a l'utilisateur de push via GitHub Desktop
