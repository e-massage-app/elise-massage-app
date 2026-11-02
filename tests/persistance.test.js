// Tests de la persistance (parametres, pagination, format de sauvegarde). Donnees fictives.
const assert = require('node:assert/strict');
const test = require('node:test');
const P = require('../js/core/persistance.js');

const A_PART = ['googleAdsTokens', 'googleAdsConnected', 'googleAdsConnectedAt', 'gestion', 'calendrier'];

// Copie de la base telle que loadData la pose
function base(valeurs) {
  const b = {};
  Object.entries(valeurs).forEach(([cle, v]) => { b[cle] = P.jsonStable(v); });
  return b;
}

// ----- JSON stable -----

test('JSON stable : meme valeur, meme chaine, quel que soit l\'ordre des cles', () => {
  assert.equal(P.jsonStable({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: null } }),
    P.jsonStable({ a: { c: null, d: [1, { x: 1, y: 2 }] }, b: 1 }));
  assert.notEqual(P.jsonStable([1, 2]), P.jsonStable([2, 1]));     // l'ordre d'une liste compte
  assert.equal(P.jsonStable(undefined), undefined);                // absente
  assert.equal(P.jsonStable(null), 'null');                        // valeur nulle, pas absente
  assert.equal(P.jsonStable({ a: 1, b: undefined }), P.jsonStable({ a: 1 }));
});

// ----- Ecriture : seules les cles modifiees partent -----

test('rien de modifie : rien a envoyer', () => {
  const enBase = { carteSoins: { soins: [{ id: 's1', nom: 'Soin A' }] }, joursInstitut: ['2026-10-01'] };
  const memoire = JSON.parse(JSON.stringify(enBase));
  assert.deepEqual(P.diffParametres(memoire, base(enBase), A_PART), { aEcrire: [], aSupprimer: [] });
});

test('vieil onglet : il n\'envoie que la cle qu\'il vient de changer', () => {
  // L'onglet a charge la base il y a longtemps ; depuis, le telephone a change la carte des soins
  // et les jours institut (la base a bouge, pas la copie de l'onglet).
  const charge = { carteSoins: { soins: [{ id: 's1', nom: 'Ancien nom' }] }, joursInstitut: ['2026-10-01'], dashboardActiveTab: '__global__' };
  const memoire = JSON.parse(JSON.stringify(charge));
  memoire.dashboardActiveTab = 'Massages'; // seul changement fait dans cet onglet
  const { aEcrire, aSupprimer } = P.diffParametres(memoire, base(charge), A_PART);
  assert.deepEqual(aEcrire.map(e => e.cle), ['dashboardActiveTab']);
  assert.deepEqual(JSON.parse(aEcrire[0].json), 'Massages');
  assert.deepEqual(aSupprimer, []);
});

test('modification en profondeur, nouvelle cle, cle retiree', () => {
  const charge = { abonnements: [{ nom: 'Logiciel', actif: true }], openRouteServiceKey: 'cle-fictive' };
  const memoire = JSON.parse(JSON.stringify(charge));
  memoire.abonnements[0].actif = false;           // modifiee sur place
  memoire.fideliteConfig = { paliers: [5, 10] };  // nouvelle
  delete memoire.openRouteServiceKey;              // retiree (clearApiKey)
  const { aEcrire, aSupprimer } = P.diffParametres(memoire, base(charge), A_PART);
  assert.deepEqual(aEcrire.map(e => e.cle).sort(), ['abonnements', 'fideliteConfig']);
  assert.deepEqual(aSupprimer, ['openRouteServiceKey']);
});

test('une valeur undefined vaut suppression, null s\'enregistre', () => {
  const charge = { a: 1, b: 2 };
  const { aEcrire, aSupprimer } = P.diffParametres({ a: undefined, b: null }, base(charge), A_PART);
  assert.deepEqual(aEcrire.map(e => [e.cle, e.json]), [['b', 'null']]);
  assert.deepEqual(aSupprimer, ['a']);
});

test('les cles enregistrees a part ne sont ni ecrites ni supprimees', () => {
  const charge = { calendrier: { joursFermes: [7] }, googleAdsConnected: true, gestion: { x: 1 } };
  const memoire = { calendrier: { joursFermes: [7, 1] }, googleAdsTokens: 'jeton-fictif' }; // gestion et googleAdsConnected retirees
  assert.deepEqual(P.diffParametres(memoire, base(charge), A_PART), { aEcrire: [], aSupprimer: [] });
});

// ----- Relecture au retour sur l'app -----

test('relecture : la base gagne sur les cles non modifiees ici', () => {
  const charge = { carteSoins: { v: 1 }, joursInstitut: ['2026-10-01'], openRouteServiceKey: 'cle-fictive' };
  const memoire = JSON.parse(JSON.stringify(charge));
  const distants = { carteSoins: { v: 2 }, joursInstitut: ['2026-10-01'], abonnements: [{ nom: 'Nouveau' }] };
  const r = P.fusionnerParametresDistants(memoire, base(charge), distants);
  assert.deepEqual(r.aPrendre, { carteSoins: { v: 2 }, abonnements: [{ nom: 'Nouveau' }] });
  assert.deepEqual(r.aRetirer, ['openRouteServiceKey']); // supprimee ailleurs
  assert.deepEqual(r.base, base(distants));
});

