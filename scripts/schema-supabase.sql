-- ============================================================
-- SCHEMA COMPLET SUPABASE - Elise Massage PWA
-- Releve sur la base reelle le 2026-11-02 (v1.2.0.0) : c'est la structure EXACTE en production.
-- Sert a RECONSTRUIRE la base de zero (nouveau projet Supabase), puis a y re-importer la
-- sauvegarde du lundi (bouton « Importer » de l'app, fichier recu par e-mail).
--
-- Usage : nouveau projet Supabase -> SQL Editor -> coller -> Run. Ensuite :
--   1. creer le compte d'Elise (Authentication) et se connecter une fois a l'app ;
--   2. importer la derniere sauvegarde depuis l'app ;
--   3. sauvegarde du lundi : scripts/migration-sauvegarde-hebdo.sql (+ fonction sauvegarde-hebdo,
--      secrets et Vault, voir l'en-tete de ce fichier) ;
--   4. Google Ads : deployer supabase/functions/google-ads (secrets dans tasks/todo-google-ads.md),
--      puis Elise se reconnecte.
--
-- Les fichiers scripts/migration-*.sql sont l'historique des changements ; ce fichier-ci les
-- contient tous. Identifiants : TEXT « id_<horodatage>_<aleatoire> » generes par l'app (pas d'UUID).
-- Dates metier : TEXT 'YYYY-MM-DD' (heures : TEXT 'HH:MM').
-- Hors de ce fichier : le schema prive `sauvegarde` (copies de securite, non expose par l'API).
-- ============================================================

-- Extensions (deja presentes sur un projet Supabase neuf, sauf pg_cron / pg_net : voir
-- migration-sauvegarde-hebdo.sql)
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Fonction : updated_at tenu a jour a chaque modification
-- (le conseiller Supabase signale un search_path non fixe : sans effet ici, garde tel quel)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

-- ============================================
-- TABLE : clients
-- ============================================
CREATE TABLE public.clients (
  id TEXT NOT NULL,
  user_id UUID NOT NULL,
  nom TEXT,
  prenom TEXT,
  email TEXT,
  telephone TEXT,
  adresse TEXT,
  ville TEXT DEFAULT 'Porto-Vecchio'::text,
  notes TEXT,
  sexe TEXT,
  parrain TEXT,
  canal_acquisition TEXT DEFAULT 'non-renseigne'::text,
  date_acquisition TEXT,
  huiles TEXT,
  zones TEXT,
  allergies TEXT,
  pression TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  societe TEXT,
  sans_fidelite BOOLEAN DEFAULT false,
  fidelite_atteinte JSONB DEFAULT '[]'::jsonb,
  CONSTRAINT clients_pkey PRIMARY KEY (id),
  CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE INDEX idx_clients_user ON public.clients USING btree (user_id);
CREATE INDEX idx_clients_ville ON public.clients USING btree (ville);

-- ============================================
-- TABLE : prospects (masques dans l'app depuis la v1.2.0.0, donnees gardees)
-- ============================================
CREATE TABLE public.prospects (
  id TEXT NOT NULL,
  user_id UUID NOT NULL,
  nom TEXT,
  prenom TEXT,
  email TEXT,
  telephone TEXT,
  adresse TEXT,
  ville TEXT DEFAULT 'Porto-Vecchio'::text,
  notes TEXT,
  sexe TEXT,
  statut TEXT DEFAULT 'nouveau'::text,
  canal_acquisition TEXT DEFAULT 'non-renseigne'::text,
  date_acquisition TEXT,
  actions JSONB DEFAULT '{}'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  societe TEXT,
  parrain TEXT,
  CONSTRAINT prospects_pkey PRIMARY KEY (id),
  CONSTRAINT prospects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE INDEX idx_prospects_user ON public.prospects USING btree (user_id);

-- ============================================
-- TABLE : collaborateurs (dont la partenaire HeadSpa : parametres.headSpaCollaborateurId)
-- ============================================
CREATE TABLE public.collaborateurs (
  id TEXT NOT NULL,
  user_id UUID NOT NULL,
  prenom TEXT,
  nom TEXT,
  entreprise TEXT,
  specialites TEXT,
  telephone TEXT,
  email TEXT,
  adresse TEXT,
  tarif NUMERIC,
  notes TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  poste TEXT,
  CONSTRAINT collaborateurs_pkey PRIMARY KEY (id),
  CONSTRAINT collaborateurs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- ============================================
-- TABLE : rdv
-- ============================================
CREATE TABLE public.rdv (
  id TEXT NOT NULL,
  user_id UUID NOT NULL,
  client_id TEXT,
  date TEXT NOT NULL,
  heure TEXT,
  type TEXT,
  soin_id TEXT,
  duree INTEGER,
  statut TEXT DEFAULT 'confirme'::text,
  notes TEXT,
  adresse_massage TEXT,
  distance_km NUMERIC,
  frais_deplacement NUMERIC,
  sexe TEXT,
  transforme_en_prestation BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  bon_cadeau_id TEXT,
  CONSTRAINT rdv_pkey PRIMARY KEY (id),
  CONSTRAINT rdv_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE INDEX idx_rdv_user_date ON public.rdv USING btree (user_id, date);
CREATE INDEX idx_rdv_bon_cadeau ON public.rdv USING btree (bon_cadeau_id) WHERE (bon_cadeau_id IS NOT NULL);

-- ============================================
-- TABLE : prestations (rdv_id : RDV dont la prestation est nee, v1.2.0.0)
-- ============================================
CREATE TABLE public.prestations (
  id TEXT NOT NULL,
  user_id UUID NOT NULL,
  client_id TEXT,
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
  updated_at TIMESTAMPTZ DEFAULT now(),
  bon_cadeau_id TEXT,
  rdv_id TEXT,
  CONSTRAINT prestations_pkey PRIMARY KEY (id),
  CONSTRAINT prestations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE INDEX idx_prestations_user_date ON public.prestations USING btree (user_id, date);
CREATE INDEX idx_prestations_client ON public.prestations USING btree (client_id);
CREATE INDEX idx_prestations_bon_cadeau ON public.prestations USING btree (bon_cadeau_id) WHERE (bon_cadeau_id IS NOT NULL);

-- ============================================
-- TABLE : depenses (abonnement_id : abonnement qui l'a generee, v1.2.0.0)
-- ============================================
CREATE TABLE public.depenses (
  id TEXT NOT NULL,
  user_id UUID NOT NULL,
  date TEXT NOT NULL,
  categorie TEXT NOT NULL,
  montant NUMERIC DEFAULT 0,
  description TEXT,
  fournisseur TEXT,
  notes TEXT,
  prestation_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  type TEXT,
  abonnement_nom TEXT,
  abonnement_id TEXT,
  CONSTRAINT depenses_pkey PRIMARY KEY (id),
  CONSTRAINT depenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE INDEX idx_depenses_user_date ON public.depenses USING btree (user_id, date);
CREATE INDEX idx_depenses_categorie ON public.depenses USING btree (categorie);
CREATE INDEX idx_depenses_type_user ON public.depenses USING btree (user_id, type, abonnement_nom, date) WHERE (type IS NOT NULL);

-- ============================================
-- TABLE : bons_cadeaux
-- ============================================
CREATE TABLE public.bons_cadeaux (
  id TEXT NOT NULL,
  user_id UUID NOT NULL,
  montant NUMERIC DEFAULT 0,
  date_achat TEXT,
  date_debut TEXT,
  date_expiration TEXT,
  statut TEXT DEFAULT 'actif'::text,
  notes TEXT,
  client_id TEXT,
  acheteur_nom TEXT,
  acheteur_client_id TEXT,
  acheteur_telephone TEXT,
  acheteur_email TEXT,
  beneficiaire_nom TEXT,
  beneficiaire_client_id TEXT,
  description TEXT,
  moyen_paiement TEXT,
  prestation_id TEXT,
  date_utilisation TEXT,
  date_remboursement TEXT,
  force_utilise BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT bons_cadeaux_pkey PRIMARY KEY (id),
  CONSTRAINT bons_cadeaux_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE INDEX idx_bons_cadeaux_user ON public.bons_cadeaux USING btree (user_id);

-- ============================================
-- TABLE : parametres (une ligne par reglage : carte des soins, abonnements, gestion, calendrier...)
-- ============================================
CREATE TABLE public.parametres (
  id TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id UUID NOT NULL,
  cle TEXT NOT NULL,
  valeur JSONB,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT parametres_pkey PRIMARY KEY (id),
  CONSTRAINT parametres_user_id_cle_key UNIQUE (user_id, cle),
  CONSTRAINT parametres_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE INDEX idx_parametres_user_cle ON public.parametres USING btree (user_id, cle);

-- ============================================
-- TABLE : relances (supprimees avec la fiche cliente : ON DELETE CASCADE)
-- ============================================
CREATE TABLE public.relances (
  id TEXT NOT NULL,
  user_id UUID NOT NULL,
  client_id TEXT NOT NULL,
  groupe TEXT NOT NULL,
  precisions TEXT,
  intervalle_jours INTEGER NOT NULL DEFAULT 28,
  dernier_rdv_override TEXT,
  date_relance_override TEXT,
  relancee BOOLEAN NOT NULL DEFAULT false,
  relancee_le TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT relances_pkey PRIMARY KEY (id),
  CONSTRAINT relances_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT relances_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX relances_client_groupe_uniq ON public.relances USING btree (client_id, groupe);
CREATE INDEX relances_client_idx ON public.relances USING btree (client_id);

-- ============================================
-- TABLES : onglet Gestion (tresorerie pro + perso)
-- ============================================
CREATE TABLE public.gestion_mouvements (
  id TEXT NOT NULL,
  user_id UUID NOT NULL,
  date TEXT NOT NULL,
  espace TEXT NOT NULL DEFAULT 'pro'::text,
  sens TEXT NOT NULL,
  compte TEXT NOT NULL,
  compte_vers TEXT,
  categorie TEXT,
  montant NUMERIC NOT NULL DEFAULT 0,
  libelle TEXT,
  mois_concerne TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT gestion_mouvements_pkey PRIMARY KEY (id),
  CONSTRAINT gestion_mouvements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE INDEX gestion_mouvements_user_date_idx ON public.gestion_mouvements USING btree (user_id, date);

CREATE TABLE public.gestion_recurrents (
  id TEXT NOT NULL,
  user_id UUID NOT NULL,
  espace TEXT NOT NULL DEFAULT 'pro'::text,
  sens TEXT NOT NULL DEFAULT 'sortie'::text,
  compte TEXT NOT NULL,
  compte_vers TEXT,
  categorie TEXT,
  nom TEXT NOT NULL,
  montant NUMERIC NOT NULL DEFAULT 0,
  frequence TEXT NOT NULL DEFAULT 'mensuelle'::text,
  mois_annuel INTEGER,
  debut TEXT NOT NULL,
  fin TEXT,
  ordre INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT gestion_recurrents_pkey PRIMARY KEY (id),
  CONSTRAINT gestion_recurrents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE INDEX gestion_recurrents_user_idx ON public.gestion_recurrents USING btree (user_id);

CREATE TABLE public.gestion_mois (
  id TEXT NOT NULL,
  user_id UUID NOT NULL,
  mois TEXT NOT NULL,
  ca_declare NUMERIC,
  corrections JSONB NOT NULL DEFAULT '{}'::jsonb,
  cloture_le TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT gestion_mois_pkey PRIMARY KEY (id),
  CONSTRAINT gestion_mois_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE UNIQUE INDEX gestion_mois_user_mois_uniq ON public.gestion_mois USING btree (user_id, mois);

CREATE TABLE public.gestion_soldes (
  id TEXT NOT NULL,
  user_id UUID NOT NULL,
  date TEXT NOT NULL,
  compte TEXT NOT NULL,
  montant NUMERIC NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT gestion_soldes_pkey PRIMARY KEY (id),
  CONSTRAINT gestion_soldes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE INDEX gestion_soldes_user_date_idx ON public.gestion_soldes USING btree (user_id, date);

-- ============================================
-- TABLE : google_ads_connexion (lue et ecrite UNIQUEMENT par la fonction google-ads :
-- RLS sans politique + aucun droit pour anon / authenticated)
-- ============================================
CREATE TABLE public.google_ads_connexion (
  user_id UUID NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expire_le TIMESTAMPTZ,
  email TEXT,
  etat_oauth TEXT,
  redirect_uri TEXT,
  connecte_le TIMESTAMPTZ,
  maj_le TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT google_ads_connexion_pkey PRIMARY KEY (user_id),
  CONSTRAINT google_ads_connexion_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
REVOKE ALL ON public.google_ads_connexion FROM anon, authenticated;

-- ============================================
-- SECURITE : chaque utilisatrice ne voit et ne modifie que ses lignes
-- ============================================
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborateurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdv ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.depenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bons_cadeaux ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parametres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestion_mouvements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestion_recurrents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestion_mois ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestion_soldes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_ads_connexion ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_own_data ON public.clients FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY users_own_data ON public.prospects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY users_own_data ON public.collaborateurs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY users_own_data ON public.rdv FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY users_own_data ON public.prestations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY users_own_data ON public.depenses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY users_own_data ON public.bons_cadeaux FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY users_own_data ON public.parametres FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY users_own_data ON public.relances FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY users_own_data ON public.gestion_mouvements FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY users_own_data ON public.gestion_recurrents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY users_own_data ON public.gestion_mois FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY users_own_data ON public.gestion_soldes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- google_ads_connexion : volontairement AUCUNE politique (seule la cle service_role y accede)

-- ============================================
-- DECLENCHEURS : updated_at (comme en production : relances, gestion_* et
-- google_ads_connexion n'en ont pas ; l'app y ecrit updated_at / maj_le elle-meme)
-- ============================================
CREATE TRIGGER tr_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_prospects_updated BEFORE UPDATE ON public.prospects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_collaborateurs_updated BEFORE UPDATE ON public.collaborateurs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_rdv_updated BEFORE UPDATE ON public.rdv FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_prestations_updated BEFORE UPDATE ON public.prestations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_depenses_updated BEFORE UPDATE ON public.depenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_bons_cadeaux_updated BEFORE UPDATE ON public.bons_cadeaux FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_parametres_updated BEFORE UPDATE ON public.parametres FOR EACH ROW EXECUTE FUNCTION update_updated_at();
