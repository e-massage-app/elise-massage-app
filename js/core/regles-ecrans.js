// ===== REGLES PARTAGEES PAR LES ECRANS (v1.2.0.0) =====
// Petites regles qu'au moins deux ecrans appliquaient chacun a leur facon (tableau de
// bord, Analytics, Depenses, fidelite, relances, fiche cliente). Fonctions pures : ni DOM,
// ni DataManager, ni date du jour implicite (on la passe). Tests : tests/regles-ecrans.test.js.

(function (racine) {

const Enc = racine.Encaissements || require('./encaissements.js');

/** Jour local 'YYYY-MM-DD' (toISOString donne le jour UTC : la veille entre 0 h et 1-2 h). */
function jourLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** RDV annule (les deux orthographes existent en base). */
function estAnnule(rdv) {
  const s = (rdv && rdv.statut) || '';
  return s === 'annulé' || s === 'annule';
}

/** RDV encore a venir : date du jour ou plus tard, ni annule, ni deja transforme en prestation. */
function estRdvAVenir(rdv, aujourdhui) {
  return !!rdv && !!rdv.date && Enc.jourDe(rdv.date) >= aujourdhui && !estAnnule(rdv) && !rdv.transformeEnPrestation;
}

/**
 * Panier moyen : ce que paie une cliente par prestation. Les prestations reglees par carte
 * cadeau n'y entrent pas (rien n'est paye ce jour-la) : meme regle que le panier d'Analytics.
 */
function panierMoyen(prestations) {
  const payees = (prestations || []).filter(p => !Enc.estPayeeParBonCadeau(p));
  return payees.length ? payees.reduce((t, p) => t + Enc.encaissePrestation(p), 0) / payees.length : 0;
}

/** Couts produits : cout par defaut de CHAQUE categorie x nombre de prestations de cette categorie. */
function coutsProduits(categories, nbParCategorie) {
  return (categories || []).reduce((t, c) =>
    t + (Number(c.coutProduitDefault) || 0) * ((nbParCategorie || {})[c.id] || 0), 0);
}

/** Nom d'une categorie dans les statistiques : une categorie archivee garde son nom, signale. */
function nomCategorieStats(categorie) {
  if (!categorie) return 'Autre';
  return categorie.statut === 'actif' ? categorie.nom : `${categorie.nom} (archivée)`;
}

/**
 * Filtre « Période » de l'onglet Depenses, sur les dates TEXT 'YYYY-MM-DD'.
 * « 3 derniers mois » = le mois en cours et les deux precedents (avant : quatre mois).
 */
function depenseDansPeriode(dateDepense, periode, aujourdhui) {
  const mois = Enc.moisDe(dateDepense);
  const moisCourant = aujourdhui.slice(0, 7);
  switch (periode) {
    case 'ce-mois': return mois === moisCourant;
    case 'mois-dernier': return mois === Enc.decalerMois(moisCourant, -1);
    case '3-mois': return mois >= Enc.decalerMois(moisCourant, -2) && mois <= moisCourant;
    case 'cette-annee': return mois.slice(0, 4) === moisCourant.slice(0, 4);
    default: return true;
  }
}

/** Sexe d'une fiche en clair : 'H' et l'ancien code 'M' = Homme, comme les statistiques ; '' si inconnu. */
function libelleSexe(sexe) {
  const s = String(sexe || '').trim().toUpperCase();
  if (s === 'H' || s === 'M' || s === 'HOMME') return 'Homme';
  if (s === 'F' || s === 'FEMME') return 'Femme';
  return '';
}

const ReglesEcrans = {
  jourLocal,
  estAnnule,
  estRdvAVenir,
  panierMoyen,
  coutsProduits,
  nomCategorieStats,
  depenseDansPeriode,
  libelleSexe
};

racine.ReglesEcrans = ReglesEcrans;
if (typeof module !== 'undefined' && module.exports) module.exports = ReglesEcrans;

})(typeof window !== 'undefined' ? window : globalThis);
