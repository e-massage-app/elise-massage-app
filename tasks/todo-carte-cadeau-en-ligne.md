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
- [ ] Table `commandes_carte_cadeau` (migration idempotente) : mode de paiement, montant, prestation,
      acheteur, beneficiaire (dont telephone), message, format, id du paiement SumUp, statut
      (`en_attente`, `payee`, `envoyee`, `echouee`, `expiree`), id du bon cree, erreur. Lecture par Elise
      seulement (RLS) ; ecriture par les fonctions.
- [ ] Fonction `carte-cadeau-commande` : verifie le formulaire (prix lu dans la liste publiee par le
      site, montant libre entre 50 EUR et un plafond, textes qui tiennent sur le bon), cree le paiement SumUp.
- [ ] Fonction `carte-cadeau-sumup` (notification) : verification aupres de SumUp, une seule fois par
      paiement (rejouable sans doublon), bon + PDF + e-mail ; repond vite a SumUp.
- [ ] PDF cote serveur : reutiliser `js/core/bon-cadeau-carte.js` (regles pures, deja testees) et le
      modele `assets/bon-cadeau/` ; pdf-lib dans la fonction.
- [ ] E-mails Resend depuis `no-reply@elise-massage.fr` (decision de Jordan : pas de reponses sur
      cette adresse ; le message renvoie vers contact@ et le telephone), PDF en piece jointe.
- [ ] Logiciel : les bons crees en ligne visibles comme les autres (+ mention « paye en ligne ») ;
      une commande payee mais non envoyee (erreur) signalee a Elise.

**Site**
- [ ] Choix du paiement dans le formulaire, chaque option expliquee ; carte bancaire -> fonction puis
      page SumUp ; virement et sur place -> envoi actuel (Web3Forms).
- [ ] « Le bon est envoye a VOTRE adresse (celle de l'acheteur), pas a celle du beneficiaire », ecrit
      clairement ; champ « adresse de reception du bon », pre-rempli avec l'e-mail de l'acheteur et
      modifiable.
- [ ] Format papier : avec la carte bancaire, le PDF part tout de suite ET le bon imprime peut etre
      retire a l'institut.
- [ ] Liste des prix publiee a la construction (`soins.ts` reste la seule source des prix).
- [ ] Page de retour « Merci » (paye / en cours / echec, avec que faire).
- [ ] « Pensez a regarder vos courriers indesirables (spams) » : sous le choix « carte bancaire » et
      sur la page « Merci » (demande de Jordan).

## Fait le 2026-11-03

- [x] Resend : domaine `elise-massage.fr` ajoute au compte de Jordan (gamezoneyt, region Irlande) ;
      enregistrements poses chez OVH (CNAME `send` et `rsend`, TXT `resend._domainkey`, TXT `_dmarc`
      `v=DMARC1; p=none;`) et verifies sur le serveur DNS d'OVH. Les sauvegardes du lundi passeront par ce
      compte (`no-reply@elise-massage.fr`) quand Jordan aura remplace la cle RESEND_API_KEY.

## Ce que Jordan prepare (je lui donne tout pret, il valide et colle lui-meme)

- [ ] SumUp > Parametres > Developpeurs : creer un **bac a sable** et sa cle API de test ; plus tard,
      la vraie cle. Les cles vont dans les secrets Supabase, jamais dans le code.
- [ ] Resend : ajouter le domaine `elise-massage.fr` ; chez OVH, les 3 ou 4 enregistrements DNS
      demandes par Resend (sur un sous-domaine d'envoi : la messagerie `contact@` n'est pas touchee).

## Tests avant la mise en route (ensemble)

- [ ] Tout dans le bac a sable SumUp (aucun vrai argent) : paiement reussi, refuse (montant de 11 EUR
      = toujours refuse), abandonne, notification en double, notification en retard.
- [ ] Verifier dans la doc et en bac a sable les valeurs exactes du statut d'un paiement (PAID ?).
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
