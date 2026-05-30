// ===== js/core/data-manager.js =====
// Gestion des donnees - Version PWA avec Supabase
// Strategie : meme interface que l'original, mais Supabase au lieu d'IPC Electron
// Le cache appData en memoire est conserve pour la performance des getters

// ===== DONNEES GLOBALES (CACHE EN MEMOIRE) =====
let appData = {
  clients: [],
  prospects: [],
  collaborateurs: [],
  prestations: [],
  rdv: [],
  depenses: [],
  bonsCadeaux: [],
  parametres: {
    tarifsMassage: {
      "Massage sur mesure": { 30: 50, 45: 60, 60: 80, 90: 110 },
      "Les Rituels": { 60: 80, 90: 110, 120: 150 },
      "HeadSpa": { 30: 20, 45: 35, 60: 40 }
    },
    coutHuiles: {
      "Massage sur mesure": 3,
      "Les Rituels": 8,
      "HeadSpa": 0
    },
    headSpaCollaborateurId: null
  }
};

let editingId = null;

// ===== MAPPING camelCase (JS) <-> snake_case (DB) =====

function mapClientFromDb(row) {
  return {
    id: row.id,
    nom: row.nom,
    prenom: row.prenom,
    societe: row.societe,
    email: row.email,
    telephone: row.telephone,
    adresse: row.adresse,
    ville: row.ville,
    notes: row.notes,
    sexe: row.sexe,
    parrain: row.parrain,
    canalAcquisition: row.canal_acquisition,
    dateAcquisition: row.date_acquisition,
    huiles: row.huiles,
    zones: row.zones,
    allergies: row.allergies,
    pression: row.pression,
    tags: row.tags || [],
    createdAt: row.created_at
  };
}

function mapClientToDb(obj) {
  const row = {
    nom: obj.nom || null,
    prenom: obj.prenom || null,
    societe: obj.societe || null,
    email: obj.email || null,
    telephone: obj.telephone || null,
    adresse: obj.adresse || null,
    ville: obj.ville || 'Porto-Vecchio',
    notes: obj.notes || null,
    sexe: obj.sexe || null,
    parrain: obj.parrain || null,
    canal_acquisition: obj.canalAcquisition || 'non-renseigne',
    date_acquisition: obj.dateAcquisition || null,
    huiles: obj.huiles || null,
    zones: obj.zones || null,
    allergies: obj.allergies || null,
    pression: obj.pression || null,
    tags: obj.tags || []
  };
  if (obj.id) row.id = obj.id;
  return row;
}

function mapProspectFromDb(row) {
  return {
    id: row.id,
    nom: row.nom,
    prenom: row.prenom,
    societe: row.societe,
    email: row.email,
    telephone: row.telephone,
    adresse: row.adresse,
    ville: row.ville,
    notes: row.notes,
    sexe: row.sexe,
    statut: row.statut,
    parrain: row.parrain,
    canalAcquisition: row.canal_acquisition,
    dateAcquisition: row.date_acquisition,
    actions: row.actions || {},
    tags: row.tags || [],
    createdAt: row.created_at
  };
}

function mapProspectToDb(obj) {
  const row = {
    nom: obj.nom || null,
    prenom: obj.prenom || null,
    societe: obj.societe || null,
    email: obj.email || null,
    telephone: obj.telephone || null,
    adresse: obj.adresse || null,
    ville: obj.ville || 'Porto-Vecchio',
    notes: obj.notes || null,
    sexe: obj.sexe || null,
    statut: obj.statut || 'nouveau',
    parrain: obj.parrain || null,
    canal_acquisition: obj.canalAcquisition || 'non-renseigne',
    date_acquisition: obj.dateAcquisition || null,
    actions: obj.actions || {},
    tags: obj.tags || []
  };
  if (obj.id) row.id = obj.id;
  return row;
}

function mapCollaborateurFromDb(row) {
  return {
    id: row.id,
    prenom: row.prenom,
    nom: row.nom,
    poste: row.poste,
    entreprise: row.entreprise,
    specialites: row.specialites,
    telephone: row.telephone,
    email: row.email,
    adresse: row.adresse,
    tarif: row.tarif,
    notes: row.notes,
    tags: row.tags || [],
    createdAt: row.created_at
  };
}

function mapCollaborateurToDb(obj) {
  const row = {
    prenom: obj.prenom || null,
    nom: obj.nom || null,
    poste: obj.poste || null,
    entreprise: obj.entreprise || null,
    specialites: obj.specialites || null,
    telephone: obj.telephone || null,
    email: obj.email || null,
    adresse: obj.adresse || null,
    tarif: obj.tarif || null,
    notes: obj.notes || null,
    tags: obj.tags || []
  };
  if (obj.id) row.id = obj.id;
  return row;
}

function mapRdvFromDb(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    date: row.date,
    heure: row.heure,
    type: row.type,
    soinId: row.soin_id,
    duree: row.duree,
    statut: row.statut,
    notes: row.notes,
    adresseMassage: row.adresse_massage,
    distanceKm: row.distance_km,
    fraisDeplacement: row.frais_deplacement,
    sexe: row.sexe,
    transformeEnPrestation: row.transforme_en_prestation,
    bonCadeauId: row.bon_cadeau_id
  };
}

function mapRdvToDb(obj) {
  const row = {
    client_id: obj.clientId || null,
    date: obj.date,
    heure: obj.heure || null,
    type: obj.type || null,
    soin_id: obj.soinId || null,
    duree: obj.duree || null,
    statut: obj.statut || 'confirme',
    notes: obj.notes || null,
    adresse_massage: obj.adresseMassage || null,
    distance_km: obj.distanceKm || null,
    frais_deplacement: obj.fraisDeplacement || null,
    sexe: obj.sexe || null,
    transforme_en_prestation: obj.transformeEnPrestation || false,
    bon_cadeau_id: obj.bonCadeauId || null
  };
  if (obj.id) row.id = obj.id;
  return row;
}

function mapPrestationFromDb(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    date: row.date,
    heure: row.heure,
    type: row.type,
    soinId: row.soin_id,
    duree: row.duree,
    prix: row.prix,
    tips: row.tips,
    notes: row.notes,
    isTransformed: row.is_transformed,
    adresseMassage: row.adresse_massage,
    distanceKm: row.distance_km,
    fraisDeplacement: row.frais_deplacement,
    moyenPaiement: row.moyen_paiement,
    bonCadeauId: row.bon_cadeau_id
  };
}

function mapPrestationToDb(obj) {
  const row = {
    client_id: obj.clientId || null,
    date: obj.date,
    heure: obj.heure || null,
    type: obj.type || null,
    soin_id: obj.soinId || null,
    duree: obj.duree || null,
    prix: obj.prix || 0,
    tips: obj.tips || 0,
    notes: obj.notes || null,
    is_transformed: obj.isTransformed || false,
    adresse_massage: obj.adresseMassage || null,
    distance_km: obj.distanceKm || null,
    frais_deplacement: obj.fraisDeplacement || null,
    moyen_paiement: obj.moyenPaiement || null,
    bon_cadeau_id: obj.bonCadeauId || null
  };
  if (obj.id) row.id = obj.id;
  return row;
}

