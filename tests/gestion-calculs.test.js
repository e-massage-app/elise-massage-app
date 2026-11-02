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

test('solde : dernier solde recopie + flux dates apres lui, URSSAF prelevee le 4 du mois M+2', () => {
  const d = base();
  d.gestion.soldes = [
    { compte: 'pro', date: '2026-09-30', montant: 2000 },
    { compte: 'caisse', date: '2026-09-30', montant: 300 }
  ];
  const c = ctx(d);
  // compte pro en octobre : +80 carte +100 virement -10 banque -50 abonnement
  // -1,40 commission (31/10) -100 Ads de septembre (01/10) ; l'URSSAF de septembre part le 04/11
  assert.equal(G.soldeCompte(c, 'pro', '2026-10-31').montant, 2018.6);
  // le 04/11 : - Ads d'octobre (01/11) 60 - banque de novembre (01/11) 10 - URSSAF de septembre 214
  assert.equal(G.soldeCompte(c, 'pro', '2026-11-04').montant, 1734.6);
  // caisse : +420 liquide -30 loyer
  assert.equal(G.soldeCompte(c, 'caisse', '2026-10-31').montant, 690);
  assert.equal(G.soldeCompte(c, 'perso', '2026-10-31').montant, null);
  assert.equal(G.reserve(c, '2026-10-31').montant, 2708.6);
});

test('un solde recopie remplace l estimation a partir de sa date', () => {
  const d = base();
  d.gestion.soldes = [
    { compte: 'pro', date: '2026-09-30', montant: 2000 },
    { compte: 'pro', date: '2026-10-15', montant: 1500 }
  ];
  // apres le 15 : -50 abonnement (22/10) -1,40 commission
  assert.equal(G.soldeCompte(ctx(d), 'pro', '2026-10-31').montant, 1448.6);
});

function avecSoldes(d, pro = 2000, caisse = 300) {
  d.gestion.soldes = [
    { compte: 'pro', date: '2026-09-30', montant: pro },
    { compte: 'caisse', date: '2026-09-30', montant: caisse }
  ];
  return d;
}

test('je peux me verser (mois termine) : ce que le mois a rapporte, verdict sur le besoin', () => {
  const v = G.jePeuxMeVerser(ctx(avecSoldes(base())), '2026-10', '2026-11-02');
  assert.equal(v.enCours, false);
  assert.equal(v.rapporte, 320.2);
  // deja du au 31/10 : URSSAF de septembre (04/11) 214 + URSSAF d'octobre (04/12) 128,40 + Ads d'octobre (01/11) 60
  assert.equal(v.totalAPayer, 402.4);
  // ma reserve fin octobre : comptes 2708,60 moins ce qui est deja du, tout de suite
  assert.equal(v.comptes, 2708.6);
  assert.equal(v.reserve, 2306.2);
  assert.equal(v.marge, 1306.2); // - matelas 1000
  assert.equal(v.total, 320.2);
  assert.equal(v.limiteParMatelas, false);
  // le salaire n'est retire que « si je me verse »
  assert.equal(v.salaireApres, 320.2);
  assert.equal(v.reserveApres, 1986);
  assert.equal(v.statut, 'alerte'); // 320,20 < 70 % de 500
});

test('ma reserve : l URSSAF d octobre sort fin octobre, novembre part de la sans la recompter', () => {
  const d = avecSoldes(base());
  const oct = G.bilanReserve(ctx(d), '2026-10', '2026-11-02');
  // fin septembre : comptes 2300 - URSSAF de septembre 214 - Ads de septembre 100
  assert.equal(oct.depart, 1986);
  assert.equal(oct.rapporte, 320.2);
  assert.equal(oct.arrivee, 2306.2);
  assert.equal(oct.ecart, 0);
  const nov = G.bilanReserve(ctx(d), '2026-11', '2026-11-02');
  assert.equal(nov.depart, oct.arrivee);
  assert.equal(nov.ecart, 0);
  const urssafOct = j => G.aPayer(ctx(d), j.slice(0, 7), j).lignes.some(l => l.libelle === 'URSSAF d\'octobre');
  assert.ok(urssafOct('2026-11-30'), 'encore due fin novembre');
  assert.ok(!urssafOct('2026-12-05'), 'partie le 04/12');
});

test('URSSAF : prelevee le 4 du mois M+2 par defaut, reglable, ou a la date confirmee', () => {
  const d = base();
  assert.equal(G.datePrelevementUrssaf(ctx(d), '2026-10'), '2026-12-04');
  d.reglages.jourUrssaf = 2;
  assert.equal(G.datePrelevementUrssaf(ctx(d), '2026-10'), '2026-12-02');
  d.gestion.mois['2026-10'] = { corrections: { urssafLe: '2026-12-03' } };
  assert.equal(G.datePrelevementUrssaf(ctx(d), '2026-10'), '2026-12-03');
});

