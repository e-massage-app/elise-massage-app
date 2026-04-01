// ===== scripts/migrate-data.js =====
// Script de migration one-shot : JSON Electron -> Supabase
// Usage : node scripts/migrate-data.js <chemin-vers-massage-data.json>

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURATION - A REMPLIR AVANT EXECUTION
// ============================================================
const SUPABASE_URL = 'https://ixuwialfycbzvliezliv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'VOTRE_SERVICE_ROLE_KEY_ICI'; // Ne JAMAIS commiter la vraie cle ici
const USER_ID = '3bdf06ef-9bbe-4777-9ae4-68f7cd94d127';
// ============================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Mapping camelCase -> snake_case
function mapClient(c) {
  return {
    id: c.id, user_id: USER_ID,
    nom: c.nom || null, prenom: c.prenom || null,
    email: c.email || null, telephone: c.telephone || null,
    adresse: c.adresse || null, ville: c.ville || 'Porto-Vecchio',
    notes: c.notes || null, sexe: c.sexe || null,
    parrain: c.parrain || null,
    canal_acquisition: c.canalAcquisition || 'non-renseigne',
    date_acquisition: c.dateAcquisition || null,
    huiles: c.huiles || null, zones: c.zones || null,
    allergies: c.allergies || null, pression: c.pression || null,
    tags: c.tags || []
  };
}

function mapProspect(p) {
  return {
    id: p.id, user_id: USER_ID,
    nom: p.nom || null, prenom: p.prenom || null,
    email: p.email || null, telephone: p.telephone || null,
    adresse: p.adresse || null, ville: p.ville || 'Porto-Vecchio',
    notes: p.notes || null, sexe: p.sexe || null,
    statut: p.statut || 'nouveau',
    canal_acquisition: p.canalAcquisition || 'non-renseigne',
    date_acquisition: p.dateAcquisition || null,
    actions: p.actions || {}, tags: p.tags || []
  };
}

function mapCollaborateur(c) {
  return {
    id: c.id, user_id: USER_ID,
    prenom: c.prenom || null, nom: c.nom || null,
    entreprise: c.entreprise || null, specialites: c.specialites || null,
    telephone: c.telephone || null, email: c.email || null,
    adresse: c.adresse || null, tarif: c.tarif || null,
    notes: c.notes || null, tags: c.tags || []
  };
}

function mapRdv(r) {
  return {
    id: r.id, user_id: USER_ID,
    client_id: r.clientId || null, date: r.date,
    heure: r.heure || null, type: r.type || null,
    soin_id: r.soinId || null, duree: r.duree || null,
    statut: r.statut || 'confirme', notes: r.notes || null,
    adresse_massage: r.adresseMassage || null,
    distance_km: r.distanceKm || null,
    frais_deplacement: r.fraisDeplacement || null,
    sexe: r.sexe || null,
    transforme_en_prestation: r.transformeEnPrestation || false
  };
}

function mapPrestation(p) {
  return {
    id: p.id, user_id: USER_ID,
    client_id: p.clientId || null, date: p.date,
    heure: p.heure || null, type: p.type || null,
    soin_id: p.soinId || null, duree: p.duree || null,
    prix: p.prix || 0, tips: p.tips || 0,
    notes: p.notes || null,
    is_transformed: p.isTransformed || false,
    adresse_massage: p.adresseMassage || null,
    distance_km: p.distanceKm || null,
    frais_deplacement: p.fraisDeplacement || null,
    moyen_paiement: p.moyenPaiement || null
  };
}

function mapDepense(d) {
  return {
    id: d.id, user_id: USER_ID,
    date: d.date, categorie: d.categorie,
    montant: d.montant || 0, description: d.description || null,
    fournisseur: d.fournisseur || null, notes: d.notes || null,
    prestation_id: d.prestationId || null
  };
}

function mapBonCadeau(b) {
  return {
    id: b.id, user_id: USER_ID,
    montant: b.montant || 0,
    date_achat: b.dateAchat || null,
    date_debut: b.dateDebut || b.dateAchat || null,
    date_expiration: b.dateExpiration || null,
    statut: b.statut || 'actif',
    notes: b.notes || null,
    client_id: b.clientId || null,
    acheteur_nom: b.acheteurNom || null,
    acheteur_client_id: b.acheteurClientId || null,
    acheteur_telephone: b.acheteurTelephone || null,
    acheteur_email: b.acheteurEmail || null,
    beneficiaire_nom: b.beneficiaireNom || null,
    beneficiaire_client_id: b.beneficiaireClientId || null,
    description: b.description || null,
    moyen_paiement: b.moyenPaiement || null,
    prestation_id: b.prestationId || null,
    date_utilisation: b.dateUtilisation || null,
    date_remboursement: b.dateRemboursement || null,
    force_utilise: b.forceUtilise || false
  };
}

async function insertBatch(table, rows) {
  if (!rows || rows.length === 0) {
    console.log(`  ${table}: 0 enregistrements (vide)`);
    return 0;
  }

  let inserted = 0;
  // Inserer par lots de 500
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error(`  ERREUR ${table} (lot ${i}-${i + batch.length}):`, error.message);
    } else {
      inserted += batch.length;
    }
  }
  console.log(`  ${table}: ${inserted}/${rows.length} enregistrements inseres`);
  return inserted;
}

async function migrate() {
  // Lire le fichier JSON
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error('Usage: node migrate-data.js <chemin-vers-massage-data.json>');
    process.exit(1);
  }

  const fullPath = path.resolve(jsonPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`Fichier non trouve: ${fullPath}`);
    process.exit(1);
  }

  console.log(`\nLecture de ${fullPath}...`);
  const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

  console.log('\nDonnees trouvees dans le JSON:');
  console.log(`  clients: ${(data.clients || []).length}`);
  console.log(`  prospects: ${(data.prospects || []).length}`);
  console.log(`  collaborateurs: ${(data.collaborateurs || []).length}`);
  console.log(`  rdv: ${(data.rdv || []).length}`);
  console.log(`  prestations: ${(data.prestations || []).length}`);
  console.log(`  depenses: ${(data.depenses || []).length}`);
  console.log(`  bonsCadeaux: ${(data.bonsCadeaux || []).length}`);

  console.log('\nMigration vers Supabase...\n');

  // Inserer les donnees
  await insertBatch('clients', (data.clients || []).map(mapClient));
  await insertBatch('prospects', (data.prospects || []).map(mapProspect));
  await insertBatch('collaborateurs', (data.collaborateurs || []).map(mapCollaborateur));
  await insertBatch('rdv', (data.rdv || []).map(mapRdv));
  await insertBatch('prestations', (data.prestations || []).map(mapPrestation));
  await insertBatch('depenses', (data.depenses || []).map(mapDepense));
  await insertBatch('bons_cadeaux', (data.bonsCadeaux || []).map(mapBonCadeau));

  // Migrer les parametres (cle/valeur)
  if (data.parametres) {
    console.log('\n  Migration des parametres...');
    let paramCount = 0;
    for (const [cle, valeur] of Object.entries(data.parametres)) {
      const { error } = await supabase.from('parametres').upsert(
        { user_id: USER_ID, cle, valeur },
        { onConflict: 'user_id,cle' }
      );
      if (error) {
        console.error(`  ERREUR parametre ${cle}:`, error.message);
      } else {
        paramCount++;
      }
    }
    console.log(`  parametres: ${paramCount}/${Object.keys(data.parametres).length} cles inserees`);
  }

  console.log('\nMigration terminee !');
  console.log('Ouvrez la PWA et verifiez que les donnees sont correctes.');
}

migrate().catch(err => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
