-- v1.1.1.0 : la connexion Google Ads quitte le navigateur.
-- La fonction Supabase « google-ads » (supabase/functions/google-ads) est la seule a lire et ecrire
-- cette table, avec la cle service_role. RLS active SANS politique : depuis le navigateur (anon ou
-- utilisatrice connectee), la table est illisible et non modifiable.
-- Idempotente : peut etre relancee sans risque.

create table if not exists public.google_ads_connexion (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text,          -- la connexion durable a Google (jamais envoyee au navigateur)
  access_token text,           -- jeton court (1 h), garde pour eviter de le redemander a chaque appel
  expire_le timestamptz,
  email text,                  -- le compte Google connecte (affichage)
  etat_oauth text,             -- jeton anti-falsification de la connexion en cours
  redirect_uri text,
  connecte_le timestamptz,
  maj_le timestamptz default now()
);

alter table public.google_ads_connexion enable row level security;
revoke all on public.google_ads_connexion from anon, authenticated;
