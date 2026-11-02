// Tests de la regle d'encaissement commune (node tests/encaissements.test.js).
// Donnees fictives : aucun chiffre reel d'Elise ici (le depot est public).
const assert = require('node:assert/strict');
const test = require('node:test');
const E = require('../js/core/encaissements.js');

const appData = {
  prestations: [
    { date: '2026-10-01', prix: 80, tips: 0, moyenPaiement: 'Carte bleue' },
    { date: '2026-10-02', prix: 60, tips: 10, moyenPaiement: 'Liquide' },
    { date: '2026-10-03', prix: 0, tips: 5, moyenPaiement: 'Bon cadeau' },          // tips seuls
    { date: '2026-10-04', prix: 95, tips: 0, moyenPaiement: 'Liquide', bonCadeauId: 'b9' }, // prix pre-rempli par erreur
    { date: '2026-10-05', prix: 50, tips: 0, moyenPaiement: 'Virement' },
    { date: '2026-10-31', prix: 40, tips: 0, moyenPaiement: '' },                     // sans moyen -> liquide
    { date: '2026-11-01', prix: 999, tips: 0, moyenPaiement: 'Liquide' }              // hors mois
  ],
  bonsCadeaux: [
    { montant: 110, dateAchat: '2026-10-10', moyenPaiement: 'Virement', statut: 'actif' },
    { montant: 80, dateAchat: '2026-09-20', moyenPaiement: 'Carte bleue', statut: 'rembourse', dateRemboursement: '2026-10-15' },
    { montant: 70, dateAchat: '2026-10-12', moyenPaiement: 'Liquide', statut: 'rembourse', dateRemboursement: '2026-10-20' }
  ]
};

test('encaisse du mois : prix + tips, cartes cadeaux a la vente, remboursements retires', () => {
  const t = E.encaisseDuMois(appData, '2026-10');
  // prestations : 80 + 70 + 5 + 0 (bon) + 50 + 40 = 245 ; bons : +110 +70 ; remboursements : -80 -70
  assert.equal(t.prestations, 245);
  assert.equal(t.bonsVendus, 180);
  assert.equal(t.bonsRembourses, -150);
  assert.equal(t.total, 275);
  assert.equal(t.tips, 15);
});

test('repartition par moyen et base de la commission carte', () => {
  const t = E.encaisseDuMois(appData, '2026-10');
  assert.equal(t.parMoyen['Liquide'], 70 + 5 + 40 + 70 - 70);
  assert.equal(t.parMoyen['Virement'], 50 + 110);
  assert.equal(t.parMoyen['Carte bleue'], 80 - 80);
  assert.equal(t.carte, 0);
});

test('une carte cadeau vendue et remboursee le meme mois s annule', () => {
  const t = E.encaisseEntre(appData, '2026-10-12', '2026-10-20');
  assert.equal(t.bonsVendus + t.bonsRembourses, 70 - 80 - 70);
});

test('avecBons:false ne compte que les prestations', () => {
  const t = E.encaisseDuMois(appData, '2026-10', { avecBons: false });
  assert.equal(t.total, 245);
});

test('arithmetique des mois sans new Date()', () => {
  assert.equal(E.decalerMois('2026-01', -1), '2025-12');
  assert.equal(E.decalerMois('2026-12', 1), '2027-01');
  assert.equal(E.decalerMois('2026-03', -14), '2025-01');
  assert.deepEqual(E.derniersMois('2026-02', 3), ['2025-12', '2026-01', '2026-02']);
  assert.equal(E.dernierJourDuMois('2026-02'), '2026-02-28');
  assert.equal(E.dernierJourDuMois('2028-02'), '2028-02-29');
  assert.equal(E.dernierJourDuMois('2026-10'), '2026-10-31');
});

test('encaissePrestation : meme regle que encaissementsEntre, prestation par prestation', () => {
  assert.equal(E.encaissePrestation({ prix: 60, tips: 10, moyenPaiement: 'Liquide' }), 70);
  assert.equal(E.encaissePrestation({ prix: 0, tips: 5, moyenPaiement: 'Bon cadeau' }), 5);
  assert.equal(E.encaissePrestation({ prix: 95, tips: 0, moyenPaiement: 'Liquide', bonCadeauId: 'b9' }), 0);
  assert.equal(E.encaissePrestation({ prix: '50', tips: null, moyenPaiement: 'Virement' }), 50);
  const duMois = appData.prestations.filter(p => p.date.startsWith('2026-10'));
  const somme = duMois.reduce((t, p) => t + E.encaissePrestation(p), 0);
  assert.equal(somme, E.encaisseDuMois(appData, '2026-10', { avecBons: false }).total);
});
