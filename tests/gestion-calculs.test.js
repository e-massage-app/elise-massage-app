// Tests des calculs de l'onglet Gestion (node --test tests/*.test.js).
// Donnees fictives uniquement : le depot est public.
const assert = require('node:assert/strict');
const test = require('node:test');
const G = require('../js/gestion/gestion-calculs.js');

function base() {
  return {
    appData: {
      prestations: [
        { date: '2026-09-10', prix: 1000, tips: 0, moyenPaiement: 'Liquide' },
        { date: '2026-10-01', prix: 80, tips: 0, moyenPaiement: 'Carte bleue' },
        { date: '2026-10-02', prix: 400, tips: 20, moyenPaiement: 'Liquide' },
        { date: '2026-10-03', prix: 100, tips: 0, moyenPaiement: 'Virement' },
        { date: '2025-11-05', prix: 600, tips: 0, moyenPaiement: 'Liquide' }
      ],
      bonsCadeaux: [],
      depenses: [
        { date: '2026-10-08', categorie: 'Loyer', montant: 30, fournisseur: 'Institut' },
        { date: '2026-10-22', categorie: 'Abonnement', montant: 50, fournisseur: 'PLATEFORME', abonnementNom: 'PLATEFORME' },
        { date: '2026-10-09', categorie: 'Transport', montant: 12, fournisseur: 'Frais kilometriques' }
      ]
    },
    gestion: {
      mouvements: [],
      recurrents: [
        { id: 'r1', espace: 'pro', sens: 'sortie', compte: 'pro', nom: 'Banque pro', montant: 10, frequence: 'mensuelle', debut: '2026-01' },
        { id: 'r2', espace: 'pro', sens: 'sortie', compte: 'pro', nom: 'Taxe annuelle', montant: 300, frequence: 'annuelle', moisAnnuel: 7, debut: '2026-01' }
      ],
      mois: {},
      soldes: []
    },
    reglages: { tauxUrssaf: 21.4, tauxCarte: 1.75, matelas: 1000, besoinMensuel: 500, seuilTendu: 70 },
    ads: { '2026-09': 100, '2026-10': 60 }
  };
}

function ctx(d) {
  return G.contexte(d.appData, d.gestion, d.reglages, d.ads);
}

test('encaisse, URSSAF 21,4 % et commission carte 1,75 % (80 € -> 1,40 €)', () => {
  const t = G.totauxPro(ctx(base()), '2026-10');
  assert.equal(t.encaisse, 600);
  assert.equal(t.urssaf, 128.4);
  assert.equal(t.commission, 1.4);
  assert.equal(t.ads, 60);
});

test('le montant declare sert de base a l URSSAF, la correction de l encaisse prend le dessus', () => {
  const d = base();
  d.gestion.mois['2026-10'] = { caDeclare: 500, corrections: { ca: 650 } };
  const t = G.totauxPro(ctx(d), '2026-10');
  assert.equal(t.encaisse, 650);
  assert.equal(t.encaisseCalcule, 600);
  assert.equal(t.urssaf, 107);
});

test('ce qu il reste : frais du mois rattaches, estimations kilometriques exclues, charge annuelle hors mois', () => {
  const m = G.moisPro(ctx(base()), '2026-10');
  // 128,40 URSSAF + 1,40 carte + 60 Ads + 30 loyer + 50 abonnement + 10 banque
  assert.equal(m.frais, 279.8);
  assert.equal(m.reste, 320.2);
  assert.ok(!m.postes.some(p => p.categorie === 'Transport'));
  assert.ok(!m.postes.some(p => p.libelle === 'Taxe annuelle'));
});

test('rattachement : l URSSAF de septembre, prelevee en octobre, ne pese pas sur octobre', () => {
  const sept = G.moisPro(ctx(base()), '2026-09');
  const oct = G.moisPro(ctx(base()), '2026-10');
  assert.equal(sept.urssaf, 214);
  assert.equal(oct.postes.find(p => p.cle === 'urssaf').montant, 128.4);
});