function mapDepenseFromDb(row) {
  return {
    id: row.id,
    date: row.date,
    categorie: row.categorie,
    montant: row.montant,
    description: row.description,
    fournisseur: row.fournisseur || '',
    notes: row.notes || '',
    prestationId: row.prestation_id,
    type: row.type,
    abonnementNom: row.abonnement_nom
  };
}

function mapDepenseToDb(obj) {
  const row = {
    date: obj.date,
    categorie: obj.categorie,
    montant: obj.montant || 0,
    description: obj.description || null,
    fournisseur: obj.fournisseur || null,
    notes: obj.notes || null,
    prestation_id: obj.prestationId || null,
    type: obj.type || null,
    abonnement_nom: obj.abonnementNom || null
  };
  if (obj.id) row.id = obj.id;
  return row;
}

function mapBonCadeauFromDb(row) {
  return {
    id: row.id,
    montant: row.montant,
    dateAchat: row.date_achat,
    dateDebut: row.date_debut,
    dateExpiration: row.date_expiration,
    statut: row.statut,
    notes: row.notes,
    clientId: row.client_id,
    acheteurNom: row.acheteur_nom,
    acheteurClientId: row.acheteur_client_id,
    acheteurTelephone: row.acheteur_telephone,
    acheteurEmail: row.acheteur_email,
    beneficiaireNom: row.beneficiaire_nom,
    beneficiaireClientId: row.beneficiaire_client_id,
    description: row.description,
    moyenPaiement: row.moyen_paiement,
    prestationId: row.prestation_id,
    dateUtilisation: row.date_utilisation,
    dateRemboursement: row.date_remboursement,
    forceUtilise: row.force_utilise,
    createdAt: row.created_at
  };
}

function mapBonCadeauToDb(obj) {
  const row = {
    montant: obj.montant || 0,
    date_achat: obj.dateAchat || null,
    date_debut: obj.dateDebut || obj.dateAchat || null,
    date_expiration: obj.dateExpiration || null,
    statut: obj.statut || 'actif',
    notes: obj.notes || null,
    client_id: obj.clientId || null,
    acheteur_nom: obj.acheteurNom || null,
    acheteur_client_id: obj.acheteurClientId || null,
    acheteur_telephone: obj.acheteurTelephone || null,
    acheteur_email: obj.acheteurEmail || null,
    beneficiaire_nom: obj.beneficiaireNom || null,
    beneficiaire_client_id: obj.beneficiaireClientId || null,
    description: obj.description || null,
    moyen_paiement: obj.moyenPaiement || null,
    prestation_id: obj.prestationId || null,
    date_utilisation: obj.dateUtilisation || null,
    date_remboursement: obj.dateRemboursement || null,
    force_utilise: obj.forceUtilise || false
  };
  if (obj.id) row.id = obj.id;
  return row;
}

// ===== HELPER : obtenir user_id =====
async function getCurrentUserId() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('Non authentifie');
  return user.id;
}

// ===== GESTION DES DONNEES =====

async function loadData() {
  try {
    const userId = await getCurrentUserId();

    // Charger toutes les tables en parallele
    const [
      clientsRes,
      prospectsRes,
      collaborateursRes,
      rdvRes,
      prestationsRes,
      depensesRes,
      bonsCadeauxRes,
      parametresRes
    ] = await Promise.all([
      supabaseClient.from('clients').select('*').eq('user_id', userId),
      supabaseClient.from('prospects').select('*').eq('user_id', userId),
      supabaseClient.from('collaborateurs').select('*').eq('user_id', userId),
      supabaseClient.from('rdv').select('*').eq('user_id', userId),
      supabaseClient.from('prestations').select('*').eq('user_id', userId),
      supabaseClient.from('depenses').select('*').eq('user_id', userId),
      supabaseClient.from('bons_cadeaux').select('*').eq('user_id', userId),
      supabaseClient.from('parametres').select('*').eq('user_id', userId)
    ]);

    // Verifier les erreurs
    const errors = [clientsRes, prospectsRes, collaborateursRes, rdvRes, prestationsRes, depensesRes, bonsCadeauxRes, parametresRes]
      .filter(r => r.error);
    if (errors.length > 0) {
      console.error('Erreurs Supabase:', errors.map(e => e.error));
      throw new Error('Erreur lors du chargement des donnees');
    }

    // Mapper les donnees DB -> JS
    appData.clients = (clientsRes.data || []).map(mapClientFromDb);
    appData.prospects = (prospectsRes.data || []).map(mapProspectFromDb);
    appData.collaborateurs = (collaborateursRes.data || []).map(mapCollaborateurFromDb);
    appData.rdv = (rdvRes.data || []).map(mapRdvFromDb);
    appData.prestations = (prestationsRes.data || []).map(mapPrestationFromDb);
    appData.depenses = (depensesRes.data || []).map(mapDepenseFromDb);
    appData.bonsCadeaux = (bonsCadeauxRes.data || []).map(mapBonCadeauFromDb);

    // Reconstituer les parametres depuis les lignes cle/valeur
    const parametresDefaults = appData.parametres; // Garder les defaults
    const parametresFromDb = {};
    (parametresRes.data || []).forEach(row => {
      parametresFromDb[row.cle] = row.valeur;
    });

    // Fusionner : defaults + DB (DB a priorite)
    appData.parametres = { ...parametresDefaults };
    Object.entries(parametresFromDb).forEach(([cle, valeur]) => {
      appData.parametres[cle] = valeur;
    });

    // Initialiser les champs manquants
    if (!appData.collaborateurs) appData.collaborateurs = [];
    if (!appData.bonsCadeaux) appData.bonsCadeaux = [];
    if (!appData.parametres.validiteBonsCadeauxMois) appData.parametres.validiteBonsCadeauxMois = 6;
    if (!appData.parametres.tarifsMassage['HeadSpa']) {
      appData.parametres.tarifsMassage['HeadSpa'] = { 30: 20, 45: 35, 60: 40 };
    }
    if (!appData.parametres.coutHuiles) appData.parametres.coutHuiles = {};
    if (appData.parametres.coutHuiles['HeadSpa'] === undefined) {
      appData.parametres.coutHuiles['HeadSpa'] = 0;
    }

    console.log('Donnees chargees depuis Supabase:', {
      clients: appData.clients.length,
      prospects: appData.prospects.length,
      collaborateurs: appData.collaborateurs.length,
      rdv: appData.rdv.length,
      prestations: appData.prestations.length,
      depenses: appData.depenses.length,
      bonsCadeaux: appData.bonsCadeaux.length
    });

    return true;
  } catch (error) {
    console.error('Erreur chargement donnees:', error);
    return false;
  }
}

// saveData() est un no-op : chaque operation CRUD sauve individuellement
async function saveData() {
  // No-op dans la version Supabase
  // Chaque mutation est sauvegardee directement dans la methode CRUD
  return true;
}

