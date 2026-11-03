# Carte cadeau payee en ligne, bon recu tout de suite (plan valide par Jordan le 2026-11-03)

Demande de Jordan (2026-11-03) : « le but, c'est vraiment de gagner du temps et que ce soit
instantane ». Le client paie par carte sur le site, le bon PDF (le vrai visuel d'Elise) part aussitot
par e-mail et le bon apparait dans le logiciel. Pas de « paiement par lien » (il faudrait l'envoyer a
la main). Jordan prepare et colle lui-meme les cles ; les CGV se mettent a jour une fois tout branche,
teste et valide ensemble.

## Le parcours

1. Page Carte cadeau : le client compose la carte comme aujourd'hui, puis choisit comment payer :
   - **Carte bancaire** : « votre bon arrive par e-mail des le paiement » ;
   - **Virement** : Elise envoie son RIB par e-mail ou SMS (a la main) ; le bon est fait a reception du
     virement, donc avec un delai ;
   - **Sur place** : paiement en especes a l'institut et retrait du bon imprime.
   Ce que chaque choix implique est explique sur la page (delais, qui fait quoi). Quel que soit le
   paiement (carte ou virement), le bon imprime peut aussi etre retire ensuite a l'institut,
   gratuitement.
2. Carte bancaire : le site appelle une fonction Supabase qui recalcule le prix (jamais celui envoye
   par le navigateur), enregistre la commande, cree le paiement SumUp et renvoie l'adresse de la page
   de paiement SumUp (« hosted checkout »). Le client y paie (3D Secure compris).
3. SumUp previent notre fonction (`return_url`, evenement `CHECKOUT_STATUS_CHANGED`, seulement l'id).
   La fonction **redemande le statut a SumUp** avec la cle secrete ; si c'est paye et pas deja traite :
   - cree le bon dans `bons_cadeaux` (actif, valable 6 mois, « CB en ligne (SumUp) », textes du bon) ;
   - fabrique le PDF (meme modele, memes polices et memes regles que le bouton 🖨️ de l'app) ;
   - l'envoie par e-mail a l'acheteur SEULEMENT (Elise prevenue a part) ;
   - note la commande « envoyee ».
4. Le client revient sur le site (`redirect_url`) : page « Merci, votre bon arrive par e-mail ». Elle
   redemande le statut (au cas ou la notification SumUp arriverait apres lui).

## Ce qu'il faut construire

**Supabase (depot de l'app)**
- [x] Table `commandes_carte_cadeau` (migration idempotente) : mode de paiement, montant, prestation,
      acheteur, beneficiaire (dont telephone), message, format, id du paiement SumUp, statut
      (`en_attente`, `payee`, `envoyee`, `echouee`, `expiree`), id du bon cree, erreur. Lecture par Elise
      seulement (RLS) ; ecriture par les fonctions.
- [x] Fonction `carte-cadeau` (une seule, routes `commande`, `statut`, `sumup`, `relancer`, `etat`) : verifie le formulaire (prix lu dans la liste publiee par le
      site, montant libre entre 50 EUR et un plafond, textes qui tiennent sur le bon), cree le paiement SumUp.
- [x] Notification SumUp (route `sumup`) : verification aupres de SumUp, une seule fois par
      paiement (rejouable sans doublon), bon + PDF + e-mail ; repond vite a SumUp.
- [x] PDF cote serveur : reutiliser `js/core/bon-cadeau-carte.js` (regles pures, deja testees) et le
      modele `assets/bon-cadeau/` ; pdf-lib dans la fonction.
- [x] E-mails Resend depuis `no-reply@elise-massage.fr` (decision de Jordan : pas de reponses sur
      cette adresse ; le message renvoie vers contact@ et le telephone), PDF en piece jointe.
- [ ] Logiciel : les bons crees en ligne visibles comme les autres (+ mention « paye en ligne ») ;
      une commande payee mais non envoyee (erreur) signalee a Elise.

**Site**
- [x] Choix du paiement dans le formulaire, chaque option expliquee ; carte bancaire -> fonction puis
      page SumUp ; virement et sur place -> envoi actuel (Web3Forms).
- [x] « Le bon est envoye a VOTRE adresse (celle de l'acheteur), pas a celle du beneficiaire », ecrit
      clairement ; champ « adresse de reception du bon », pre-rempli avec l'e-mail de l'acheteur et
      modifiable.
- [x] Format papier : avec la carte bancaire, le PDF part tout de suite ET le bon imprime peut etre
      retire a l'institut.
- [x] Liste des prix publiee a la construction (`soins.ts` reste la seule source des prix).
- [x] Page de retour « Merci » (paye / en cours / echec, avec que faire).
- [x] « Pensez a regarder vos courriers indesirables (spams) » : sous le choix « carte bancaire » et
      sur la page « Merci » (demande de Jordan).

## Fait le 2026-11-03

- [x] Resend : domaine `elise-massage.fr` ajoute au compte de Jordan (gamezoneyt, region Irlande) ;
      enregistrements poses chez OVH (CNAME `send` et `rsend`, TXT `resend._domainkey`, TXT `_dmarc`
      `v=DMARC1; p=none;`) et verifies sur le serveur DNS d'OVH. Les sauvegardes du lundi passeront par ce
      compte (`no-reply@elise-massage.fr`) quand Jordan aura remplace la cle RESEND_API_KEY.

## Fait le 2026-11-03 (soir), pendant que Jordan etait absent

Construit, deploye cote serveur, teste en bac a sable. RIEN de publie sur le site (branche Git
`paiement-en-ligne` du site, essai sur `essai.elise-massage.pages.dev`, non indexe) ; l'app n'est pas
poussee (bump de version a valider).

- Compte SumUp de test « Elise Massage TEST » (`MTCMVPMC`) cree par Jordan ; cle `SUMUP_API_KEY`
  collee par Jordan dans les secrets Supabase. La fonction reconnait seule le compte de test
  (`GET /v1/merchants/{code}` -> `sandbox: true`) : commande marquee `essai`, AUCUN bon dans le
  logiciel, rien chez Elise (son e-mail va a l'adresse saisie), sujets « [ESSAI] ». Paiement reel
  refuse depuis un site d'essai ou le serveur de developpement.
- Une seule fonction `carte-cadeau` (au lieu de deux) : la notification, la page « Merci » et le filet
  de securite partagent le meme envoi. Code marchand lu par la cle (`/v0.1/me`) : un seul secret.
- PDF : `creerPdf` deplace dans `js/core/bon-cadeau-carte.js`, utilise par l'app ET la fonction (meme
  dessin a l'octet pres) ; modele et polices lus sur l'app publiee (3 essais : GitHub Pages a repondu
  503 une fois pendant les essais).
- Regles de commande pures et testees : `js/core/carte-cadeau-commande.js` (10 tests ; 159 en tout).
- Filet de securite : tache pg_cron `carte-cadeau-relance` toutes les 10 min, n'appelle la fonction
  que s'il reste une commande non envoyee de moins de 24 h (notification perdue, client parti).
- Bon cree au paiement (compte reel) : moyen « Carte bleue » (compte dans les encaissements ; un moyen
  inconnu serait compte en Liquide), notes « Paye en ligne... », textes du bon (`carte`) pour reimprimer.

Essais du 2026-11-03 (compte SumUp de test, adresse `delivered@resend.dev`, qui ne livre a personne) :
- refus : prix trafique, montant < 50 EUR, caractere non imprimable (𝄞), origine inconnue -> OK ;
- paiement reussi (carte de test 4200 0000 0000 0091) : notification SumUp recue, bon PDF + e-mail
  envoyes 2 s apres le paiement, page « Merci » « Votre carte cadeau est partie » -> OK ;
- carte de test « erreur 3D Secure » : la page SumUp reste sur le formulaire, la commande reste
  « en attente », rien n'est envoye -> OK ;
- e-mails (Resend) : « [ESSAI] Votre carte cadeau pour Camille 🎁 » avec `Bon-cadeau-Camille-...pdf`,
  et celui d'Elise -> Delivered. Resend signale « Don't use no-reply » (voir questions).
- l'app (tests/apercu-app) : le bouton 🖨️ fait toujours son PDF avec le dessin partage.

Reponses de Jordan (2026-11-03, soir) :
1. Bump 1.3.0.0 : OK (publie).
2. `reply_to` : OK. Acheteur -> contact@elise-massage.fr ; e-mails d'Elise -> l'adresse de l'acheteur
   (elle lui repond directement). Pied de l'e-mail : « Une question ? Repondez simplement a cet e-mail ».
3. Essai sur SON telephone, sur `elise-massage.pages.dev` (le site Cloudflare, pas encore public).
4. Vraie cle SumUp et paiement de controle : quand tout sera valide ensemble.
5. Compte de test : le bon est AUSSI cree dans le logiciel (pour tout verifier), marque « [ESSAI] » dans
   la description et les notes, a supprimer apres verification (il compte dans les encaissements tant
   qu'il est la : moyen « Carte bleue »).

Qui peut payer avec quel compte (`refusPaiement`, teste) : www = compte reel seulement ; Cloudflare
(`elise-massage.pages.dev` et ses essais) = les deux ; serveur de developpement = test seulement.
Essai du 2026-11-03 (soir) en local : paiement de test -> commande envoyee, bon « [ESSAI] Massage
Signature 60 min » cree (80 EUR, Carte bleue, valable au 3 mai 2027, textes du bon, notes) -> OK, puis
supprime (le mien).

## Ce que Jordan prepare (je lui donne tout pret, il valide et colle lui-meme)

- [x] SumUp > Parametres > Developpeurs : creer un **bac a sable** et sa cle API de test ; plus tard,
      la vraie cle. Les cles vont dans les secrets Supabase, jamais dans le code.
- [x] Resend : ajouter le domaine `elise-massage.fr` ; chez OVH, les 3 ou 4 enregistrements DNS
      demandes par Resend (sur un sous-domaine d'envoi : la messagerie `contact@` n'est pas touchee).

## Tests avant la mise en route (ensemble)

- [ ] Tout dans le bac a sable SumUp (aucun vrai argent) : paiement reussi, refuse (montant de 11 EUR
      = toujours refuse), abandonne, notification en double, notification en retard.
- [x] Verifier dans la doc et en bac a sable les valeurs exactes du statut d'un paiement (PAID ?).
- [ ] Le PDF recu : identique a celui de l'app, vectoriel, 210 x 100 mm.
- [ ] Puis la vraie cle, et un vrai petit paiement de controle si Jordan le souhaite.
- [ ] Ensuite seulement : CGV (droit de retractation de 14 jours pour la vente a distance, mediateur).

## Decisions (Jordan et Elise, 2026-11-03)

1. Montant libre : 50 EUR minimum, pas de plafond.
2. Le PDF part a l'acheteur seulement, en le disant clairement ; adresse de reception modifiable.
3. Carte bancaire + version papier : le PDF tout de suite ET le bon imprime a retirer.
4. Expediteur : `no-reply@elise-massage.fr`.
5. Frais SumUp en ligne : a lire dans son compte (Jordan suppose les memes qu'en CB).
6. DNS : Jordan connecte son OVH pour que je pose les enregistrements de Resend (je les montre avant
   d'enregistrer). Sans lien avec la bascule du site : la zone DNS reste chez OVH avant et apres,
   seul le `www` changera ce jour-la.
