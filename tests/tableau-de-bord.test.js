// Tests v1.2.0.0 sur le vrai code de data-manager.js et calculations.js (scripts du
// navigateur, charges ici avec un `window` de remplacement ; aucun appel a Supabase).
// Donnees fictives, datees par rapport a aujourd'hui : le depot est public.
const assert = require('node:assert/strict');
const test = require('node:test');

globalThis.window = globalThis;
require('../js/core/data-manager.js');
require('../js/core/encaissements.js');
require('../js/core/google-ads-calculs.js');
require('../js/core/regles-ecrans.js');
require('../js/core/calculations.js');
const { DataManager, Calculations, GoogleAdsCalculs, ReglesEcrans } = globalThis;

const maintenant = new Date();
const jour = n => ReglesEcrans.jourLocal(new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() + n));
const AUJ = jour(0);
const ANNEE_DERNIERE = `${maintenant.getFullYear() - 1}-06-15`;

function donnees() {
  return {
    clients: [
      { id: 'c1', prenom: 'Ana', nom: 'A', canalAcquisition: 'google-ads', fideliteAtteinte: [] },
      { id: 'c2', prenom: 'Bea', nom: 'B', canalAcquisition: 'bouche-a-oreille', fideliteAtteinte: [] },
      { id: 'c3', prenom: 'Cleo', nom: 'C', canalAcquisition: 'google-ads', fideliteAtteinte: [] }
    ],
    prospects: [], collaborateurs: [], depenses: [], bonsCadeaux: [],
    prestations: [
      { id: 'p1', clientId: 'c1', date: AUJ, heure: '10:00', soinId: 's-m', prix: 80, tips: 0, moyenPaiement: 'Liquide' },
      { id: 'p2', clientId: 'c1', date: AUJ, heure: '11:00', soinId: 's-m', prix: 0, tips: 5, moyenPaiement: 'Bon cadeau' },
      { id: 'p3', clientId: 'c1', date: AUJ, heure: '12:00', soinId: 's-r', prix: 120, tips: 0, moyenPaiement: 'Carte bleue' },
      { id: 'p4', clientId: 'c2', date: AUJ, heure: '14:00', soinId: 's-v', prix: 50, tips: 0, moyenPaiement: 'Liquide' },
      { id: 'p5', clientId: 'c3', date: jour(-40), heure: '09:00', soinId: 's-e', prix: 30, tips: 0, moyenPaiement: 'Liquide' },
      { id: 'p6', clientId: 'c3', date: ANNEE_DERNIERE, heure: '09:00', soinId: 's-m', prix: 70, tips: 0, moyenPaiement: 'Liquide' }
    ],
    rdv: [
      { id: 'r1', clientId: 'c1', date: jour(3), heure: '10:00', soinId: 's-m', statut: 'confirmé' },
      { id: 'r2', clientId: 'c1', date: jour(-2), heure: '10:00', soinId: 's-m', statut: 'confirmé' },  // passe, jamais transforme
      { id: 'r3', clientId: 'c1', date: jour(5), heure: '10:00', soinId: 's-m', statut: 'annulé' },
      { id: 'r4', clientId: 'c3', date: jour(4), heure: '10:00', soinId: 's-e', statut: 'annule' }      // annule : pas un « RDV prévu »
    ],
    relances: [
      { id: 'l1', clientId: 'c3', groupe: 'Épilation', intervalleJours: 28 },                          // derniere epilation il y a 40 j
      { id: 'l2', clientId: 'c1', groupe: 'Massages', intervalleJours: 28 },                           // vue aujourd'hui : a jour
      { id: 'l3', clientId: 'c2', groupe: 'Visage', intervalleJours: 28, dateRelanceOverride: jour(3) } // bientot
    ],
    parametres: {
      carteSoins: {
        legacyTypeMapping: {},
        categories: [
          { id: 'cat-m', nom: 'Massages', groupe: 'Massages', statut: 'actif', ordre: 1, coutProduitDefault: 4 },
          { id: 'cat-r', nom: 'Rituels', groupe: 'Massages', statut: 'actif', ordre: 2, coutProduitDefault: 10 },
          { id: 'cat-v', nom: 'Soins visage', groupe: 'Visage', statut: 'archive', ordre: 3 },
          { id: 'cat-e', nom: 'Épilation', groupe: 'Épilation', statut: 'actif', ordre: 4 }
        ],
        soins: [
          { id: 's-m', nom: 'Massage sur mesure', categorieId: 'cat-m', statut: 'actif', variantes: [] },
          { id: 's-r', nom: 'Rituel', categorieId: 'cat-r', statut: 'actif', variantes: [] },
          { id: 's-v', nom: 'Soin éclat', categorieId: 'cat-v', statut: 'archive', variantes: [] },
          { id: 's-e', nom: 'Aisselles', categorieId: 'cat-e', statut: 'actif', variantes: [] }
        ]
      },
      fideliteConfig: { paliers: [4, 5], groupesComptes: ['Massages'] },
      googleAdsConnected: true,
      googleAdsSelectedCampaigns: ['k1'],
      googleAdsCampaignPeriods: { k1: [{ startDate: `${maintenant.getFullYear()}-01-01` }] },
      googleAdsCachedCosts: { total: 50 }
    }
  };
}