// ===== SAUVEGARDE PARAMETRES VERS SUPABASE =====
async function saveParametresToDb() {
  try {
    const userId = await getCurrentUserId();
    const entries = Object.entries(appData.parametres);

    // v1.0.7.2 : Promise.all parallele au lieu de boucle sequentielle.
    // 15-20 cles x 500-800ms sequentiel = 10-15s (super lent sur form lambda).
    // En parallele, 1 seul round-trip latence = 1-2s.
    const results = await Promise.all(
      entries.map(([cle, valeur]) =>
        supabaseClient
          .from('parametres')
          .upsert(
            { user_id: userId, cle, valeur },
            { onConflict: 'user_id,cle' }
          )
          .then(res => ({ cle, error: res.error }))
      )
    );
    results.forEach(({ cle, error }) => {
      if (error) console.error(`Erreur sauvegarde parametre ${cle}:`, error);
    });
    return true;
  } catch (error) {
    console.error('Erreur sauvegarde parametres:', error);
    return false;
  }
}

// ===== CRUD GENERIQUE =====

async function insertEntity(table, obj, mapToDb) {
  const userId = await getCurrentUserId();
  const row = mapToDb(obj);
  row.user_id = userId;
  const { data, error } = await supabaseClient.from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}

async function updateEntity(table, id, obj, mapToDb) {
  const row = mapToDb(obj);
  delete row.id; // Ne pas inclure id dans l'update
  delete row.user_id; // Ne pas changer le user_id
  const { data, error } = await supabaseClient.from(table).update(row).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function deleteEntity(table, id) {
  const { error } = await supabaseClient.from(table).delete().eq('id', id);
  if (error) throw error;
}

// ===== GETTERS/SETTERS GLOBAUX (inchanges - lisent depuis le cache) =====
function getAppData() {
  return appData;
}

function setAppData(newData) {
  appData = newData;
}

function setEditingId(id) {
  editingId = id;
}

function getEditingId() {
  return editingId;
}

// ===== UTILITAIRES DE BASE =====
function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR');
}

function formatActions(actions) {
  if (!actions) return '';
  let result = [];
  if (actions.email && actions.emailDate) {
    result.push(`Email (${formatDate(actions.emailDate)})`);
  }
  if (actions.telephone && actions.telephoneDate) {
    result.push(`Appel (${formatDate(actions.telephoneDate)})`);
  }
  if (actions.relance && actions.relanceDate) {
    result.push(`Relance (${formatDate(actions.relanceDate)})`);
  }
  return result.join('<br>');
}

function getDureeValue(type) {
  const select = document.getElementById(`${type}-duree`);
  if (select && select.value === 'autre') {
    return parseInt(document.getElementById(`${type}-duree-autre`).value) || 60;
  }
  return parseInt(select?.value) || 60;
}

// ===== GESTION DES PARAMETRES =====
async function saveParametres(formData) {
  if (!appData.parametres) {
    appData.parametres = {};
  }

  if (formData.adresseSalon !== undefined) {
    appData.parametres.adresseSalon = formData.adresseSalon;
  }
  if (formData.consommation !== undefined) {
    appData.parametres.consommation = parseFloat(formData.consommation) || 5.5;
  }
  if (formData.prixCarburant !== undefined) {
    appData.parametres.prixCarburant = parseFloat(formData.prixCarburant) || 1.85;
  }
  if (formData.coutUsure !== undefined) {
    appData.parametres.coutUsure = parseFloat(formData.coutUsure) || 0.15;
  }
  if (formData.calculPeriode !== undefined) {
    appData.parametres.calculPeriode = formData.calculPeriode || 'mois-calendaire';
  }

  // Sauvegarder vers Supabase (await!)
  await saveParametresToDb();

  return true;
}

function getParametres() {
  return appData.parametres || {};
}

// ===== DASHBOARD PERSONNALISABLE =====
async function saveDashboardLayoutToCore(config) {
  if (!appData.parametres) {
    appData.parametres = {};
  }
  appData.parametres.dashboardLayout = config;
  await saveParametresToDb();
}

function loadDashboardLayoutFromCore() {
  return appData.parametres && appData.parametres.dashboardLayout ?
    appData.parametres.dashboardLayout : null;
}

// ===== GETTERS SPECIFIQUES PAR ENTITE (inchanges - lisent depuis le cache) =====

