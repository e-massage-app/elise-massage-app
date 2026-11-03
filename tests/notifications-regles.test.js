// Notifications de l'app (v1.4.0.0) : js/core/notifications-regles.js
const assert = require('node:assert/strict');
const test = require('node:test');
const N = require('../js/core/notifications-regles.js');

const notif = (id, cree_le, lu_le = null) => ({ id, cree_le, lu_le, type: 'carte-cadeau', titre: 'Titre' });

test('non lues et pastille : rien, un nombre, puis « 9+ »', () => {
  assert.equal(N.pastille([]), '');
  assert.equal(N.pastille(null), '');
  const liste = [notif('a', '2026-11-03T10:00:00Z'), notif('b', '2026-11-03T11:00:00Z', '2026-11-03T12:00:00Z')];
  assert.deepEqual(N.nonLues(liste).map(n => n.id), ['a']);
  assert.equal(N.pastille(liste), '1');
  const beaucoup = Array.from({ length: 12 }, (_, i) => notif(`n${i}`, '2026-11-03T10:00:00Z'));
  assert.equal(N.pastille(beaucoup), '9+');
});

test('fusionner : plus recentes d\'abord, une notification recue deux fois n\'apparait qu\'une fois', () => {
  const liste = [notif('a', '2026-11-03T10:00:00Z'), notif('b', '2026-11-02T10:00:00Z')];
  const recues = [notif('c', '2026-11-03T12:00:00Z'), notif('a', '2026-11-03T10:00:00Z', '2026-11-03T13:00:00Z')];
  const r = N.fusionner(liste, recues);
  assert.deepEqual(r.map(n => n.id), ['c', 'a', 'b']);
  assert.equal(r[1].lu_le, '2026-11-03T13:00:00Z'); // la version la plus recente gagne
});

test('quand : de « a l\'instant » a la date (jour a Ajaccio)', () => {
  const maintenant = new Date('2026-11-03T20:00:00Z');
  assert.equal(N.quand('2026-11-03T19:59:40Z', maintenant), 'à l’instant');
  assert.equal(N.quand('2026-11-03T19:55:00Z', maintenant), 'il y a 5 min');
  assert.equal(N.quand('2026-11-03T17:30:00Z', maintenant), 'il y a 2 h');
  assert.equal(N.quand('2026-11-02T12:00:00Z', maintenant), 'hier');
  assert.equal(N.quand('2026-10-28T09:00:00Z', maintenant), 'le 28 oct.');
  assert.equal(N.quand('pas une date', maintenant), '');
});
