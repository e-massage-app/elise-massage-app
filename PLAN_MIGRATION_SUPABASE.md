# Plan de Migration - Elise Massage App v5.2.0
## Electron (local) -> PWA + Supabase + GitHub Pages

> **Date de rédaction** : 01/04/2026
> **Statut** : A valider avant exécution
> **Priorité** : Le projet Electron actuel ne sera PAS modifié. On travaille sur une COPIE.

---

## Contexte

L'app Elise Massage est actuellement une app Electron desktop (v5.2.0, ~19k lignes JS vanilla) qui stocke tout dans un fichier JSON local (`AppData/Roaming/Elise Massage/data/massage-data.json`). L'objectif est de la rendre accessible sur mobile (PWA), synchronisée entre appareils, protégée par login, gratuite, et sans mode offline complexe.

### Contraintes clés
- **Gratuit** : Supabase free tier + GitHub Pages
- **Privé** : login obligatoire, noindex, repo privé
- **Pas de mode offline** : message clair "réseau requis" si pas de connexion
- **Keepalive Supabase** : cron GitHub Action pour éviter la pause après 7j d'inactivité
- **URL GitHub Pages** de base d'abord, CNAME OVH (sous-domaine) plus tard
- **Projet Electron intact** : on duplique le projet, on ne touche PAS à l'original

### Limites Supabase Free Tier
| Ressource | Limite | Suffisant ? |
|-----------|--------|-------------|
| Projets actifs | 2 max | Oui (1 seul) |
| BDD PostgreSQL | 500 MB | Oui (quelques MB de données) |
| Egress BDD | 5 GB/mois | Oui (1 utilisatrice) |
| Auth MAU | 50 000 | Oui |
| File Storage | 1 GB | Oui |
| **Pause inactivité** | **7 jours** | **Contourné par keepalive cron** |

---

## Architecture Cible

```
Utilisateur (PC / Mobile / Tablette)
        |
        v
  PWA (GitHub Pages - GRATUIT)
  HTML + CSS + JS + Service Worker (cache assets uniquement)
  Login Screen -> Supabase Auth
        |
        v
  SUPABASE (FREE TIER)
  +-- PostgreSQL (BDD, 8 tables)
  +-- Auth (email/password, signup désactivé)
  +-- Row Level Security (par user_id)

  GITHUB ACTIONS (keepalive cron quotidien)
```

### Sécurité
- **URL publique** (`https://USERNAME.github.io/elise-massage-app/`) mais :
  - `<meta name="robots" content="noindex, nofollow">` : invisible sur Google
  - Aucun lien entrant : personne ne tombe dessus par hasard
  - **Écran de login obligatoire** : sans identifiants, on voit la page de login et rien d'autre
  - **RLS Supabase** : toute requête non authentifiée est rejetée
  - **Signup désactivé** : impossible de créer un compte, seul le compte Elise existe

---

## Phase 0 : Préparation du projet PWA

### 0.1 - Dupliquer le projet
```
ACTIF/
  elise-massage-app/      <-- ORIGINAL, ne pas toucher
  elise-massage-pwa/      <-- COPIE de travail pour la migration
```

- Copier le dossier complet
- Dans la copie, supprimer : `main.js`, `node_modules/`, `build/`, `dist/`, `package-lock.json`
- Remplacer `package.json` par un fichier minimal (pas de deps Electron)

### 0.2 - Nettoyer les références Electron
**Fichiers concernés dans la copie :**
- `js/core/data-manager.js` : supprimer tous les `ipcRenderer.invoke()` (lignes 55-118, 472-491)
- `index.html` : supprimer le `<script>` Electron preload si présent
- `js/ui/modal-manager.js` : supprimer les appels IPC backup (lignes 3048-3160) - `select-backup-folder`, `validate-backup-path`

