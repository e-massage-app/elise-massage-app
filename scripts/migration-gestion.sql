-- =====================================================================
-- MIGRATION GESTION — v1.1.0.0
-- Onglet "Gestion" (tresorerie pro + perso). Idempotent : rejouable sans
-- risque, aucune modification ni suppression des tables existantes.
-- L'onglet LIT prestations / bons_cadeaux / depenses et n'ecrit QUE ici.
-- Conventions de l'app : id TEXT (generateId), dates TEXT 'YYYY-MM-DD',
-- mois TEXT 'YYYY-MM', montants toujours positifs (le sens dit le reste).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Mouvements saisis a la main (encaissement hors logiciel, depense
--    oubliee, courses, depot de la caisse en banque, virement vers le
--    perso, mise de cote...)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gestion_mouvements (
  id            TEXT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  date          TEXT NOT NULL,
  espace        TEXT NOT NULL DEFAULT 'pro',      -- pro | perso
  sens          TEXT NOT NULL,                    -- entree | sortie | transfert
  compte        TEXT NOT NULL,                    -- pro | caisse | perso | epargne
  compte_vers   TEXT,                             -- transfert uniquement
  categorie     TEXT,
  montant       NUMERIC NOT NULL DEFAULT 0,
  libelle       TEXT,
  mois_concerne TEXT,                             -- rattachement (Ads, URSSAF...)
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gestion_mouvements_user_date_idx
  ON gestion_mouvements (user_id, date);

-- ---------------------------------------------------------------------
-- 2. Lignes recurrentes : charges fixes, revenus fixes, epargne programmee
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gestion_recurrents (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  espace      TEXT NOT NULL DEFAULT 'pro',
  sens        TEXT NOT NULL DEFAULT 'sortie',
  compte      TEXT NOT NULL,
  compte_vers TEXT,
  categorie   TEXT,
  nom         TEXT NOT NULL,
  montant     NUMERIC NOT NULL DEFAULT 0,
  frequence   TEXT NOT NULL DEFAULT 'mensuelle', -- mensuelle | annuelle
  mois_annuel INTEGER,                           -- 1-12 si annuelle
  debut       TEXT NOT NULL,                     -- 'YYYY-MM'
  fin         TEXT,                              -- 'YYYY-MM' inclus, NULL = en cours
  ordre       INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gestion_recurrents_user_idx ON gestion_recurrents (user_id);

-- ---------------------------------------------------------------------
-- 3. Un enregistrement par mois : montant declare, corrections a la main,
--    cloture
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gestion_mois (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  mois        TEXT NOT NULL,
  ca_declare  NUMERIC,
  corrections JSONB NOT NULL DEFAULT '{}'::jsonb,
  cloture_le  TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS gestion_mois_user_mois_uniq
  ON gestion_mois (user_id, mois);

-- ---------------------------------------------------------------------
-- 4. Soldes recopies depuis l'appli bancaire (ou caisse comptee)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gestion_soldes (
  id         TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  date       TEXT NOT NULL,
  compte     TEXT NOT NULL,
  montant    NUMERIC NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gestion_soldes_user_date_idx ON gestion_soldes (user_id, date);

-- ---------------------------------------------------------------------
-- 5. RLS : chaque utilisatrice ne voit que ses lignes
-- ---------------------------------------------------------------------
ALTER TABLE gestion_mouvements ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestion_recurrents ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestion_mois       ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestion_soldes     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_data" ON gestion_mouvements;
CREATE POLICY "users_own_data" ON gestion_mouvements FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_own_data" ON gestion_recurrents;
CREATE POLICY "users_own_data" ON gestion_recurrents FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_own_data" ON gestion_mois;
CREATE POLICY "users_own_data" ON gestion_mois FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_own_data" ON gestion_soldes;
CREATE POLICY "users_own_data" ON gestion_soldes FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
