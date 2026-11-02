// ===== GESTION : CALCULS (v1.1.0.0) =====
// Fonctions pures : ni DOM, ni Supabase, ni date du jour implicite (on la passe).
// Testees sous Node : tests/gestion-calculs.test.js.
//
// Vocabulaire d'Elise, pas de jargon comptable :
//  - « encaisse »      : ce que les clientes ont paye (regle commune Encaissements)
//  - « reste »         : ce qu'il reste apres les frais du mois
//  - « reserve »       : compte pro + caisse especes
//  - « pour moi »      : ce qu'elle prend pour elle (virement vers le perso,
//                        depenses perso payees avec l'argent pro)
// Montants : toujours positifs dans les donnees ; le sens (entree / sortie /
// transfert) donne la direction. Ici, un flux porte un montant signe.

(function (racine) {

const _Enc = racine.Encaissements || require('../core/encaissements.js');

const COMPTES = {
  pro: 'Compte pro',
  caisse: 'Caisse (espèces)',
  perso: 'Compte perso',
  epargne: 'Épargne'
};
const COMPTES_RESERVE = ['pro', 'caisse'];

// Valeurs generiques uniquement : le depot est public, les montants et les
// categories personnelles d'Elise se saisissent dans l'ecran Reglages.
const REGLAGES_DEFAUT = {
  tauxUrssaf: 21.4,
  tauxCarte: 1.75,
  matelas: null,
  besoinMensuel: null,
  seuilTendu: 70,
  moyenneSur: 1,
  compteUrssaf: 'pro',
  compteParCategorie: { Loyer: 'caisse' },
  inclureTransport: false,
  categories: {
    proEntree: ['Prestation hors logiciel', 'Retraite / événement', 'Autre encaissement'],
    proSortie: ['Consommables', 'Matériel / déco', 'Formation', 'Assurance pro', 'Loyer cabine', 'Banque', 'Autre frais'],
    persoEntree: ['Salaire', 'Aides', 'Remboursement', 'Autre revenu'],
    persoFixe: ['Logement', 'Assurance', 'Crédit', 'Téléphone / internet', 'Abonnements', 'Mutuelle', 'Autre charge fixe'],
    persoVariable: ['Courses', 'Essence', 'Restaurant', 'Santé & pharmacie', 'Loisirs', 'Beauté & vêtements', 'Maison', 'Cadeaux', 'Vacances', 'Retraits', 'Divers'],
    epargne: ['Compte épargne', 'Projets', 'Vacances', 'Imprévus']
  }
};

function arrondi(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function nombreOuNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function reglagesComplets(r) {
  const base = JSON.parse(JSON.stringify(REGLAGES_DEFAUT));
  if (!r) return base;
  const fusion = { ...base, ...r };
  fusion.compteParCategorie = { ...base.compteParCategorie, ...(r.compteParCategorie || {}) };
  fusion.categories = { ...base.categories, ...(r.categories || {}) };
  return fusion;
}

function jourDuMois(mois, jour) {
  return `${mois}-${String(jour).padStart(2, '0')}`;
}

// ----- Lignes recurrentes -----

/** Une ligne recurrente s'applique-t-elle au mois 'YYYY-MM' ? */
function recurrentActif(rec, mois) {
  if (!rec || !rec.debut || mois < rec.debut) return false;
  if (rec.fin && mois > rec.fin) return false;
  if (rec.frequence === 'annuelle') {
    return Number(mois.slice(5, 7)) === Number(rec.moisAnnuel);
  }
  return true;
}

/** Montant d'une ligne recurrente pour un mois, apres correction eventuelle. */
function montantRecurrent(rec, infoMois) {
  const corr = nombreOuNull(infoMois?.corrections?.[`rec:${rec.id}`]);
  return corr !== null ? corr : (Number(rec.montant) || 0);
}

// ----- Flux : tout ce qui entre et sort des comptes -----

function compteDuMoyen(moyen) {
  return moyen === 'Liquide' ? 'caisse' : 'pro';
}

function estEstimationKilometrique(d) {
  return d.categorie === 'Transport' && /kilom/i.test(d.fournisseur || '');
}

/**
 * Tous les flux qui CONCERNENT le mois (rattachement), avec leur vraie date.
 * L'URSSAF et Google Ads d'un mois sont dates au mois suivant (prelevement).
 * Chaque flux : { date, compte, montant (signe), espace, type, categorie, libelle, moisConcerne, source }
 * type : encaissement | frais | transfert | revenu | depense
 */
function fluxConcernant(ctx, mois) {
  const R = ctx.reglages;
  const infoMois = ctx.gestion.mois[mois] || {};
  const debut = `${mois}-01`;
  const fin = _Enc.dernierJourDuMois(mois);
  const suivant = _Enc.decalerMois(mois, 1);
  const flux = [];
  const dansMois = d => d >= debut && d <= fin;

  // 1. Encaissements du logiciel (regle commune)
  _Enc.encaissementsEntre(ctx.appData, debut, fin).forEach(l => {
    flux.push({ date: l.date, compte: compteDuMoyen(l.moyen), montant: l.montant, espace: 'pro', type: 'encaissement', categorie: l.moyen, libelle: '', moisConcerne: mois, source: 'logiciel' });
  });

  // 2. Frais calcules : commission carte, URSSAF, Google Ads
  const t = totauxPro(ctx, mois);
  if (t.commission) flux.push({ date: fin, compte: 'pro', montant: -t.commission, espace: 'pro', type: 'frais', categorie: 'Commission carte', libelle: '', moisConcerne: mois, source: 'calcul' });
  if (t.urssaf) flux.push({ date: _Enc.dernierJourDuMois(suivant), compte: R.compteUrssaf || 'pro', montant: -t.urssaf, espace: 'pro', type: 'frais', categorie: 'URSSAF', libelle: '', moisConcerne: mois, source: 'calcul' });
  if (t.ads) flux.push({ date: `${suivant}-01`, compte: 'pro', montant: -t.ads, espace: 'pro', type: 'frais', categorie: 'Google Ads', libelle: '', moisConcerne: mois, source: 'google' });

  // 3. Depenses du logiciel (hors estimations kilometriques)
  depensesLogiciel(ctx, mois).forEach(d => {
    flux.push({ date: d.date, compte: d.compte, montant: -d.montant, espace: 'pro', type: 'frais', categorie: d.categorie, libelle: d.libelle, moisConcerne: mois, source: 'logiciel' });
  });

  // 4. Lignes recurrentes (charges fixes, revenus fixes, epargne programmee)
  (ctx.gestion.recurrents || []).filter(r => recurrentActif(r, mois)).forEach(r => {
    const m = montantRecurrent(r, infoMois);
    if (!m) return;
    pousserMouvement(flux, { ...r, date: debut, libelle: r.nom, montant: m }, mois, 'recurrent');
  });

  // 5. Mouvements saisis a la main
  (ctx.gestion.mouvements || []).filter(mv => dansMois(_Enc.jourDe(mv.date))).forEach(mv => {
    pousserMouvement(flux, mv, mv.moisConcerne || mois, 'saisie');
  });

  return flux;
}

function pousserMouvement(flux, mv, moisConcerne, source) {
  const m = Math.abs(Number(mv.montant) || 0);
  const base = { date: _Enc.jourDe(mv.date), espace: mv.espace || 'pro', categorie: mv.categorie || '', libelle: mv.libelle || '', moisConcerne, source, id: mv.id };
  if (mv.sens === 'transfert') {
    flux.push({ ...base, compte: mv.compte, montant: -m, type: 'transfert', vers: mv.compteVers });
    if (mv.compteVers) flux.push({ ...base, compte: mv.compteVers, montant: m, type: 'transfert', depuis: mv.compte });
  } else if (mv.sens === 'entree') {
    flux.push({ ...base, compte: mv.compte, montant: m, type: base.espace === 'pro' ? 'encaissement' : 'revenu' });
  } else {
    flux.push({ ...base, compte: mv.compte, montant: -m, type: base.espace === 'pro' ? 'frais' : 'depense' });
  }
}

function depensesLogiciel(ctx, mois) {
  const R = ctx.reglages;
  return (ctx.appData.depenses || [])
    .filter(d => _Enc.moisDe(d.date) === mois)
    .filter(d => R.inclureTransport || !estEstimationKilometrique(d))
    .map(d => ({
      date: _Enc.jourDe(d.date),
      montant: Number(d.montant) || 0,
      categorie: d.categorie || 'Autre',
      libelle: d.abonnementNom || d.fournisseur || d.description || '',
      compte: R.compteParCategorie[d.categorie] || 'pro'
    }));
}

// ----- Le mois pro : encaisse, frais, reste -----

/**
 * Totaux pro d'un mois. Chaque chiffre calcule peut etre remplace par une
 * correction saisie a la main (gestion_mois.corrections) ; on garde les deux.
 */
function totauxPro(ctx, mois) {
  const R = ctx.reglages;
  const infoMois = ctx.gestion.mois[mois] || {};
  const corr = infoMois.corrections || {};
  const debut = `${mois}-01`;
  const fin = _Enc.dernierJourDuMois(mois);

  const logiciel = _Enc.encaisseDuMois(ctx.appData, mois);
  const saisies = (ctx.gestion.mouvements || [])
    .filter(mv => (mv.espace || 'pro') === 'pro' && mv.sens === 'entree')
    .filter(mv => { const d = _Enc.jourDe(mv.date); return d >= debut && d <= fin; })
    .reduce((s, mv) => s + Math.abs(Number(mv.montant) || 0), 0);

  const encaisseCalcule = arrondi(logiciel.total + saisies);
  const encaisseCorrige = nombreOuNull(corr.ca);
  const encaisse = encaisseCorrige !== null ? encaisseCorrige : encaisseCalcule;

  const declare = nombreOuNull(infoMois.caDeclare);
  const urssafCalcule = arrondi((declare !== null ? declare : encaisse) * R.tauxUrssaf / 100);
  const urssaf = nombreOuNull(corr.urssaf) ?? urssafCalcule;

  const commissionCalculee = arrondi(logiciel.carte * R.tauxCarte / 100);
  const commission = nombreOuNull(corr.carte) ?? commissionCalculee;

  const adsGoogle = ctx.ads ? nombreOuNull(ctx.ads[mois]) : null;
  const ads = nombreOuNull(corr.ads) ?? (adsGoogle ?? 0);

  return {
    mois,
    logiciel,
    saisies: arrondi(saisies),
    encaisseCalcule,
    encaisseCorrige,
    encaisse,
    declare,
    urssafCalcule,
    urssaf,
    commissionCalculee,
    commission,
    adsGoogle,
    ads,
    adsInconnu: adsGoogle === null && nombreOuNull(corr.ads) === null
  };
}

/** Le detail des frais pro d'un mois, par poste, et ce qu'il reste. */
function moisPro(ctx, mois) {
  const t = totauxPro(ctx, mois);
  const infoMois = ctx.gestion.mois[mois] || {};
  const postes = [];
  postes.push({ cle: 'urssaf', libelle: 'URSSAF', montant: t.urssaf, calcule: t.urssafCalcule, corrigeable: true });
  postes.push({ cle: 'carte', libelle: 'Commission carte', montant: t.commission, calcule: t.commissionCalculee, corrigeable: true });
  postes.push({ cle: 'ads', libelle: 'Google Ads', montant: t.ads, calcule: t.adsGoogle, corrigeable: true, inconnu: t.adsInconnu });

  depensesLogiciel(ctx, mois).forEach(d => {
    postes.push({ cle: null, libelle: d.libelle ? `${d.categorie} · ${d.libelle}` : d.categorie, categorie: d.categorie, montant: d.montant, source: 'logiciel', date: d.date });
  });

  (ctx.gestion.recurrents || [])
    .filter(r => (r.espace || 'pro') === 'pro' && (r.sens || 'sortie') === 'sortie' && recurrentActif(r, mois))
    .forEach(r => {
      postes.push({ cle: `rec:${r.id}`, libelle: r.nom, categorie: r.categorie, montant: montantRecurrent(r, infoMois), calcule: Number(r.montant) || 0, corrigeable: true, source: 'fixe', ref: r });
    });

  const debut = `${mois}-01`;
  const fin = _Enc.dernierJourDuMois(mois);
  (ctx.gestion.mouvements || [])
    .filter(mv => (mv.espace || 'pro') === 'pro' && mv.sens === 'sortie')
    .filter(mv => { const d = _Enc.jourDe(mv.date); return d >= debut && d <= fin; })
    .forEach(mv => postes.push({ cle: null, libelle: mv.libelle || mv.categorie || 'Frais', categorie: mv.categorie, montant: Math.abs(Number(mv.montant) || 0), source: 'saisie', ref: mv, date: _Enc.jourDe(mv.date) }));

  const frais = arrondi(postes.reduce((s, p) => s + (Number(p.montant) || 0), 0));
  return { ...t, postes, frais, reste: arrondi(t.encaisse - frais), pourMoi: pourMoi(ctx, mois), cloture: !!infoMois.clotureLe };
}

/** Ce qu'elle a pris pour elle ce mois-ci : virements vers le perso + depenses perso payees avec l'argent pro. */
function pourMoi(ctx, mois) {
  const debut = `${mois}-01`;
  const fin = _Enc.dernierJourDuMois(mois);
  let total = 0;
  const lignes = [];
  const prendre = (mv, m, source) => { total += m; lignes.push({ ...mv, montant: m, source }); };
  const infoMois = ctx.gestion.mois[mois] || {};

  (ctx.gestion.mouvements || []).forEach(mv => {
    const d = _Enc.jourDe(mv.date);
    if (d < debut || d > fin) return;
    const m = Math.abs(Number(mv.montant) || 0);
    if (mv.sens === 'transfert' && COMPTES_RESERVE.includes(mv.compte) && !COMPTES_RESERVE.includes(mv.compteVers)) prendre(mv, m, 'saisie');
    else if (mv.sens === 'sortie' && mv.espace === 'perso' && COMPTES_RESERVE.includes(mv.compte)) prendre(mv, m, 'saisie');
  });
  (ctx.gestion.recurrents || []).filter(r => recurrentActif(r, mois)).forEach(r => {
    if (r.sens === 'transfert' && COMPTES_RESERVE.includes(r.compte) && !COMPTES_RESERVE.includes(r.compteVers)) {
      prendre({ ...r, libelle: r.nom }, montantRecurrent(r, infoMois), 'recurrent');
    }
  });
  return { total: arrondi(total), lignes };
}

// ----- Comptes : soldes recopies + estimation entre deux saisies -----

/**
 * Solde d'un compte a la fin du jour J ('YYYY-MM-DD').
 * Part du dernier solde recopie (date <= J), ajoute les flux dates apres lui.
 * Retourne { montant, depuis (date du solde recopie), estime } ou montant null si aucun solde connu.
 */
function soldeCompte(ctx, compte, jour) {
  const releves = (ctx.gestion.soldes || [])
    .filter(s => s.compte === compte && _Enc.jourDe(s.date) <= jour)
    .sort((a, b) => _Enc.jourDe(a.date).localeCompare(_Enc.jourDe(b.date)) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  const releve = releves[releves.length - 1];
  if (!releve) return { montant: null, depuis: null, estime: false };

  const depuis = _Enc.jourDe(releve.date);
  let montant = Number(releve.montant) || 0;
  const moisDebut = _Enc.decalerMois(depuis.slice(0, 7), -1);
  const moisFin = jour.slice(0, 7);
  // « estime » des qu'un flux a ete ajoute, meme si leur somme vaut 0
  let flux = 0;
  let nombre = 0;
  for (let m = moisDebut; m <= moisFin; m = _Enc.decalerMois(m, 1)) {
    fluxConcernant(ctx, m).forEach(f => {
      if (f.compte === compte && f.date > depuis && f.date <= jour) { flux += f.montant; nombre++; }
    });
  }
  return { montant: arrondi(montant + flux), depuis, estime: nombre > 0 };
}

function reserve(ctx, jour) {
  const parts = COMPTES_RESERVE.map(c => ({ compte: c, ...soldeCompte(ctx, c, jour) }));
  const connu = parts.some(p => p.montant !== null);
  return {
    montant: connu ? arrondi(parts.reduce((s, p) => s + (p.montant || 0), 0)) : null,
    parts,
    incomplet: parts.some(p => p.montant === null)
  };
}

// ----- Ce que je peux me verser -----

function dernierMoisCloture(ctx, avant) {
  return Object.keys(ctx.gestion.mois)
    .filter(m => m < avant && ctx.gestion.mois[m]?.clotureLe)
    .sort()
    .pop() || null;
}

/**
 * Calcul sur le dernier mois cloture avant `mois` (sinon le mois precedent, provisoire).
 * Reserve fin de mois − URSSAF a payer − facture Google Ads a venir − charges annuelles du mois
 * suivant − matelas ; plafonne a ce que le mois a rapporte (ou la moyenne des N derniers) ; >= 0.
 * Le reste a declarer (lissage) n'est PAS retire (decision du 2026-11-02).
 */
function jePeuxMeVerser(ctx, mois) {
  const R = ctx.reglages;
  const cloture = dernierMoisCloture(ctx, mois);
  const base = cloture || _Enc.decalerMois(mois, -1);
  const provisoire = !cloture || base !== _Enc.decalerMois(mois, -1);
  const finBase = _Enc.dernierJourDuMois(base);
  const res = reserve(ctx, finBase);

  const pro = moisPro(ctx, base);
  const suivant = _Enc.decalerMois(base, 1);
  const urssafDue = COMPTES_RESERVE.includes(R.compteUrssaf || 'pro') ? pro.urssaf : 0;
  const annuelles = (ctx.gestion.recurrents || [])
    .filter(r => r.frequence === 'annuelle' && (r.sens || 'sortie') === 'sortie' && COMPTES_RESERVE.includes(r.compte) && recurrentActif(r, suivant))
    .map(r => ({ nom: r.nom, montant: montantRecurrent(r, ctx.gestion.mois[suivant]) }));
  const dettes = [
    { libelle: `URSSAF ${deMois(base)}`, montant: urssafDue },
    { libelle: `Google Ads ${deMois(base)}`, montant: pro.ads },
    ...annuelles.map(a => ({ libelle: a.nom, montant: a.montant }))
  ].filter(d => d.montant);
  const totalDettes = arrondi(dettes.reduce((s, d) => s + d.montant, 0));
  const matelas = nombreOuNull(R.matelas) || 0;

  const n = Math.max(1, Number(R.moyenneSur) || 1);
  const moisPlafond = _Enc.derniersMois(base, n);
  const plafond = arrondi(moisPlafond.reduce((s, m) => s + moisPro(ctx, m).reste, 0) / n);

  const marge = res.montant === null ? null : arrondi(res.montant - totalDettes - matelas);
  const recommande = marge === null ? null : arrondi(Math.max(0, Math.min(marge, plafond)));

  const besoin = nombreOuNull(R.besoinMensuel);
  let statut = null;
  if (recommande !== null && besoin) {
    if (recommande >= besoin) statut = 'ok';
    else if (recommande >= besoin * (Number(R.seuilTendu) || 0) / 100) statut = 'tendu';
    else statut = 'alerte';
  }

  return { base, provisoire, reserve: res.montant, reserveIncomplete: res.incomplet, dettes, totalDettes, matelas, marge, plafond, moisPlafond, recommande, besoin, statut, dejaPris: pourMoi(ctx, mois).total };
}

// ----- A declarer (lissage : simple information, pas de cumul) -----

function aDeclarer(ctx, mois) {
  const precedent = _Enc.decalerMois(mois, -1);
  const t = totauxPro(ctx, precedent);
  const reste = t.declare !== null ? arrondi(t.encaisse - t.declare) : null;
  return {
    moisConcerne: precedent,
    montant: t.encaisse,
    declare: t.declare,
    resteNonDeclare: reste !== null && reste > 0 ? reste : 0,
    cotisationsCorrespondantes: reste !== null && reste > 0 ? arrondi(reste * ctx.reglages.tauxUrssaf / 100) : 0
  };
}

// ----- Le mois perso -----

function moisPerso(ctx, mois) {
  const flux = fluxConcernant(ctx, mois).filter(f => f.date.slice(0, 7) === mois || f.source === 'recurrent');
  const revenus = flux.filter(f => (f.compte === 'perso' && f.montant > 0 && f.type !== 'transfert') || (f.type === 'transfert' && f.compte === 'perso' && f.montant > 0 && COMPTES_RESERVE.includes(f.depuis)));
  const fixes = flux.filter(f => f.espace === 'perso' && f.source === 'recurrent' && f.type === 'depense');
  const variables = flux.filter(f => f.espace === 'perso' && f.source === 'saisie' && f.type === 'depense');
  const epargne = flux.filter(f => f.type === 'transfert' && f.compte === 'epargne' && f.montant > 0);

  const somme = l => arrondi(l.reduce((s, f) => s + Math.abs(f.montant), 0));
  const parCategorie = {};
  variables.forEach(f => { parCategorie[f.categorie || 'Divers'] = arrondi((parCategorie[f.categorie || 'Divers'] || 0) + Math.abs(f.montant)); });

  const jours = Number(_Enc.dernierJourDuMois(mois).slice(8, 10));
  const totalRevenus = somme(revenus);
  const totalFixes = somme(fixes);
  const totalVariables = somme(variables);
  const totalEpargne = somme(epargne);
  return {
    mois,
    revenus, fixes, variables, epargne, parCategorie,
    totalRevenus, totalFixes, totalVariables, totalEpargne,
    resteAVivreJour: arrondi((totalRevenus - totalFixes - totalEpargne) / jours)
  };
}

// ----- Courbe et projection -----

/** Mois de fin de la projection : mai (fin du printemps) de cette annee ou de la suivante. */
function moisFinProjection(mois) {
  const annee = Number(mois.slice(0, 4));
  const finCetteAnnee = `${annee}-05`;
  return mois <= finCetteAnnee ? (mois === finCetteAnnee ? `${annee + 1}-05` : finCetteAnnee) : `${annee + 1}-05`;
}

function premierMoisAvecDonnees(appData) {
  const dates = (appData.prestations || []).map(p => _Enc.moisDe(p.date)).filter(Boolean).sort();
  return dates[0] || null;
}

/**
 * Reserve a la fin de chacun des 12 derniers mois (null avant le premier solde
 * recopie), puis projection jusqu'au printemps.
 * Projection d'un mois : reserve du mois d'avant
 *   + encaisse du meme mois l'an dernier (l'activite suit les saisons ;
 *     a defaut, la moyenne des 12 derniers mois)
 *   − URSSAF et commission carte sur ce montant
 *   − moyenne des frais (Google Ads, depenses du logiciel) des 3 derniers mois
 *   − charges fixes pro du mois (dont annuelles, ex. CFE)
 *   − ce qu'elle se verse (virement recurrent vers le perso, sinon son besoin mensuel).
 */
function courbeReserve(ctx, aujourdhui) {
  const R = ctx.reglages;
  const moisCourant = aujourdhui.slice(0, 7);
  const passes = _Enc.derniersMois(_Enc.decalerMois(moisCourant, -1), 12);
  const points = passes.map(m => ({ mois: m, reserve: reserve(ctx, _Enc.dernierJourDuMois(m)).montant, type: 'passe' }));
  const actuel = reserve(ctx, aujourdhui).montant;
  points.push({ mois: moisCourant, reserve: actuel, type: 'aujourdhui', jour: aujourdhui });

  const debutDonnees = premierMoisAvecDonnees(ctx.appData);
  const historique = _Enc.derniersMois(_Enc.decalerMois(moisCourant, -1), 12).filter(m => !debutDonnees || m >= debutDonnees);
  const moyenne12 = historique.length ? historique.reduce((s, m) => s + _Enc.encaisseDuMois(ctx.appData, m).total, 0) / historique.length : 0;
  const recents = _Enc.derniersMois(_Enc.decalerMois(moisCourant, -1), 3);
  const fraisMoyens = recents.reduce((s, m) => {
    const t = totauxPro(ctx, m);
    return s + t.ads + depensesLogiciel(ctx, m).reduce((x, d) => x + d.montant, 0);
  }, 0) / recents.length;
  const totalCarte = historique.reduce((s, m) => s + _Enc.encaisseDuMois(ctx.appData, m).carte, 0);
  const totalEnc = historique.reduce((s, m) => s + _Enc.encaisseDuMois(ctx.appData, m).total, 0);
  const partCarte = totalEnc > 0 ? totalCarte / totalEnc : 0;

  const versementRecurrent = m => (ctx.gestion.recurrents || [])
    .filter(r => r.sens === 'transfert' && COMPTES_RESERVE.includes(r.compte) && !COMPTES_RESERVE.includes(r.compteVers) && recurrentActif(r, m))
    .reduce((s, r) => s + (Number(r.montant) || 0), 0);

  const projection = [];
  let courant = reserve(ctx, _Enc.dernierJourDuMois(_Enc.decalerMois(moisCourant, -1))).montant;
  const fin = moisFinProjection(moisCourant);
  if (courant !== null) {
    for (let m = moisCourant; m <= fin; m = _Enc.decalerMois(m, 1)) {
      const anDernier = _Enc.decalerMois(m, -12);
      const prevu = (debutDonnees && anDernier >= debutDonnees) ? _Enc.encaisseDuMois(ctx.appData, anDernier).total : moyenne12;
      const fixes = (ctx.gestion.recurrents || [])
        .filter(r => (r.espace || 'pro') === 'pro' && (r.sens || 'sortie') === 'sortie' && COMPTES_RESERVE.includes(r.compte) && recurrentActif(r, m))
        .reduce((s, r) => s + (Number(r.montant) || 0), 0);
      const versement = versementRecurrent(m) || nombreOuNull(R.besoinMensuel) || 0;
      const net = prevu * (1 - R.tauxUrssaf / 100 - partCarte * R.tauxCarte / 100) - fraisMoyens - fixes - versement;
      courant = arrondi(courant + net);
      projection.push({ mois: m, reserve: courant, prevu: arrondi(prevu), net: arrondi(net), type: 'projection' });
    }
  }
  return { points, projection, matelas: nombreOuNull(R.matelas), fin };
}

// ----- Libelles -----

const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function nomMois(mois, avecAnnee = false) {
  const nom = NOMS_MOIS[Number(mois.slice(5, 7)) - 1] || mois;
  return avecAnnee ? `${nom} ${mois.slice(0, 4)}` : nom;
}

/** « de novembre » / « d'octobre » (avril, aout, octobre commencent par une voyelle). */
function deMois(mois) {
  const nom = nomMois(mois);
  return /^[aeiouyàâéèêîôû]/i.test(nom) ? `d'${nom}` : `de ${nom}`;
}

/** « que novembre » / « qu'octobre ». */
function queMois(mois) {
  const nom = nomMois(mois);
  return /^[aeiouyàâéèêîôû]/i.test(nom) ? `qu'${nom}` : `que ${nom}`;
}

function contexte(appData, gestion, reglages, ads) {
  return {
    appData: appData || {},
    gestion: {
      mouvements: gestion?.mouvements || [],
      recurrents: gestion?.recurrents || [],
      mois: gestion?.mois || {},
      soldes: gestion?.soldes || []
    },
    reglages: reglagesComplets(reglages),
    ads: ads || null
  };
}

const GestionCalculs = {
  COMPTES,
  COMPTES_RESERVE,
  REGLAGES_DEFAUT,
  NOMS_MOIS,
  arrondi,
  nombreOuNull,
  reglagesComplets,
  contexte,
  recurrentActif,
  montantRecurrent,
  fluxConcernant,
  depensesLogiciel,
  totauxPro,
  moisPro,
  pourMoi,
  soldeCompte,
  reserve,
  dernierMoisCloture,
  jePeuxMeVerser,
  aDeclarer,
  moisPerso,
  courbeReserve,
  moisFinProjection,
  nomMois,
  deMois,
  queMois,
  jourDuMois
};

racine.GestionCalculs = GestionCalculs;
if (typeof module !== 'undefined' && module.exports) module.exports = GestionCalculs;

})(typeof window !== 'undefined' ? window : globalThis);