test('correction d une charge fixe pour un mois (0 = pas ce mois-ci)', () => {
  const d = base();
  d.gestion.mois['2026-10'] = { corrections: { 'rec:r1': 0 } };
  const m = G.moisPro(ctx(d), '2026-10');
  assert.equal(m.frais, 269.8);
});

test('solde : dernier solde recopie + flux dates apres lui, URSSAF du mois precedent prelevee', () => {
  const d = base();
  d.gestion.soldes = [
    { compte: 'pro', date: '2026-09-30', montant: 2000 },
    { compte: 'caisse', date: '2026-09-30', montant: 300 }
  ];
  const c = ctx(d);
  // compte pro en octobre : +80 carte +100 virement -10 banque -50 abonnement
  // -1,40 commission (31/10) -214 URSSAF de septembre (31/10) -100 Ads de septembre (01/10)
  assert.equal(G.soldeCompte(c, 'pro', '2026-10-31').montant, 1804.6);
  // caisse : +420 liquide -30 loyer
  assert.equal(G.soldeCompte(c, 'caisse', '2026-10-31').montant, 690);
  assert.equal(G.soldeCompte(c, 'perso', '2026-10-31').montant, null);
  assert.equal(G.reserve(c, '2026-10-31').montant, 2494.6);
});

test('un solde recopie remplace l estimation a partir de sa date', () => {
  const d = base();
  d.gestion.soldes = [
    { compte: 'pro', date: '2026-09-30', montant: 2000 },
    { compte: 'pro', date: '2026-10-15', montant: 1500 }
  ];
  // apres le 15 : -50 abonnement (22/10) -1,40 commission -214 URSSAF de septembre (31/10)
  assert.equal(G.soldeCompte(ctx(d), 'pro', '2026-10-31').montant, 1234.6);
});

test('je peux me verser : le plus petit entre ce qui reste de cote et ce que le mois a rapporte', () => {
  const d = base();
  d.gestion.soldes = [
    { compte: 'pro', date: '2026-09-30', montant: 2000 },
    { compte: 'caisse', date: '2026-09-30', montant: 300 }
  ];
  d.gestion.mois['2026-10'] = { clotureLe: '2026-11-01' };
  const v = G.jePeuxMeVerser(ctx(d), '2026-11');
  assert.equal(v.base, '2026-10');
  assert.equal(v.provisoire, false);
  // reserve 2494,60 - URSSAF d'octobre 128,40 - Ads d'octobre 60 - matelas 1000 = 1306,20
  assert.equal(v.marge, 1306.2);
  assert.equal(v.plafond, 320.2);
  assert.equal(v.recommande, 320.2);
  assert.equal(v.statut, 'alerte'); // 320,20 < 70 % de 500
});

test('statuts OK / Tendu selon le besoin', () => {
  const d = base();
  d.gestion.soldes = [{ compte: 'pro', date: '2026-09-30', montant: 9000 }];
  d.reglages.besoinMensuel = 300;
  assert.equal(G.jePeuxMeVerser(ctx(d), '2026-11').statut, 'ok');
  d.reglages.besoinMensuel = 400;
  assert.equal(G.jePeuxMeVerser(ctx(d), '2026-11').statut, 'tendu');
  assert.equal(G.jePeuxMeVerser(ctx(d), '2026-11').provisoire, true);
});

test('la charge annuelle du mois suivant est mise de cote', () => {
  const d = base();
  d.gestion.soldes = [{ compte: 'pro', date: '2026-06-30', montant: 5000 }];
  const v = G.jePeuxMeVerser(ctx(d), '2026-07');
  assert.equal(v.base, '2026-06');
  assert.ok(v.dettes.some(x => x.libelle === 'Taxe annuelle' && x.montant === 300));
});

test('jamais negatif', () => {
  const d = base();
  d.gestion.soldes = [{ compte: 'pro', date: '2026-09-30', montant: 100 }];
  assert.equal(G.jePeuxMeVerser(ctx(d), '2026-11').recommande, 0);
});

