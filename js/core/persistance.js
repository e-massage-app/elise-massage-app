// ===== PERSISTANCE : CALCULS PURS (v1.2.0.0) =====
// Sans Supabase ni DOM : data-manager.js s'en sert, tests/persistance.test.js les verifie.
//  - parametres : ce qu'il faut ecrire (diffParametres) et ce qu'il faut relire
//    (fusionnerParametresDistants), compares en JSON stable a la copie de la base ;
//  - lecture par pages de 1000 lignes (plafond de Supabase par requete) ;
//  - format de la sauvegarde (export, import, e-mail du lundi) et sa verification.

(function (racine) {

// ----- Parametres -----

// JSON aux cles triees : jsonb renvoie les cles d'un objet dans son propre ordre,
// une meme valeur doit donner la meme chaine. undefined = cle absente.
function jsonStable(valeur) {
  if (valeur === undefined) return undefined;
  return JSON.stringify(trier(valeur));
}

function trier(v) {
  if (Array.isArray(v)) return v.map(trier);
  if (v && typeof v === 'object' && typeof v.toJSON !== 'function') {
    const o = {};
    Object.keys(v).sort().forEach(k => { if (v[k] !== undefined) o[k] = trier(v[k]); });
    return o;
  }
  return v;
}

/**
 * Ce que l'app doit envoyer : les cles dont la valeur differe de la base (enBase : cle -> JSON
 * stable), et les cles retirees de la memoire (a supprimer en base). Les cles `exclues` passent
 * par un autre chemin (saveParametresCles, fonction google-ads) : jamais ecrites ni supprimees ici.
 */
function diffParametres(courant, enBase, exclues = []) {
  const aEcrire = [];
  const aSupprimer = [];
  const memoire = courant || {};
  Object.keys(memoire).forEach(cle => {
    if (exclues.includes(cle)) return;
    const json = jsonStable(memoire[cle]);
    if (json !== undefined && json !== enBase[cle]) aEcrire.push({ cle, json });
  });
  Object.keys(enBase).forEach(cle => {
    if (exclues.includes(cle)) return;
    if (jsonStable(memoire[cle]) === undefined) aSupprimer.push(cle);
  });
  return { aEcrire, aSupprimer };
}

/**
 * Relecture des parametres en base (distants : cle -> valeur). Une cle modifiee ici et pas encore
 * enregistree (differente de enBase) garde sa valeur locale ; les autres prennent celle de la base,
 * ou disparaissent si la base ne l'a plus. Une cle jamais vue en base (valeur par defaut) cede a
 * la base. Renvoie { aPrendre, aRetirer, base } : base = nouvelle copie de la base.
 */
function fusionnerParametresDistants(courant, enBase, distants) {
  const memoire = courant || {};
  const aPrendre = {};
  const aRetirer = [];
  const base = { ...enBase };
  new Set([...Object.keys(enBase), ...Object.keys(distants)]).forEach(cle => {
    const local = jsonStable(memoire[cle]);
    const connu = enBase[cle];
    const distant = jsonStable(distants[cle]);
    if (local === distant) {                                   // deja d'accord
      if (distant === undefined) delete base[cle]; else base[cle] = distant;
      return;
    }
    if (connu !== undefined && local !== connu) return;          // modifiee ici, pas encore enregistree
    if (distant === undefined) {
      if (connu === undefined) return;                           // valeur par defaut, absente en base
      aRetirer.push(cle);                                        // supprimee ailleurs
      delete base[cle];
      return;
    }
    aPrendre[cle] = distants[cle];
    base[cle] = distant;
  });
  return { aPrendre, aRetirer, base };
}

// ----- Lecture par pages -----

// Supabase (max_rows par defaut) renvoie au plus 1000 lignes par requete : sans pagination,
// la 1001e ligne d'une table disparaissait de l'app sans un mot.
const TAILLE_PAGE = 1000;

/** lirePage(debut, fin) -> { data, error } (bornes incluses). Renvoie { data, error } pour toute la table. */
async function lirePages(lirePage, taille = TAILLE_PAGE) {
  const lignes = [];
  for (let debut = 0; ; debut += taille) {
    const { data, error } = await lirePage(debut, debut + taille - 1);
    if (error) return { data: null, error };
    lignes.push(...(data || []));
    if (!data || data.length < taille) return { data: lignes, error: null };
  }
}

// ----- Format de la sauvegarde -----

// Format 2 = format 1 (JSON.stringify(appData)) + relances + tables de la Gestion.
// Ordre d'import : clients avant relances (relances.client_id -> clients, ON DELETE CASCADE).
// cle = nom dans le fichier ; brut = lignes de la base telles quelles (Gestion) ;
// requis = champs NOT NULL en base, verifies avant de toucher a quoi que ce soit.
// supabase/functions/sauvegarde-hebdo/index.ts reprend cette liste : les garder alignees.
const TABLES_SAUVEGARDE = [
  { cle: 'clients', table: 'clients' },
  { cle: 'prospects', table: 'prospects' },
  { cle: 'collaborateurs', table: 'collaborateurs' },
  { cle: 'prestations', table: 'prestations', requis: ['date'] },
  { cle: 'rdv', table: 'rdv', requis: ['date'] },
  { cle: 'depenses', table: 'depenses', requis: ['date', 'categorie'] },
  { cle: 'bonsCadeaux', table: 'bons_cadeaux' },
  { cle: 'relances', table: 'relances', requis: ['clientId', 'groupe'] },
  { cle: 'gestion_mouvements', table: 'gestion_mouvements', brut: true, requis: ['date', 'sens', 'compte'] },
  { cle: 'gestion_recurrents', table: 'gestion_recurrents', brut: true, requis: ['compte', 'nom', 'debut'] },
  { cle: 'gestion_mois', table: 'gestion_mois', brut: true, requis: ['mois'] },
  { cle: 'gestion_soldes', table: 'gestion_soldes', brut: true, requis: ['date', 'compte', 'montant'] }
];

const LIBELLES_TABLES = {
  clients: 'Clientes', prospects: 'Prospects', collaborateurs: 'Collaborateurs',
  prestations: 'Prestations', rdv: 'Rendez-vous', depenses: 'Dépenses', bonsCadeaux: 'Cartes cadeaux',
  relances: 'Relances', gestion_mouvements: 'Gestion : mouvements', gestion_recurrents: 'Gestion : lignes fixes',
  gestion_mois: 'Gestion : mois', gestion_soldes: 'Gestion : soldes', parametres: 'Réglages'
};

// La connexion Google Ads vit cote serveur (table google_ads_connexion) : ces cles la decrivent,
// elles ne sont ni sauvegardees ni restaurees (un vieux fichier remettrait un jeton mort).
const CLES_CONNEXION_GOOGLE = ['googleAdsTokens', 'googleAdsConnected', 'googleAdsConnectedAt'];

/**
 * Assemble le fichier a partir des lignes de la base : lignes = { table: [rows] } (avec
 * `parametres`), versApp(cle, row) convertit une ligne d'une table de l'app en objet de l'app.
 */
function assemblerSauvegarde(lignes, versApp, meta = {}) {
  const sauvegarde = { _sauvegarde: { format: 2, ...meta } };
  TABLES_SAUVEGARDE.forEach(def => {
    const rows = lignes[def.table] || [];
    sauvegarde[def.cle] = def.brut ? rows : rows.map(row => versApp(def.cle, row));
  });
  sauvegarde.parametres = {};
  (lignes.parametres || []).forEach(row => {
    if (!CLES_CONNEXION_GOOGLE.includes(row.cle)) sauvegarde.parametres[row.cle] = row.valeur;
  });
  return sauvegarde;
}

function estObjet(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function rempli(v) {
  return v !== undefined && v !== null && v !== '';
}

/**
 * Verifie TOUT le fichier avant la moindre suppression. Une table absente du fichier (vieil
 * export) n'est pas touchee. Les relances dont la cliente n'est pas dans le fichier sont
 * ignorees (la base les refuserait). Renvoie { ok, erreurs, presentes, absentes, lignes,
 * relancesIgnorees, parametres }.
 */
function validerSauvegarde(donnees) {
  const erreurs = [];
  if (!estObjet(donnees)) {
    return { ok: false, erreurs: ['Le fichier ne contient pas une sauvegarde de l\'application.'] };
  }
  if (!Array.isArray(donnees.clients) || !Array.isArray(donnees.prestations)) {
    erreurs.push('Les clientes et les prestations manquent : ce n\'est pas une sauvegarde de l\'application.');
  }

  const presentes = [];
  const absentes = [];
  const lignes = {};
  TABLES_SAUVEGARDE.forEach(def => {
    const liste = donnees[def.cle];
    const nom = LIBELLES_TABLES[def.cle];
    if (liste === undefined) { absentes.push(def.cle); return; }
    if (!Array.isArray(liste)) { erreurs.push(`${nom} : une liste est attendue.`); return; }
    const ids = new Set();
    liste.forEach((ligne, i) => {
      const ou = `${nom}, ligne ${i + 1}`;
      if (!estObjet(ligne)) { erreurs.push(`${ou} : illisible.`); return; }
      if (typeof ligne.id !== 'string' || !ligne.id) { erreurs.push(`${ou} : identifiant manquant.`); return; }
      if (ids.has(ligne.id)) erreurs.push(`${ou} : identifiant en double (${ligne.id}).`);
      ids.add(ligne.id);
      (def.requis || []).forEach(champ => {
        if (!rempli(ligne[champ])) erreurs.push(`${ou} : « ${champ} » manquant.`);
      });
    });
    presentes.push(def.cle);
    lignes[def.cle] = liste;
  });

  // Doublons refuses par la base (index uniques)
  const doublon = (cle, cleDe, message) => {
    const vus = new Set();
    (lignes[cle] || []).forEach(l => {
      if (!estObjet(l)) return;
      const k = cleDe(l);
      if (vus.has(k)) erreurs.push(message(l));
      vus.add(k);
    });
  };
  doublon('gestion_mois', l => l.mois, l => `Gestion : mois en double (${l.mois}).`);
  doublon('relances', l => `${l.clientId}|${l.groupe}`, l => `Relances : la même cliente est suivie deux fois en ${l.groupe}.`);

  let relancesIgnorees = 0;
  if (lignes.relances && Array.isArray(donnees.clients)) {
    const clientes = new Set(donnees.clients.filter(estObjet).map(c => c.id));
    const gardees = lignes.relances.filter(r => estObjet(r) && clientes.has(r.clientId));
    relancesIgnorees = lignes.relances.length - gardees.length;
    lignes.relances = gardees;
  }

  let parametres = null;
  if (donnees.parametres !== undefined) {
    if (estObjet(donnees.parametres)) parametres = donnees.parametres;
    else erreurs.push('Réglages : un objet est attendu.');
  }

  return { ok: erreurs.length === 0, erreurs, presentes, absentes, lignes, relancesIgnorees, parametres };
}

const Persistance = {
  jsonStable,
  diffParametres,
  fusionnerParametresDistants,
  TAILLE_PAGE,
  lirePages,
  TABLES_SAUVEGARDE,
  LIBELLES_TABLES,
  CLES_CONNEXION_GOOGLE,
  assemblerSauvegarde,
  validerSauvegarde
};

// Portee fermee : rien d'autre que `Persistance` ne devient global.
racine.Persistance = Persistance;
if (typeof module !== 'undefined' && module.exports) module.exports = Persistance;

})(typeof window !== 'undefined' ? window : globalThis);