test('relecture : une modification locale pas encore enregistree est gardee', () => {
  const charge = { dashboardStatsLayout: { a: 1 }, joursInstitut: ['2026-10-01'] };
  const memoire = JSON.parse(JSON.stringify(charge));
  memoire.dashboardStatsLayout = { a: 2 };   // en attente d'enregistrement
  delete memoire.joursInstitut;              // suppression locale en attente
  const distants = { dashboardStatsLayout: { a: 3 }, joursInstitut: ['2026-10-02'] };
  const r = P.fusionnerParametresDistants(memoire, base(charge), distants);
  assert.deepEqual(r.aPrendre, {});
  assert.deepEqual(r.aRetirer, []);
  assert.deepEqual(r.base, base(charge)); // la prochaine ecriture enverra encore les deux changements
  const d = P.diffParametres(memoire, r.base, A_PART);
  assert.deepEqual(d.aEcrire.map(e => e.cle), ['dashboardStatsLayout']);
  assert.deepEqual(d.aSupprimer, ['joursInstitut']);
});

test('relecture : une valeur par defaut jamais enregistree cede a la base, sinon reste', () => {
  const memoire = { validiteBonsCadeauxMois: 6, tarifsMassage: { HeadSpa: { 30: 20 } } };
  const r = P.fusionnerParametresDistants(memoire, {}, { validiteBonsCadeauxMois: 12 });
  assert.deepEqual(r.aPrendre, { validiteBonsCadeauxMois: 12 });
  assert.deepEqual(r.aRetirer, []);                   // tarifsMassage : absente en base, gardee
  assert.deepEqual(r.base, { validiteBonsCadeauxMois: '12' });
});

test('relecture : deja d\'accord, la copie de la base se recale sans rien changer', () => {
  // Cle ecrite directement (onglet Gestion) : memoire = base, copie en retard
  const memoire = { gestion: { seuil: 2 } };
  const r = P.fusionnerParametresDistants(memoire, base({ gestion: { seuil: 1 } }), { gestion: { seuil: 2 } });
  assert.deepEqual(r.aPrendre, {});
  assert.deepEqual(r.base, base({ gestion: { seuil: 2 } }));
});

// ----- Lecture par pages -----

function fausseTable(n) {
  const lignes = Array.from({ length: n }, (_, i) => ({ id: `id_${String(i).padStart(5, '0')}` }));
  const appels = [];
  const lirePage = async (debut, fin) => {
    appels.push([debut, fin]);
    return { data: lignes.slice(debut, fin + 1), error: null };
  };
  return { lirePage, appels };
}

