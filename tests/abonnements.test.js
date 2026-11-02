// Tests des depenses automatiques d'abonnement (node --test tests/abonnements.test.js).
// Donnees fictives : aucun chiffre reel d'Elise ici (le depot est public).
const assert = require('node:assert/strict');
const test = require('node:test');
const A = require('../js/core/abonnements.js');

const logiciel = { id: 'abo1', nom: 'Logiciel', categorie: 'Abonnement', jourPrelevement: 22, actif: true };
const autre = { id: 'abo2', nom: 'Logiciel', categorie: 'Abonnement', jourPrelevement: 5, actif: true };
const tous = [logiciel, autre];
const dep = (date, champs) => ({ id: 'd_' + date, date, categorie: 'Abonnement', ...champs });

test('depense reconnue par l\'identifiant, meme apres un renommage', () => {
  const d = dep('2026-10-22', { type: 'abonnement-auto', abonnementId: 'abo1', abonnementNom: 'Ancien nom' });
  assert.ok(A.estDepenseDe(d, logiciel, tous));
  assert.equal(A.estDepenseDe(d, autre, tous), false); // meme nom, autre abonnement
});

test('depenses d\'avant (sans identifiant) : regle par le nom', () => {
  assert.ok(A.estDepenseDe(dep('2026-10-22', { type: 'abonnement-auto', abonnementNom: 'Logiciel' }), logiciel, tous));
  assert.ok(A.estDepenseDe(dep('2026-10-22', { fournisseur: ' logiciel ' }), logiciel, tous));     // saisie a la main
  assert.equal(A.estDepenseDe(dep('2026-10-22', { fournisseur: 'Logiciel', categorie: 'Marketing' }), logiciel, tous), false);
  assert.equal(A.estDepenseDe(dep('2026-10-22', { type: 'autre', fournisseur: 'Logiciel' }), logiciel, tous), false);
});

test('identifiant inconnu (abonnement supprime ou reecrit) : retour a la regle par le nom', () => {
  const d = dep('2026-10-22', { type: 'abonnement-auto', abonnementId: 'perdu', abonnementNom: 'Logiciel' });
  assert.ok(A.estDepenseDe(d, logiciel, tous));
});

test('mois courant cree seulement une fois le jour de prelevement atteint', () => {
  const depenses = [dep('2026-10-22', { abonnementId: 'abo1', type: 'abonnement-auto' })];
  assert.deepEqual(A.moisAGenerer(logiciel, depenses, tous, '2026-11-21'), []);
  assert.deepEqual(A.moisAGenerer(logiciel, depenses, tous, '2026-11-22'), ['2026-11']);
});

test('rattrapage des mois sans ouverture du logiciel', () => {
  const depenses = [dep('2026-08-22', { abonnementId: 'abo1', type: 'abonnement-auto' })];
  assert.deepEqual(A.moisAGenerer(logiciel, depenses, tous, '2026-11-02'), ['2026-09', '2026-10']);
});

test('sans depense : le mois courant seul', () => {
  assert.deepEqual(A.moisAGenerer(logiciel, [], tous, '2026-11-25'), ['2026-11']);
  assert.deepEqual(A.moisAGenerer(logiciel, [], tous, '2026-11-02'), []);
});

test('reprise apres une pause : pas de rattrapage des mois en pause', () => {
  const depenses = [dep('2026-05-22', { abonnementId: 'abo1', type: 'abonnement-auto' })];
  // repris le 10 novembre, avant le prelevement du 22 : novembre compte, une fois le 22 atteint
  const repris = { ...logiciel, repriseLe: '2026-11-10' };
  assert.deepEqual(A.moisAGenerer(repris, depenses, tous, '2026-11-12'), []);
  assert.deepEqual(A.moisAGenerer(repris, depenses, tous, '2026-11-23'), ['2026-11']);
  // repris le 25 novembre, apres le prelevement : premier mois = decembre
  const reprisTard = { ...logiciel, repriseLe: '2026-11-25' };
  assert.deepEqual(A.moisAGenerer(reprisTard, depenses, tous, '2026-11-26'), []);
  assert.deepEqual(A.moisAGenerer(reprisTard, depenses, tous, '2027-01-03'), ['2026-12']);
});

test('une reprise ancienne ne bloque pas le rattrapage normal', () => {
  const depenses = [dep('2026-09-22', { abonnementId: 'abo1', type: 'abonnement-auto' })];
  const repris = { ...logiciel, repriseLe: '2026-03-01' };
  assert.deepEqual(A.moisAGenerer(repris, depenses, tous, '2026-11-02'), ['2026-10']);
});

test('les depenses d\'un homonyme ne comptent pas', () => {
  const depenses = [dep('2026-10-05', { abonnementId: 'abo2', type: 'abonnement-auto', abonnementNom: 'Logiciel' })];
  assert.deepEqual(A.moisAGenerer(logiciel, depenses, tous, '2026-11-25'), ['2026-11']);
});
