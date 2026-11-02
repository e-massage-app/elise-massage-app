// ===== GESTION : DONNEES (v1.1.0.1) =====
// Lit et ecrit UNIQUEMENT les tables de l'onglet Gestion (gestion_*) et la cle
// `gestion` de `parametres`. Prestations, cartes cadeaux et depenses sont lues
// depuis appData (deja charge par l'app), jamais modifiees ici.
// Mapping camelCase (JS) <-> snake_case (BDD), comme data-manager.js.

(function (racine) {

const etat = {
  charge: false,
  gestion: { mouvements: [], recurrents: [], mois: {}, soldes: [] },
  ads: null,          // { 'YYYY-MM': cout } lu chez Google, null si indisponible
  adsJours: null,     // { 'YYYY-MM-DD': cout } : la courbe du mois, jour par jour
  adsErreur: null,
  adsCharge: false
};

// ----- Mappers -----

const CHAMPS = {
  gestion_mouvements: { date: 'date', espace: 'espace', sens: 'sens', compte: 'compte', compteVers: 'compte_vers', categorie: 'categorie', montant: 'montant', libelle: 'libelle', moisConcerne: 'mois_concerne' },
  gestion_recurrents: { espace: 'espace', sens: 'sens', compte: 'compte', compteVers: 'compte_vers', categorie: 'categorie', nom: 'nom', montant: 'montant', frequence: 'frequence', moisAnnuel: 'mois_annuel', debut: 'debut', fin: 'fin', ordre: 'ordre' },
  gestion_mois: { mois: 'mois', caDeclare: 'ca_declare', corrections: 'corrections', clotureLe: 'cloture_le', notes: 'notes' },
  gestion_soldes: { date: 'date', compte: 'compte', montant: 'montant', note: 'note' }
};

function depuisBdd(table, row) {
  const obj = { id: row.id, createdAt: row.created_at };
  Object.entries(CHAMPS[table]).forEach(([js, bdd]) => { obj[js] = row[bdd] ?? null; });
  if (table === 'gestion_mois' && !obj.corrections) obj.corrections = {};
  ['montant', 'caDeclare'].forEach(c => { if (obj[c] !== null && obj[c] !== undefined) obj[c] = Number(obj[c]); });
  return obj;
}

function versBdd(table, obj) {
  const row = {};
  Object.entries(CHAMPS[table]).forEach(([js, bdd]) => {
    if (obj[js] !== undefined) row[bdd] = obj[js] === '' ? null : obj[js];
  });
  return row;
}

function nouvelId() {
  return (typeof DataManager !== 'undefined' && DataManager.generateId)
    ? DataManager.generateId()
    : 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
}

async function utilisateur() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('Non authentifie');
  return user.id;
}

// ----- Chargement -----

async function charger() {
  const userId = await utilisateur();
  const tables = ['gestion_mouvements', 'gestion_recurrents', 'gestion_mois', 'gestion_soldes'];
  const reponses = await Promise.all(tables.map(t => supabaseClient.from(t).select('*').eq('user_id', userId)));
  const erreur = reponses.find(r => r.error);
  if (erreur) throw erreur.error;

  const [mouvements, recurrents, mois, soldes] = reponses.map((r, i) => (r.data || []).map(row => depuisBdd(tables[i], row)));
  etat.gestion = {
    mouvements: mouvements.sort((a, b) => a.date.localeCompare(b.date)),
    recurrents: recurrents.sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.nom.localeCompare(b.nom)),
    mois: Object.fromEntries(mois.map(m => [m.mois, m])),
    soldes
  };
  etat.charge = true;
  return etat.gestion;
}

// ----- Ecriture generique (une table de l'onglet) -----