function getAllRdv() { return appData.rdv || []; }
function getRdvById(rdvId) { return appData.rdv.find(r => r.id === rdvId); }
function getAllPrestations() { return appData.prestations || []; }
function getPrestationById(prestationId) { return appData.prestations.find(p => p.id === prestationId); }
function getSortedPrestations() {
  return appData.prestations
    .sort((a, b) => new Date(`${b.date}T${b.heure}`) - new Date(`${a.date}T${a.heure}`));
}
function getAllClients() { return appData.clients || []; }
function getClientById(clientId) { return appData.clients.find(c => c.id === clientId); }
function getAllProspects() { return appData.prospects || []; }
function getProspectById(prospectId) { return appData.prospects.find(p => p.id === prospectId); }
function getAllCollaborateurs() { return appData.collaborateurs || []; }
function getCollaborateurById(collaborateurId) { return appData.collaborateurs.find(c => c.id === collaborateurId); }
function getSortedCollaborateurs() {
  return appData.collaborateurs
    .sort((a, b) => `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`));
}
function getAllDepenses() { return appData.depenses || []; }
function getDepenseById(depenseId) { return appData.depenses ? appData.depenses.find(d => d.id === depenseId) : null; }
function getSortedDepenses() {
  if (!appData.depenses) return [];
  return appData.depenses.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ===== FONCTIONS DE RECHERCHE ET FILTRAGE =====
function getRdvForDate(dateStr) {
  return appData.rdv
    .filter(rdv => rdv.date === dateStr)
    .sort((a, b) => a.heure.localeCompare(b.heure));
}

function getPrestationsForDate(dateStr) {
  return appData.prestations
    .filter(p => p.date === dateStr)
    .sort((a, b) => a.heure.localeCompare(b.heure));
}

function getProchainsRdv() {
  const now = new Date();
  return appData.rdv
    .filter(rdv => new Date(`${rdv.date}T${rdv.heure}`) >= now)
    .sort((a, b) => new Date(`${a.date}T${a.heure}`) - new Date(`${b.date}T${b.heure}`))
    .slice(0, 5);
}

// ===== FRAIS DE DEPLACEMENT =====
function isAdresseSalonConfigured() {
  const params = appData.parametres || {};
  return !!(params.adresseSalon && params.adresseSalon.trim().length > 10);
}

function getAdresseSalon() {
  const params = appData.parametres || {};
  return params.adresseSalon || '';
}

function calculateFraisDeplacement(distanceKm) {
  const params = appData.parametres || {};
  const consommation = parseFloat(params.consommation) || 5.5;
  const prixCarburant = parseFloat(params.prixCarburant) || 1.85;
  const coutUsure = parseFloat(params.coutUsure) || 0.15;
  if (distanceKm <= 0) return 0;
  const distanceAllerRetour = distanceKm * 2;
  const coutCarburant = (consommation / 100) * distanceAllerRetour * prixCarburant;
  const coutTotal = coutCarburant + (distanceAllerRetour * coutUsure);
  return Math.round(coutTotal * 100) / 100;
}

// Sauvegarde auto (plus pertinent en PWA, mais on garde l'interface)
function getCheminSauvegardeAuto() { return ''; }
function isCheminSauvegardeAutoConfigured() { return false; }

// ===== MIGRATION (deja executees lors de la migration initiale) =====
function migrerVilleParDefaut() { return 0; }
function migrerCollaborateurHeadSpa() { }
function migrerTarifs2026() { }
function migrerCarteSoins() { }
function migrerCarteSoinsV2() { }

// v1.0.7.0 : Backfill du champ "groupe" sur les categories existantes.
// Heuristique : HeadSpa -> "HeadSpa"; tout ce qui matche massage/rituel/monde -> "Massages";
// sinon -> le nom de la categorie elle-meme (= la categorie est son propre groupe).
// Idempotent : ne touche que les categories sans groupe defini.
async function migrerCategoriesGroupes() {
  const carte = getCarteSoins();
  if (!carte || !Array.isArray(carte.categories)) return 0;
  let modified = 0;
  carte.categories.forEach(cat => {
    if (cat.groupe && typeof cat.groupe === 'string' && cat.groupe.trim()) return;
    const nom = (cat.nom || '').toLowerCase();
    let groupe = cat.nom || 'Sans nom';
    if (nom.includes('headspa') || nom.includes('head spa')) {
      groupe = 'HeadSpa';
    } else if (
      nom.includes('massage') ||
      nom.includes('rituel') ||
      nom.includes('soins du monde') ||
      nom.includes('soin du monde')
    ) {
      groupe = 'Massages';
    }
    cat.groupe = groupe;
    modified++;
  });
  if (modified > 0) {
    console.log(`Migration groupes : ${modified} categorie(s) backfillee(s).`);
    await saveParametresToDb();
  }
  return modified;
}

// v1.0.7.0 : retourne la liste des groupes distincts (uniques) parmi les categories actives.
// Chaque groupe : { nom, couleur (heritee de la 1ere cat du groupe), categorieIds: [...] }.
function getGroupesCategories(options = {}) {
  const cats = getCategories(options);
  const map = new Map();
  cats.forEach(cat => {
    const groupe = (cat.groupe && cat.groupe.trim()) ? cat.groupe : cat.nom;
    if (!map.has(groupe)) {
      map.set(groupe, { nom: groupe, couleur: cat.couleur || null, categorieIds: [cat.id] });
    } else {
      const g = map.get(groupe);
      g.categorieIds.push(cat.id);
      if (!g.couleur && cat.couleur) g.couleur = cat.couleur;
    }
  });
  return Array.from(map.values());
}

// v1.0.7.0 : retourne le groupe d'une categorie (par defaut son propre nom).
function getGroupeForCategorieId(categorieId) {
  const cat = getCategorieById(categorieId);
  if (!cat) return null;
  return (cat.groupe && cat.groupe.trim()) ? cat.groupe : cat.nom;
}

// v1.0.7.0 : retourne le groupe d'un soin (via sa categorie).
function getGroupeForSoinId(soinIdOrType) {
  const soin = resolveSoin(soinIdOrType);
  if (!soin) return null;
  return getGroupeForCategorieId(soin.categorieId);
}

function getHeadSpaCollaborateurId() {
  return appData.parametres?.headSpaCollaborateurId || null;
}

function getHeadSpaCollaborateur() {
  const id = getHeadSpaCollaborateurId();
  if (!id) return null;
  return appData.collaborateurs.find(c => c.id === id) || null;
}

// ===== EXPORT/IMPORT (version PWA avec download/upload) =====
async function exportData() {
  try {
    const jsonStr = JSON.stringify(appData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elise-massage-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { success: true };
  } catch (error) {
    throw error;
  }
}

async function importData() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      try {
        const file = e.target.files[0];
        if (!file) {
          resolve({ success: false, error: 'Aucun fichier selectionne' });
          return;
        }
        const text = await file.text();
        const importedData = JSON.parse(text);

        // Valider la structure
        if (!importedData.clients && !importedData.prestations) {
          resolve({ success: false, error: 'Format de fichier invalide' });
          return;
        }

        // Importer dans Supabase (effacer et re-inserer)
        const userId = await getCurrentUserId();
        const confirm = window.confirm(
          'Attention : ceci va remplacer TOUTES les donnees actuelles par celles du fichier importe. Continuer ?'
        );
        if (!confirm) {
          resolve({ success: false, error: 'Import annule' });
          return;
        }

        // Supprimer les donnees existantes
        await Promise.all([
          supabaseClient.from('clients').delete().eq('user_id', userId),
          supabaseClient.from('prospects').delete().eq('user_id', userId),
          supabaseClient.from('collaborateurs').delete().eq('user_id', userId),
          supabaseClient.from('rdv').delete().eq('user_id', userId),
          supabaseClient.from('prestations').delete().eq('user_id', userId),
          supabaseClient.from('depenses').delete().eq('user_id', userId),
          supabaseClient.from('bons_cadeaux').delete().eq('user_id', userId),
          supabaseClient.from('parametres').delete().eq('user_id', userId)
        ]);

        // Re-inserer les donnees importees
        const insertBatch = async (table, items, mapFn) => {
          if (!items || items.length === 0) return;
          const rows = items.map(item => {
            const row = mapFn(item);
            row.user_id = userId;
            return row;
          });
          // Inserer par lots de 500
          for (let i = 0; i < rows.length; i += 500) {
            const batch = rows.slice(i, i + 500);
            const { error } = await supabaseClient.from(table).insert(batch);
            if (error) console.error(`Erreur insert ${table}:`, error);
          }
        };

        await insertBatch('clients', importedData.clients, mapClientToDb);
        await insertBatch('prospects', importedData.prospects, mapProspectToDb);
        await insertBatch('collaborateurs', importedData.collaborateurs, mapCollaborateurToDb);
        await insertBatch('rdv', importedData.rdv, mapRdvToDb);
        await insertBatch('prestations', importedData.prestations, mapPrestationToDb);
        await insertBatch('depenses', importedData.depenses, mapDepenseToDb);
        await insertBatch('bons_cadeaux', importedData.bonsCadeaux, mapBonCadeauToDb);

        // Parametres
        if (importedData.parametres) {
          for (const [cle, valeur] of Object.entries(importedData.parametres)) {
            await supabaseClient.from('parametres').upsert(
              { user_id: userId, cle, valeur },
              { onConflict: 'user_id,cle' }
            );
          }
        }

        // Recharger les donnees
        await loadData();

        resolve({ success: true });
      } catch (error) {
        reject(error);
      }
    };
    input.click();
  });
}

