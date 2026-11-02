// Tests des reglages du calendrier (jours fermes, vacances). Donnees fictives.
const assert = require('node:assert/strict');
const test = require('node:test');
const C = require('../js/ui/calendrier-reglages.js');

test('par defaut : dimanche et lundi fermes, gris taupe, uni', () => {
  const r = C.reglagesComplets(undefined);
  assert.deepEqual(r.joursFermes, [7, 1]);
  assert.equal(r.style, 'uni');
  assert.equal(r.fermetures.length, 0);
});

test('valeurs abimees ramenees a des valeurs sures', () => {
  const r = C.reglagesComplets({ joursFermes: ['3', 9], couleur: 'rouge', opacite: 5, style: 'pois', fermetures: [{ debut: '2026-12-24' }] });
  assert.deepEqual(r.joursFermes, [3]);
  assert.equal(r.couleur, C.DEFAUT.couleur);
  assert.equal(r.opacite, 0.9);
  assert.equal(r.style, 'uni');
  assert.equal(r.fermetures.length, 0); // plage sans fin ignoree
});

test('un jour est ferme par son jour de semaine ou par une plage, la plage d\'abord', () => {
  const r = C.reglagesComplets({ joursFermes: [7, 1], fermetures: [{ id: 'f1', debut: '2026-12-24', fin: '2026-12-31', libelle: 'Noël' }] });
  assert.deepEqual(C.fermetureDu(r, '2026-11-02'), { type: 'semaine', libelle: 'Jour fermé' }); // lundi
  assert.equal(C.fermetureDu(r, '2026-11-04'), null);                                            // mercredi
  assert.deepEqual(C.fermetureDu(r, '2026-12-24'), { type: 'plage', libelle: 'Noël' });          // jeudi en vacances
  assert.deepEqual(C.fermetureDu(r, '2026-12-27'), { type: 'plage', libelle: 'Noël' });          // dimanche en vacances
  assert.equal(C.fermetureDu(r, '2027-01-01'), null);                                            // vendredi apres
});

test('hachures : degrade de la couleur choisie', () => {
  const r = C.reglagesComplets({ couleur: '#adc4ab', style: 'hachures' });
  assert.match(C.fondCss(r), /^repeating-linear-gradient\(135deg, #adc4ab/);
  assert.equal(C.fondCss(C.reglagesComplets({ couleur: '#adc4ab' })), '#adc4ab');
});
