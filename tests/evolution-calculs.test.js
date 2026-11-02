// Tests du graphique « Évolution » d'Analytics (node --test tests/*.test.js).
// Donnees fictives uniquement : le depot est public.
const assert = require('node:assert/strict');
const test = require('node:test');
const V = require('../js/analytics/evolution-calculs.js');

const appData = {
  prestations: [
    { date: '2026-01-10', prix: 100, tips: 10, moyenPaiement: 'Liquide', groupe: 'Massages' },
    { date: '2026-01-12', prix: 60, tips: 0, moyenPaiement: 'Carte bleue', groupe: 'HeadSpa' },
    { date: '2026-01-20', prix: 0, tips: 5, moyenPaiement: 'Bon cadeau', groupe: 'Massages' },     // carte cadeau : tips seuls
    { date: '2026-03-02', prix: 80, tips: 0, moyenPaiement: 'Virement', groupe: 'Massages' },
    { date: '2026-03-05', prix: 30, tips: 0, moyenPaiement: 'Liquide', groupe: 'Archive' },        // groupe hors liste
    { date: '2026-03-20', prix: 999, tips: 0, moyenPaiement: 'Liquide', groupe: 'Massages' },      // apres « aujourd'hui »
    { date: '2025-01-15', prix: 50, tips: 0, moyenPaiement: 'Liquide', groupe: 'Massages' },
    { date: '2025-03-04', prix: 40, tips: 0, moyenPaiement: 'Liquide', groupe: 'Massages' },
    { date: '2025-03-25', prix: 70, tips: 0, moyenPaiement: 'Liquide', groupe: 'Massages' }        // apres le 10 mars
  ],
  bonsCadeaux: [
    { montant: 90, dateAchat: '2026-01-05', moyenPaiement: 'Virement', statut: 'actif' },
    { montant: 40, dateAchat: '2025-12-01', moyenPaiement: 'Liquide', statut: 'rembourse', dateRemboursement: '2026-03-01' }
  ],
  depenses: [
    { date: '2026-01-08', categorie: 'Loyer', montant: 30 },
    { date: '2026-01-09', categorie: 'Huiles', montant: 12.5 },
    { date: '2026-03-03', montant: 7 },                                                            // sans categorie
    { date: '2026-03-25', categorie: 'Loyer', montant: 30 }                                        // apres « aujourd'hui »
  ]
};

const OPTIONS = { groupeDe: p => p.groupe, activites: ['Massages', 'HeadSpa', 'Epilation'], aujourdhui: '2026-03-10' };

test("periode : « Année actuelle » = l'annee en cours, mois vide = toute l'annee", () => {
  assert.deepEqual(V.periodeDe('current', '', '2026-03-10'), { annee: 2026, mois: null });
  assert.deepEqual(V.periodeDe('2025', '7', '2026-03-10'), { annee: 2025, mois: 7 });
});

test('une annee : 12 colonnes, les mois a venir sont vides', () => {
  const e = V.evolution(appData, { annee: 2026, mois: null }, OPTIONS);
  assert.equal(e.mode, 'annee');
  assert.equal(e.colonnes.length, 12);
  assert.equal(e.colonnes[0].libelle, 'janv.');
  assert.equal(e.bilans[3], null);              // avril n'a pas commence
  assert.equal(e.reste[3], null);
});

test("activites : ordre prefere, groupe inconnu ajoute, activite vide retiree, cartes cadeaux a la fin", () => {
  const e = V.evolution(appData, { annee: 2026, mois: null }, OPTIONS);
  assert.deepEqual(e.activites, ['Massages', 'HeadSpa', 'Archive', V.CARTES]);
  const massages = e.series.find(s => s.nom === 'Massages').valeurs;
  assert.equal(massages[0], 115);               // 100 + 10 de tips + 5 de tips sur carte cadeau
  assert.equal(massages[2], 80);                // le 20 mars n'est pas encore arrive
  const cartes = e.series.find(s => s.nom === V.CARTES).valeurs;
  assert.deepEqual(cartes.slice(0, 3), [90, 0, -40]); // vente en janvier, remboursement en mars
});

