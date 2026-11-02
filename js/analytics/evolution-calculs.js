// ===== ANALYTICS : EVOLUTION, CALCULS (v1.1.2.0) =====
// Graphique « Évolution » de la vue d'ensemble Analytics. Fonctions pures :
// ni DOM, ni DataManager, ni date du jour implicite (on la passe).
// Testees sous Node : tests/evolution-calculs.test.js.
//
//  - encaisse   : regle commune Encaissements, repartie par activite (groupe de
//                 soins) ; ventes et remboursements de cartes cadeaux a part
//  - pourboires : deja compris dans chaque activite, donnes seulement en detail
//  - frais      : les depenses de l'onglet Depenses, et elles seules (Google Ads
//                 et URSSAF sont comptes dans l'onglet Gestion)
//  - reste      : encaisse - frais
// Rien n'est compte apres aujourd'hui : un mois en cours s'arrete au jour present.

(function (racine) {

const Enc = racine.Encaissements || require('../core/encaissements.js');

const CARTES = 'Cartes cadeaux';
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function arrondi(n) {
  // « || 0 » : jamais de -0
  return Math.round((Number(n) || 0) * 100) / 100 || 0;
}

function deux(n) {
  return String(n).padStart(2, '0');
}

/** Meme jour, n annees plus tot ou plus tard (un 29 fevrier devient le 28). */
function decalerAnnee(jour, n) {
  const annee = Number(jour.slice(0, 4)) + n;
  const mois = jour.slice(5, 7);
  const j = Math.min(Number(jour.slice(8, 10)), Number(Enc.dernierJourDuMois(`${annee}-${mois}`).slice(8, 10)));
  return `${annee}-${mois}-${deux(j)}`;
}

/** Filtres du haut : annee ('current' = en cours) et mois ('' = toute l'annee). */
function periodeDe(choixAnnee, choixMois, aujourdhui) {
  const annee = (!choixAnnee || choixAnnee === 'current') ? Number(aujourdhui.slice(0, 4)) : Number(choixAnnee);
  const mois = (choixMois === '' || choixMois === null || choixMois === undefined) ? null : Number(choixMois);
  return { annee, mois };
}

/** Les colonnes : les 12 mois de l'annee, ou les jours du mois choisi. */
function colonnes({ annee, mois }, aujourdhui) {
  if (mois) {
    const m = `${annee}-${deux(mois)}`;
    const dernier = Number(Enc.dernierJourDuMois(m).slice(8, 10));
    return Array.from({ length: dernier }, (_, i) => {
      const jour = `${m}-${deux(i + 1)}`;
      return { cle: jour, debut: jour, fin: jour, libelle: String(i + 1), avenir: jour > aujourdhui };
    });
  }
  return MOIS_COURTS.map((libelle, i) => {
    const m = `${annee}-${deux(i + 1)}`;
    return { cle: m, debut: `${m}-01`, fin: Enc.dernierJourDuMois(m), libelle, avenir: `${m}-01` > aujourdhui };
  });
}

/** Ce qui s'est passe entre debut et fin (inclus) : encaisse par activite, frais par categorie. */
function bilan(appData, debut, fin, groupeDe) {
  const lignes = Enc.encaissementsEntre(appData, debut, fin);
  const totaux = Enc.totaliserEncaissements(lignes);
  const parActivite = {};
  lignes.forEach(l => {
    const nom = (l.source === 'bon-vendu' || l.source === 'bon-rembourse') ? CARTES : groupeDe(l.ref);
    parActivite[nom] = (parActivite[nom] || 0) + l.montant;
  });
  const parCategorie = {};
  (appData.depenses || []).forEach(d => {
    const jour = Enc.jourDe(d.date);
    if (!jour || jour < debut || jour > fin) return;
    const categorie = d.categorie || 'Autre';
    parCategorie[categorie] = (parCategorie[categorie] || 0) + Enc.montant(d.montant);
  });
  const frais = Object.values(parCategorie).reduce((t, v) => t + v, 0);
  Object.keys(parActivite).forEach(k => { parActivite[k] = arrondi(parActivite[k]); });
  Object.keys(parCategorie).forEach(k => { parCategorie[k] = arrondi(parCategorie[k]); });
  return {
    debut,
    fin,
    parActivite,
    encaisse: arrondi(totaux.total),
    pourboires: arrondi(totaux.tips),
    parCategorie,
    frais: arrondi(frais),
    reste: arrondi(totaux.total - frais)
  };
}

/** Les memes dates un an plus tot : ce qui avait ete encaisse, et l'ecart (en %) avec `encaisse`. */
function comparer(appData, debut, fin, groupeDe, encaisse) {
  const avant = bilan(appData, decalerAnnee(debut, -1), decalerAnnee(fin, -1), groupeDe);
  const ecart = avant.encaisse > 0 ? Math.round((encaisse - avant.encaisse) / avant.encaisse * 100) : null;
  return { annee: Number(avant.debut.slice(0, 4)), encaisse: avant.encaisse, ecart };
}

/** Ordre d'affichage : les activites connues d'abord, les autres ensuite, les cartes cadeaux a la fin. */
function ordreActivites(connues, trouvees) {
  const ordre = connues.filter(n => n !== CARTES);
  trouvees.forEach(n => { if (n !== CARTES && !ordre.includes(n)) ordre.push(n); });
  ordre.push(CARTES);
  return ordre;
}

/**
 * Tout ce que dessine le graphique pour la periode { annee, mois }.
 * options : groupeDe(prestation) -> activite, activites (ordre prefere), aujourdhui 'YYYY-MM-DD'.
 */
function evolution(appData, periode, { groupeDe, activites = [], aujourdhui }) {
  const cols = colonnes(periode, aujourdhui);
  const jusquA = fin => (fin < aujourdhui ? fin : aujourdhui);
  const bilans = cols.map(c => (c.avenir ? null : bilan(appData, c.debut, jusquA(c.fin), groupeDe)));

  const trouvees = new Set();
  bilans.forEach(b => b && Object.keys(b.parActivite).forEach(n => trouvees.add(n)));
  // Une activite sans aucun encaissement sur la periode n'encombre ni la legende ni le graphique
  const noms = ordreActivites(activites, trouvees)
    .filter(n => bilans.some(b => b && Math.abs(b.parActivite[n] || 0) > 0));

  // L'annee d'avant, mois par mois et par activite (une annee seulement : jour par jour, ce serait du bruit)
  const avant = periode.mois ? null : colonnes({ annee: periode.annee - 1, mois: null }, aujourdhui)
    .map(c => (c.avenir ? null : bilan(appData, c.debut, jusquA(c.fin), groupeDe).parActivite));

  const debut = cols[0].debut;
  const fin = jusquA(cols[cols.length - 1].fin);
  const total = debut <= aujourdhui ? bilan(appData, debut, fin, groupeDe) : null;

  return {
    mode: periode.mois ? 'mois' : 'annee',
    periode,
    colonnes: cols,
    bilans,
    activites: noms,
    series: noms.map(nom => ({ nom, valeurs: bilans.map(b => (b ? (b.parActivite[nom] || 0) : null)) })),
    reste: bilans.map(b => (b ? b.reste : null)),
    avant,
    total,
    comparaison: total ? comparer(appData, debut, fin, groupeDe, total.encaisse) : null
  };
}

/** Nom lisible d'une periode : « 2026 » ou « novembre 2026 ». */
function nomPeriode({ annee, mois }) {
  return mois ? `${MOIS_LONGS[mois - 1]} ${annee}` : String(annee);
}

const EvolutionCalculs = {
  CARTES,
  MOIS_COURTS,
  MOIS_LONGS,
  periodeDe,
  colonnes,
  bilan,
  comparer,
  evolution,
  decalerAnnee,
  nomPeriode
};

racine.EvolutionCalculs = EvolutionCalculs;
if (typeof module !== 'undefined' && module.exports) module.exports = EvolutionCalculs;

})(typeof window !== 'undefined' ? window : globalThis);
