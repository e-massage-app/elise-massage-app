// ===== BON CADEAU A IMPRIMER : REGLES PURES (v1.2.1.0) =====
// Ou et comment s'ecrivent les textes sur le bon d'Elise (assets/bon-cadeau/bon-vierge.pdf, son fichier
// vectoriel dont les champs ont ete vides). Sans DOM : la mesure du texte est fournie par l'appelant
// (police du PDF, ou canvas pour l'apercu), donc l'apercu et le PDF coupent les lignes exactement
// pareil ; pdf-lib aussi (creerPdf). Teste sous Node (tests/bon-cadeau-carte.test.js).
// Plans : tasks/todo-bon-cadeau-pdf.md ; v1.3.0.0, partage avec la fonction Supabase « carte-cadeau »
// (cartes payees sur le site) : tasks/todo-carte-cadeau-en-ligne.md
//
// Coordonnees en points PDF, origine en HAUT a gauche (le PDF les inverse au dessin).

(function (racine) {

const PAGE = { largeur: 595.276, hauteur: 283.465 }; // 210 x 100 mm, comme le fichier d'Elise

// Encarts clairs du panneau de droite, releves dans le fichier d'Elise
const CHAMPS = {
  offertPar: { x0: 449.3, y0: 109.2, x1: 583.3, y1: 124.0, multi: false, libelle: 'Offert par' },
  pour: { x0: 449.3, y0: 140.9, x1: 583.3, y1: 155.6, multi: false, libelle: 'Pour' },
  soin: { x0: 449.3, y0: 174.7, x1: 583.3, y1: 189.4, multi: false, libelle: 'Soin' },
  message: { x0: 449.3, y0: 203.0, x1: 583.3, y1: 233.8, multi: true, libelle: 'Message' }
};

// Raleway SemiBold 6,5 pt, #C58375, a 3,9 pt du bord : comme les exemples d'Elise. Un texte trop long
// retrecit jusqu'a 4,5 pt (encore lisible a l'impression), puis il est refuse.
const STYLE = {
  marge: 3.9,
  margeVerticale: 2.6,
  taille: 6.5,
  tailleMini: 4.5,
  pas: 0.1,
  interligne: 7.7 / 6.5,
  couleur: [197, 131, 117]
};

// « Bon valable 6 mois » (decision de Jordan : pas de date), sur la ligne des reseaux sociaux :
// meme ligne de base, capitales de meme hauteur (3,78 pt, Raleway : 0,71 em), meme ecart (8,5 pt)
// qu'entre « @massagebienetre2a » et l'icone Facebook. Mesure a 2 400 dpi le 2026-11-03.
const MENTION = { texte: 'Bon valable 6 mois', taille: 3.78 / 0.71, ligneDeBase: 276.04, fin: 234.0 };

const CLES = ['offertPar', 'pour', 'soin', 'message'];

// Emojis (coeur, fleurs...) : police d'emojis PLEINS d'une seule couleur, celle du texte
// (assets/bon-cadeau/BonCadeauEmoji.ttf, tiree de Twemoji par scripts/polices-bon-cadeau.py)
const EST_EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/u;
// Sans effet en une couleur : variantes de presentation, teintes de peau, jointures, touches (1️⃣)
const SANS_EFFET = /[\uFE0E\uFE0F\u200D\u20E3\u{1F3FB}-\u{1F3FF}]/gu;

// Palette « Inserer un emoji » : ceux qui vont sur un bon cadeau, par groupe
const EMOJIS = [
  { titre: 'Cœurs', emojis: ['❤', '💕', '💖', '💗', '💓', '💞', '💝', '💌', '🫶'] },
  { titre: 'Sourires', emojis: ['😊', '🥰', '😍', '😘', '😉', '😁', '🤗', '😇', '😌'] },
  { titre: 'Fleurs et nature', emojis: ['🌸', '🌺', '🌹', '🌷', '🌼', '💐', '🌿', '🍃', '🦋'] },
  { titre: 'Fête', emojis: ['🎁', '🎂', '🎉', '🥂', '🍾', '🎀', '✨', '⭐', '🌟'] },
  { titre: 'Bien-être', emojis: ['💆', '🧘', '🕯', '🛁', '🌞', '🌙', '🌊', '🌴', '🙏'] }
];

/** Typographie francaise du bon : apostrophe courbe, points de suspension, espaces propres. */
function typographier(texte, multi) {
  const lignes = String(texte == null ? '' : texte)
    .replace(/\r\n?/g, '\n')
    .replace(SANS_EFFET, '')
    .replace(/'/g, '’')
    .replace(/\.\.\./g, '…')
    .split('\n')
    .map(l => l.replace(/[ \t]+/g, ' ').trim());
  return multi ? lignes.join('\n').trim() : lignes.filter(Boolean).join(' ');
}

/** Coupe un texte en morceaux texte / emoji consecutifs : [{ texte, emoji }]. */
function segments(texte) {
  const sortie = [];
  for (const car of String(texte || '')) {
    const emoji = EST_EMOJI.test(car);
    const dernier = sortie[sortie.length - 1];
    if (dernier && dernier.emoji === emoji) dernier.texte += car;
    else sortie.push({ texte: car, emoji });
  }
  return sortie;
}

/**
 * Caracteres qu'aucune police du bon ne sait dessiner (ils sortiraient en case vide) :
 * couvre(caractere, estEmoji) -> booleen. Sans doublon ; espaces et retours a la ligne exclus.
 */
function introuvables(texte, couvre) {
  const sortie = [];
  for (const car of String(texte || '')) {
    if (/\s/.test(car) || sortie.includes(car)) continue;
    if (!couvre(car, EST_EMOJI.test(car))) sortie.push(car);
  }
  return sortie;
}

/** Largeur d'une ligne : mesure(texte, taille, estEmoji) -> largeur en points. */
function largeur(texte, taille, mesure) {
  return segments(texte).reduce((total, s) => total + mesure(s.texte, taille, s.emoji), 0);
}

/** Lignes d'un texte, mots entiers, retours a la ligne d'Elise respectes. */
function couper(texte, taille, largeurMax, mesure) {
  const lignes = [];
  for (const paragraphe of texte.split('\n')) {
    let ligne = '';
    for (const mot of paragraphe.split(' ')) {
      const essai = ligne ? `${ligne} ${mot}` : mot;
      if (!ligne || largeur(essai, taille, mesure) <= largeurMax) ligne = essai;
      else { lignes.push(ligne); ligne = mot; }
    }
    lignes.push(ligne);
  }
  return lignes;
}

/**
 * Plus grande taille ou le texte tient dans son encart : { taille, lignes } ; null s'il ne tient pas
 * meme a la taille mini (Elise doit le raccourcir). Texte vide : { taille, lignes: [] }.
 */
function ajuster(texte, champ, mesure) {
  if (!texte) return { taille: STYLE.taille, lignes: [] };
  const largeurMax = (champ.x1 - champ.x0) - 2 * STYLE.marge;
  const hauteurMax = (champ.y1 - champ.y0) - 2 * STYLE.margeVerticale;
  for (let taille = STYLE.taille; taille >= STYLE.tailleMini - 1e-9; taille = Math.round((taille - STYLE.pas) * 100) / 100) {
    const lignes = champ.multi ? couper(texte, taille, largeurMax, mesure) : [texte];
    const tientEnLargeur = lignes.every(l => largeur(l, taille, mesure) <= largeurMax);
    if (tientEnLargeur && lignes.length * taille * STYLE.interligne <= hauteurMax) return { taille, lignes };
  }
  return null;
}

/** Lignes de base (y, origine en haut) d'un bloc de lignes centre verticalement dans l'encart. */
function lignesDeBase(champ, taille, nombre) {
  const pas = taille * STYLE.interligne;
  const premiere = champ.y0 + ((champ.y1 - champ.y0) - nombre * pas) / 2 + taille * 0.95;
  return Array.from({ length: nombre }, (_, i) => premiere + i * pas);
}

/** « Bon d'une valeur de 100 € » (espace insecable avant l'euro). */
function soinDeMontant(montant) {
  const m = Number(montant) || 0;
  const valeur = Number.isInteger(m) ? String(m) : m.toFixed(2).replace('.', ',');
  return `Bon d’une valeur de ${valeur} €`;
}

/**
 * Textes proposes pour un bon : ceux deja imprimes s'il y en a (reimprimer = meme bon), sinon tires du
 * bon (acheteur, beneficiaire, description ou montant). Tous restent modifiables dans la fenetre.
 * noms : { acheteur, beneficiaire } = noms des fiches clientes liees, s'il y en a.
 */
function textesParDefaut(bon, noms) {
  const n = noms || {};
  const deduits = {
    offertPar: n.acheteur || (bon && bon.acheteurNom) || '',
    pour: n.beneficiaire || (bon && bon.beneficiaireNom) || '',
    soin: (bon && bon.description) || (bon && bon.montant > 0 ? soinDeMontant(bon.montant) : ''),
    message: ''
  };
  const carte = (bon && bon.carte) || {};
  const sortie = {};
  for (const cle of CLES) sortie[cle] = typeof carte[cle] === 'string' ? carte[cle] : deduits[cle];
  return sortie;
}

/**
 * Tout le bon : pour chaque champ, { texte, taille, lignes, lignesDeBase } ou { texte, tropLong: true }.
 * C'est ce que dessinent l'apercu et le PDF.
 */
function composer(textes, mesure) {
  const sortie = {};
  for (const cle of CLES) {
    const champ = CHAMPS[cle];
    const texte = typographier(textes && textes[cle], champ.multi);
    const r = ajuster(texte, champ, mesure);
    sortie[cle] = r
      ? { texte, taille: r.taille, lignes: r.lignes, lignesDeBase: lignesDeBase(champ, r.taille, r.lignes.length) }
      : { texte, tropLong: true };
  }
  return sortie;
}

/**
 * Ce qui empeche d'imprimer le bon : [{ cle, libelle, raison, caracteres? }] ; [] s'il est imprimable.
 * raison : 'tropLong' (meme a la taille mini) ou 'caracteres' (aucune police ne les dessine).
 */
function problemes(compo, couvre) {
  const sortie = [];
  for (const cle of CLES) {
    const libelle = CHAMPS[cle].libelle;
    if (compo[cle].tropLong) { sortie.push({ cle, libelle, raison: 'tropLong' }); continue; }
    const absents = introuvables(compo[cle].texte, couvre);
    if (absents.length) sortie.push({ cle, libelle, raison: 'caracteres', caracteres: absents });
  }
  return sortie;
}

/**
 * Le PDF du bon (v1.3.0.0) : les textes poses sur le fichier d'Elise, rien n'est aplati en image.
 * Un seul dessin pour l'app (bouton 🖨️) et la fonction Supabase « carte-cadeau » (cartes payees
 * sur le site) : pdf-lib et fontkit sont fournis par l'appelant (navigateur ou serveur).
 * r : { modele, semi, fin, emoji } (octets du modele et des polices) + couvre(caractere, estEmoji).
 * Leve une erreur si un texte ne tient pas ou contient un caractere impossible a imprimer.
 */
async function creerPdf({ PDFLib, fontkit }, r, textes) {
  const { PDFDocument, rgb } = PDFLib;
  const doc = await PDFDocument.load(r.modele);
  doc.registerFontkit(fontkit);
  const semi = await doc.embedFont(r.semi, { subset: true });
  const fin = await doc.embedFont(r.fin, { subset: true });
  const emoji = await doc.embedFont(r.emoji, { subset: true });

  const compo = composer(textes, (t, taille, e) => (e ? emoji : semi).widthOfTextAtSize(t, taille));
  const p = problemes(compo, r.couvre);
  const tropLongs = p.filter(x => x.raison === 'tropLong');
  if (tropLongs.length) throw new Error(`Texte trop long : ${tropLongs.map(x => x.libelle).join(', ')}`);
  if (p.length) throw new Error(`Caractères impossibles à imprimer : ${p.flatMap(x => x.caracteres).join(' ')}`);

  const page = doc.getPage(0);
  const boite = page.getMediaBox();
  const yPdf = y => boite.y + boite.height - y; // regles : origine en haut ; PDF : en bas
  const couleur = rgb(...STYLE.couleur.map(v => v / 255));

  for (const cle of CLES) {
    const res = compo[cle];
    res.lignes.forEach((ligne, i) => {
      let x = boite.x + CHAMPS[cle].x0 + STYLE.marge;
      for (const s of segments(ligne)) {
        const police = s.emoji ? emoji : semi;
        page.drawText(s.texte, { x, y: yPdf(res.lignesDeBase[i]), size: res.taille, font: police, color: couleur });
        x += police.widthOfTextAtSize(s.texte, res.taille);
      }
    });
  }
  page.drawText(MENTION.texte, {
    x: boite.x + MENTION.fin - fin.widthOfTextAtSize(MENTION.texte, MENTION.taille),
    y: yPdf(MENTION.ligneDeBase), size: MENTION.taille, font: fin, color: couleur
  });

  doc.setTitle(`Bon cadeau${textes.pour ? ` pour ${textes.pour}` : ''}`);
  doc.setAuthor('Elise Massage & Bien-être');
  doc.setCreator('Logiciel Elise Massage');
  return doc.save();
}

/** Nom de fichier : Bon-cadeau-Paul-2026-11-03.pdf */
function nomDeFichier(pour, jour) {
  const propre = String(pour || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `Bon-cadeau${propre ? '-' + propre : ''}${jour ? '-' + jour : ''}.pdf`;
}

const BonCadeauCarte = {
  PAGE, CHAMPS, STYLE, MENTION, CLES, EMOJIS,
  typographier, segments, introuvables, largeur, couper, ajuster, lignesDeBase,
  soinDeMontant, textesParDefaut, composer, problemes, creerPdf, nomDeFichier
};

racine.BonCadeauCarte = BonCadeauCarte;
if (typeof module !== 'undefined' && module.exports) module.exports = BonCadeauCarte;

})(typeof window !== 'undefined' ? window : globalThis);
