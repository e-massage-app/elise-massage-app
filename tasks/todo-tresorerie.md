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
| Lissage URSSAF | Carte « A declarer pour <mois> » (= encaisse DU mois affiche, declaration avant la fin du mois suivant) + montant declare saisi sur ce meme mois + message informatif sur ce qui reste non declare. Pas de cumul, rien retire de « Je peux me verser » : elle paie souvent l'URSSAF depuis un autre compte ou elle a mis de l'argent de cote |
| Une page = son mois | Chaque vue de mois ne montre que les chiffres de ce mois, rattaches « a l'instantane » meme s'ils sont payes ou declares le mois suivant (Jordan, 2026-11-02, v1.1.0.1). La v1.1.0.0 affichait sur octobre l'encaisse de septembre et y enregistrait le declare |
| Rattachement | URSSAF et Google Ads comptent dans le mois qu'ils concernent pour « Ce qu'il me reste » ; les comptes suivent les vraies dates de prelevement |
| Je peux me verser | v1.1.0.1 « a l'instantane » : ce que le mois affiche a rapporte jusqu'ici (encaisse − tous ses frais), reduit seulement si la reserve passerait sous le matelas une fois paye ce qui est deja du ; jamais negatif. Affiche « X € sur <besoin> » + jauge, « dont Y déjà versés ». Remplace le calcul sur le mois precedent cloture (v1.1.0.0) |
| Statuts | OK >= besoin ; Tendu >= 70 % du besoin ; Alerte en dessous. Modifiables. Seulement sur un mois termine : en debut de mois le chiffre part forcement de zero |
| Versements | « Me verser de l'argent » porte le mois concerne (`mois_concerne`) : un virement du 3 novembre peut compter pour octobre |
| Cloture | Supprimee en v1.1.0.1 (elle ne servait qu'a choisir le mois de calcul). La colonne `cloture_le` reste en base, inutilisee |
| Courbe | v1.1.0.1 : « Ce qu'il me reste en <mois>, jour par jour » = paye − frais − verse, rouge sous zero. Charges fixes le 1er (le mois demarre sous zero), Google Ads au jour le jour, URSSAF et commission avec chaque paiement. Remplace la courbe de la reserve et la projection (qui supposait un versement fixe et faisait peur) |
| Ma reserve | v1.1.0.2 « a l'instantane » : compte pro + caisse − ce qui est deja du (URSSAF, Ads… retires tout de suite, comme Revolut). L'URSSAF d'octobre sort fin octobre, novembre part de la (plus de double affichage). Le salaire n'est jamais retire d'office : « −X € si je me verse le salaire de <mois> → Y ». Detail : reserve fin du mois d'avant + ce que le mois a rapporte − ce que je me suis verse (a la vraie date) ± ecart avec les releves ; puis « Sur mes comptes » (banque + caisse, dont deja du) |
| Comptes | Compte pro, caisse especes, compte perso, epargne. Chaque mouvement dit d'ou part l'argent |
| Soldes | Recopies depuis l'appli bancaire, actualisables a tout moment ; estimation entre deux saisies |
| Charges fixes | Pas de « jour de prelevement » : une charge fixe compte pour le mois. Mensuelle ou annuelle (CFE) |
| HeadSpa | Jenny encaisse puis paie Elise : le prix du logiciel (sa part) est juste |
| Loyer cabine | Par jour travaille, comme le logiciel le compte ; paye en especes le plus souvent |
| CFE | Charge annuelle (mois et montant saisis dans l'app), modifiable |
| Google Ads | Lu directement chez Google, jour par jour depuis v1.1.0.1 (`segments.date`, cache d'une heure), aucune saisie. Pas de lissage : le cout de chaque jour tombe ce jour-la |
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
- [x] C10 (v1.1.0.1). Connexion Google Ads : les jetons s'enregistrent seuls (`saveParametresCles`) et
      `saveParametresToDb` ne les re-ecrit plus (ni la cle `gestion`) : un onglet ouvert depuis longtemps
      remettait d'anciens jetons. Parametres : « Connexion expirée » au lieu de « Connecté » quand le
      renouvellement echoue, bouton de reconnexion visible ; bandeau au demarrage ; alerte dans Gestion.
      Deconnexion : les cles sont videes en base (avant, elles revenaient au rechargement).
      Reste cote Google Cloud : passer l'ecran de consentement OAuth en « En production » (en « Test »,
      Google fait expirer le jeton de renouvellement au bout de 7 jours)

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

## Revue v1.1.0.1 (2026-11-02)

- Une vue = son mois : carte « À déclarer pour <mois> » (montant declare enregistre sur ce mois).
  Le declare d'octobre, saisi par erreur sur septembre en v1.1.0.0, a ete deplace (accord de Jordan).
- « Je peux me verser » a l'instantane, versements rattaches a un mois, cloture supprimee,
  courbe du mois jour par jour (Google Ads lu par jour), tuile reserve avec ce qui est a venir.
- `npm test` : 27 tests (dont mois termine / en cours, matelas, versement debut novembre pour
  octobre, trop verse, debut de mois negatif, courbe jour par jour), donnees fictives uniquement.
- Banc d'essai Node : un vieil onglet n'ecrase plus les jetons Google ni la cle `gestion`.
- Apercu (`tests/apercu-gestion.html`) a 375 px et 1280 px : tuiles sans debordement, courbe
  rouge sous zero, rattachement d'un versement a octobre, alerte Google Ads.

## Revue v1.1.0.2 (2026-11-02)

- Retour de Jordan sur la v1.1.0.1 : le « à venir » de la reserve retirait le salaire comme s'il etait
  verse, et l'URSSAF d'octobre apparaissait dans octobre ET dans novembre. Corrige (ligne « Ma reserve »).
- `npm test` : 29 tests, dont le bilan du mois (ecart 0 sur octobre et novembre, salaire verse
  le 3 novembre, releve inattendu = ecart).
- Script `date-fns` retire de index.html : il plantait au chargement depuis avril (format CommonJS),
  rien ne pouvait s'en servir. Verifie : plus d'erreur `require is not defined`, tous les modules chargent.

## v1.1.0.3 (2026-11-02)

- Tuile « Ma reserve » : ce qui compte est le sens (Jordan) : « ▲ +X € depuis fin <mois precedent> (Y €) »
  en vert, « ▼ » en rouge, puis « si je me verse le salaire : ▲ / ▼ / stable ». Se verser exactement ce
  que le mois permet laisse la reserve stable. Premier mois (pas de solde avant) : « point de depart ».
- Rappel : la carte de la v1.1.0.0 affichait sur octobre l'encaisse de septembre ; les chiffres en base
  n'ont jamais change (verifie le 2026-11-02).