// ===== ANNEES PRESENTES DANS LES DONNEES =====
function getYearsFromData() {
  const years = new Set();
  appData.prestations.forEach(p => { if (p.date) years.add(new Date(p.date).getFullYear()); });
  if (appData.depenses) { appData.depenses.forEach(d => { if (d.date) years.add(new Date(d.date).getFullYear()); }); }
  if (appData.rdv) { appData.rdv.forEach(r => { if (r.date) years.add(new Date(r.date).getFullYear()); }); }
  return Array.from(years).sort((a, b) => b - a);
}

// ===== GESTION DES PERIODES GOOGLE ADS =====
function getCampaignPeriods(campaignId) {
  if (!appData.parametres.googleAdsCampaignPeriods) {
    appData.parametres.googleAdsCampaignPeriods = {};
  }
  return appData.parametres.googleAdsCampaignPeriods[campaignId] || [];
}

async function addCampaignPeriod(campaignId, periodData) {
  if (!appData.parametres.googleAdsCampaignPeriods) {
    appData.parametres.googleAdsCampaignPeriods = {};
  }
  if (!appData.parametres.googleAdsCampaignPeriods[campaignId]) {
    appData.parametres.googleAdsCampaignPeriods[campaignId] = [];
  }
  const newPeriod = {
    id: generateId(),
    campaignId,
    startDate: periodData.startDate,
    endDate: periodData.endDate || null,
    frozenCost: periodData.frozenCost || null,
    frozenMetrics: periodData.frozenMetrics || null,
    createdAt: new Date().toISOString()
  };
  appData.parametres.googleAdsCampaignPeriods[campaignId].push(newPeriod);
  await saveParametresToDb();
  return newPeriod;
}

async function endCampaignPeriod(periodId, finalCost, finalMetrics = {}) {
  if (!appData.parametres.googleAdsCampaignPeriods) return false;
  for (const campaignId in appData.parametres.googleAdsCampaignPeriods) {
    const periods = appData.parametres.googleAdsCampaignPeriods[campaignId];
    const period = periods.find(p => p.id === periodId);
    if (period) {
      period.endDate = new Date().toISOString().split('T')[0];
      period.frozenCost = finalCost;
      period.frozenMetrics = finalMetrics;
      period.endedAt = new Date().toISOString();
      await saveParametresToDb();
      return true;
    }
  }
  return false;
}

async function updateCampaignPeriod(periodId, updates) {
  if (!appData.parametres.googleAdsCampaignPeriods) return false;
  for (const campaignId in appData.parametres.googleAdsCampaignPeriods) {
    const periods = appData.parametres.googleAdsCampaignPeriods[campaignId];
    const period = periods.find(p => p.id === periodId);
    if (period) {
      Object.assign(period, updates);
      period.updatedAt = new Date().toISOString();
      await saveParametresToDb();
      return true;
    }
  }
  return false;
}

async function deleteCampaignPeriod(periodId) {
  if (!appData.parametres.googleAdsCampaignPeriods) return false;
  for (const campaignId in appData.parametres.googleAdsCampaignPeriods) {
    const periods = appData.parametres.googleAdsCampaignPeriods[campaignId];
    const index = periods.findIndex(p => p.id === periodId);
    if (index !== -1) {
      periods.splice(index, 1);
      await saveParametresToDb();
      return true;
    }
  }
  return false;
}

function getActivePeriodForDate(campaignId, date) {
  const periods = getCampaignPeriods(campaignId);
  if (periods.length === 0) return null;
  const targetDate = new Date(date);
  return periods.find(period => {
    const startDate = new Date(period.startDate);
    const endDate = period.endDate ? new Date(period.endDate) : new Date();
    return targetDate >= startDate && targetDate <= endDate;
  }) || null;
}

function getClientAcquisitionDate(client) {
  const clientPrestations = appData.prestations.filter(p => p.clientId === client.id);
  if (clientPrestations.length === 0) return null;
  const sortedPrestations = clientPrestations.sort((a, b) => new Date(a.date) - new Date(b.date));
  return sortedPrestations[0].date;
}

// ===== GESTION DES BONS CADEAUX =====
function getAllBonsCadeaux() { return appData.bonsCadeaux || []; }
function getBonCadeauById(bonId) { return appData.bonsCadeaux ? appData.bonsCadeaux.find(b => b.id === bonId) : null; }
function getSortedBonsCadeaux() {
  if (!appData.bonsCadeaux) return [];
  return appData.bonsCadeaux.sort((a, b) => new Date(b.dateAchat) - new Date(a.dateAchat));
}

function getBonsCadeauxActifs() {
  if (!appData.bonsCadeaux) return [];
  const today = new Date().toISOString().split('T')[0];
  return appData.bonsCadeaux.filter(bon => {
    if (bon.statut !== 'actif') return false;
    return bon.dateExpiration >= today;
  }).sort((a, b) => new Date(a.dateExpiration) - new Date(b.dateExpiration));
}

function getBonsCadeauxExpirantBientot(joursAvant = 30) {
  if (!appData.bonsCadeaux) return [];
  const today = new Date();
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() + joursAvant);
  return appData.bonsCadeaux.filter(bon => {
    if (bon.statut !== 'actif') return false;
    const expiration = new Date(bon.dateExpiration);
    return expiration >= today && expiration <= limitDate;
  }).sort((a, b) => new Date(a.dateExpiration) - new Date(b.dateExpiration));
}

function getMontantBonsCadeauxNonUtilises() {
  if (!appData.bonsCadeaux) return 0;
  return appData.bonsCadeaux
    .filter(bon => bon.statut === 'actif')
    .reduce((total, bon) => total + (bon.montant || 0), 0);
}

function getStatistiquesBonsCadeaux() {
  if (!appData.bonsCadeaux) {
    return { actifs: 0, utilises: 0, expires: 0, rembourses: 0, montantActifs: 0, montantTotal: 0 };
  }
  const today = new Date().toISOString().split('T')[0];
  appData.bonsCadeaux.forEach(bon => {
    if (bon.statut === 'actif' && bon.dateExpiration < today) {
      bon.statut = 'expire';
    }
  });
  const stats = { actifs: 0, utilises: 0, expires: 0, rembourses: 0, montantActifs: 0, montantTotal: 0 };
  appData.bonsCadeaux.forEach(bon => {
    stats.montantTotal += bon.montant || 0;
    switch (bon.statut) {
      case 'actif': stats.actifs++; stats.montantActifs += bon.montant || 0; break;
      case 'utilise': stats.utilises++; break;
      case 'expire': stats.expires++; break;
      case 'rembourse': stats.rembourses++; break;
    }
  });
  return stats;
}

function calculerDateExpiration(dateDebut) {
  const validiteMois = appData.parametres?.validiteBonsCadeauxMois || 6;
  const date = new Date(dateDebut);
  date.setMonth(date.getMonth() + validiteMois);
  return date.toISOString().split('T')[0];
}