test('debut de mois : deux URSSAF encore dues, la question au releve entre le 1er et le 4', () => {
  const d = avecSoldes(base());
  const du = G.aPayer(ctx(d), '2026-11', '2026-11-02').lignes.map(l => l.libelle);
  assert.ok(du.includes('URSSAF de septembre') && du.includes('URSSAF d\'octobre'));
  assert.deepEqual(G.urssafAConfirmer(ctx(d), 'pro', '2026-11-03'), { mois: '2026-09', montant: 214, dateSupposee: '2026-11-04' });
  assert.equal(G.urssafAConfirmer(ctx(d), 'pro', '2026-11-05'), null, 'apres le 4 : deja partie');
  assert.equal(G.urssafAConfirmer(ctx(d), 'caisse', '2026-11-03'), null, 'pas le compte qui paie l URSSAF');
  d.gestion.mois['2026-09'] = { corrections: { urssafLe: '2026-11-02' } };
  assert.equal(G.urssafAConfirmer(ctx(d), 'pro', '2026-11-03'), null, 'deja confirmee');
  // confirmee partie le 02/11 : le releve du 03/11 ne la retire pas une deuxieme fois
  d.gestion.soldes.push({ compte: 'pro', date: '2026-11-03', montant: 1500 });
  assert.equal(G.soldeCompte(ctx(d), 'pro', '2026-11-05').montant, 1500);
});

test('ma reserve : un salaire verse compte a sa vraie date, un releve inattendu apparait en ecart', () => {
  const d = avecSoldes(base());
  d.gestion.mouvements = [{ id: 'm1', date: '2026-11-03', espace: 'pro', sens: 'transfert', compte: 'pro', compteVers: 'perso', montant: 300, moisConcerne: '2026-10' }];
  const nov = G.bilanReserve(ctx(d), '2026-11', '2026-11-05');
  assert.equal(nov.verses.total, 300);
  assert.equal(nov.ecart, 0);
  d.gestion.soldes.push({ compte: 'caisse', date: '2026-11-04', montant: 600 }); // estimee 690
  assert.equal(G.bilanReserve(ctx(d), '2026-11', '2026-11-05').ecart, -90);
});

test('je peux me verser (mois en cours) : bouge avec le mois, pas de verdict, meme marge qu en fin de mois', () => {
  const v = G.jePeuxMeVerser(ctx(avecSoldes(base())), '2026-10', '2026-10-15');
  assert.equal(v.enCours, true);
  assert.equal(v.jour, '2026-10-15');
  assert.equal(v.statut, null);
  assert.equal(v.progression, 0.6404);
  // comptes au 15/10 : 2070 pro + 690 caisse
  assert.equal(v.comptes, 2760);
  // deja du : URSSAF de septembre (31/10) 214 + abonnement (22/10) 50 + commission 1,40 + URSSAF 128,40 + Ads 60
  assert.equal(v.totalAPayer, 453.8);
  assert.equal(v.reserve, 2306.2);
  assert.equal(v.marge, 1306.2);
  assert.equal(v.total, 320.2);
});

test('je peux me verser : limite pour garder le matelas', () => {
  const v = G.jePeuxMeVerser(ctx(avecSoldes(base(), 1000)), '2026-10', '2026-11-02');
  assert.equal(v.total, 306.2);
  assert.equal(v.limiteParMatelas, true);
  assert.equal(v.reserveApres, 1000);
});

test('deja verse : un virement debut novembre pour octobre compte pour octobre', () => {
  const d = avecSoldes(base());
  d.gestion.mouvements = [
    { id: 'm1', date: '2026-10-05', espace: 'pro', sens: 'transfert', compte: 'pro', compteVers: 'perso', montant: 100 },
    { id: 'm2', date: '2026-11-03', espace: 'pro', sens: 'transfert', compte: 'pro', compteVers: 'perso', montant: 200, moisConcerne: '2026-10' }
  ];
  const v = G.jePeuxMeVerser(ctx(d), '2026-10', '2026-11-05');
  assert.equal(v.verse, 300);
  assert.equal(v.versesAvant, 100);
  assert.equal(v.versesApres, 200);
  assert.equal(v.total, 320.2);
  assert.equal(v.resteAVerser, 20.2);
  assert.equal(v.enTrop, 0);
  // reserve au 31/10 (2394,60) - du (188,40) - verse le 3/11 (200) - reste a verser (20,20)
  assert.equal(v.reserveApres, 1986);
  assert.equal(G.pourMoi(ctx(d), '2026-11').total, 0, 'novembre ne le compte pas');
});

