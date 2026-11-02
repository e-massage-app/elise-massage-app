# v1.1.1.0 — Google Ads par une fonction Supabase (plus aucune cle dans le depot)

Probleme (2026-11-02) : le jeton developpeur Google Ads et le secret OAuth etaient ecrits dans le code,
alors que le depot est public ; la connexion Google (jetons) etait gardee dans `parametres`, lisible par
le navigateur et ecrasable par un vieil onglet.

## Principe

- Fonction Supabase `google-ads` (`supabase/functions/google-ads/index.ts`) : relais en LECTURE SEULE.
  Elle n'accepte que `customers:listAccessibleCustomers` et `customers/{id}/googleAds:search(Stream)`,
  et refuse tout le reste (regle de Jordan : Google Ads en lecture seule).
- Les cles sont des secrets Supabase : `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`,
  `GOOGLE_ADS_DEVELOPER_TOKEN`. Jamais dans le depot, jamais dans le navigateur.
- La connexion Google (refresh token) est dans la table `google_ads_connexion`
  (`scripts/migration-google-ads.sql`) : RLS sans politique, seule la fonction (service_role) y accede.
- Nouveau client OAuth « Elise Massage App (web) » (projet Google Cloud elise-massage-analytics, deja
  « En production »). URI de redirection : `https://app.elise-massage.fr/google-ads-retour.html` et
  `http://localhost:3457/google-ads-retour.html`. Plus de code a copier-coller.
- Navigateur : `js/core/google-ads.js` (`GoogleAdsApi`). `appel()` renvoie la reponse Google telle quelle,
  donc le code existant qui lit les reponses n'a pas change. `getValidTokens()` garde son nom et sa forme
  (objet si connecte, sinon null). Retour de Google : `google-ads-retour.html`.

## Ordre de mise en ligne

- [x] Code : fonction, migration, module navigateur, page de retour, appels remplaces (5 endroits),
      ancien code de connexion supprime (secret OAuth et jeton developpeur retires du code)
- [x] Jordan : creer le client « Elise Massage App (web) » et coller les 3 secrets dans Supabase
- [x] Accord de Jordan : creer la table (migration) et deployer la fonction (2026-11-02)
- [x] Verifier la fonction deployee : preflight CORS 200, refus sans session (401), refus sans autorisation (401)
- [x] Pousser la v1.1.1.0 (le front ne doit partir qu'APRES la fonction)
- [x] Elise se reconnecte une fois (fait le 2026-11-02 ; la fonction repond « connecte »)
- [x] Jordan : supprimer l'ancien client « Elise Massage Pro » (fait le 2026-11-02 ; son secret, reste dans l'historique public, ne sert plus a rien).
      Jeton developpeur : Google ne l'exige plus (bandeau du Centre API, 2026-11-02), la fonction ne
      l'envoie que s'il est renseigne ; le regenerer reste possible mais n'est plus urgent
