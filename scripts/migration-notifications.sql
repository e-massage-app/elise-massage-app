-- v1.4.0.0 : notifications de l'app (cloche en haut a droite). Table generique : les fonctions Supabase
-- y ecrivent (cle service_role : carte cadeau payee en ligne, envoi echoue ; plus tard d'autres) ;
-- Elise, connectee, les lit et les marque lues (seule la colonne lu_le). En temps reel : la table est
-- dans la publication supabase_realtime (l'app s'abonne aux nouvelles lignes, RLS respectee).
-- Idempotente : peut etre relancee sans risque.

create table if not exists public.notifications (
  id text primary key,                  -- fixe par l'emetteur (rejouable sans doublon), ex. n_cc_<commande>
  user_id uuid not null references auth.users(id) on delete cascade,
  cree_le timestamptz not null default now(),
  type text not null,                   -- 'carte-cadeau', 'carte-cadeau-erreur'...
  titre text not null,
  texte text,
  lien jsonb,                           -- ce qu'ouvre un clic : { "onglet": "bons-cadeaux", "bonId": "..." }
  lu_le timestamptz
);

create index if not exists notifications_user_cree on public.notifications (user_id, cree_le desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (lu_le) on public.notifications to authenticated;

drop policy if exists elise_lit_ses_notifications on public.notifications;
create policy elise_lit_ses_notifications on public.notifications
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists elise_marque_ses_notifications on public.notifications;
create policy elise_marque_ses_notifications on public.notifications
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Temps reel : nouvelles notifications poussees a l'app ouverte
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
