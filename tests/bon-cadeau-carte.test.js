// Regles du bon cadeau a imprimer (v1.2.1.0) : js/core/bon-cadeau-carte.js
const assert = require('node:assert/strict');
const test = require('node:test');
const B = require('../js/core/bon-cadeau-carte.js');

// Mesure fictive : chaque caractere fait 0,5 em, chaque emoji 1 em
const mesure = (texte, taille, emoji) => [...texte].length * taille * (emoji ? 1 : 0.5);

test('format du bon : 210 x 100 mm, comme le fichier d\'Elise', () => {
  assert.equal(Math.round(B.PAGE.largeur / 72 * 25.4), 210);
  assert.equal(Math.round(B.PAGE.hauteur / 72 * 25.4), 100);
});

test('typographie : apostrophe courbe, points de suspension, espaces', () => {
  assert.equal(B.typographier("C'est  le moment...", false), 'C’est le moment…');
  assert.equal(B.typographier('  Ligne 1 \n\n Ligne 2  ', true), 'Ligne 1\n\nLigne 2');
  assert.equal(B.typographier('Ligne 1\nLigne 2', false), 'Ligne 1 Ligne 2');
  assert.equal(B.typographier('Je t’aime ❤️', true), 'Je t’aime ❤');
  // une seule couleur : teinte de peau, jointure (👩‍❤️‍👨) et touche (1️⃣) n'ont pas de sens
  assert.equal(B.typographier('Merci 🙏🏽 👩‍❤️‍👨 1️⃣', false), 'Merci 🙏 👩❤👨 1');
  assert.equal(B.typographier(null, true), '');
});

test('segments : le coeur et les fleurs a part, pour la police d\'emojis', () => {
  assert.deepEqual(B.segments('Bisous ❤ et \u{1F338}\u{1F338} !'), [
    { texte: 'Bisous ', emoji: false },
    { texte: '❤', emoji: true },
    { texte: ' et ', emoji: false },
    { texte: '\u{1F338}\u{1F338}', emoji: true },
    { texte: ' !', emoji: false }
  ]);
  assert.deepEqual(B.segments('Sans emoji'), [{ texte: 'Sans emoji', emoji: false }]);
});

test('introuvables : caracteres qu\'aucune police du bon ne dessine', () => {
  const couvre = (car, emoji) => (emoji ? car === '❤' : /[a-z’!]/i.test(car));
  assert.deepEqual(B.introuvables('Coucou ❤ ❤ 🦄 ★\nà', couvre), ['🦄', '★', 'à']);
  assert.deepEqual(B.introuvables('', couvre), []);
});

test('palette : des emojis seuls (un caractere chacun), sans doublon', () => {
  const tous = B.EMOJIS.flatMap(g => g.emojis);
  assert.equal(new Set(tous).size, tous.length);
  for (const e of tous) {
    assert.equal([...e].length, 1, e);
    assert.deepEqual(B.segments(e), [{ texte: e, emoji: true }], e);
  }
});

test('largeur : texte et emojis mesures chacun avec leur police', () => {
  assert.equal(B.largeur('ab❤', 10, mesure), 2 * 5 + 10);
});

test('champ d\'une ligne : taille normale si ca tient, plus petit sinon, refuse au-dela', () => {
  const champ = B.CHAMPS.pour; // 134 - 2 x 3,9 = 126,2 pt de large
  assert.deepEqual(B.ajuster('Paul', champ, mesure), { taille: 6.5, lignes: ['Paul'] });
  const long = 'x'.repeat(45); // 45 x 3,25 = 146 pt a 6,5 : il faut retrecir
  const r = B.ajuster(long, champ, mesure);
  assert.ok(r.taille < 6.5 && r.taille >= 4.5);
  assert.ok(B.largeur(long, r.taille, mesure) <= 126.2);
  assert.equal(B.ajuster('x'.repeat(80), champ, mesure), null); // 80 x 2,25 = 180 pt meme a 4,5
});

test('message : coupe en lignes et retrecit pour tenir dans l\'encart', () => {
  const court = B.ajuster('Joyeux anniversaire !', B.CHAMPS.message, mesure);
  assert.deepEqual(court, { taille: 6.5, lignes: ['Joyeux anniversaire !'] });
  const texte = 'mot '.repeat(40).trim();
  const r = B.ajuster(texte, B.CHAMPS.message, mesure);
  assert.ok(r && r.taille < 6.5, 'un long message retrecit');
  const hauteur = (233.8 - 203.0) - 2 * 2.6;
  assert.ok(r.lignes.length * r.taille * B.STYLE.interligne <= hauteur + 1e-9);
  assert.ok(r.lignes.every(l => B.largeur(l, r.taille, mesure) <= 126.2 + 1e-9));
  assert.equal(r.lignes.join(' '), texte, 'aucun mot perdu');
  assert.equal(B.ajuster('mot '.repeat(200).trim(), B.CHAMPS.message, mesure), null);
});

test('message : les retours a la ligne d\'Elise sont gardes', () => {
  const r = B.ajuster('Joyeux anniversaire !\nC’est le moment !', B.CHAMPS.message, mesure);
  assert.deepEqual(r.lignes, ['Joyeux anniversaire !', 'C’est le moment !']);
});

test('lignes de base : bloc centre verticalement dans l\'encart', () => {
  const [y] = B.lignesDeBase(B.CHAMPS.pour, 6.5, 1);
  assert.ok(Math.abs(y - (140.9 + (14.7 - 7.7) / 2 + 6.5 * 0.95)) < 1e-9);
  const deux = B.lignesDeBase(B.CHAMPS.message, 6.5, 2);
  assert.ok(Math.abs(deux[1] - deux[0] - 7.7) < 1e-9);
});

test('montant : « Bon d’une valeur de 100 € »', () => {
  assert.equal(B.soinDeMontant(100), 'Bon d’une valeur de 100 €');
  assert.equal(B.soinDeMontant(82.5), 'Bon d’une valeur de 82,50 €');
});

test('textes par defaut : tires du bon, ou ceux deja imprimes', () => {
  const bon = { acheteurNom: 'Acheteur', beneficiaireNom: 'Beneficiaire', description: 'Massage Signature - 60 minutes', montant: 80 };
  assert.deepEqual(B.textesParDefaut(bon), { offertPar: 'Acheteur', pour: 'Beneficiaire', soin: 'Massage Signature - 60 minutes', message: '' });
  assert.equal(B.textesParDefaut({ montant: 100 }).soin, 'Bon d’une valeur de 100 €');
  assert.equal(B.textesParDefaut(bon, { beneficiaire: 'Fiche liee' }).pour, 'Fiche liee');
  const imprime = { ...bon, carte: { offertPar: 'Toute la famille', pour: 'Jeanne', soin: 'Autre', message: 'Bisous' } };
  assert.deepEqual(B.textesParDefaut(imprime), imprime.carte);
});

test('composer : chaque champ, ou « trop long »', () => {
  const r = B.composer({ offertPar: 'A', pour: 'B', soin: 'C', message: 'x'.repeat(500) }, mesure);
  assert.equal(r.pour.taille, 6.5);
  assert.equal(r.pour.lignesDeBase.length, 1);
  assert.equal(r.message.tropLong, true);
  assert.deepEqual(B.composer({}, mesure).message.lignes, []);
});

test('nom de fichier sans accents ni espaces', () => {
  assert.equal(B.nomDeFichier('Hélène Martin', '2026-11-03'), 'Bon-cadeau-Helene-Martin-2026-11-03.pdf');
  assert.equal(B.nomDeFichier('', '2026-11-03'), 'Bon-cadeau-2026-11-03.pdf');
});