test('bilan : pourboires en detail, frais = depenses seulement, reste = encaisse - frais', () => {
  const e = V.evolution(appData, { annee: 2026, mois: null }, OPTIONS);
  const janvier = e.bilans[0];
  assert.equal(janvier.encaisse, 265);          // 115 + 60 + 90
  assert.equal(janvier.pourboires, 15);
  assert.deepEqual(janvier.parCategorie, { Loyer: 30, Huiles: 12.5 });
  assert.equal(janvier.frais, 42.5);
  assert.equal(janvier.reste, 222.5);
  assert.deepEqual(e.bilans[2].parCategorie, { Autre: 7 }); // la depense du 25 mars n'est pas encore la
});

test("annee d'avant : par mois et par activite, et comparaison aux memes dates", () => {
  const e = V.evolution(appData, { annee: 2026, mois: null }, OPTIONS);
  assert.deepEqual(e.avant[0], { Massages: 50 });
  assert.deepEqual(e.avant[2], { Massages: 110 });  // l'an dernier est entierement passe
  // Du 1er janvier au 10 mars : 2026 = 265 + 80 + 30 - 40 = 335 ; 2025 = 50 + 40 = 90
  assert.equal(e.total.encaisse, 335);
  assert.deepEqual(e.comparaison, { annee: 2025, encaisse: 90, ecart: 272 });
});

test('un mois : une colonne par jour, sans annee d\'avant ni ligne par jour a comparer', () => {
  const e = V.evolution(appData, { annee: 2026, mois: 3 }, OPTIONS);
  assert.equal(e.mode, 'mois');
  assert.equal(e.colonnes.length, 31);
  assert.equal(e.colonnes[9].libelle, '10');
  assert.equal(e.bilans[10], null);             // le 11 mars est a venir
  assert.equal(e.avant, null);
  assert.equal(e.series.find(s => s.nom === 'Massages').valeurs[1], 80);
  assert.equal(e.total.encaisse, 70);           // 80 + 30 - 40
  assert.equal(e.comparaison.encaisse, 40);     // 1er au 10 mars 2025
});

test("un mois qui n'a pas commence : rien a compter", () => {
  const e = V.evolution(appData, { annee: 2026, mois: 5 }, OPTIONS);
  assert.equal(e.total, null);
  assert.equal(e.comparaison, null);
  assert.deepEqual(e.activites, []);
});

test("sans rien l'annee d'avant, pas d'ecart en %", () => {
  const e = V.evolution(appData, { annee: 2025, mois: null }, { ...OPTIONS, aujourdhui: '2026-03-10' });
  assert.equal(e.comparaison.ecart, null);
});

test('29 fevrier : un an plus tot = 28 fevrier', () => {
  assert.equal(V.decalerAnnee('2028-02-29', -1), '2027-02-28');
  assert.equal(V.decalerAnnee('2026-03-10', -1), '2025-03-10');
});

test('jour de la semaine : 1 = lundi, 7 = dimanche', () => {
  assert.equal(V.jourSemaine('2026-11-02'), 1); // lundi
  assert.equal(V.jourSemaine('2026-11-04'), 3); // mercredi
  assert.equal(V.jourSemaine('2026-11-08'), 7); // dimanche
});

test('par jour de la semaine : prestations et encaisse, sans les ventes de cartes cadeaux', () => {
  // Du 1er janvier au 10 mars 2026 (donnees fictives du haut)
  const j = V.parJourSemaine(appData, '2026-01-01', '2026-03-10');
  const parNom = Object.fromEntries(j.map(x => [x.nom, x]));
  // 10/01 samedi, 12/01 lundi, 20/01 mardi (carte cadeau : tips seuls), 02/03 lundi, 05/03 jeudi
  assert.deepEqual(parNom.samedi, { jour: 6, nom: 'samedi', prestations: 1, encaisse: 110 });
  assert.deepEqual(parNom.lundi, { jour: 1, nom: 'lundi', prestations: 2, encaisse: 140 });
  assert.equal(parNom.mardi.prestations, 1);
  assert.equal(parNom.mardi.encaisse, 5);
  assert.equal(parNom.jeudi.encaisse, 30);
  // La vente de carte du 05/01 (lundi) et le remboursement du 01/03 (dimanche) ne comptent pas
  assert.equal(parNom.dimanche.encaisse, 0);
  assert.equal(j.reduce((t, x) => t + x.prestations, 0), 5);
});
