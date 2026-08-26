#!/usr/bin/env node
/**
 * Estampille la version courante sur chaque <script src="js/..."> et
 * <link href="css/..."> de index.html et login.html.
 *
 * POURQUOI
 * Le service worker sait se rafraichir (cache v60 + Request cache:'reload'),
 * mais le cache HTTP du navigateur, lui, est indexe sur l'URL. Tant que
 * "js/analytics/google-ads-roi.js" reste identique, Chrome peut resservir la
 * version d'il y a trois deploiements - meme apres un Ctrl+Shift+R sur la
 * page. On l'a constate sur la v1.0.18.2 : le HTML annoncait la bonne
 * version, et le JS execute etait l'ancien.
 *
 * Ajouter "?v=1.0.18.3" change l'URL a chaque release : le cache ne peut plus
 * repondre, et le navigateur va rechercher le fichier.
 *
 * USAGE
 *   node scripts/estampiller-version.js          (lit package.json)
 *   node scripts/estampiller-version.js 1.2.3.4
 *
 * A LANCER APRES chaque bump de version, avant le commit.
 */
const fs = require('fs');
const path = require('path');

const racine = path.join(__dirname, '..');
const version = process.argv[2] ||
  JSON.parse(fs.readFileSync(path.join(racine, 'package.json'), 'utf8')).version;

if (!/^\d+\.\d+\.\d+\.\d+$/.test(version)) {
  console.error('Version inattendue : ' + version);
  process.exit(1);
}

// Un seul motif : l'attribut d'une ressource locale js/ ou css/, avec ou sans
// estampille deja posee. Le groupe 1 est le chemin nu.
const MOTIF = /(?:src|href)="((?:js|css)\/[^"?]+)(?:\?v=[^"]*)?"/g;

let total = 0;
for (const fichier of ['index.html', 'login.html']) {
  const chemin = path.join(racine, fichier);
  if (!fs.existsSync(chemin)) continue;

  const avant = fs.readFileSync(chemin, 'utf8');
  let n = 0;
  const apres = avant.replace(MOTIF, (correspondance, ressource) => {
    n++;
    const attribut = correspondance.startsWith('src') ? 'src' : 'href';
    return attribut + '="' + ressource + '?v=' + version + '"';
  });

  if (apres !== avant) fs.writeFileSync(chemin, apres);
  console.log(fichier.padEnd(12) + n + ' ressource(s) estampillee(s) en ' + version);
  total += n;
}

if (total === 0) {
  console.error('Aucune ressource trouvee : le motif ne correspond plus au HTML.');
  process.exit(1);
}
