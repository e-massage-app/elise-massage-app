// ===== ABONNEMENTS : DEPENSES MENSUELLES AUTOMATIQUES (v1.2.0.0) =====
// Fonctions pures, testees sous Node (tests/abonnements.test.js). La date du jour
// se passe en parametre ('YYYY-MM-DD' local).
//
// Avant : un abonnement se reconnaissait a son nom (le renommer recreait la
// depense du mois) et une reprise apres une pause rattrapait les mois en pause.

(function (racine) {

const Enc = racine.Encaissements || require('./encaissements.js');

/**
 * La depense appartient-elle a cet abonnement ?
 * Par son abonnementId quand il designe un abonnement existant. Sinon (depenses
 * d'avant la v1.2.0.0, ou identifiant inconnu) : la regle d'avant, par le nom
 * - generee (type + abonnementNom), ou saisie a la main (sans type, meme
 * categorie, fournisseur ou abonnementNom egal au nom, casse ignoree).
 * Meme regle par le nom que depenseDeLAbonnement (gestion-calculs.js), que le
 * renommage garde juste en renommant aussi abonnementNom sur les depenses.
 */
function estDepenseDe(d, abo, abonnements) {
  if (!d || typeof d.date !== 'string') return false;
  if (d.abonnementId && (abonnements || []).some(a => a.id === d.abonnementId)) {
    return d.abonnementId === abo.id;
  }
  if (d.type === 'abonnement-auto') return d.abonnementNom === abo.nom;
  if (d.type) return false;
  const nom = String(abo.nom || '').trim().toLowerCase();
  if (!nom || d.categorie !== abo.categorie) return false;
  const egal = v => String(v || '').trim().toLowerCase() === nom;
  return egal(d.fournisseur) || egal(d.abonnementNom);
}

/**
 * Mois 'YYYY-MM' dont la depense manque : du mois qui suit la plus recente
 * depense de l'abonnement (le mois courant s'il n'en a aucune) jusqu'au mois
 * courant, celui-ci seulement une fois le jour de prelevement atteint.
 * Apres une pause (repriseLe), rien avant le premier prelevement qui suit la
 * reprise : les mois en pause n'ont pas ete preleves.
 */
function moisAGenerer(abo, depenses, abonnements, aujourdhui) {
  const moisCourant = aujourdhui.slice(0, 7);
  const jourActuel = Number(aujourdhui.slice(8, 10));
  const jourPrelevement = abo.jourPrelevement || 1;

  const siens = (depenses || []).filter(d => estDepenseDe(d, abo, abonnements)).map(d => d.date.slice(0, 7)).sort();
  let debut = siens.length ? Enc.decalerMois(siens[siens.length - 1], 1) : moisCourant;

  if (typeof abo.repriseLe === 'string' && abo.repriseLe.length >= 10) {
    const moisReprise = abo.repriseLe.slice(0, 7);
    const premier = Number(abo.repriseLe.slice(8, 10)) <= jourPrelevement ? moisReprise : Enc.decalerMois(moisReprise, 1);
    if (premier > debut) debut = premier;
  }

  const liste = [];
  for (let mois = debut; mois <= moisCourant; mois = Enc.decalerMois(mois, 1)) {
    if (mois < moisCourant || jourActuel >= jourPrelevement) liste.push(mois);
  }
  return liste;
}

const Abonnements = { estDepenseDe, moisAGenerer };

racine.Abonnements = Abonnements;
if (typeof module !== 'undefined' && module.exports) module.exports = Abonnements;

})(typeof window !== 'undefined' ? window : globalThis);