### 0.3 - Structure finale du projet PWA
```
elise-massage-pwa/
+-- index.html (adapté)
+-- login.html (NOUVEAU - page de connexion)
+-- manifest.json (NOUVEAU)
+-- sw.js (NOUVEAU - service worker)
+-- js/
|   +-- config.js (NOUVEAU - credentials Supabase)
|   +-- supabase-client.js (NOUVEAU - init client)
|   +-- auth.js (NOUVEAU - login/logout/session)
|   +-- core/
|   |   +-- data-manager.js (MODIFIÉ MAJEUR - Supabase au lieu d'IPC)
|   |   +-- calculations.js (INCHANGÉ)
|   +-- services/
|   |   +-- client-services.js (adaptations async)
|   |   +-- business-services.js (adaptations async)
|   |   +-- utils-services.js (adaptations async + export via download API)
|   +-- ui/
|   |   +-- view-manager.js (INCHANGÉ ou presque)
|   |   +-- modal-manager.js (supprimer IPC backup + adapter Google Ads OAuth redirect)
|   |   +-- form-manager.js (INCHANGÉ)
|   +-- analytics/
|       +-- google-ads-roi.js (INCHANGÉ)
+-- css/ (INCHANGÉ - base.css, components.css, views.css)
+-- assets/
|   +-- icons/ (NOUVEAU - icônes PWA 192px et 512px)
|   +-- logo.png (existant)
|   +-- icon.png (existant)
+-- scripts/
|   +-- migrate-data.js (NOUVEAU - script one-shot de migration des données)
+-- .github/
    +-- workflows/
        +-- keepalive.yml (NOUVEAU - cron Supabase anti-pause)
```

---

## Phase 1 : Configuration Supabase

### 1.1 - Créer le projet Supabase
- Aller sur https://supabase.com
- Nouveau projet : nom `elise-massage`, région EU West (Paris)
- Récupérer :
  - `SUPABASE_URL` (ex: `https://xxxxx.supabase.co`)
  - `SUPABASE_ANON_KEY` (clé publique, safe côté client car protégée par RLS)
  - `SERVICE_ROLE_KEY` (clé admin, utilisée UNIQUEMENT pour le script de migration)

### 1.2 - Schéma PostgreSQL

Exécuter dans le SQL Editor de Supabase :

