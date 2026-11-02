// Tests des chiffres Google Ads (v1.2.0.0) : periode, libelles, KPI, cache.
// Donnees fictives uniquement : le depot est public.
const assert = require('node:assert/strict');
const test = require('node:test');
const G = require('../js/core/google-ads-calculs.js');

const MAINTENANT = new Date(2026, 10, 2, 10, 0); // 2 novembre 2026, heure locale
const AUJOURDHUI = '2026-11-02';

const appData = {
  clients: [
    { id: 'c1', prenom: 'Ana', nom: 'A', canalAcquisition: 'google-ads' },
    { id: 'c2', prenom: 'Bea', nom: 'B', canalAcquisition: 'google-ads' },
    { id: 'c3', prenom: 'Cleo', nom: 'C', canalAcquisition: 'bouche-a-oreille' },
    { id: 'c4', prenom: 'Dana', nom: 'D', canalAcquisition: 'google-ads' }        // jamais venue
  ],
  prestations: [
    { clientId: 'c1', date: '2025-06-10', prix: 70, tips: 0, moyenPaiement: 'Liquide' },   // avant les campagnes
    { clientId: 'c1', date: '2026-03-05', prix: 80, tips: 10, moyenPaiement: 'Carte bleue' },
    { clientId: 'c1', date: '2026-10-20', prix: 0, tips: 5, moyenPaiement: 'Bon cadeau' }, // tips seuls
    { clientId: 'c2', date: '2026-11-01', prix: 60, tips: 0, moyenPaiement: 'Virement' },
    { clientId: 'c3', date: '2026-11-01', prix: 99, tips: 0, moyenPaiement: 'Liquide' }    // autre canal
  ],
  parametres: {
    googleAdsSelectedCampaigns: ['k1', 'k2'],
    googleAdsCampaignPeriods: {
      k1: [{ startDate: '2026-02-15T00:00:00.000Z' }],
      k2: [{ startDate: '2026-01-10' }, { startDate: '2026-04-01', endDate: '2026-05-01' }],
      k9: [{ startDate: '2020-01-01' }]                                                     // non selectionnee
    },
    googleAdsCachedCosts: { total: 50, currentMonth: 12, lastUpdateMonth: '2026-11-02T08:00:00.000Z' }
  }
};

test('la Periode du haut devient une plage Google Ads, l annee en cours s arrete a aujourd hui', () => {
  assert.equal(G.periodePourFiltres('current', '', AUJOURDHUI), 'custom:2026-01-01:2026-11-02');
  assert.equal(G.periodePourFiltres('2025', '', AUJOURDHUI), 'custom:2025-01-01:2025-12-31');
  assert.equal(G.periodePourFiltres('current', '11', AUJOURDHUI), 'custom:2026-11-01:2026-11-02');
  assert.equal(G.periodePourFiltres('current', '2', AUJOURDHUI), 'custom:2026-02-01:2026-02-28');
  assert.equal(G.periodePourFiltres('2024', '2', AUJOURDHUI), 'custom:2024-02-01:2024-02-29');
  assert.equal(G.periodePourFiltres('current', '12', AUJOURDHUI), 'custom:2026-12-01:2026-12-31'); // a venir : laisse tel quel
});

test('libelles lisibles, plus jamais « custom:… » ni « THIS_MONTH jours »', () => {
  const lib = p => G.plagePourPeriode(p, MAINTENANT).libelle;
  assert.equal(lib('custom:2026-01-01:2026-11-02'), 'année 2026');
  assert.equal(lib('custom:2025-01-01:2025-12-31'), 'année 2025');
  assert.equal(lib('custom:2026-11-01:2026-11-02'), 'novembre 2026');
  assert.equal(lib('custom:2026-02-01:2026-02-28'), 'février 2026');
  assert.equal(lib('custom:2026-11-01:2026-11-15'), 'du 01/11/2026 au 15/11/2026'); // bout de mois choisi a la main
  assert.equal(lib('THIS_MONTH'), 'novembre 2026');
  assert.equal(lib('LAST_MONTH'), 'octobre 2026');
  assert.equal(lib('30'), '30 derniers jours');
  assert.equal(G.plagePourPeriode('all', MAINTENANT), null);
  assert.equal(G.plagePourPeriode('custom:abc', MAINTENANT), null);
});