async function enregistrer(table, obj, liste) {
  const userId = await utilisateur();
  const row = versBdd(table, obj);
  row.updated_at = new Date().toISOString();
  let res;
  if (obj.id) {
    res = await supabaseClient.from(table).update(row).eq('id', obj.id).eq('user_id', userId).select().single();
  } else {
    row.id = nouvelId();
    row.user_id = userId;
    res = await supabaseClient.from(table).insert(row).select().single();
  }
  if (res.error) throw res.error;
  const sauve = depuisBdd(table, res.data);
  if (liste) {
    const i = liste.findIndex(x => x.id === sauve.id);
    if (i >= 0) liste[i] = sauve; else liste.push(sauve);
  }
  return sauve;
}

async function supprimer(table, id, liste) {
  const userId = await utilisateur();
  const { error } = await supabaseClient.from(table).delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
  if (liste) {
    const i = liste.findIndex(x => x.id === id);
    if (i >= 0) liste.splice(i, 1);
  }
}

const enregistrerMouvement = mv => enregistrer('gestion_mouvements', mv, etat.gestion.mouvements);
const supprimerMouvement = id => supprimer('gestion_mouvements', id, etat.gestion.mouvements);
const enregistrerRecurrent = r => enregistrer('gestion_recurrents', r, etat.gestion.recurrents);
const supprimerRecurrent = id => supprimer('gestion_recurrents', id, etat.gestion.recurrents);
const enregistrerSolde = s => enregistrer('gestion_soldes', s, etat.gestion.soldes);
const supprimerSolde = id => supprimer('gestion_soldes', id, etat.gestion.soldes);

/** Met a jour la ligne d'un mois (creee au besoin) : { caDeclare, corrections, clotureLe, notes }. */
async function enregistrerMois(mois, modifs) {
  const existant = etat.gestion.mois[mois];
  const obj = { ...(existant || { mois, corrections: {} }), ...modifs, mois };
  const userId = await utilisateur();
  const row = versBdd('gestion_mois', obj);
  row.id = existant?.id || nouvelId();
  row.user_id = userId;
  row.updated_at = new Date().toISOString();
  const { data, error } = await supabaseClient.from('gestion_mois')
    .upsert(row, { onConflict: 'user_id,mois' }).select().single();
  if (error) throw error;
  etat.gestion.mois[mois] = depuisBdd('gestion_mois', data);
  return etat.gestion.mois[mois];
}

/** Corrige un chiffre d'un mois (valeur null = revenir au calcul). */
async function corriger(mois, cle, valeur) {
  const corrections = { ...(etat.gestion.mois[mois]?.corrections || {}) };
  if (valeur === null || valeur === undefined || valeur === '') delete corrections[cle];
  else corrections[cle] = Number(valeur);
  return enregistrerMois(mois, { corrections });
}

// ----- Reglages : cle `gestion` de parametres -----

function reglages() {
  const p = (typeof DataManager !== 'undefined') ? DataManager.getParametres() : {};
  return GestionCalculs.reglagesComplets(p.gestion);
}

/** N'ecrit que la cle `gestion` (et garde appData a jour pour saveParametresToDb). */
async function enregistrerReglages(nouveaux) {
  const userId = await utilisateur();
  const p = DataManager.getParametres();
  p.gestion = { ...(p.gestion || {}), ...nouveaux };
  const { error } = await supabaseClient.from('parametres')
    .upsert({ user_id: userId, cle: 'gestion', valeur: p.gestion }, { onConflict: 'user_id,cle' });
  if (error) throw error;
  return reglages();
}

// ----- Google Ads : cout du compte, jour par jour -----
// Lu directement chez Google (decision de Jordan : « au moins 0 erreur »).
// Tous les postes de depense des comptes qui portent les campagnes suivies :
// c'est ce que Google facture, donc ce qui sort du compte pro.

const CLE_CACHE_ADS = 'gestion-ads-v2';
const DUREE_CACHE_ADS = 60 * 60 * 1000; // le cout du jour bouge : une heure au plus