```sql
-- ============================================
-- TABLE : clients
-- ============================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  nom TEXT,
  prenom TEXT,
  email TEXT,
  telephone TEXT,
  adresse TEXT,
  ville TEXT DEFAULT 'Porto-Vecchio',
  notes TEXT,
  sexe TEXT,
  parrain TEXT,
  canal_acquisition TEXT DEFAULT 'non-renseigne',
  date_acquisition TEXT,
  huiles TEXT,
  zones TEXT,
  allergies TEXT,
  pression TEXT,
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABLE : prospects
-- ============================================
CREATE TABLE prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  nom TEXT,
  prenom TEXT,
  email TEXT,
  telephone TEXT,
  adresse TEXT,
  ville TEXT DEFAULT 'Porto-Vecchio',
  notes TEXT,
  sexe TEXT,
  statut TEXT DEFAULT 'nouveau',
  canal_acquisition TEXT DEFAULT 'non-renseigne',
  date_acquisition TEXT,
  actions JSONB DEFAULT '{}',
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABLE : collaborateurs
-- ============================================
CREATE TABLE collaborateurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  prenom TEXT,
  nom TEXT,
  entreprise TEXT,
  specialites TEXT,
  telephone TEXT,
  email TEXT,
  adresse TEXT,
  tarif NUMERIC,
  notes TEXT,
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABLE : rdv (rendez-vous)
-- ============================================
CREATE TABLE rdv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  client_id UUID,
  date TEXT NOT NULL,
  heure TEXT,
  type TEXT,
  soin_id TEXT,
  duree INTEGER,
  statut TEXT DEFAULT 'confirme',
  notes TEXT,
  adresse_massage TEXT,
  distance_km NUMERIC,
  frais_deplacement NUMERIC,
  sexe TEXT,
  transforme_en_prestation BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABLE : prestations
-- ============================================
CREATE TABLE prestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  client_id UUID,
  date TEXT NOT NULL,
  heure TEXT,
  type TEXT,
  soin_id TEXT,
  duree INTEGER,
  prix NUMERIC DEFAULT 0,
  tips NUMERIC DEFAULT 0,
  notes TEXT,
  is_transformed BOOLEAN DEFAULT false,
  adresse_massage TEXT,
  distance_km NUMERIC,
  frais_deplacement NUMERIC,
  moyen_paiement TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABLE : depenses
-- ============================================
CREATE TABLE depenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  date TEXT NOT NULL,
  categorie TEXT NOT NULL,
  montant NUMERIC DEFAULT 0,
  description TEXT,
  prestation_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABLE : bons_cadeaux
-- ============================================
CREATE TABLE bons_cadeaux (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  montant NUMERIC DEFAULT 0,
  date_achat TEXT,
  date_expiration TEXT,
  statut TEXT DEFAULT 'actif',
  notes TEXT,
  client_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABLE : parametres (clé/valeur pour flexibilité)
-- ============================================
CREATE TABLE parametres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  cle TEXT NOT NULL,
  valeur JSONB,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, cle)
);

-- ============================================
-- INDEX pour performances
-- ============================================
CREATE INDEX idx_clients_user ON clients(user_id);
CREATE INDEX idx_clients_ville ON clients(ville);
CREATE INDEX idx_prospects_user ON prospects(user_id);
CREATE INDEX idx_rdv_user_date ON rdv(user_id, date);
CREATE INDEX idx_prestations_user_date ON prestations(user_id, date);
CREATE INDEX idx_prestations_client ON prestations(client_id);
CREATE INDEX idx_depenses_user_date ON depenses(user_id, date);
CREATE INDEX idx_depenses_categorie ON depenses(categorie);
CREATE INDEX idx_bons_cadeaux_user ON bons_cadeaux(user_id);
CREATE INDEX idx_parametres_user_cle ON parametres(user_id, cle);

-- ============================================
-- TRIGGER : updated_at automatique
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_clients_updated BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_prospects_updated BEFORE UPDATE ON prospects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_collaborateurs_updated BEFORE UPDATE ON collaborateurs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_rdv_updated BEFORE UPDATE ON rdv FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_prestations_updated BEFORE UPDATE ON prestations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_depenses_updated BEFORE UPDATE ON depenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_bons_cadeaux_updated BEFORE UPDATE ON bons_cadeaux FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_parametres_updated BEFORE UPDATE ON parametres FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 1.3 - Row Level Security (RLS)

```sql
-- Activer RLS sur toutes les tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborateurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdv ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE depenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bons_cadeaux ENABLE ROW LEVEL SECURITY;
ALTER TABLE parametres ENABLE ROW LEVEL SECURITY;

