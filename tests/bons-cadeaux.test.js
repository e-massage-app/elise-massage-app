// Tests des regles des cartes cadeaux (node --test tests/bons-cadeaux.test.js).
// Donnees fictives : aucun chiffre reel d'Elise ici (le depot est public).
const assert = require('node:assert/strict');
const test = require('node:test');
const B = require('../js/core/bons-cadeaux.js');

test('ajouterMois : jour garde, ramene au dernier jour du mois', () => {
  assert.equal(B.ajouterMois('2026-03-10', 6), '2026-09-10');
  assert.equal(B.ajouterMois('2026-08-31', 6), '2027-02-28');   // et non 3 mars
  assert.equal(B.ajouterMois('2027-08-31', 6), '2028-02-29');   // annee bissextile
  assert.equal(B.ajouterMois('2026-01-31', 1), '2026-02-28');
  assert.equal(B.ajouterMois('2026-10-31', 1), '2026-11-30');
  assert.equal(B.ajouterMois('2026-12-15', 1), '2027-01-15');
  assert.equal(B.ajouterMois('2028-02-29', 12), '2029-02-28');
  assert.equal(B.ajouterMois('2026-03-31', -1), '2026-02-28');
});

test('ajouterMois : pas de decalage d\'un jour l\'hiver (heure d\'ete / UTC)', () => {
  // new Date('2026-11-15') + setMonth + toISOString donnait le 14 mai en France
  assert.equal(B.ajouterMois('2026-11-15', 6), '2027-05-15');
  assert.equal(B.ajouterMois('2026-12-01', 6), '2027-06-01');
});

test('ajouterMois : date vide ou invalide -> chaine vide', () => {
  assert.equal(B.ajouterMois('', 6), '');
  assert.equal(B.ajouterMois(undefined, 6), '');
  assert.equal(B.ajouterMois('15/11/2026', 6), '');
});

test('statutEffectif : la date de fin decide, jour de fin inclus', () => {
  const auj = '2026-11-02';
  assert.equal(B.statutEffectif({ statut: 'actif', dateExpiration: '2026-11-02' }, auj), 'actif');
  assert.equal(B.statutEffectif({ statut: 'actif', dateExpiration: '2026-11-01' }, auj), 'expire');
  assert.equal(B.statutEffectif({ statut: 'actif', dateExpiration: '' }, auj), 'actif');
});

test('statutEffectif : une carte prolongee redevient active, meme stockee « expire »', () => {
  assert.equal(B.statutEffectif({ statut: 'expire', dateExpiration: '2027-05-01' }, '2026-11-02'), 'actif');
  assert.equal(B.statutEffectif({ statut: 'expire', dateExpiration: '2026-10-01' }, '2026-11-02'), 'expire');
});

test('statutEffectif : utilisation forcee d\'une carte expiree = active', () => {
  assert.equal(B.statutEffectif({ statut: 'actif', forceUtilise: true, dateExpiration: '2026-01-01' }, '2026-11-02'), 'actif');
  assert.equal(B.statutEffectif({ statut: 'expire', forceUtilise: true, dateExpiration: '2026-01-01' }, '2026-11-02'), 'actif');
});

test('statutEffectif : utilisee et remboursee sont definitifs', () => {
  assert.equal(B.statutEffectif({ statut: 'utilise', dateExpiration: '2030-01-01' }, '2026-11-02'), 'utilise');
  assert.equal(B.statutEffectif({ statut: 'rembourse', dateExpiration: '2020-01-01' }, '2026-11-02'), 'rembourse');
  assert.equal(B.statutEffectif(null, '2026-11-02'), null);
});

test('statutEffectif ne modifie jamais la carte', () => {
  const bon = { statut: 'actif', dateExpiration: '2026-01-01' };
  B.statutEffectif(bon, '2026-11-02');
  assert.deepEqual(bon, { statut: 'actif', dateExpiration: '2026-01-01' });
});

test('ficheDuNom : nom exact d\'une seule fiche (casse, accents, espaces ignores)', () => {
  const clients = [
    { id: 'c1', prenom: 'Léa', nom: 'Fictive' },
    { id: 'c2', prenom: 'Zoé', nom: 'Exemple' },
    { id: 'c3', prenom: 'Zoé', nom: 'Exemple' }
  ];
  assert.equal(B.ficheDuNom(clients, '  lea   FICTIVE ').id, 'c1');
  assert.equal(B.ficheDuNom(clients, 'Léa'), null);            // nom partiel : pas devine
  assert.equal(B.ficheDuNom(clients, 'Zoé Exemple'), null);    // homonymes : pas devine
  assert.equal(B.ficheDuNom(clients, ''), null);
});
