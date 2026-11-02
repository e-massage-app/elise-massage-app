// ===== GESTION : CALCULS (v1.1.0.4) =====
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
  compteUrssaf: 'pro',
  jourUrssaf: 4,          // l'URSSAF du mois M part entre le 2 et le 4 du mois M+2 : le plus tard par prudence
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
  // « || 0 » : jamais de -0 (affiche « -0 € »)
  return Math.round((Number(n) || 0) * 100) / 100 || 0;
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
 * Dates de prelevement (Jordan, 2026-11-02) : l'URSSAF du mois M part entre le 2 et le 4 du mois
 * M+2 (reglage jourUrssaf, ou date confirmee avec un releve : corrections.urssafLe) ; Google Ads
 * le 1er du mois suivant.
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
  if (t.urssaf) flux.push({ date: datePrelevementUrssaf(ctx, mois), compte: R.compteUrssaf || 'pro', montant: -t.urssaf, espace: 'pro', type: 'frais', categorie: 'URSSAF', libelle: '', moisConcerne: mois, source: 'calcul' });
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

/** Jour ou part l'URSSAF du mois : celui confirme avec un releve, sinon le jourUrssaf du mois M+2. */
function datePrelevementUrssaf(ctx, mois) {
  const confirme = ctx.gestion.mois[mois]?.corrections?.urssafLe;
  if (confirme) return _Enc.jourDe(confirme);
  const jour = Math.min(28, Math.max(1, Math.round(Number(ctx.reglages.jourUrssaf) || 4)));
  return jourDuMois(_Enc.decalerMois(mois, 2), jour);
}

/**
 * Un releve du compte qui paie l'URSSAF, saisi entre le 1er et le jour de prelevement suppose :
 * impossible de savoir si l'URSSAF d'il y a deux mois est deja passee. On le demande.
 * Retourne { mois, montant, dateSupposee } ou null.
 */
function urssafAConfirmer(ctx, compte, date) {
  const R = ctx.reglages;
  if (!date || compte !== (R.compteUrssaf || 'pro')) return null;
  const jour = _Enc.jourDe(date);
  const mois = _Enc.decalerMois(jour.slice(0, 7), -2);
  if (ctx.gestion.mois[mois]?.corrections?.urssafLe) return null;
  const dateSupposee = datePrelevementUrssaf(ctx, mois);
  if (jour > dateSupposee) return null;
  const montant = totauxPro(ctx, mois).urssaf;
  return montant > 0 ? { mois, montant, dateSupposee } : null;
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
  return { ...t, postes, frais, reste: arrondi(t.encaisse - frais), pourMoi: pourMoi(ctx, mois) };
}

/** Mois auquel un mouvement saisi est rattache : celui choisi a la saisie, sinon celui de sa date. */
function moisDuMouvement(mv) {
  return mv.moisConcerne || _Enc.jourDe(mv.date).slice(0, 7);
}

/**
 * Ce qu'elle a pris pour elle au titre du mois : virements vers le perso + depenses perso payees
 * avec l'argent pro. Un salaire d'octobre vire le 3 novembre compte pour octobre (moisConcerne).
 */
/** De l'argent pro qui part pour moi : virement vers le perso ou l'epargne, depense perso payee avec le pro. */
function estPourMoi(mv) {
  return (mv.sens === 'transfert' && COMPTES_RESERVE.includes(mv.compte) && !COMPTES_RESERVE.includes(mv.compteVers))
    || (mv.sens === 'sortie' && mv.espace === 'perso' && COMPTES_RESERVE.includes(mv.compte));
}

function pourMoi(ctx, mois) {
  let total = 0;
  const lignes = [];
  const prendre = (mv, m, source) => { total += m; lignes.push({ ...mv, montant: m, source }); };
  const infoMois = ctx.gestion.mois[mois] || {};

  (ctx.gestion.mouvements || []).forEach(mv => {
    if (moisDuMouvement(mv) === mois && estPourMoi(mv)) prendre(mv, Math.abs(Number(mv.montant) || 0), 'saisie');
  });
  (ctx.gestion.recurrents || []).filter(r => recurrentActif(r, mois) && estPourMoi({ ...r, sens: r.sens || 'sortie' })).forEach(r => {
    prendre({ ...r, libelle: r.nom }, montantRecurrent(r, infoMois), 'recurrent');
  });
  return { total: arrondi(total), lignes };
}