function getValiditeBonsCadeauxMois() { return appData.parametres?.validiteBonsCadeauxMois || 6; }
async function setValiditeBonsCadeauxMois(mois) {
  if (!appData.parametres) appData.parametres = {};
  appData.parametres.validiteBonsCadeauxMois = mois;
  await saveParametresToDb();
}

// ===== CARTE DES SOINS PARAMETRABLE =====
// (Toute la logique carte des soins est identique a l'original - elle lit depuis appData.parametres.carteSoins)

function getDefaultCarteSoins() {
  const jennyId = appData.parametres?.headSpaCollaborateurId || null;
  return {
    categories: [
      { id: "cat_signature", nom: "Massage Signature", ordre: 1, statut: "actif" },
      { id: "cat_specifiques", nom: "Massages Specifiques", ordre: 2, statut: "actif" },
      { id: "cat_monde", nom: "Soins du Monde", ordre: 3, statut: "actif" },
      { id: "cat_rituels", nom: "Les Rituels", ordre: 4, statut: "actif" },
      { id: "cat_headspa", nom: "HeadSpa", ordre: 5, statut: "actif" },
      { id: "cat_rituels_headspa", nom: "Rituels HeadSpa", ordre: 6, statut: "actif" }
    ],
    soins: [
      { id: "soin_signature", nom: "Massage Signature", categorieId: "cat_signature", statut: "actif", coutHuiles: 0, isPartnership: false, partenaireCollaborateurId: null, calendarColor: null, comboConfig: null, variantes: [{ duree: 60, prix: 80, description: "L'equilibre parfait" }, { duree: 90, prix: 110, description: "L'immersion" }, { duree: 120, prix: 150, description: "L'evasion absolue" }] },
      { id: "soin_detente_dos", nom: "Detente dos", categorieId: "cat_specifiques", statut: "actif", coutHuiles: 0, isPartnership: false, partenaireCollaborateurId: null, calendarColor: null, comboConfig: null, variantes: [{ duree: 30, prix: 50, description: "" }] },
      { id: "soin_epaules_dos_nuque", nom: "Epaules, dos & nuque", categorieId: "cat_specifiques", statut: "actif", coutHuiles: 0, isPartnership: false, partenaireCollaborateurId: null, calendarColor: null, comboConfig: null, variantes: [{ duree: 45, prix: 60, description: "" }] },
      { id: "soin_jambes_legeres", nom: "Jambes legeres", categorieId: "cat_specifiques", statut: "actif", coutHuiles: 0, isPartnership: false, partenaireCollaborateurId: null, calendarColor: null, comboConfig: null, variantes: [{ duree: 45, prix: 60, description: "" }] },
      { id: "soin_relaxant_visage", nom: "Relaxant visage", categorieId: "cat_specifiques", statut: "actif", coutHuiles: 0, isPartnership: false, partenaireCollaborateurId: null, calendarColor: null, comboConfig: null, variantes: [{ duree: 30, prix: 50, description: "" }] },
      { id: "soin_eclat_antiage", nom: "Eclat & anti-age", categorieId: "cat_specifiques", statut: "actif", coutHuiles: 0, isPartnership: false, partenaireCollaborateurId: null, calendarColor: null, comboConfig: null, variantes: [{ duree: 30, prix: 60, description: "Inspire du Kobido" }] },
      { id: "soin_balinais", nom: "Massage Balinais", categorieId: "cat_monde", statut: "actif", coutHuiles: 0, isPartnership: false, partenaireCollaborateurId: null, calendarColor: null, comboConfig: null, variantes: [{ duree: 75, prix: 90, description: "Pressions profondes et huiles chaudes" }] },
      { id: "soin_coreenne", nom: "Relaxation Coreenne", categorieId: "cat_monde", statut: "actif", coutHuiles: 0, isPartnership: false, partenaireCollaborateurId: null, calendarColor: null, comboConfig: null, variantes: [{ duree: 75, prix: 95, description: "Oscillations et vibrations douces" }] },
      { id: "soin_parenthese", nom: "La Parenthese bien-etre", categorieId: "cat_rituels", statut: "actif", coutHuiles: 0, isPartnership: false, partenaireCollaborateurId: null, calendarColor: null, comboConfig: null, variantes: [{ duree: 60, prix: 80, description: "Detente dos + Relaxant visage" }] },
      { id: "soin_voyage", nom: "Le Voyage sensoriel", categorieId: "cat_rituels", statut: "actif", coutHuiles: 0, isPartnership: false, partenaireCollaborateurId: null, calendarColor: null, comboConfig: null, variantes: [{ duree: 90, prix: 110, description: "Signature 60' + Visage au choix" }] },
      { id: "soin_evasion", nom: "L'Evasion totale", categorieId: "cat_rituels", statut: "actif", coutHuiles: 0, isPartnership: false, partenaireCollaborateurId: null, calendarColor: null, comboConfig: null, variantes: [{ duree: 120, prix: 150, description: "Signature 90' + Visage au choix" }] },
      { id: "soin_headspa", nom: "HeadSpa", categorieId: "cat_headspa", statut: "actif", coutHuiles: 0, isPartnership: true, partenaireCollaborateurId: jennyId, calendarColor: "#9b59b6", comboConfig: null, variantes: [{ duree: 30, prixTotal: 75, maPartFixe: 20, description: "" }, { duree: 45, prixTotal: 95, maPartFixe: 35, description: "" }, { duree: 60, prixTotal: 115, maPartFixe: 40, description: "" }] },
      { id: "soin_rituel_douceur_signature", nom: "Rituel douceur signature", categorieId: "cat_rituels_headspa", statut: "actif", coutHuiles: 0, isPartnership: true, partenaireCollaborateurId: jennyId, calendarColor: "#8e44ad", comboConfig: { isCombo: true, partMassagePrix: null, partHeadSpaFixe: null }, variantes: [{ duree: 105, prixTotal: 125, maPartFixe: 70, description: "Massage 30' + HeadSpa 30' + Brushing" }] },
      { id: "soin_rituel_douceur_premium", nom: "Rituel douceur premium", categorieId: "cat_rituels_headspa", statut: "actif", coutHuiles: 0, isPartnership: true, partenaireCollaborateurId: jennyId, calendarColor: "#8e44ad", comboConfig: { isCombo: true, partMassagePrix: null, partHeadSpaFixe: null }, variantes: [{ duree: 150, prixTotal: 155, maPartFixe: 95, description: "Massage 45' + HeadSpa 45' + Brushing" }] },
      { id: "soin_massage_sur_mesure_legacy", nom: "Massage sur mesure", categorieId: "cat_signature", statut: "archive", coutHuiles: 0, isPartnership: false, partenaireCollaborateurId: null, calendarColor: null, comboConfig: null, variantes: [{ duree: 30, prix: 50, description: "" }, { duree: 45, prix: 60, description: "" }, { duree: 60, prix: 80, description: "" }, { duree: 90, prix: 110, description: "" }] },
      { id: "soin_aromatherapie_legacy", nom: "Aromatherapie", categorieId: "cat_signature", statut: "archive", coutHuiles: 0, isPartnership: false, partenaireCollaborateurId: null, calendarColor: null, comboConfig: null, variantes: [{ duree: 30, prix: 50, description: "" }, { duree: 45, prix: 60, description: "" }, { duree: 60, prix: 80, description: "" }, { duree: 90, prix: 110, description: "" }] }
    ],
    legacyTypeMapping: {
      "Massage sur mesure": "soin_massage_sur_mesure_legacy",
      "Les Rituels": null,
      "HeadSpa": "soin_headspa",
      "Aromatherapie": "soin_aromatherapie_legacy"
    },
    version: 1
  };
}

