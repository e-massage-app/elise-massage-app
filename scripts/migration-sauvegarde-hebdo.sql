-- =====================================================================
-- MIGRATION SAUVEGARDE HEBDOMADAIRE — v1.2.0.0
-- Chaque lundi a 06:00 UTC (7 h a Paris l'hiver, 8 h l'ete), pg_cron appelle la fonction Supabase
-- « sauvegarde-hebdo » (supabase/functions/sauvegarde-hebdo), qui envoie toute la base par e-mail :
-- un fichier JSON au format de l'export de l'app, a re-importer tel quel (bouton « Importer »).
-- Idempotente : rejouable sans risque (le job est remplace s'il existe deja).
--
-- ETAPES MANUELLES, DANS CET ORDRE (rien ne se fait tout seul) :
--
--  1. Resend (resend.com) : creer un compte, puis une cle API (« Sending access » suffit).
--     ATTENTION : avec l'expediteur de test onboarding@resend.dev, Resend n'envoie QU'A l'adresse
--     du compte Resend. Creer le compte avec l'adresse d'Elise (destinataire) ; sinon, verifier le domaine
--     elise-massage.fr dans Resend et changer EXPEDITEUR dans la fonction.
--
--  2. Choisir un secret long et aleatoire (ex. : openssl rand -hex 32). Le garder hors du depot
--     (depot public) : il ne va que dans les secrets de la fonction et dans le Vault.
--
--  3. Secrets de la fonction (Dashboard > Edge Functions > Secrets, ou en ligne de commande) :
--       supabase secrets set RESEND_API_KEY=re_... SAUVEGARDE_DESTINATAIRE=<adresse d'Elise> SAUVEGARDE_SECRET=<secret>
--     (l'adresse reste un secret : le depot est public)
--
--  4. Deployer la fonction SANS verification de jeton (pg_cron n'a pas de session ; c'est l'en-tete
--     x-sauvegarde-secret qui protege la fonction) :
--       supabase functions deploy sauvegarde-hebdo --no-verify-jwt
--
--  5. Ranger le MEME secret dans le Vault (SQL Editor) :
--       select vault.create_secret('<secret>', 'sauvegarde_secret', 'En-tete x-sauvegarde-secret de sauvegarde-hebdo');
--     Pour le changer plus tard (et le changer aussi a l'etape 3) :
--       select vault.update_secret((select id from vault.secrets where name = 'sauvegarde_secret'), '<nouveau>');
--
--  6. Jouer ce fichier dans le SQL Editor.
--
--  7. Essayer tout de suite, sans attendre lundi (bloc « ESSAI » en bas), puis lire la reponse :
--       select status_code, content from net._http_response order by created desc limit 1;
--     200 = e-mail parti ; 401 = secret different entre Vault et fonction ; 500 = voir « content ».
-- =====================================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Rejouable : on retire l'ancien job du meme nom avant de le recreer
select cron.unschedule(jobid) from cron.job where jobname = 'sauvegarde-hebdo';

select cron.schedule(
  'sauvegarde-hebdo',
  '0 6 * * 1',  -- lundi 06:00 UTC
  $$
  select net.http_post(
    url := 'https://ixuwialfycbzvliezliv.supabase.co/functions/v1/sauvegarde-hebdo',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sauvegarde-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sauvegarde_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000  -- lecture de toutes les tables + envoi : plus que les 5 s par defaut
  );
  $$
);

-- Controle : le job doit apparaitre, actif
select jobid, jobname, schedule, active from cron.job where jobname = 'sauvegarde-hebdo';

-- ---------------------------------------------------------------------
-- ESSAI (a lancer a la main, une fois les etapes 1 a 6 faites)
-- ---------------------------------------------------------------------
-- select net.http_post(
--   url := 'https://ixuwialfycbzvliezliv.supabase.co/functions/v1/sauvegarde-hebdo',
--   headers := jsonb_build_object(
--     'Content-Type', 'application/json',
--     'x-sauvegarde-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sauvegarde_secret')
--   ),
--   body := '{}'::jsonb,
--   timeout_milliseconds := 120000
-- );
-- Historique des passages du job : select * from cron.job_run_details order by start_time desc limit 5;