test('a declarer ce mois-ci : l encaisse du mois precedent, et le reste non declare a titre d info', () => {
  const d = base();
  assert.equal(G.aDeclarer(ctx(d), '2026-11').montant, 600);
  d.gestion.mois['2026-10'] = { caDeclare: 450 };
  const a = G.aDeclarer(ctx(d), '2026-11');
  assert.equal(a.resteNonDeclare, 150);
  assert.equal(a.cotisationsCorrespondantes, 32.1);
});

test('pour moi : virement vers le perso + depenses perso payees avec la caisse', () => {
  const d = base();
  d.gestion.mouvements = [
    { id: 'm1', date: '2026-10-05', espace: 'pro', sens: 'transfert', compte: 'pro', compteVers: 'perso', montant: 400 },
    { id: 'm2', date: '2026-10-06', espace: 'perso', sens: 'sortie', compte: 'caisse', categorie: 'Courses', montant: 25 },
    { id: 'm3', date: '2026-10-07', espace: 'pro', sens: 'transfert', compte: 'caisse', compteVers: 'pro', montant: 200 },
    { id: 'm4', date: '2026-10-08', espace: 'perso', sens: 'sortie', compte: 'perso', categorie: 'Courses', montant: 40 }
  ];
  const p = G.pourMoi(ctx(d), '2026-10');
  assert.equal(p.total, 425);
  // un depot de la caisse en banque ne change pas la reserve
  d.gestion.soldes = [{ compte: 'pro', date: '2026-09-30', montant: 0 }, { compte: 'caisse', date: '2026-09-30', montant: 0 }];
  const sans = G.contexte(d.appData, { ...d.gestion, mouvements: d.gestion.mouvements.filter(m => m.id !== 'm3') }, d.reglages, d.ads);
  assert.equal(G.reserve(ctx(d), '2026-10-31').montant, G.reserve(sans, '2026-10-31').montant);
});

test('mois perso : revenus, charges fixes, depenses variables, epargne', () => {
  const d = base();
  d.gestion.recurrents.push(
    { id: 'p1', espace: 'perso', sens: 'sortie', compte: 'perso', nom: 'Logement', montant: 500, frequence: 'mensuelle', debut: '2026-01' },
    { id: 'p2', espace: 'perso', sens: 'entree', compte: 'perso', nom: 'Aides', montant: 300, frequence: 'mensuelle', debut: '2026-01' },
    { id: 'p3', espace: 'perso', sens: 'transfert', compte: 'perso', compteVers: 'epargne', nom: 'Vacances', montant: 50, frequence: 'mensuelle', debut: '2026-01' }
  );
  d.gestion.mouvements = [
    { id: 'm1', date: '2026-10-05', espace: 'pro', sens: 'transfert', compte: 'pro', compteVers: 'perso', montant: 800 },
    { id: 'm2', date: '2026-10-06', espace: 'perso', sens: 'sortie', compte: 'caisse', categorie: 'Courses', montant: 25 },
    { id: 'm4', date: '2026-10-08', espace: 'perso', sens: 'sortie', compte: 'perso', categorie: 'Courses', montant: 40 }
  ];
  const p = G.moisPerso(ctx(d), '2026-10');
  assert.equal(p.totalRevenus, 1100);
  assert.equal(p.totalFixes, 500);
  assert.equal(p.totalVariables, 65);
  assert.equal(p.parCategorie['Courses'], 65);
  assert.equal(p.totalEpargne, 50);
});

test('projection jusqu au printemps, a partir du meme mois l an dernier', () => {
  const d = base();
  d.gestion.soldes = [{ compte: 'pro', date: '2026-10-31', montant: 3000 }];
  const c = G.courbeReserve(ctx(d), '2026-11-02');
  assert.equal(c.fin, '2027-05');
  assert.equal(c.projection[0].mois, '2026-11');
  assert.equal(c.projection[0].prevu, 600); // novembre 2025
  assert.equal(c.projection[c.projection.length - 1].mois, '2027-05');
  assert.equal(c.points.length, 13);
});