function getCarteSoins() { return appData.parametres?.carteSoins || null; }

function getCategories(options = {}) {
  const carte = getCarteSoins();
  if (!carte) return [];
  let categories = [...carte.categories];
  if (!options.includeArchived) { categories = categories.filter(c => c.statut === 'actif'); }
  return categories.sort((a, b) => a.ordre - b.ordre);
}

function getCategorieById(categorieId) {
  const carte = getCarteSoins();
  if (!carte) return null;
  return carte.categories.find(c => c.id === categorieId) || null;
}

function getSoins(options = {}) {
  const carte = getCarteSoins();
  if (!carte) return [];
  let soins = [...carte.soins];
  if (!options.includeArchived) { soins = soins.filter(s => s.statut !== 'archive'); }
  if (!options.includeStandby) { soins = soins.filter(s => s.statut !== 'standby'); }
  if (!options.includeArchived && !options.includeStandby && !options.allStatuts) { soins = soins.filter(s => s.statut === 'actif'); }
  if (options.categorieId) { soins = soins.filter(s => s.categorieId === options.categorieId); }
  return soins;
}

function getSoinById(soinId) { const carte = getCarteSoins(); if (!carte || !soinId) return null; return carte.soins.find(s => s.id === soinId) || null; }

function resolveSoin(idOrType) {
  if (!idOrType) return null;
  let soin = getSoinById(idOrType);
  if (soin) return soin;
  const carte = getCarteSoins();
  if (!carte) return null;
  const legacyId = carte.legacyTypeMapping[idOrType];
  if (legacyId) return getSoinById(legacyId);
  return carte.soins.find(s => s.nom === idOrType) || null;
}

function getVariantesForSoin(soinId) { const soin = getSoinById(soinId); if (!soin) return []; return soin.variantes || []; }

function getPrixForSoinVariante(soinId, duree) {
  const soin = getSoinById(soinId);
  if (!soin) return null;
  const dureeNum = parseInt(duree);
  const variante = soin.variantes.find(v => v.duree === dureeNum);
  if (!variante) return null;
  if (soin.isPartnership) return variante.maPartFixe !== undefined ? variante.maPartFixe : variante.prix;
  return variante.prix !== undefined ? variante.prix : variante.prixTotal;
}

function getPrixTotalForSoinVariante(soinId, duree) {
  const soin = getSoinById(soinId);
  if (!soin) return null;
  const dureeNum = parseInt(duree);
  const variante = soin.variantes.find(v => v.duree === dureeNum);
  if (!variante) return null;
  return variante.prixTotal !== undefined ? variante.prixTotal : variante.prix;
}

function getCoutHuilesForSoin(soinId) { const soin = getSoinById(soinId); if (!soin) return 0; return soin.coutHuiles || 0; }

function isPartnershipSoin(soinIdOrType) {
  const soin = resolveSoin(soinIdOrType);
  if (soin) return soin.isPartnership === true;
  if (typeof soinIdOrType === 'string') return soinIdOrType === 'HeadSpa';
  return false;
}

function isComboSoin(soinId) { const soin = getSoinById(soinId); if (!soin) return false; return soin.comboConfig?.isCombo === true; }
function getCalendarColorForSoin(soinIdOrType) {
  const soin = resolveSoin(soinIdOrType);
  if (soin && soin.calendarColor) return soin.calendarColor;
  // v1.0.7.0 : fallback sur la couleur de la categorie si pas de couleur propre au soin
  if (soin && soin.categorieId) {
    const cat = getCategorieById(soin.categorieId);
    if (cat && cat.couleur) return cat.couleur;
  }
  return null;
}

function getDisplayNameForType(soinIdOrType, options = {}) {
  if (!soinIdOrType) return 'Inconnu';
  const soin = resolveSoin(soinIdOrType);
  if (soin) {
    if (options.consolidateArchived && soin.statut === 'archive') {
      const carte = getCarteSoins();
      if (carte) { const actif = carte.soins.find(s => s.categorieId === soin.categorieId && s.statut === 'actif'); if (actif) return actif.nom; }
    }
    return soin.nom;
  }
  return soinIdOrType;
}

function getPartenaireCollaborateurId(soinId) { const soin = getSoinById(soinId); if (!soin) return null; return soin.partenaireCollaborateurId || null; }

function getSoinsGroupedByCategorie(options = {}) {
  const categories = getCategories(options);
  const soins = getSoins(options);
  return categories.map(cat => ({ ...cat, soins: soins.filter(s => s.categorieId === cat.id) })).filter(cat => cat.soins.length > 0 || options.includeEmpty);
}

// CRUD Carte des soins
async function addSoin(soinData) {
  const carte = getCarteSoins();
  if (!carte) return null;
  const newSoin = {
    id: 'soin_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    nom: soinData.nom || 'Nouveau soin',
    categorieId: soinData.categorieId || carte.categories[0]?.id,
    statut: soinData.statut || 'actif',
    coutHuiles: soinData.coutHuiles || 0,
    isPartnership: soinData.isPartnership || false,
    partenaireCollaborateurId: soinData.partenaireCollaborateurId || null,
    calendarColor: soinData.calendarColor || null,
    comboConfig: soinData.comboConfig || null,
    variantes: soinData.variantes || [{ duree: 60, prix: 0, description: "" }]
  };
  carte.soins.push(newSoin);
  await saveParametresToDb();
  return newSoin;
}

async function updateSoin(soinId, updates) {
  const carte = getCarteSoins();
  if (!carte) return false;
  const soin = carte.soins.find(s => s.id === soinId);
  if (!soin) return false;
  const allowedFields = ['nom', 'categorieId', 'statut', 'coutHuiles', 'isPartnership', 'partenaireCollaborateurId', 'calendarColor', 'comboConfig', 'variantes'];
  allowedFields.forEach(field => { if (updates[field] !== undefined) soin[field] = updates[field]; });
  await saveParametresToDb();
  return true;
}

async function archiveSoin(soinId) { return updateSoin(soinId, { statut: 'archive' }); }
async function standBySoin(soinId) { return updateSoin(soinId, { statut: 'standby' }); }
async function activerSoin(soinId) { return updateSoin(soinId, { statut: 'actif' }); }

