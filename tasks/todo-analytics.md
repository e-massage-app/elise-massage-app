# v1.1.2.0 — Analytics : graphique « Évolution » refait + menu des catégories de Gestion

Retours n°1, 2 et 3 de `tasks/retours-app.md` (2026-11-02). Décisions de Jordan :

- Les filtres du HAUT (Année, Mois) pilotent toute la page, graphique compris. Un raccourci
  « Ce mois-ci » en haut (annee en cours + mois en cours ; un 2e clic revient a toute l'annee).
  Le choix d'annee du graphique et les boutons 12 / 6 / 3 mois / Ce mois-ci disparaissent.
- Une annee : une colonne par mois (janvier a decembre), empilee par activite (groupes de soins
  + cartes cadeaux), regle Encaissements. Les pourboires sont deja dans chaque activite : plus
  de serie a part (double comptage), seulement « dont X de pourboires » dans le detail.
- Un mois : une colonne par jour.
- Ligne « Il me reste » = encaisse − frais. Frais = UNIQUEMENT l'onglet Depenses ; Google Ads et
  URSSAF sont dans Gestion, et c'est ecrit sous le graphique.
- Pointilles : l'annee d'avant, meme mois (mode annee).
- Les pastilles deviennent la legende (clic = masquer / afficher une activite, total de la
  periode). Les 7 pastilles de depenses disparaissent : clic sur une colonne = detail (encaisse
  par activite, pourboires, frais par categorie, ce qu'il reste, l'an dernier).
- Joli, dans le style du logiciel (Playfair / Inter, dore, creme).
- Gestion : le champ « Catégorie » devient une vraie liste qui s'ouvre au toucher, se filtre en
  tapant, et permet d'ajouter une nouvelle categorie (gardee dans les reglages).

## Etapes

- [x] `js/analytics/evolution-calculs.js` (pur) + `tests/evolution-calculs.test.js` (fictif)
- [x] `js/analytics/evolution-vue.js` (rendu ApexCharts, legende, detail) + CSS
- [x] Filtres du haut : selection gardee, ecouteurs branches une seule fois, raccourci « Ce mois-ci »,
      `updateAnalytics` passe les filtres a tous les blocs
- [x] Retrait de l'ancien graphique (pastilles, choix d'annee, boutons de periode, calculs morts)
- [x] Gestion : liste de categories (ouvrir, filtrer, ajouter) + enregistrement de la nouvelle categorie
- [x] Apercu avec donnees fictives (`tests/apercu-analytics.html`), ordinateur + telephone
- [x] Version 1.1.2.0 (package.json, index.html x2, estampille, sw.js v72), tests (45/45)
- [x] Push (79cc939) et verification en ligne avec les vraies donnees (lecture seule) : 2026 = tuile CA,
      2025 recalcule le graphique et la tuile, « Ce mois-ci » aller-retour, aucune erreur
- [x] v1.1.2.1 (demande de Jordan : « les serifs ça devient illisible », option A) : Playfair garde les
      grands titres (h1-h3) ; chiffres, h4 et petits titres en Inter (tuiles Analytics, carte Evolution,
      anneaux, fiche cliente, Annuaire)

## Revue (2026-11-02)

- Verifie dans les apercus, ordinateur et telephone (375 px), avec ApexCharts 8.7 comme le logiciel :
  annee, un mois (jour par jour), « Ce mois-ci », legende qui masque, bulle, clic = detail + fond creme,
  liste de categories (ouvrir, filtrer, « + Ajouter », reecriture « loyer CABINE » -> « Loyer cabine »).
- Choix faits en cours de route : la ligne « Il me reste » s'arrete au dernier mois complet (le mois en
  cours n'a que quelques jours, elle plongeait chaque debut de mois) ; son chiffre reste dans la bulle et
  le detail. Pas d'assombrissement au survol (ApexCharts 8 noircissait la colonne). Initiales des mois
  sur telephone. « Statistiques cles » sort de la carte du graphique (elle y etait rangee par erreur de
  balise) et reste ouverte sur telephone.
- Retires : pastilles de depenses, choix d'annee du graphique, boutons 12/6/3 mois, `getRevenueChartData`,
  `calculateFilterAmountsForPeriod`, `moisDeLaPeriodeAnalytics` et leurs fonctions d'ecran.
