# v1.1.0.0 — Onglet "Gestion" (pro + perso) et corrections des calculs

Demande d'Elise (2026-11-02) : comprendre sa situation d'un coup d'oeil, sans jargon comptable.
L'audit des calculs actuels (avec ses chiffres) est dans `tasks/prive/` (ignore par Git : le depot
est public, aucun montant personnel ne doit etre commite, ni dans le code ni dans ce fichier).

## Principe (valide par Jordan le 2026-11-02)

- **Un outil de plus.** L'onglet LIT prestations, cartes cadeaux et depenses du logiciel. Il
  n'ecrit QUE dans ses propres tables.
- **Tres permissif.** Chaque chiffre calcule peut etre corrige a la main ; l'ecran affiche alors les
  deux (« calcule : X · saisi : Y ») et la correction peut etre annulee.
- **Pro ET perso**, comme son Excel : charges fixes, charges variables, revenus, epargne.
- **Tous les reglages sont modifiables dans l'app** (taux, seuils, matelas, besoin, charges fixes).
- **Une seule version 1.1.0.0** : onglet + corrections des calculs existants, livres ensemble.

## Decisions actees

| Sujet | Choix |
|---|---|
| Reference | Le logiciel fait foi (l'Excel oubliait des choses) : le but est de tout centraliser |
| Taux URSSAF | 21,4 %, modifiable |
| CA du mois | Calcule automatiquement, ET saisie manuelle du montant declare qui prend le dessus |
| Lissage URSSAF | Chiffre « A declarer ce mois-ci » (= encaisse du mois precedent) + message informatif sur ce qui reste non declare pour ce mois. Pas de cumul, rien retire de « Je peux me verser » : elle paie souvent l'URSSAF depuis un autre compte ou elle a mis de l'argent de cote |
| Rattachement | URSSAF et Google Ads comptent dans le mois qu'ils concernent pour « Ce qu'il me reste » ; les comptes suivent les vraies dates de prelevement |
| Je peux me verser | Reserve fin du mois cloture − URSSAF a payer sur le declare − facture Ads a venir − matelas ; plafonne a ce que le mois a rapporte ; jamais negatif |
| Statuts | OK >= besoin ; Tendu >= 70 % du besoin ; Alerte en dessous. Modifiables |
| Comptes | Compte pro, caisse especes, compte perso, epargne. Chaque mouvement dit d'ou part l'argent |
| Soldes | Recopies depuis l'appli bancaire, actualisables a tout moment ; estimation entre deux saisies |
| Charges fixes | Pas de « jour de prelevement » : une charge fixe compte pour le mois. Mensuelle ou annuelle (CFE) |
| HeadSpa | Jenny encaisse puis paie Elise : le prix du logiciel (sa part) est juste |
| Loyer cabine | Par jour travaille, comme le logiciel le compte ; paye en especes le plus souvent |
| CFE | Charge annuelle (mois et montant saisis dans l'app), modifiable |
| Google Ads | Lu directement chez Google (cout du compte par mois), aucune saisie |
| SumUp | 1,75 % des paiements carte, modifiable. CA = montant paye par la cliente, la commission est un frais |
| Depart | Le mois precedent (octobre 2026) sert de base ; utilisation reelle a partir de novembre |
| Analytics | Utilise aussi l'encaisse (regle d'Elise), comme tous les ecrans |
| Transport | Estimations kilometriques laissees telles quelles (presque plus de domicile), exclues de la gestion |

## Stockage (`scripts/migration-gestion.sql`)

- `gestion_mouvements` : date, espace (pro|perso), sens (entree|sortie|transfert), compte,
  compte_vers (transfert), categorie, montant (toujours positif), libelle, mois_concerne.
- `gestion_recurrents` : charges fixes, revenus fixes, epargne programmee ; espace, sens, compte,
  compte_vers, categorie, nom, montant, frequence (mensuelle|annuelle) + mois_annuel, debut, fin.
- `gestion_mois` : une ligne par mois ; ca_declare, corrections JSONB, cloture_le, notes.
- `gestion_soldes` : solde recopie d'un compte a une date.
- IDs TEXT, dates TEXT, RLS `users_own_data` (meme convention que `migration-relances.sql`).
- Reglages : cle `gestion` dans `parametres` (mecanisme normal de l'app). Valeurs personnelles
  saisies dans l'ecran Reglages, jamais en dur dans le code.
- Pourquoi pas tout dans `parametres` : `saveParametresToDb()` re-ecrit TOUTES les cles depuis
  `appData.parametres` charge au demarrage ; des donnees du mois y seraient ecrasees par une copie
  perimee a chaque sauvegarde d'un reglage ailleurs dans l'app.

## Une seule regle d'encaissement (`js/core/encaissements.js`)

- Prestation : `prix` + `tips`, sauf `prix` d'une prestation payee par carte cadeau
  (`moyenPaiement === 'Bon cadeau'` ou `bonCadeauId`) ; ses tips restent de l'argent recu.
- Carte cadeau : `montant` au mois de `dateAchat` ; un remboursement retire le montant au mois de
  `dateRemboursement`.
- Moyens : Liquide -> caisse ; Carte bleue -> compte pro (commission SumUp) ; Virement, Cheque -> compte pro.
- Utilisee par l'onglet Gestion ET par tous les ecrans existants (correction C1).

## Pieges releves par l'audit (ne pas reproduire)

- Ne PAS reutiliser la boucle `setMonth(getMonth() - i)` : iterer sur des chaines 'YYYY-MM'.
- Dates en TEXT 'YYYY-MM-DD' : decouper la chaine, pas de `new Date()` (fuseau horaire).
- `bonCadeauId` n'etait jamais enregistre sur une nouvelle prestation : `moyenPaiement` fait foi.
- Depenses `Transport` / « Frais kilometriques » = estimations : exclues de la gestion.
- Cout Google Ads du tableau de bord : cache non fiable. La gestion interroge Google elle-meme.

## Corrections de l'app existante

- [x] C1. Une seule definition de l'encaisse pour tous les ecrans (accueil, tuile Analytics,
      graphique, camembert des moyens de paiement, Google Ads)
- [x] C2. Carte cadeau remboursee : retiree au mois du remboursement, partout
- [x] C3. Nouvelle prestation payee par carte cadeau : prix a 0, `bonCadeauId` enregistre
- [x] C4. Formulaire de modification : option « Bon cadeau »
- [x] C5. Moyen de paiement « Virement » pour les prestations
- [x] C6. Abonnements : rattraper les mois manques, plus de doublon apres modification
- [x] C7. Boucle des mois du graphique et des filtres : plus de mois en double ou sautes
- [x] C8. « Annee actuelle » qui prenait toutes les annees dans plusieurs blocs d'Analytics
- [x] C9. Cout Google Ads du mois sur l'accueil : plus d'estimation (total / 12, / 4) ecrite dans le cache

## Plan

- [x] 1. Migration `scripts/migration-gestion.sql` (4 tables + RLS), lancee via le connecteur (accord de Jordan)
- [x] 2. `js/core/encaissements.js` + tests Node
- [x] 3. Corrections C1 a C9
- [x] 4. `js/gestion/gestion-calculs.js` (pur) + tests Node sur des cas reels
- [x] 5. `js/gestion/gestion-donnees.js` : ses tables + couts Google Ads par mois
- [x] 6. `js/gestion/gestion-vue.js` + `css/gestion.css` : Pro (4 chiffres, detail, caisse, comptes,
      cloture), Perso (revenus, fixes, variables, epargne), Reglages ; mobile d'abord
- [x] 7. Courbe de la reserve 12 mois + projection jusqu'au printemps
- [x] 8. Onglet dans les deux menus ; version 1.1.0.0 (package.json, index.html x2), estampille, cache `sw.js`
- [ ] 9. Verification en local avec le compte d'Elise, telephone + ordinateur

## Revue (2026-11-02)

- Tables `gestion_*` creees et protegees (RLS, une politique par table), via le connecteur, avec l'accord de Jordan.
- `npm test` : 21 tests (regle d'encaissement + calculs de la gestion), donnees fictives uniquement.
- Corrections C1 a C9 relues ; banc d'essai Node de l'agent : tableau de bord, graphique, pastilles,
  boucles de mois, rattrapage des abonnements (11 cas), conservation a la modification, carte cadeau.
- Panier moyen d'Analytics : prestations payees uniquement (ni ventes de cartes cadeaux, ni prestations
  reglees par carte cadeau).
- Onglet verifie sur `tests/apercu-gestion.html` (donnees fictives) a 375 px et 1280 px : pas de
  debordement, formulaires, changement de type sans perte de saisie, perso, reglages, courbe.
- Reste : etape 9, verification avec les vraies donnees (Jordan se connecte en local).
- Laisse tel quel : depenses Transport ; `calculerDateExpiration` (meme debordement de `setMonth`,
  mais changer la regle changerait des dates d'expiration deja enregistrees).
- Carte cadeau (regle d'Elise : « utilisee » quand la cliente est venue) : si la prestation reglee
  par carte est supprimee, ou corrigee vers un autre moyen de paiement, la carte redevient active
  (`libererBonsCadeauxDe`, business-services.js). Verifie sur 4 cas.
- Pre-remplissage valide par Jordan (2026-11-02), ecrit dans SA base uniquement : charges fixes pro
  et perso, soldes au 31 octobre repris de l'Excel (a verifier par Elise), reglages et categories,
  deux frais d'octobre absents du logiciel. Epargne : pas de ligne automatique, Elise adapte chaque mois.