-- Policy : chaque user ne voit/modifie que SES données
-- (même si on n'a qu'une seule utilisatrice, c'est une bonne pratique de sécurité)
CREATE POLICY "users_own_data" ON clients FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_data" ON prospects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_data" ON collaborateurs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_data" ON rdv FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_data" ON prestations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_data" ON depenses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_data" ON bons_cadeaux FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_data" ON parametres FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### 1.4 - Créer le compte utilisateur Elise
1. Supabase Dashboard > Authentication > Settings > **Désactiver "Enable sign up"** (personne ne peut créer de compte)
2. Supabase Dashboard > Authentication > Users > **Add User** (email + mot de passe pour Elise)
3. Noter le `user_id` généré (nécessaire pour le script de migration)

---

## Phase 2 : Adaptation du Code

### 2.1 - config.js (NOUVEAU)
```javascript
// Credentials Supabase - safe côté client car RLS protège les données
const SUPABASE_CONFIG = {
  url: 'https://xxxxx.supabase.co',
  anonKey: 'eyJhbGc...'
};
```

### 2.2 - supabase-client.js (NOUVEAU)
- Charge le client Supabase via CDN `@supabase/supabase-js@2`
- Initialise : `const supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)`
- Expose `window.supabaseClient` pour usage global

### 2.3 - auth.js (NOUVEAU)
| Fonction | Rôle |
|----------|------|
| `checkSession()` | Vérifie si connecté, redirige vers login.html sinon |
| `login(email, password)` | `supabase.auth.signInWithPassword()` |
| `logout()` | `supabase.auth.signOut()` + redirect login.html |
| `getUser()` | Retourne l'utilisateur courant |
| `getUserId()` | Retourne le user_id (pour injection dans les requêtes) |
| `onAuthStateChange()` | Listener pour changement de session |

### 2.4 - login.html (NOUVEAU)
- Page simple : logo Elise Massage + formulaire email/password + bouton connexion
- Message d'erreur si mauvais identifiants
- Redirection vers index.html après login réussi
- Style cohérent avec l'app (couleurs `#d4a574`, `#1a1a2e`)
- Meta noindex inclus

### 2.5 - data-manager.js (MODIFICATION MAJEURE)
C'est le cœur de la migration. 1615 lignes à adapter.

**Stratégie : garder la même interface (noms de méthodes) mais changer l'implémentation.**

Le `appData` en mémoire est conservé comme CACHE local pour la performance.
Flux : écriture DB Supabase -> mise à jour cache -> retour au caller.
Les getters lisent depuis le cache (pas de requête réseau).

#### Tableau des changements

| Méthode actuelle | Changement |
|---|---|
| `loadData()` | `Promise.all()` sur toutes les tables Supabase, populate le cache `appData` |
| `saveData()` | Devient un **no-op** (chaque opération sauve individuellement) |
| `exportData()` | Génère un JSON blob + `URL.createObjectURL()` + `<a download>` |
| `importData()` | `<input type="file">` + parse JSON + insert Supabase batch |
| Tous les getters (`getAllClients()`, `getClientById()`, etc.) | **Inchangés** (lisent depuis le cache `appData`) |
| CRUD clients | `supabase.from('clients').insert/update/delete` + update cache |
| CRUD prospects | Idem |
| CRUD rdv | Idem |
| CRUD prestations | Idem |
| CRUD dépenses | Idem |
| CRUD bons_cadeaux | Idem |
| `saveParametres()` | `supabase.from('parametres').upsert()` par clé |
| Migrations (`migrerVilleParDefaut`, `migrerTarifs2026`, etc.) | Exécutées UNE FOIS lors de la migration initiale, puis supprimées |

#### Mapping camelCase (JS) <-> snake_case (DB)
Fonctions `mapToDb(obj)` et `mapFromDb(obj)` pour chaque entité.

Exemples :
- `clientId` <-> `client_id`
- `fraisDeplacement` <-> `frais_deplacement`
- `moyenPaiement` <-> `moyen_paiement`
- `isTransformed` <-> `is_transformed`
- `bonsCadeaux` <-> `bons_cadeaux`
- `dateAchat` <-> `date_achat`
- `canalAcquisition` <-> `canal_acquisition`
- `adresseMassage` <-> `adresse_massage`
- `transformeEnPrestation` <-> `transforme_en_prestation`

#### Injection du user_id
Chaque insert/update ajoute automatiquement : `user_id: Auth.getUserId()`

### 2.6 - Services (adaptations async)

**client-services.js :**
- `createClient()` : await DataManager operations
- `deleteClientById()` : cascade delete rdv/prestations via Supabase
- `convertProspectToClient()` / `convertClientToProspect()` : opérations séquentielles await

**business-services.js :**
- `createRdv()`, `createPrestation()` : await
- `transformRdvToPrestation()` : update rdv + insert prestation (séquentiel)
- `annulerTransformationRdv()` : update rdv + cleanup dépenses

**utils-services.js :**
- `exportDataUI()` : remplacer IPC dialog par download blob HTML5
- APIs externes (OpenRouteService, Nominatim, api-adresse.data.gouv.fr) : **INCHANGÉES** (déjà des fetch côté client)

### 2.7 - modal-manager.js (adaptations)
- **Supprimer** tout le bloc backup IPC (lignes 3048-3160) : `select-backup-folder`, `validate-backup-path`
- **Remplacer** par message "Les sauvegardes sont gérées automatiquement. Utilisez l'export JSON pour une copie manuelle."
- **Google Ads OAuth** : changer `redirect_uri` de `http://localhost:3000` vers l'URL GitHub Pages
- **Conserver** le reste tel quel (le client secret Google Ads reste dans le code - c'est une OAuth app, pas un secret serveur)

### 2.8 - index.html (adaptations)
Ajouter dans `<head>` :
```html
<!-- Supabase -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/config.js"></script>
<script src="js/supabase-client.js"></script>
<script src="js/auth.js"></script>

<!-- PWA -->
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#d4a574">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">

<!-- Sécurité / SEO -->
<meta name="robots" content="noindex, nofollow">
```

Ajouter dans le header/nav : **bouton déconnexion**

Supprimer : toute référence Electron (`require`, `ipcRenderer`, `nodeIntegration`)

### 2.9 - Gestion du réseau (PAS de mode offline)
```javascript
// Au chargement
if (!navigator.onLine) {
  showOfflineOverlay();
}

// Écoute les changements
window.addEventListener('offline', showOfflineOverlay);
window.addEventListener('online', hideOfflineOverlay);

function showOfflineOverlay() {
  // Overlay plein écran, bloque toute interaction
  // Message : "Connexion internet requise pour utiliser l'application."
  // Sous-texte : "Vérifiez votre connexion et rechargez la page."
  // Bouton : "Recharger" (window.location.reload())
}
```

---

## Phase 3 : Transformation PWA

### 3.1 - manifest.json
```json
{
  "name": "Elise Massage",
  "short_name": "Elise Massage",
  "description": "Application de gestion - Elise Massage",
  "start_url": "/elise-massage-app/",
  "scope": "/elise-massage-app/",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#1a1a2e",
  "theme_color": "#d4a574",
  "lang": "fr-FR",
  "icons": [
    { "src": "assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 3.2 - Service Worker (sw.js)
**Stratégie : cache les ASSETS statiques uniquement, PAS les données Supabase.**

- `install` : pré-cache index.html, login.html, CSS, JS, assets/images
- `fetch` :
  - Requête vers `*.supabase.co` -> **network only** (pas de cache données)
  - Requête vers assets statiques -> **cache first**, network fallback
  - Requête vers CDN (ApexCharts, date-fns, Supabase JS) -> **cache first**
  - Si offline et requête API -> laisser échouer (l'app gère l'affichage overlay)
- `activate` : cleanup des anciens caches

### 3.3 - Icônes PWA
- Générer depuis `assets/icon.png` : tailles 192x192 et 512x512
- Placer dans `assets/icons/`
- Outils : https://www.pwabuilder.com/imageGenerator ou conversion manuelle

### 3.4 - Registration du Service Worker
Dans `app.js` :
```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/elise-massage-app/sw.js');
}
```

---

## Phase 4 : Keepalive Supabase (GitHub Action)

### 4.1 - Fichier `.github/workflows/keepalive.yml`
```yaml
name: Supabase Keepalive
on:
  schedule:
    - cron: '0 6 * * *'  # Tous les jours à 6h UTC (8h Paris)
  workflow_dispatch:       # Permet déclenchement manuel

jobs:
  keepalive:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase pour éviter la pause
        run: |
          response=$(curl -s -o /dev/null -w "%{http_code}" \
            "${{ secrets.SUPABASE_URL }}/rest/v1/parametres?select=id&limit=1" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}")
          echo "Supabase responded with HTTP $response"
          if [ "$response" -ge 400 ]; then
            echo "::warning::Supabase returned HTTP $response"
            exit 1
          fi
```

### 4.2 - Secrets GitHub à configurer
Dans le repo > Settings > Secrets and variables > Actions :
- `SUPABASE_URL` : l'URL du projet Supabase
- `SUPABASE_ANON_KEY` : la clé publique anon

---

## Phase 5 : Déploiement GitHub Pages

### 5.1 - Créer le repo GitHub
- Nom : `elise-massage-app` (ou autre)
- Visibilité : **Privé** (code source invisible publiquement)
- Note : le site déployé via GitHub Pages sera techniquement accessible par URL, mais protégé par login Supabase + noindex

### 5.2 - Push initial
```bash
cd elise-massage-pwa/
git init
git add .
git commit -m "Initial PWA deployment"
git remote add origin https://github.com/USERNAME/elise-massage-app.git
git push -u origin main
```

### 5.3 - Activer GitHub Pages
1. Repo > Settings > Pages
2. Source : **Deploy from branch** `main` / root `/`
3. Attendre le build (~1-2 min)
4. URL disponible : `https://USERNAME.github.io/elise-massage-app/`

### 5.4 - Vérifications sécurité
- [x] `<meta name="robots" content="noindex, nofollow">` dans index.html ET login.html
- [x] Aucun lien entrant vers le site
- [x] Login Supabase obligatoire pour voir les données
- [x] RLS Supabase : chaque requête sans auth est rejetée
- [x] Signup Supabase désactivé

---

## Phase 6 : Migration des Données

### 6.1 - Exporter depuis l'app Electron
1. Ouvrir l'app Electron actuelle (l'originale, pas la copie)
2. Utiliser la fonction d'export existante (menu Paramètres > Exporter)
3. Sauvegarder le fichier `massage-data.json`