async function deleteSoin(soinId) {
  const carte = getCarteSoins();
  if (!carte) return false;
  const index = carte.soins.findIndex(s => s.id === soinId);
  if (index === -1) return false;
  carte.soins.splice(index, 1);
  await saveParametresToDb();
  return true;
}

async function addCategorie(categorieData) {
  const carte = getCarteSoins();
  if (!carte) return null;
  const maxOrdre = carte.categories.reduce((max, c) => Math.max(max, c.ordre || 0), 0);
  const newCategorie = {
    id: 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    nom: categorieData.nom || 'Nouvelle categorie',
    ordre: categorieData.ordre || (maxOrdre + 1),
    statut: categorieData.statut || 'actif',
    // v1.0.7.0 : champs etendus
    couleur: categorieData.couleur || null,
    groupe: categorieData.groupe || (categorieData.nom || 'Nouvelle categorie'),
    objectifCaMensuel: categorieData.objectifCaMensuel != null ? Number(categorieData.objectifCaMensuel) : null,
    coutProduitDefault: categorieData.coutProduitDefault != null ? Number(categorieData.coutProduitDefault) : null
  };
  carte.categories.push(newCategorie);
  await saveParametresToDb();
  return newCategorie;
}

async function updateCategorie(categorieId, updates) {
  const carte = getCarteSoins();
  if (!carte) return false;
  const categorie = carte.categories.find(c => c.id === categorieId);
  if (!categorie) return false;
  if (updates.nom !== undefined) categorie.nom = updates.nom;
  if (updates.ordre !== undefined) categorie.ordre = updates.ordre;
  if (updates.statut !== undefined) categorie.statut = updates.statut;
  // v1.0.7.0 : champs etendus
  if (updates.couleur !== undefined) categorie.couleur = updates.couleur || null;
  if (updates.groupe !== undefined) categorie.groupe = updates.groupe || categorie.nom;
  if (updates.objectifCaMensuel !== undefined) {
    categorie.objectifCaMensuel = updates.objectifCaMensuel != null && updates.objectifCaMensuel !== ''
      ? Number(updates.objectifCaMensuel) : null;
  }
  if (updates.coutProduitDefault !== undefined) {
    categorie.coutProduitDefault = updates.coutProduitDefault != null && updates.coutProduitDefault !== ''
      ? Number(updates.coutProduitDefault) : null;
  }
  await saveParametresToDb();
  return true;
}

async function archiveCategorie(categorieId) {
  const carte = getCarteSoins();
  if (!carte) return false;
  // v1.0.7.2 : modifier le cache en une fois puis UN seul save (au lieu de 2).
  // updateCategorie faisait deja un save -> on inline pour eviter le double round-trip.
  const cat = carte.categories.find(c => c.id === categorieId);
  if (cat) cat.statut = 'archive';
  carte.soins.filter(s => s.categorieId === categorieId).forEach(s => { s.statut = 'archive'; });
  await saveParametresToDb();
  return true;
}

// v1.0.7.3 : suppression definitive d'une categorie + tous ses soins.
// ATTENTION : les prestations existantes liees aux soins gardent leur snapshot
// (.type et .prix) mais leur .soinId deviendra orphelin. C'est volontaire :
// on preserve l'historique financier mais on libere la categorie.
async function deleteCategorieById(categorieId) {
  const carte = getCarteSoins();
  if (!carte) return false;
  carte.categories = carte.categories.filter(c => c.id !== categorieId);
  carte.soins = carte.soins.filter(s => s.categorieId !== categorieId);
  await saveParametresToDb();
  return true;
}

// JOURS INSTITUT
function isJourInstitut(dateStr) {
  if (!appData.parametres || !appData.parametres.joursInstitut) return false;
  return appData.parametres.joursInstitut.includes(dateStr);
}
function getJoursInstitut() {
  if (!appData.parametres || !appData.parametres.joursInstitut) return [];
  return appData.parametres.joursInstitut;
}

// ===== EXPORTS GLOBAUX =====
window.DataManager = {
  loadData, saveData, getAppData, setAppData,
  setEditingId, getEditingId,
  generateId, formatDate, formatActions, getDureeValue,
  saveParametres, getParametres,
  saveDashboardLayoutToCore, loadDashboardLayoutFromCore,
  getAllRdv, getRdvById,
  getAllPrestations, getPrestationById, getSortedPrestations,
  getAllClients, getClientById,
  getAllProspects, getProspectById,
  getAllCollaborateurs, getCollaborateurById, getSortedCollaborateurs,
  getAllDepenses, getDepenseById, getSortedDepenses,
  getRdvForDate, getPrestationsForDate, getProchainsRdv,
  isAdresseSalonConfigured, getAdresseSalon, calculateFraisDeplacement,
  getCheminSauvegardeAuto, isCheminSauvegardeAutoConfigured,
  migrerVilleParDefaut, migrerCollaborateurHeadSpa, migrerTarifs2026, migrerCarteSoins, migrerCarteSoinsV2,
  getHeadSpaCollaborateurId, getHeadSpaCollaborateur,
  exportData, importData,
  getYearsFromData,
  getCampaignPeriods, addCampaignPeriod, endCampaignPeriod, updateCampaignPeriod, deleteCampaignPeriod,
  getActivePeriodForDate, getClientAcquisitionDate,
  isJourInstitut, getJoursInstitut,
  getAllBonsCadeaux, getBonCadeauById, getSortedBonsCadeaux, getBonsCadeauxActifs,
  getBonsCadeauxExpirantBientot, getMontantBonsCadeauxNonUtilises, getStatistiquesBonsCadeaux,
  calculerDateExpiration, getValiditeBonsCadeauxMois, setValiditeBonsCadeauxMois,
  getDefaultCarteSoins, getCarteSoins, getCategories, getCategorieById, getSoins, getSoinById, resolveSoin,
  getVariantesForSoin, getPrixForSoinVariante, getPrixTotalForSoinVariante, getCoutHuilesForSoin,
  isPartnershipSoin, isComboSoin, getCalendarColorForSoin, getDisplayNameForType, getPartenaireCollaborateurId,
  getSoinsGroupedByCategorie,
  addSoin, updateSoin, archiveSoin, standBySoin, activerSoin, deleteSoin,
  addCategorie, updateCategorie, archiveCategorie, deleteCategorieById,
  // v1.0.7.0 : groupes de categories
  migrerCategoriesGroupes, getGroupesCategories, getGroupeForCategorieId, getGroupeForSoinId,
  // Nouvelles fonctions Supabase
  insertEntity, updateEntity, deleteEntity, saveParametresToDb,
  mapClientToDb, mapClientFromDb, mapProspectToDb, mapProspectFromDb,
  mapCollaborateurToDb, mapCollaborateurFromDb,
  mapRdvToDb, mapRdvFromDb, mapPrestationToDb, mapPrestationFromDb,
  mapDepenseToDb, mapDepenseFromDb, mapBonCadeauToDb, mapBonCadeauFromDb
};

console.log('Data Manager PWA avec Supabase charge');
