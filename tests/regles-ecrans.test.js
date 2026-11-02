// Tests des petites regles partagees par les ecrans (v1.2.0.0). Donnees fictives.
const assert = require('node:assert/strict');
const test = require('node:test');
const R = require('../js/core/regles-ecrans.js');

test('jour local, pas UTC : 0 h 30 le 2 novembre reste le 2 novembre', () => {
  assert.equal(R.jourLocal(new Date(2026, 10, 2, 0, 30)), '2026-11-02');
  assert.equal(R.jourLocal(new Date(2026, 0, 1, 23, 59)), '2026-01-01');
});

test('RDV a venir : aujourd hui ou plus tard, ni annule (deux orthographes), ni transforme', () => {
  const auj = '2026-11-02';
  assert.equal(R.estRdvAVenir({ date: '2026-11-02', statut: 'confirmé' }, auj), true);
  assert.equal(R.estRdvAVenir({ date: '2026-12-01', statut: 'en attente' }, auj), true);
  assert.equal(R.estRdvAVenir({ date: '2026-11-01', statut: 'confirmé' }, auj), false);   // passe, non transforme
  assert.equal(R.estRdvAVenir({ date: '2026-11-10', statut: 'annulé' }, auj), false);
  assert.equal(R.estRdvAVenir({ date: '2026-11-10', statut: 'annule' }, auj), false);
  assert.equal(R.estRdvAVenir({ date: '2026-11-10', statut: 'confirmé', transformeEnPrestation: true }, auj), false);
  assert.equal(R.estRdvAVenir({ statut: 'confirmé' }, auj), false);
});

test('panier moyen sans les prestations reglees par carte cadeau (regle d Analytics)', () => {
  const prestations = [
    { prix: 80, tips: 0, moyenPaiement: 'Liquide' },
    { prix: 60, tips: 10, moyenPaiement: 'Carte bleue' },
    { prix: 0, tips: 5, moyenPaiement: 'Bon cadeau' },             // ne compte pas
    { prix: 95, tips: 0, moyenPaiement: 'Liquide', bonCadeauId: 'b1' } // ne compte pas non plus
  ];
  assert.equal(R.panierMoyen(prestations), 75); // (80 + 70) / 2
  assert.equal(R.panierMoyen([{ prix: 0, tips: 0, moyenPaiement: 'Bon cadeau' }]), 0);
  assert.equal(R.panierMoyen([]), 0);
});

test('couts produits : chaque categorie x SES prestations, pas x tout le groupe', () => {
  const categories = [
    { id: 'cat-a', coutProduitDefault: 4 },
    { id: 'cat-b', coutProduitDefault: '2.5' },
    { id: 'cat-c' }                                  // sans cout
  ];
  // 3 prestations en A, 2 en B, 5 en C : 3*4 + 2*2.5 = 17 (l'ancien calcul donnait (4+2.5)*10 = 65)
  assert.equal(R.coutsProduits(categories, { 'cat-a': 3, 'cat-b': 2, 'cat-c': 5 }), 17);
  assert.equal(R.coutsProduits(categories, {}), 0);
});

test('categorie archivee comptee sous son propre nom', () => {
  assert.equal(R.nomCategorieStats({ nom: 'Rituels', statut: 'actif' }), 'Rituels');
  assert.equal(R.nomCategorieStats({ nom: 'Soins visage', statut: 'archive' }), 'Soins visage (archivée)');
  assert.equal(R.nomCategorieStats(null), 'Autre');
});

test('filtre Periode des depenses : « 3 derniers mois » = ce mois et les deux precedents', () => {
  const auj = '2026-11-02';
  const dans = (date, p) => R.depenseDansPeriode(date, p, auj);
  assert.equal(dans('2026-11-01', '3-mois'), true);
  assert.equal(dans('2026-09-01', '3-mois'), true);
  assert.equal(dans('2026-08-31', '3-mois'), false);   // l'ancien filtre l'incluait (4 mois)
  assert.equal(dans('2026-12-01', '3-mois'), false);
  assert.equal(dans('2026-11-30', 'ce-mois'), true);
  assert.equal(dans('2026-10-31', 'ce-mois'), false);
  assert.equal(dans('2026-10-01', 'mois-dernier'), true);
  assert.equal(dans('2025-10-01', 'mois-dernier'), false);
  assert.equal(dans('2026-01-01', 'cette-annee'), true);
  assert.equal(dans('2025-12-31', 'cette-annee'), false);
  assert.equal(dans('2020-01-01', ''), true);
  // janvier : « 3 derniers mois » remonte sur l'annee precedente
  assert.equal(R.depenseDansPeriode('2025-11-15', '3-mois', '2026-01-10'), true);
  assert.equal(R.depenseDansPeriode('2025-10-31', '3-mois', '2026-01-10'), false);
});

test('sexe en clair : l ancien code M = Homme, comme les statistiques', () => {
  assert.equal(R.libelleSexe('H'), 'Homme');
  assert.equal(R.libelleSexe('M'), 'Homme');
  assert.equal(R.libelleSexe('homme'), 'Homme');
  assert.equal(R.libelleSexe('F'), 'Femme');
  assert.equal(R.libelleSexe(''), '');
  assert.equal(R.libelleSexe(undefined), '');
  assert.equal(R.libelleSexe('X'), '');
});