test('pagination : 2500 lignes = 3 pages, rien de perdu', async () => {
  const { lirePage, appels } = fausseTable(2500);
  const { data, error } = await P.lirePages(lirePage);
  assert.equal(error, null);
  assert.equal(data.length, 2500);
  assert.equal(new Set(data.map(l => l.id)).size, 2500);
  assert.deepEqual(appels, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test('pagination : pile 1000 lignes = une page vide de plus ; table vide = un appel', async () => {
  const mille = fausseTable(1000);
  assert.equal((await P.lirePages(mille.lirePage)).data.length, 1000);
  assert.equal(mille.appels.length, 2);
  const vide = fausseTable(0);
  assert.deepEqual((await P.lirePages(vide.lirePage)).data, []);
  assert.equal(vide.appels.length, 1);
});

test('pagination : une erreur sur une page = erreur pour toute la table', async () => {
  let n = 0;
  const r = await P.lirePages(async () => (++n === 2 ? { data: null, error: { message: 'coupure' } } : { data: new Array(1000).fill({}), error: null }));
  assert.equal(r.data, null);
  assert.equal(r.error.message, 'coupure');
});

// ----- Format de la sauvegarde -----

const lignesBase = {
  clients: [{ id: 'c1', nom: 'Fictive', user_id: 'u' }],
  prospects: [], collaborateurs: [],
  prestations: [{ id: 'p1', date: '2026-10-01', client_id: 'c1' }],
  rdv: [{ id: 'r1', date: '2026-11-03' }],
  depenses: [{ id: 'd1', date: '2026-10-02', categorie: 'Fournitures' }],
  bons_cadeaux: [],
  relances: [{ id: 'l1', client_id: 'c1', groupe: 'Massages' }],
  gestion_mouvements: [{ id: 'm1', user_id: 'u', date: '2026-10-03', sens: 'sortie', compte: 'pro', montant: 10 }],
  gestion_recurrents: [],
  gestion_mois: [{ id: 'g1', user_id: 'u', mois: '2026-10', corrections: {} }],
  gestion_soldes: [],
  parametres: [
    { cle: 'joursInstitut', valeur: ['2026-10-01'] },
    { cle: 'googleAdsConnected', valeur: true },
    { cle: 'googleAdsTokens', valeur: 'jeton-fictif' }
  ]
};
// Conversion simplifiee (l'app utilise ses mapXxxFromDb)
const versApp = (cle, row) => ({ id: row.id, date: row.date, categorie: row.categorie, clientId: row.client_id, groupe: row.groupe });

test('assemblage : toutes les tables, Gestion brute, sans la connexion Google', () => {
  const s = P.assemblerSauvegarde(lignesBase, versApp, { source: 'test' });
  assert.equal(s._sauvegarde.format, 2);
  assert.equal(s._sauvegarde.source, 'test');
  assert.deepEqual(Object.keys(s).filter(k => k !== '_sauvegarde'),
    ['clients', 'prospects', 'collaborateurs', 'prestations', 'rdv', 'depenses', 'bonsCadeaux', 'relances',
      'gestion_mouvements', 'gestion_recurrents', 'gestion_mois', 'gestion_soldes', 'parametres']);
  assert.deepEqual(s.relances, [{ id: 'l1', date: undefined, categorie: undefined, clientId: 'c1', groupe: 'Massages' }]);
  assert.deepEqual(s.gestion_mouvements, lignesBase.gestion_mouvements); // telles quelles
  assert.deepEqual(s.parametres, { joursInstitut: ['2026-10-01'] });
});

test('verification : une sauvegarde assemblee se reimporte', () => {
  const s = JSON.parse(JSON.stringify(P.assemblerSauvegarde(lignesBase, versApp)));
  const v = P.validerSauvegarde(s);
  assert.equal(v.ok, true, v.erreurs.join(' / '));
  assert.equal(v.presentes.length, P.TABLES_SAUVEGARDE.length);
  assert.deepEqual(v.absentes, []);
  assert.equal(v.relancesIgnorees, 0);
  assert.deepEqual(v.parametres, { joursInstitut: ['2026-10-01'] });
});

test('verification : un ancien export (sans relances ni Gestion) reste accepte, ces tables sont gardees', () => {
  const ancien = {
    clients: [{ id: 'c1' }], prospects: [], collaborateurs: [], prestations: [{ id: 'p1', date: '2026-01-05' }],
    rdv: [], depenses: [], bonsCadeaux: [], parametres: { tarifsMassage: {} }
  };
  const v = P.validerSauvegarde(ancien);
  assert.equal(v.ok, true, v.erreurs.join(' / '));
  assert.deepEqual(v.absentes, ['relances', 'gestion_mouvements', 'gestion_recurrents', 'gestion_mois', 'gestion_soldes']);
  assert.ok(!v.presentes.includes('relances'));
});

test('verification : relances sans fiche cliente ignorees', () => {
  const s = { clients: [{ id: 'c1' }], prestations: [], relances: [
    { id: 'l1', clientId: 'c1', groupe: 'Massages' },
    { id: 'l2', clientId: 'c-disparue', groupe: 'Massages' }
  ] };
  const v = P.validerSauvegarde(s);
  assert.equal(v.ok, true, v.erreurs.join(' / '));
  assert.equal(v.relancesIgnorees, 1);
  assert.deepEqual(v.lignes.relances.map(r => r.id), ['l1']);
});

test('verification : fichier refuse avant toute suppression', () => {
  assert.equal(P.validerSauvegarde(null).ok, false);
  assert.equal(P.validerSauvegarde([1, 2]).ok, false);
  assert.equal(P.validerSauvegarde({ parametres: {} }).ok, false);        // ni clientes ni prestations

  const v = P.validerSauvegarde({
    clients: [{ id: 'c1' }, { id: 'c1' }, { nom: 'sans id' }],
    prestations: [{ id: 'p1' }],                                         // sans date
    rdv: 'pas une liste',
    depenses: [{ id: 'd1', date: '2026-10-01' }],                         // sans categorie
    relances: [{ id: 'l1', clientId: 'c1', groupe: 'Massages' }, { id: 'l2', clientId: 'c1', groupe: 'Massages' }],
    gestion_mois: [{ id: 'g1', mois: '2026-10' }, { id: 'g2', mois: '2026-10' }],
    gestion_soldes: [{ id: 's1', date: '2026-10-01', compte: 'pro', montant: null }],
    parametres: ['pas', 'un', 'objet']
  });
  assert.equal(v.ok, false);
  const tout = v.erreurs.join('\n');
  [
    /Clientes, ligne 2 : identifiant en double/,
    /Clientes, ligne 3 : identifiant manquant/,
    /Prestations, ligne 1 : « date » manquant/,
    /Rendez-vous : une liste est attendue/,
    /Dépenses, ligne 1 : « categorie » manquant/,
    /Relances : la même cliente est suivie deux fois/,
    /Gestion : mois en double \(2026-10\)/,
    /Gestion : soldes, ligne 1 : « montant » manquant/,
    /Réglages : un objet est attendu/
  ].forEach(motif => assert.match(tout, motif));
});