test('relances : un RDV annule n est pas un « RDV prévu »', () => {
  DataManager.setAppData(donnees());
  assert.equal(DataManager.getProchainRdvGroupe('c3', 'Épilation'), '');
  assert.equal(DataManager.getStatutRelance(DataManager.getRelanceById('l1')).cle, 'depassee');
  assert.equal(DataManager.getProchainRdvGroupe('c1', 'Massages'), jour(3)); // le confirme, pas l'annule (jour + 5)
});

test('relances « à agir » : depassees et bientot, la plus en retard d abord ; meme compte que le badge', () => {
  DataManager.setAppData(donnees());
  const aAgir = DataManager.getRelancesAAgir();
  assert.deepEqual(aAgir.map(x => x.relance.id), ['l1', 'l3']);
  assert.deepEqual(aAgir.map(x => x.statut.cle), ['depassee', 'bientot']);
  assert.equal(aAgir[0].date, jour(-12));
  assert.equal(DataManager.getNbRelancesAAgir(), 2);
});

test('fidelite : seuls les RDV d aujourd hui ou plus tard, non annules, sont « à venir »', () => {
  DataManager.setAppData(donnees());
  // 3 massages faits + 1 RDV confirme a venir = 4 ; le RDV passe et l'annule ne comptent pas (sinon 5 ou 6)
  assert.equal(DataManager.getFidelitePalierPourClient('c1'), 4);
});

test('Types de prestations : une categorie archivee garde son nom', () => {
  DataManager.setAppData(donnees());
  const chart = Calculations.getPrestationsTypeChart('current', '');
  const nb = Object.fromEntries(chart.labels.map((l, i) => [l, chart.data[i]]));
  assert.equal(nb['Soins visage (archivée)'], 1);
  assert.equal(nb['Massages'], 2);   // avant : 3 (la prestation archivee tombait dans la 1re categorie active)
  assert.equal(nb['Rituels'], 1);
});

test('onglet d un groupe : couts produits par categorie, panier sans les cartes cadeaux', () => {
  DataManager.setAppData(donnees());
  const kpis = Calculations.calculateDashboardKPIs();
  const massages = DataManager.getCategories().filter(c => c.groupe === 'Massages');
  // 2 prestations « Massages » x 4 + 1 « Rituels » x 10 = 18 (avant : (4 + 10) x 3 = 42)
  assert.equal(ReglesEcrans.coutsProduits(massages, kpis.nbParCategorieMois), 18);
  // (80 + 120) / 2 : la prestation reglee par carte cadeau n'entre pas (avant : (80 + 5 + 120) / 3)
  assert.equal(kpis.panierParGroupeMois['Massages'], 100);
});

test('Google Ads : le tableau de bord donne les chiffres de l onglet « Depuis le début »', () => {
  const appData = donnees();
  DataManager.setAppData(appData);
  const kpis = Calculations.calculateDashboardKPIs();
  const onglet = GoogleAdsCalculs.kpisPeriode(appData, GoogleAdsCalculs.plageDepuisLeDebut(appData.parametres, AUJ), 50);
  assert.equal(kpis.googleAdsCost, 50);
  assert.equal(kpis.googleAdsRevenue, onglet.totalRevenue);
  assert.equal(kpis.googleAdsClientsCount, onglet.clientsCount);
  assert.equal(kpis.googleAdsROI, onglet.roi);
  // c1 : 80 + 5 (tips d'une prestation carte cadeau) + 120 ; c3 : 30 si son epilation est de cette annee ;
  // sa prestation de l'an dernier est avant le demarrage de la campagne et ne compte pas
  const attendu = 205 + (jour(-40).slice(0, 4) === AUJ.slice(0, 4) ? 30 : 0);
  assert.equal(kpis.googleAdsRevenue, attendu);
});
