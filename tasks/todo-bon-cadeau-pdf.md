# Bon cadeau en PDF depuis l'app (v1.2.1.0)

Decisions de Jordan (2026-11-03) : Elise remplit et envoie ses bons cadeaux elle-meme depuis l'app,
sur son vrai visuel (son fichier Illustrator, fourni par Jordan et garde hors depot, 210 x 100 mm).
- TOUT reste vectoriel (« pas en image aplatie ») : le texte est pose sur le PDF d'Elise, champs effaces ;
  ses photos ne sont pas recompressees (PDF d'environ 2,3 Mo).
- Format de sortie exactement 210 x 100 mm (enveloppe DL).
- Champs pre-remplis depuis le bon MAIS modifiables ; soin = celui du bon, ou choisi dans un volet de ses
  soins ; bon d'un montant : « Bon d'une valeur de xx € ».
- Le message s'adapte a son encart (retrecit puis passe a la ligne, 4,5 pt mini).
- Emojis PLEINS a la couleur du texte (les emojis « en traits » de Noto ont ete refuses) + bouton
  « Inserer un emoji » (palette des emojis utiles sur un bon).
- « Bon valable 6 mois » en mention discrete, alignee sur les reseaux sociaux (pas de date precise).
- Version 1.2.1.0 validee.

Mesures (points PDF, origine en haut a gauche, page 595,276 x 283,465) : encarts x 449,3 -> 583,3 ;
offert par y 109,2 -> 124,0 ; pour 140,9 -> 155,6 ; soin 174,7 -> 189,4 ; message 203,0 -> 233,8 ;
texte SemiBold 6,5 pt, #C58375, a 3,9 pt du bord, interligne 7,7 pt ; mention Regular 5,32 pt,
ligne de base 276,04, fin a 234,0 pt.

## Plan

- [x] Fichiers `assets/bon-cadeau/` : `bon-vierge.pdf` (PDF d'Elise, textes des champs recouverts de la
      couleur de l'encart ; copie privee Illustrator, vignette et metadonnees retirees : elles gardaient
      des prenoms de clientes ; rendu identique au pixel), `apercu-vierge.webp` (fond de l'apercu a l'ecran),
      polices + `LICENCES.md`.
- [x] Polices (`scripts/polices-bon-cadeau.py`) : « Bon Cadeau Sans » = Raleway a chiffres alignes
      (sinon « 8o € »), « Bon Cadeau Emoji » = Twemoji 17.0.3 en formes pleines d'une couleur.
- [x] Base : colonne `carte` JSONB sur `bons_cadeaux` (textes imprimes : offertPar, pour, soin, message),
      `scripts/migration-bon-cadeau-carte.sql` (appliquee le 2026-11-03) + `schema-supabase.sql` ;
      mappers ; `BusinessServices.enregistrerCarteBonCadeau`.
- [x] Regle pure `js/core/bon-cadeau-carte.js` (testee sous Node) : textes par defaut, typographie,
      decoupe texte / emojis, lignes, plus grande taille qui tient, caracteres impossibles a imprimer,
      palette d'emojis.
- [x] Fenetre `js/ui/bon-cadeau-pdf.js` + `css/bon-cadeau.css` : bouton 🖨️ sur les bons actifs et
      « Bon a imprimer » dans le detail d'un bon ; apercu en direct (zoom sur les champs / bon entier),
      champs modifiables, volet des soins, « Inserer un emoji », PDF (pdf-lib 1.17.1 + fontkit 1.1.1).
- [x] Version : package.json, index.html (x2), `node scripts/estampiller-version.js`, sw.js (v77).
- [x] Verification : `npm test`, `tests/apercu-app.html`, PDF relu avec pdf.js.
- [ ] Plus tard (option) : envoi du PDF par e-mail a la cliente (Resend).
- [ ] Plus tard (option) : emojis composes (👩‍❤️‍👨, drapeaux) ; aujourd'hui leurs morceaux s'impriment
      un par un, les teintes de peau sont ignorees (une seule couleur).

## Revue (2026-11-03)

- PDF de test : 210,0 x 100,0 mm, 2,3 Mo, cree en 0,4 s ; les trois polices sont integrees en
  sous-ensemble, le texte et les emojis restent vectoriels ; rendu pdf.js x6 net, ❤✨🌸🥰💕 pleins.
- Piege rencontre : le sous-ensemble de pdf-lib suppose des dessins de longueur paire ; la police
  d'emojis, compilee sans remplissage, sortait abimee (emojis absents du PDF). Corrige a la source
  (`glyf.padding = 4` dans le script).
- Apercu ecran : memes polices, memes coupures de ligne que le PDF (mesure au canvas).
- Caractere qu'aucune police ne dessine (★, ideogrammes...) : signale sous le champ, telechargement
  bloque, jamais de case vide sur un bon.
- Telephone (375 px) : fenetre pleine largeur, apercu 320 px, aucun debordement.