test('bornes des periodes du selecteur, en jours locaux', () => {
  assert.deepEqual(G.plagePourPeriode('LAST_MONTH', MAINTENANT), { debut: '2026-10-01', fin: '2026-10-31', libelle: 'octobre 2026' });
  const sept = G.plagePourPeriode('7', MAINTENANT);
  assert.equal(sept.debut, '2026-10-26');
  assert.equal(sept.fin, AUJOURDHUI);
  const janvier = G.plagePourPeriode('LAST_MONTH', new Date(2026, 0, 15));
  assert.equal(janvier.debut, '2025-12-01');
});

test('« depuis le debut » = depuis le premier demarrage des campagnes selectionnees', () => {
  assert.equal(G.debutCampagnes(appData.parametres), '2026-01-10');
  assert.deepEqual(G.plageDepuisLeDebut(appData.parametres, AUJOURDHUI),
    { debut: '2026-01-10', fin: AUJOURDHUI, libelle: 'depuis le 10/01/2026' });
  assert.equal(G.plageDepuisLeDebut({ googleAdsSelectedCampaigns: ['zz'] }, AUJOURDHUI), null);
});

test('KPI : clientes venues dans la plage, regle Encaissements, autre canal exclu', () => {
  const k = G.kpisPeriode(appData, { debut: '2026-01-10', fin: AUJOURDHUI }, 50);
  // c1 : 80 + 10 + 5 (tips d'une prestation carte cadeau) ; c2 : 60 ; c3 : autre canal ; c4 : jamais venue
  assert.equal(k.totalRevenue, 155);
  assert.equal(k.totalTips, 15);
  assert.equal(k.totalPrix, 140);
  assert.equal(k.prestationsCount, 3);
  assert.equal(k.clientsCount, 2);
  assert.equal(k.roiMoney, 105);
  assert.equal(k.roi, 210);
  assert.deepEqual(k.clientsData.map(c => c.client.id), ['c1', 'c2']);

  const toutHistorique = G.kpisPeriode(appData, null, 0);
  assert.equal(toutHistorique.totalRevenue, 225);
  assert.equal(toutHistorique.roi, 0); // cout inconnu : pas de ROI invente
});

test('le tableau de bord et l onglet « Depuis le debut » donnent les memes chiffres', () => {
  const tableau = G.kpisDepuisLeDebut(appData, AUJOURDHUI);
  const onglet = G.kpisPeriode(appData, G.plageDepuisLeDebut(appData.parametres, AUJOURDHUI), 50);
  assert.equal(tableau.totalCost, 50);
  assert.equal(tableau.totalRevenue, onglet.totalRevenue);
  assert.equal(tableau.clientsCount, onglet.clientsCount);
  assert.equal(tableau.roi, onglet.roi);
  assert.equal(tableau.libellePeriode, 'depuis le 10/01/2026');
});

test('cache : cout depuis le debut, cout du mois date conserve, estimations jetees', () => {
  const kpis = G.kpisDepuisLeDebut(appData, AUJOURDHUI);
  const cache = G.cacheDepuisLeDebut(
    { total: 9, currentMonth: 12, lastUpdateMonth: '2026-11-02T08:00:00.000Z', monthlyBreakdown: { x: 1 } },
    80, kpis, '2026-11-02T09:00:00.000Z');
  assert.equal(cache.total, 80);
  assert.equal(cache.currentMonth, 12);
  assert.equal(cache.revenue, 155);
  assert.equal(cache.clientsCount, 2);
  assert.equal(cache.monthlyBreakdown, undefined);

  const sansDate = G.cacheDepuisLeDebut({ total: 9, currentMonth: 3 }, 80, kpis, '2026-11-02T09:00:00.000Z');
  assert.equal(sansDate.currentMonth, undefined); // ancienne estimation (total / 12) non datee
});