test('deja verse : plus que ce que le mois permet', () => {
  const d = avecSoldes(base());
  d.gestion.mouvements = [{ id: 'm1', date: '2026-10-05', espace: 'pro', sens: 'transfert', compte: 'pro', compteVers: 'perso', montant: 400 }];
  const v = G.jePeuxMeVerser(ctx(d), '2026-10', '2026-11-02');
  assert.equal(v.total, 320.2);
  assert.equal(v.resteAVerser, 0);
  assert.equal(v.enTrop, 79.8);
});

test('debut de mois : les charges fixes passent avant, jamais negatif, pas d alerte', () => {
  const v = G.jePeuxMeVerser(ctx(avecSoldes(base())), '2026-11', '2026-11-02');
  assert.equal(v.rapporte, -10);
  assert.equal(v.total, 0);
  assert.equal(v.statut, null);
});

test('verdict OK / Tendu sur un mois termine', () => {
  const d = avecSoldes(base(), 9000);
  d.reglages.besoinMensuel = 300;
  assert.equal(G.jePeuxMeVerser(ctx(d), '2026-10', '2026-11-02').statut, 'ok');
  d.reglages.besoinMensuel = 400;
  assert.equal(G.jePeuxMeVerser(ctx(d), '2026-10', '2026-11-02').statut, 'tendu');
});

test('la charge annuelle compte dans son mois', () => {
  const m = G.moisPro(ctx(base()), '2026-07');
  assert.ok(m.postes.some(p => p.libelle === 'Taxe annuelle' && p.montant === 300));
});

test('a declarer : chaque mois porte sa propre declaration, le reste non declare a titre d info', () => {
  const d = base();
  const a0 = G.aDeclarer(ctx(d), '2026-10');
  assert.equal(a0.montant, 600);
  assert.equal(a0.dateLimite, '2026-11-30');
  assert.equal(a0.resteNonDeclare, 0);
  d.gestion.mois['2026-10'] = { caDeclare: 450 };
  const a = G.aDeclarer(ctx(d), '2026-10');
  assert.equal(a.declare, 450);
  assert.equal(a.resteNonDeclare, 150);
  assert.equal(a.cotisationsCorrespondantes, 32.1);
  assert.equal(G.aDeclarer(ctx(d), '2026-11').declare, null, 'le mois suivant ne reprend pas la declaration d octobre');
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

// Google Ads d'octobre (60 €) depense en deux jours
const ADS_JOURS = { '2026-10-05': 20, '2026-10-20': 40 };

test('courbe du mois : chaque montant le jour ou il arrive, le dernier point = ce que le mois a rapporte', () => {
  const d = base();
  const c = G.courbeDuMois(G.contexte(d.appData, d.gestion, d.reglages, d.ads, ADS_JOURS), '2026-10', '2026-11-02');
  assert.equal(c.jours.length, 31);
  // 1er : carte 80 (- 21,4 % URSSAF - 1,40 commission) - banque 10
  assert.equal(c.valeurs[0], 51.48);
  // 2 et 3 : liquide 420 et virement 100, nets d'URSSAF
  assert.equal(c.valeurs[2], 460.2);
  assert.equal(c.valeurs[4], 440.2);  // Google Ads du 5
  assert.equal(c.valeurs[7], 410.2);  // loyer du 8
  assert.equal(c.valeurs[30], 320.2); // = ce qu'il reste en octobre
});

test('courbe du mois en cours : s arrete aujourd hui, ce qui est date plus tard tombe aujourd hui', () => {
  const d = base();
  const c = G.courbeDuMois(G.contexte(d.appData, d.gestion, d.reglages, d.ads, ADS_JOURS), '2026-10', '2026-10-10');
  assert.equal(c.valeurs[9], 320.2);
  assert.equal(c.valeurs[10], null);
});

test('courbe du mois : ce que je me verse la fait descendre, jusque dans le rouge', () => {
  const d = base();
  d.gestion.mouvements = [
    { id: 'm1', date: '2026-10-15', espace: 'pro', sens: 'transfert', compte: 'pro', compteVers: 'perso', montant: 300 },
    { id: 'm2', date: '2026-11-03', espace: 'pro', sens: 'transfert', compte: 'pro', compteVers: 'perso', montant: 100, moisConcerne: '2026-10' }
  ];
  const c = G.courbeDuMois(G.contexte(d.appData, d.gestion, d.reglages, d.ads, ADS_JOURS), '2026-10', '2026-11-05');
  assert.equal(c.valeurs[14], 110.2);  // 410,20 - 300
  assert.equal(c.valeurs[30], -79.8);  // 320,20 - 400 : dans le rouge
  // debut de mois : les charges fixes passent avant
  const nov = G.courbeDuMois(ctx(d), '2026-11', '2026-11-02');
  assert.deepEqual(nov.valeurs.slice(0, 3), [-10, -10, null]);
});