/** Ce qui est parti pour moi entre deux dates, a la vraie date (quel que soit le mois concerne). */
function sortiesPourMoiEntre(ctx, debut, fin) {
  const lignes = [];
  (ctx.gestion.mouvements || []).forEach(mv => {
    const d = _Enc.jourDe(mv.date);
    if (d >= debut && d <= fin && estPourMoi(mv)) lignes.push({ ...mv, date: d, montant: Math.abs(Number(mv.montant) || 0), source: 'saisie' });
  });
  for (let m = debut.slice(0, 7); m <= fin.slice(0, 7); m = _Enc.decalerMois(m, 1)) {
    if (`${m}-01` < debut) continue;
    (ctx.gestion.recurrents || []).filter(r => recurrentActif(r, m) && estPourMoi({ ...r, sens: r.sens || 'sortie' })).forEach(r => {
      lignes.push({ ...r, libelle: r.nom, date: `${m}-01`, montant: montantRecurrent(r, ctx.gestion.mois[m]), source: 'recurrent' });
    });
  }
  return { lignes, total: arrondi(lignes.reduce((s, l) => s + l.montant, 0)) };
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
  // L'URSSAF d'il y a deux mois peut encore partir apres le releve
  const moisDebut = _Enc.decalerMois(depuis.slice(0, 7), -2);
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

// ----- Ce que je peux me verser (a l'instantane) -----

/**
 * Ce qui est deja du mais pas encore sorti de la reserve au jour J : les frais du mois et du
 * deux mois precedents dates apres J (URSSAF prelevee entre le 2 et le 4 du mois M+2, Google Ads le 1er,
 * commission carte en fin de mois). L'URSSAF payee depuis l'epargne n'y est pas.
 */
function aPayer(ctx, mois, jour) {
  const lignes = [];
  [_Enc.decalerMois(mois, -2), _Enc.decalerMois(mois, -1), mois].forEach(m => {
    fluxConcernant(ctx, m)
      .filter(f => f.type === 'frais' && COMPTES_RESERVE.includes(f.compte) && f.date > jour)
      .forEach(f => lignes.push({
        libelle: f.source === 'calcul' || f.source === 'google' ? `${f.categorie} ${deMois(m)}` : [f.categorie, f.libelle].filter(Boolean).join(' · '),
        categorie: f.categorie,
        montant: arrondi(-f.montant),
        date: f.date
      }));
  });
  return { lignes, total: arrondi(lignes.reduce((s, l) => s + l.montant, 0)) };
}

/**
 * Ma reserve « a l'instantane » au jour J (Jordan, 2026-11-02, comme Revolut) : compte pro + caisse,
 * moins ce qui est deja du mais pas encore preleve (URSSAF, Google Ads…). L'URSSAF d'octobre sort donc
 * de la reserve fin octobre, et novembre part de la : elle n'apparait pas une deuxieme fois.
 */
function reserveInstantanee(ctx, jour) {
  const comptes = reserve(ctx, jour);
  const du = aPayer(ctx, jour.slice(0, 7), jour);
  return {
    montant: comptes.montant === null ? null : arrondi(comptes.montant - du.total),
    comptes, du
  };
}

/**
 * Comment la reserve a bouge pendant le mois : reserve fin du mois precedent + ce que le mois a
 * rapporte − ce qui est parti pour moi (a la vraie date) = reserve fin du mois (ou aujourd'hui).
 * L'ecart restant vient des releves (mouvement non saisi, releve different de l'estimation).
 */
function bilanReserve(ctx, mois, aujourdhui) {
  const enCours = mois >= aujourdhui.slice(0, 7);
  const jour = enCours ? aujourdhui : _Enc.dernierJourDuMois(mois);
  const depart = reserveInstantanee(ctx, _Enc.dernierJourDuMois(_Enc.decalerMois(mois, -1)));
  const arrivee = reserveInstantanee(ctx, jour);
  const rapporte = moisPro(ctx, mois).reste;
  const verses = sortiesPourMoiEntre(ctx, `${mois}-01`, jour);
  const ecart = depart.montant === null || arrivee.montant === null ? null
    : arrondi(arrivee.montant - depart.montant - rapporte + verses.total);
  return { mois, jour, enCours, depart: depart.montant, arrivee: arrivee.montant, rapporte, verses, ecart };
}

/**
 * Ce que le mois me permet de me verser, recalcule a chaque paiement et a chaque frais
 * (Jordan, 2026-11-02) : ce que le mois a rapporte jusqu'ici (encaisse − tous ses frais),
 * reduit seulement si la reserve passerait sous le matelas une fois paye ce qui est deja du.
 * Le reste a declarer (lissage) n'est PAS retire. Jamais negatif.
 * Le verdict OK / Tendu / Alerte n'existe que pour un mois termine : en debut de mois,
 * les charges fixes sont deja comptees et le chiffre part forcement de zero.
 */
function jePeuxMeVerser(ctx, mois, aujourdhui) {
  const R = ctx.reglages;
  const enCours = mois >= aujourdhui.slice(0, 7);
  const jour = enCours ? aujourdhui : _Enc.dernierJourDuMois(mois);
  const rapporte = moisPro(ctx, mois).reste;

  const verse = pourMoi(ctx, mois);
  // Les versements deja sortis de la reserve a cette date (ceux d'apres n'y sont pas encore)
  const versesAvant = arrondi(verse.lignes
    .filter(l => l.source === 'recurrent' || _Enc.jourDe(l.date) <= jour)
    .reduce((s, l) => s + l.montant, 0));

  const res = reserveInstantanee(ctx, jour);
  const matelas = nombreOuNull(R.matelas) || 0;
  const marge = res.montant === null ? null : arrondi(res.montant - matelas);

  const plafond = Math.max(0, rapporte);
  const total = arrondi(marge === null ? plafond : Math.max(0, Math.min(plafond, versesAvant + Math.max(0, marge))));
  const resteAVerser = arrondi(Math.max(0, total - verse.total));

  const besoin = nombreOuNull(R.besoinMensuel);
  let statut = null;
  if (!enCours && besoin) {
    if (total >= besoin) statut = 'ok';
    else if (total >= besoin * (Number(R.seuilTendu) || 0) / 100) statut = 'tendu';
    else statut = 'alerte';
  }

  // Verse pour ce mois mais sorti de la reserve apres J (ex. le 3 novembre pour octobre)
  const versesApres = arrondi(verse.total - versesAvant);
  // Le salaire du mois pas encore sorti a cette date : « si je me verse », jamais retire d'office
  const salaireApres = arrondi(versesApres + resteAVerser);

  return {
    mois, enCours, jour, rapporte,
    verse: verse.total, versements: verse.lignes, versesAvant, versesApres,
    comptes: res.comptes.montant, reserve: res.montant, reserveIncomplete: res.comptes.incomplet,
    aPayer: res.du.lignes, totalAPayer: res.du.total,
    matelas, marge, total, resteAVerser, salaireApres,
    enTrop: arrondi(Math.max(0, verse.total - total)),
    limiteParMatelas: marge !== null && total < plafond,
    reserveApres: res.montant === null ? null : arrondi(res.montant - salaireApres),
    besoin,
    progression: besoin ? Math.min(1, total / besoin) : null,
    statut
  };
}

// ----- A declarer (lissage : simple information, pas de cumul) -----

/**
 * Ce que le mois a encaisse et ce qui en a ete declare. Le mois porte sa propre declaration,
 * meme si elle se fait le mois suivant : rattachement « a l'instantane » (Jordan, 2026-11-02).
 */
function aDeclarer(ctx, mois) {
  const t = totauxPro(ctx, mois);
  const reste = t.declare !== null ? arrondi(t.encaisse - t.declare) : null;
  return {
    dateLimite: _Enc.dernierJourDuMois(_Enc.decalerMois(mois, 1)),
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

// ----- Courbe du mois, jour par jour -----

/**
 * « Ce qu'il me reste » chaque jour du mois : ce que les clientes ont paye − les frais du mois
 * − ce que je me suis verse (Jordan, 2026-11-02). Chaque montant tombe le jour ou il arrive :
 * charges fixes le 1er (le mois commence donc sous zero), Google Ads au jour le jour (lu chez
 * Google), URSSAF et commission carte avec chaque paiement, au prorata du total du mois.
 * Un montant date apres le dernier jour trace tombe ce jour-la. Le dernier point vaut
 * exactement ce que le mois a rapporte moins ce qui est deja verse (corrections comprises).
 * Retourne { jours: ['YYYY-MM-DD'...] (tout le mois), valeurs: [nombre | null apres aujourd'hui] }.
 */
function courbeDuMois(ctx, mois, aujourdhui) {
  const debut = `${mois}-01`;
  const fin = _Enc.dernierJourDuMois(mois);
  const dernier = mois >= aujourdhui.slice(0, 7) ? aujourdhui : fin;
  const p = moisPro(ctx, mois);
  const verse = pourMoi(ctx, mois);
  const dansMois = d => d >= debut && d <= fin;

  const parJour = {};
  const ajouter = (date, montant) => {
    const j = !date || date > dernier ? dernier : date < debut ? debut : date;
    parJour[j] = (parJour[j] || 0) + montant;
  };

  // Paiements des clientes, nets de l'URSSAF et de la commission qu'ils entrainent
  const partUrssaf = p.encaisseCalcule ? p.urssaf / p.encaisseCalcule : 0;
  const partCarte = p.logiciel.carte ? p.commission / p.logiciel.carte : 0;
  _Enc.encaissementsEntre(ctx.appData, debut, fin).forEach(l => {
    ajouter(l.date, l.montant * (1 - partUrssaf) - (l.moyen === 'Carte bleue' ? l.montant * partCarte : 0));
  });
  (ctx.gestion.mouvements || [])
    .filter(mv => (mv.espace || 'pro') === 'pro' && mv.sens === 'entree' && dansMois(_Enc.jourDe(mv.date)))
    .forEach(mv => ajouter(_Enc.jourDe(mv.date), Math.abs(Number(mv.montant) || 0) * (1 - partUrssaf)));

  // Google Ads au jour le jour (une correction du mois est repartie au prorata)
  const jours = ctx.adsJours || {};
  const partAds = p.adsGoogle ? p.ads / p.adsGoogle : 0;
  Object.keys(jours).filter(dansMois).forEach(j => ajouter(j, -jours[j] * partAds));

  // Frais : charges fixes le 1er, depenses a leur date
  p.postes.forEach(po => {
    if (po.cle === 'urssaf' || po.cle === 'carte' || po.cle === 'ads') return;
    ajouter(po.source === 'fixe' ? debut : po.date, -(Number(po.montant) || 0));
  });

  // Ce que je me suis verse pour ce mois (un virement mensuel automatique compte le 1er)
  verse.lignes.forEach(l => ajouter(l.source === 'recurrent' ? debut : _Enc.jourDe(l.date), -l.montant));

  // Le reste (correction de l'encaisse, URSSAF sans encaissement, Ads sans detail par jour)
  const cible = arrondi(p.reste - verse.total);
  const somme = Object.values(parJour).reduce((s, m) => s + m, 0);
  if (Math.abs(cible - somme) > 0.004) ajouter(dernier, cible - somme);

  const liste = [];
  const valeurs = [];
  let cumul = 0;
  for (let n = 1; n <= Number(fin.slice(8, 10)); n++) {
    const j = jourDuMois(mois, n);
    liste.push(j);
    if (j > dernier) { valeurs.push(null); continue; }
    cumul += parJour[j] || 0;
    valeurs.push(arrondi(cumul));
  }
  return { mois, jours: liste, valeurs, dernier };
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

function contexte(appData, gestion, reglages, ads, adsJours) {
  return {
    appData: appData || {},
    gestion: {
      mouvements: gestion?.mouvements || [],
      recurrents: gestion?.recurrents || [],
      mois: gestion?.mois || {},
      soldes: gestion?.soldes || []
    },
    reglages: reglagesComplets(reglages),
    ads: ads || null,
    adsJours: adsJours || null
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
  moisDuMouvement,
  sortiesPourMoiEntre,
  soldeCompte,
  reserve,
  aPayer,
  datePrelevementUrssaf,
  urssafAConfirmer,
  reserveInstantanee,
  bilanReserve,
  jePeuxMeVerser,
  aDeclarer,
  moisPerso,
  courbeDuMois,
  nomMois,
  deMois,
  queMois,
  jourDuMois
};

racine.GestionCalculs = GestionCalculs;
if (typeof module !== 'undefined' && module.exports) module.exports = GestionCalculs;

})(typeof window !== 'undefined' ? window : globalThis);
