// ===== CARTES CADEAUX : REGLES PURES (v1.2.0.0) =====
// Fonctions sans DOM ni Supabase, testees sous Node (tests/bons-cadeaux.test.js).
// La date du jour se passe en parametre ('YYYY-MM-DD' local, jourLocal(new Date())).
//
// Avant : le statut « expire » etait ecrit dans le cache par l'onglet Bons
// (getStatistiquesBonsCadeaux) : le tableau de bord du demarrage comptait des
// cartes expirees, « Forcer utilisation » etait aussitot defait, et une carte
// prolongee restait « expire ». Desormais : UN calcul, jamais stocke par un getter.

(function (racine) {

const pad = n => String(n).padStart(2, '0');

/**
 * 'YYYY-MM-DD' + n mois, sur la chaine (pas de new Date() : fuseau et heure d'ete
 * decalaient d'un jour). Jour ramene au dernier du mois : 31 aout + 6 -> 28/29 fevrier.
 */
function ajouterMois(jour, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(jour || '');
  if (!m) return '';
  const index = Number(m[1]) * 12 + (Number(m[2]) - 1) + n;
  const annee = Math.floor(index / 12);
  const mois = index - annee * 12 + 1;
  const dernier = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  return `${annee}-${pad(mois)}-${pad(Math.min(Number(m[3]), dernier))}`;
}

/**
 * Statut reel d'une carte le jour donne : 'actif' | 'expire' | 'utilise' | 'rembourse'.
 * Utilisee et remboursee sont definitifs. Sinon la date de fin decide (valable
 * jusqu'a ce jour inclus), sauf si Elise a force l'utilisation d'une carte expiree.
 */
function statutEffectif(bon, aujourdhui) {
  if (!bon) return null;
  if (bon.statut === 'utilise' || bon.statut === 'rembourse') return bon.statut;
  if (bon.forceUtilise) return 'actif';
  const fin = typeof bon.dateExpiration === 'string' ? bon.dateExpiration.slice(0, 10) : '';
  return fin && fin < aujourdhui ? 'expire' : 'actif';
}

/**
 * Fiche dont « prenom nom » est exactement le nom saisi (casse, accents et espaces
 * ignores) ; null si aucune ou si plusieurs (homonymes : on ne devine pas).
 */
function ficheDuNom(clients, nom) {
  const norme = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
  const cherche = norme(nom);
  if (!cherche) return null;
  const trouvees = (clients || []).filter(c => norme(`${c.prenom || ''} ${c.nom || ''}`) === cherche);
  return trouvees.length === 1 ? trouvees[0] : null;
}

const BonsCadeaux = { ajouterMois, statutEffectif, ficheDuNom };

racine.BonsCadeaux = BonsCadeaux;
if (typeof module !== 'undefined' && module.exports) module.exports = BonsCadeaux;

})(typeof window !== 'undefined' ? window : globalThis);
