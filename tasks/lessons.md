# Leçons — Elise Massage PWA

Règles écrites après une correction de Jordan, pour ne pas refaire la même erreur.
À relire en début de session.

---

## 1. Un seul rédacteur par zone d'écran

**Déclencheur (v1.0.13.x)** — « Les badges au-dessus ne se chargent pas
correctement », puis « Mais non ! Là tu m'as remélangé les deux campagnes ! ».

Six fonctions écrivaient dans les mêmes quatre cartes KPI Google Ads, avec trois
définitions concurrentes du « coût ». Chacune était juste isolément ; ensemble
elles affichaient un ROI calculé sur une période et des revenus sur une autre.

**Règle** — avant d'ajouter une fonction qui écrit dans une zone existante :
`grep` sur l'identifiant de la zone. S'il y a déjà un rédacteur, on le modifie.
On n'en ajoute pas un second. Une zone = une fonction = une définition.

---

## 2. Le CSS obéit à la même règle — et la spécificité tranche

**Déclencheur (v1.0.18.0 → 18.1)** — j'avais ajouté `.ana-td-cle.est-fort`
(0,3,0) sans voir que la v1.0.17.0 posait déjà
`.ana-full table td:last-child` (0,3,2) sur les mêmes cellules. La plus
spécifique gagnait : le vert n'apparaissait jamais, alors que la classe était
bien posée dans le DOM. Même cause pour un `th:last-child { color: white }`
hérité d'une époque où l'en-tête était foncé — devenu invisible sur fond crème.

**Règle** — avant d'ajouter des règles CSS pour un composant : `grep` sur la
classe *conteneur* (`ana-full`, `ana-panel`…), pas seulement sur la classe
qu'on ajoute. Les anciennes règles se **suppriment**, elles ne se surchargent
pas — sinon on empile une troisième couche qui perdra contre une quatrième.

**Vérification** — comparer la valeur *calculée* au DOM, pas au CSS écrit :

```js
getComputedStyle(document.querySelector('.ana-td-cle.est-fort')).color
```

---

## 3. Vérifier dans l'app déployée, en mesurant

**Déclencheur** — « On a déjà vérifié X fois, à chaque fois tu me dis c'est bon
maintenant et ça ne fonctionne toujours pas ».

Plusieurs annonces de correction se sont révélées fausses : la classe était
posée mais neutralisée, le PDF n'avait pas changé (mon `replace` visait
`('Juin 26'` alors que le fichier contenait `(u'Juin 26'` — sans assertion sur
ces deux lignes-là), le JS exécuté n'était pas le JS déployé.

**Règle** — ne jamais annoncer « c'est corrigé » sans une mesure. Trois formes :

| Ce qu'on affirme | Ce qu'on mesure |
|---|---|
| le style s'applique | `getComputedStyle(el).propriété` |
| le bon code s'exécute | `String(window.maFonction).includes('marqueur')` |
| le fichier est déployé | `fetch(url + '?b=' + Date.now(), {cache:'reload'})` |

Et dans tout script de patch : **une assertion par remplacement**
(`assert s.count(avant) == 1`). Un `replace` silencieux qui ne trouve rien est
la façon la plus rapide de croire une correction faite.

---

## 4. Le cache HTTP n'est pas le cache du service worker

**Déclencheur (v1.0.18.2 → 18.3)** — index.html annonçait la bonne version et
le navigateur exécutait l'ancien `google-ads-roi.js`. Le service worker était
déjà corrigé ; c'était le cache HTTP du navigateur, en amont, qui répondait à
sa place (GitHub Pages sert avec `max-age=600`). Le Ctrl+Shift+R rafraîchit le
document, pas les sous-ressources qu'il appelle.

**Règle** — après chaque bump : `node scripts/estampiller-version.js`. Sans
estampille sur l'URL, aucun rechargement ne garantit le fichier neuf.

---

## 5. Ne pas déduire ce qu'on peut aller voir

**Déclencheurs** — j'ai affirmé que « Répartition par genre » n'affichait rien
(j'avais mesuré `sexe` sur les *prestations*, vide, au lieu des *clients*) ;
que le bouton téléphone était invisible (« Le bouton est bien visible, je te le
confirme ») ; que le suivi d'appels était désactivé (l'infobulle disait
« Activé »). Trois affirmations sûres d'elles, trois fois fausses.

**Règle** — sur les données comme sur l'interface : ouvrir et regarder. Si la
mesure contredit ce que dit Jordan, c'est la mesure qui est suspecte en
premier — il a l'écran sous les yeux.

---

## 6. Refonte demandée = refondre, pas rapiécer

**Déclencheur** — quatre relances d'affilée, jusqu'à « VOILÀ LA PUTAIN DE
MAQUETTE QUE TU M'AS ENVOYÉE ET REGARDE CE QUE J'AI », puis « tu n'as rien fait
sur Google Ads, n'économise pas les tokens et va jusqu'au bout ».

À chaque tour j'avais retouché le CSS des composants existants en gardant leur
structure. Une maquette validée n'est pas une direction esthétique : c'est le
résultat attendu, panneau par panneau.

**Règle** — quand une maquette est validée, lister ses panneaux et les traiter
**tous** avant de rendre. Un panneau laissé dans son état d'origine à côté de
cinq refaits se voit immédiatement, et donne une page à deux vitesses.
