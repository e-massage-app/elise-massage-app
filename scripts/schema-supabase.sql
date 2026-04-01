-- ============================================================
-- SCHEMA COMPLET SUPABASE - Elise Massage PWA
-- A executer dans le SQL Editor de Supabase
-- ============================================================

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
  fournisseur TEXT,
  notes TEXT,
  prestation_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABLE : bons_cadeaux (schema complet)
-- ============================================
CREATE TABLE bons_cadeaux (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  montant NUMERIC DEFAULT 0,
  date_achat TEXT,
  date_debut TEXT,
  date_expiration TEXT,
  statut TEXT DEFAULT 'actif',
  notes TEXT,
  client_id UUID,
  acheteur_nom TEXT,
  acheteur_client_id UUID,
  acheteur_telephone TEXT,
  acheteur_email TEXT,
  beneficiaire_nom TEXT,
  beneficiaire_client_id UUID,
  description TEXT,
  moyen_paiement TEXT,
  prestation_id UUID,
  date_utilisation TEXT,
  date_remboursement TEXT,
  force_utilise BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABLE : parametres (cle/valeur)
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

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborateurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdv ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE depenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bons_cadeaux ENABLE ROW LEVEL SECURITY;
ALTER TABLE parametres ENABLE ROW LEVEL SECURITY;

-- Chaque user ne voit/modifie que SES donnees
CREATE POLICY "users_own_data" ON clients FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_data" ON prospects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_data" ON collaborateurs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_data" ON rdv FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_data" ON prestations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_data" ON depenses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_data" ON bons_cadeaux FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_data" ON parametres FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