async function chargerCoutsAds(moisDebut, moisFin, { forcer = false } = {}) {
  if (!forcer) {
    try {
      const cache = JSON.parse(sessionStorage.getItem(CLE_CACHE_ADS) || 'null');
      if (cache && cache.debut <= moisDebut && cache.fin >= moisFin && Date.now() - cache.le < DUREE_CACHE_ADS) {
        etat.ads = cache.couts; etat.adsJours = cache.jours; etat.adsCharge = true; etat.adsErreur = null;
        return etat.ads;
      }
    } catch (e) { /* stockage indisponible : on interroge Google */ }
  }

  etat.adsCharge = true;
  try {
    const p = DataManager.getParametres();
    const suivies = (p.googleAdsSelectedCampaigns || []).map(String);
    if (!p.googleAdsConnected || typeof getValidTokens !== 'function') {
      etat.ads = null; etat.adsJours = null; etat.adsErreur = 'Google Ads n\'est pas connecté dans les paramètres.';
      return null;
    }
    const tokens = await getValidTokens();
    if (!tokens) throw new Error('Connexion Google Ads expirée : reconnecte-la dans les paramètres.');
    const comptes = await testAccessibleCustomers(tokens.access_token);
    if (!comptes.success) throw new Error(comptes.error || 'Comptes Google Ads inaccessibles.');

    const debut = `${moisDebut}-01`;
    const fin = Encaissements.dernierJourDuMois(moisFin);
    const couts = {};
    const jours = {};
    for (const customerId of comptes.customers) {
      const lignes = await requeteCoutsParJour(tokens.access_token, customerId, debut, fin);
      // Seulement les comptes qui portent au moins une campagne suivie dans l'app
      if (suivies.length && !lignes.some(l => suivies.includes(l.campagne))) continue;
      lignes.forEach(l => {
        const mois = l.jour.slice(0, 7);
        couts[mois] = GestionCalculs.arrondi((couts[mois] || 0) + l.cout);
        jours[l.jour] = GestionCalculs.arrondi((jours[l.jour] || 0) + l.cout);
      });
    }
    // Un mois sans depense vaut 0 (et non « inconnu »)
    for (let m = moisDebut; m <= moisFin; m = Encaissements.decalerMois(m, 1)) {
      if (couts[m] === undefined) couts[m] = 0;
    }
    etat.ads = couts; etat.adsJours = jours; etat.adsErreur = null;
    try { sessionStorage.setItem(CLE_CACHE_ADS, JSON.stringify({ debut: moisDebut, fin: moisFin, couts, jours, le: Date.now() })); } catch (e) { /* rien */ }
    return couts;
  } catch (e) {
    console.error('Gestion : couts Google Ads indisponibles', e);
    etat.ads = null; etat.adsJours = null; etat.adsErreur = e.message || String(e);
    return null;
  }
}

async function requeteCoutsParJour(accessToken, customerId, debut, fin) {
  const query = `
    SELECT campaign.id, segments.date, metrics.cost_micros
    FROM campaign
    WHERE segments.date BETWEEN '${debut}' AND '${fin}'
  `;
  const reponse = await fetch(`https://googleads.googleapis.com/v24/customers/${customerId}/googleAds:searchStream`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': 'tZ0KGweXjUnyQubimDfCsQ',
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ query })
  });
  if (!reponse.ok) throw new Error(`Google Ads a répondu ${reponse.status}`);
  const data = await reponse.json();
  const lignes = [];
  (Array.isArray(data) ? data : []).forEach(lot => (lot.results || []).forEach(r => {
    const jour = (r.segments?.date || '').slice(0, 10);
    if (!jour) return;
    lignes.push({
      campagne: String(r.campaign?.id ?? (r.campaign?.resourceName || '').split('/').pop()),
      jour,
      cout: (parseInt(r.metrics?.costMicros || 0, 10) || 0) / 1000000
    });
  }));
  return lignes;
}

racine.GestionDonnees = {
  etat,
  charger,
  enregistrerMouvement,
  supprimerMouvement,
  enregistrerRecurrent,
  supprimerRecurrent,
  enregistrerSolde,
  supprimerSolde,
  enregistrerMois,
  corriger,
  reglages,
  enregistrerReglages,
  chargerCoutsAds
};

})(window);