### 6.2 - Script de migration (`scripts/migrate-data.js`)
Script Node.js one-shot qui :
1. Lit le fichier JSON exporté
2. Se connecte à Supabase avec la **service_role key** (pas la anon key !)
3. Insère chaque entité dans la table correspondante :
   - `clients[]` -> table `clients` (+ `user_id` d'Elise)
   - `prospects[]` -> table `prospects`
   - `collaborateurs[]` -> table `collaborateurs`
   - `rdv[]` -> table `rdv`
   - `prestations[]` -> table `prestations`
   - `depenses[]` -> table `depenses`
   - `bonsCadeaux[]` -> table `bons_cadeaux`
   - `parametres{}` -> table `parametres` (une ligne par clé, valeur en JSONB)
4. Mappe camelCase -> snake_case
5. **Préserve les IDs existants** (pour ne pas casser les relations `clientId` dans rdv/prestations)
6. Log le nombre d'entités migrées par table

### 6.3 - Vérification post-migration
- Comparer le nombre d'entités JSON vs Supabase pour chaque table
- Tester quelques requêtes dans le SQL Editor Supabase
- Ouvrir la PWA et vérifier que le dashboard affiche les **mêmes KPIs** que l'app Electron

---

## Phase 7 : Tests et Validation

### 7.1 - Tests fonctionnels (sur mobile ET desktop)
- [ ] Login / Logout
- [ ] Dashboard : KPIs corrects, mêmes valeurs qu'Electron
- [ ] Calendrier : navigation mois, affichage RDV, couleurs
- [ ] Créer/modifier/supprimer un client
- [ ] Créer/modifier/supprimer un prospect
- [ ] Convertir prospect <-> client
- [ ] Créer/modifier/supprimer un RDV
- [ ] Transformer RDV en prestation
- [ ] Créer/modifier/supprimer une prestation
- [ ] Créer/modifier/supprimer une dépense
- [ ] Bons cadeaux : création, utilisation, expiration, remboursement
- [ ] Analytics : graphiques ApexCharts, filtres, périodes
- [ ] Export JSON (download via navigateur)
- [ ] Import JSON (upload fichier)
- [ ] Paramètres : tarifs, carte des soins, adresse salon, coûts transport
- [ ] Calcul distances (OpenRouteService)
- [ ] Google Ads OAuth + ROI (si utilisé)
- [ ] Tags clients (création, attribution, couleurs)
- [ ] Recherche clients/prospects
- [ ] Filtres ville (Ajaccio/Porto-Vecchio/Tous)
- [ ] Export calendrier .ics
- [ ] Système de parrainage
- [ ] Collaborateurs (HeadSpa Jenny)
- [ ] Génération automatique dépenses transport

### 7.2 - Tests PWA spécifiques
- [ ] Installation Android : Chrome > Menu > "Ajouter à l'écran d'accueil"
- [ ] Installation iOS : Safari > Partager > "Sur l'écran d'accueil"
- [ ] Mode plein écran (standalone) fonctionne
- [ ] Icône correcte sur l'écran d'accueil
- [ ] Message offline si coupure réseau (overlay bloquant)
- [ ] Retour online : bouton recharger fonctionne

### 7.3 - Tests sécurité
- [ ] URL directe sans login -> redirigé vers login.html
- [ ] Requête Supabase sans auth -> rejetée (401/403)
- [ ] Tentative de signup -> refusée
- [ ] `site:USERNAME.github.io/elise-massage-app` dans Google -> aucun résultat

### 7.4 - Tests de synchronisation
- [ ] Modifier une donnée sur PC -> visible immédiatement sur mobile (après refresh)
- [ ] Modifier une donnée sur mobile -> visible sur PC
- [ ] Créer un RDV sur un appareil, le voir sur l'autre

---

## Phase Future : Domaine Custom (CNAME OVH)

**Non inclus dans cette migration.** À faire plus tard si souhaité :

1. Dans OVH (zone DNS du domaine existant) :
   - Ajouter un enregistrement **CNAME** : `app` -> `USERNAME.github.io.`
   - Le site Odoo principal (`elise-massage.fr`) n'est PAS affecté
2. Dans le repo GitHub :
   - Ajouter un fichier `CNAME` à la racine contenant : `app.elise-massage.fr`
3. Dans GitHub Pages Settings :
   - Renseigner le custom domain : `app.elise-massage.fr`
   - Cocher "Enforce HTTPS"
4. Mettre à jour `manifest.json` : `start_url` et `scope` -> `/`
5. Mettre à jour le `redirect_uri` Google Ads OAuth dans Google Cloud Console

**Résultat** : `https://app.elise-massage.fr` au lieu de `https://USERNAME.github.io/elise-massage-app/`

---

## Ordre d'exécution et durées estimées

| # | Étape | Durée estimée |
|---|-------|---------------|
| 1 | Créer projet Supabase + schéma SQL + RLS + user Elise | 1h |
| 2 | Dupliquer le projet, nettoyer Electron | 30min |
| 3 | Créer config.js, supabase-client.js, auth.js, login.html | 1h |
| 4 | Réécrire data-manager.js (cœur de la migration) | 3-4h |
| 5 | Adapter les services (async) | 2h |
| 6 | Adapter modal-manager.js (backup, OAuth redirect) | 1h |
| 7 | Adapter index.html (meta, scripts, nav logout) | 30min |
| 8 | Créer manifest.json + sw.js + icônes PWA | 30min |
| 9 | Gestion offline (overlay "réseau requis") | 30min |
| 10 | GitHub repo + Pages + keepalive Action | 30min |
| 11 | Script migration données + exécution | 1h |
| 12 | Tests complets (mobile + desktop) | 2-3h |
| **TOTAL** | | **~12-15h** |

---

## Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|-----------|
| Pause Supabase (7j inactivité) | Moyenne | Moyen | GitHub Action keepalive quotidien |
| Données corrompues pendant migration | Faible | Élevé | L'app Electron reste intacte et fonctionnelle |
| Performance (latence réseau vs local) | Faible | Faible | Cache en mémoire (appData) + index DB |
| Google Ads OAuth redirect cassé | Moyenne | Faible | Reconfigurer redirect_uri dans Google Cloud Console |
| Perte backup auto Electron | Certaine | Faible | Supabase gère les backups. Export JSON manuel reste dispo |
| IDs qui changent pendant migration | Faible | Élevé | On préserve les IDs existants (format UUID compatible) |
| GitHub Pages down | Très faible | Moyen | 99.9% uptime GitHub. Electron reste en backup |

---

## Rollback

Si la migration échoue ou si l'app PWA ne convient pas :
1. **L'app Electron originale est intacte** dans `elise-massage-app/`
2. On peut revenir dessus à tout moment
3. Les données Supabase sont exportables en JSON
4. Le repo GitHub peut être supprimé sans impact
