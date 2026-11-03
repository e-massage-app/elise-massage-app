// ===== NOTIFICATIONS : REGLES PURES (v1.4.0.0) =====
// La cloche en haut a droite (js/ui/notifications.js) : ce qui est non lu, ce qu'affiche la pastille,
// depuis quand. Les notifications viennent de la table `notifications`, remplie par les fonctions
// Supabase (scripts/migration-notifications.sql). Teste sous Node (tests/notifications-regles.test.js).

(function (racine) {

/** Notifications pas encore lues. */
function nonLues(liste) {
  return (liste || []).filter(n => n && !n.lu_le);
}

/** Texte de la pastille : '' sans non lue, « 9+ » au-dela de 9. */
function pastille(liste) {
  const n = nonLues(liste).length;
  if (n === 0) return '';
  return n > 9 ? '9+' : String(n);
}

/** Plus recentes d'abord, sans doublon : a meme id, la version la plus recue remplace l'ancienne. */
function fusionner(liste, nouvelles) {
  const parId = new Map();
  for (const n of [...(liste || []), ...(nouvelles || [])]) if (n && n.id) parId.set(n.id, n);
  return [...parId.values()].sort((a, b) => String(b.cree_le).localeCompare(String(a.cree_le)));
}

/**
 * Depuis quand, en francais : « à l'instant », « il y a 5 min », « il y a 2 h », « hier », puis
 * « le 3 nov. » (jour a Ajaccio). maintenant : Date fournie par l'appelant (testable).
 */
function quand(date, maintenant) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const minutes = Math.floor((maintenant.getTime() - d.getTime()) / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 24 * 60) return `il y a ${Math.floor(minutes / 60)} h`;
  if (minutes < 48 * 60) return 'hier';
  return 'le ' + new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }).format(d);
}

const NotificationsRegles = { nonLues, pastille, fusionner, quand };

racine.NotificationsRegles = NotificationsRegles;
if (typeof module !== 'undefined' && module.exports) module.exports = NotificationsRegles;

})(typeof window !== 'undefined' ? window : globalThis);
