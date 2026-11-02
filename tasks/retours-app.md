# Retours sur l'app (a traiter plus tard)

Chaque retour de Jordan ou d'Elise est note ici avant d'etre corrige. Seul Jordan passe un point en « Valide ».

| # | Date | Retour | Ou | Statut |
|---|---|---|---|---|
| 1 | 2026-11-02 | « + Ajouter » : le menu deroulant des categories de depense ne fonctionne pas, ni sur telephone ni sur ordinateur | Confirme le 2026-11-02 : formulaire « Ajouter » de l'onglet Gestion. Le champ est un `<datalist>` (« Choisir ou ecrire ») : aucune liste ne s'ouvre au clic, et elle se filtre sur le texte deja saisi. L'onglet Depenses utilise un vrai menu et fonctionne. Corrige en v1.1.2.0 : vraie liste (s'ouvre au toucher, se filtre, « + Ajouter ») | Fait, a valider |
| 2 | 2026-11-02 | Analytics, vue d'ensemble : les filtres de « Evolution annuelle » ne fonctionnent pas du tout, la page plante ; « Filtrer les donnees » ne change pas selon l'annee | Confirme le 2026-11-02 dans l'app en ligne : le choix d'annee du graphique est ignore (le code lit celui du haut), celui du haut ne recalcule ni le graphique ni les pastilles, « 12 mois » = 12 mois glissants et non l'annee. Les ecouteurs des filtres du haut s'ajoutent a chaque ouverture d'Analytics. Corrige en v1.1.2.0 (filtres du haut pour toute la page) | Fait, a valider |
| 3 | 2026-11-02 | Jordan : graphique « Evolution annuelle » tres peu lisible, a refaire entierement en partant des besoins (et qu'il marche) | onglet Analytics, vue d'ensemble ; refait en v1.1.2.0 (`tasks/todo-analytics.md`) | Fait, a valider |
| 4 | 2026-11-02 | Jordan (v1.1.2.1) : la fenetre « Ajouter » de Gestion force un ascenseur sur PC, et la liste « Catégorie » est coupee ; le texte du champ aussi | Mesure en ligne : liste fermee 475/475 px, liste ouverte 521/475 px -> la liste (posee dans la fenetre) depasse et se fait couper. Champ de 171 px : « Choisir ou écrire » tronque. Correction : liste flottante hors de la fenetre + champ en pleine largeur | Fait, a valider |
