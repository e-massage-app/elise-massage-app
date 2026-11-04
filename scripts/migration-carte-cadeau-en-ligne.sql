-- v1.3.0.0 : cartes cadeaux payees par carte bancaire sur le site (plan : tasks/todo-carte-cadeau-en-ligne.md).
-- Une ligne par commande. Seule la fonction Supabase « carte-cadeau » (cle service_role) ecrit ;
-- Elise, connectee, peut lire les siennes. Depuis le navigateur, rien d'autre (ni anon ni ecriture).
-- Idempotente : peut etre relancee sans risque.

create table if not exists public.commandes_carte_cadeau (
  id text primary key,                  -- reference de la commande = checkout_reference SumUp (non devinable)
  user_id uuid not null references auth.users(id),
  cree_le timestamptz not null default now(),
  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'payee', 'envoyee', 'echouee', 'expiree')),
  essai boolean not null default false, -- compte SumUp de test : aucun bon dans le logiciel, rien a Elise
  origine text,                         -- adresse du site qui a passe la commande
  montant numeric not null check (montant > 0),
  prestation text not null,             -- choix du formulaire (« Massage Signature 60 min : 80 € »)
  soin text not null,                   -- tel qu'imprime sur le bon
  beneficiaire_prenom text not null,
  beneficiaire_nom text not null,
  beneficiaire_telephone text,
  acheteur_prenom text not null,
  acheteur_nom text not null,
  acheteur_email text not null,
  acheteur_telephone text,
  email_reception text not null,        -- ou part le PDF (celle de l'acheteur, sauf choix contraire)
  message text,
  papier boolean not null default false, -- bon imprime a retirer a l'institut, en plus du PDF
  remarques text,
  carte jsonb not null,                 -- textes du bon { offertPar, pour, soin, message }
  bon_cadeau_id text not null,          -- id du bon cree au paiement, fixe des la commande (rejouable sans doublon)
  sumup_checkout_id text unique,
  sumup_transaction_code text,
  paye_le timestamptz,
  tentative_le timestamptz,             -- debut du dernier envoi (bon + PDF + e-mails) : un seul a la fois
  envoye_le timestamptz,
  erreur text,                          -- pourquoi l'envoi a echoue (Elise est prevenue par e-mail)
  alerte_le timestamptz                 -- quand Elise a ete prevenue d'un echec (une seule fois)
);

create index if not exists commandes_carte_cadeau_user_cree on public.commandes_carte_cadeau (user_id, cree_le desc);

alter table public.commandes_carte_cadeau enable row level security;
revoke all on public.commandes_carte_cadeau from anon, authenticated;
grant select on public.commandes_carte_cadeau to authenticated;

drop policy if exists elise_lit_ses_commandes on public.commandes_carte_cadeau;
create policy elise_lit_ses_commandes on public.commandes_carte_cadeau
  for select to authenticated using (auth.uid() = user_id);

-- Filet de securite : deux fois par jour, 7 h 07 et 19 h 07 UTC (toutes les 10 min jusqu'au 2026-11-04,
-- allegee pour la reserve disque de l'offre gratuite de Supabase ; 12 h d'ecart < 24 h de suivi : chaque
-- commande est vue au moins une fois). S'il reste une commande des dernieres 24 h pas encore
-- envoyee, la fonction redemande son statut a SumUp et l'envoie si elle est payee (notification
-- perdue, client parti sans revenir sur le site). Rien n'est appele s'il n'y a rien a suivre.
-- Meme mot de passe que la sauvegarde du lundi (Vault sauvegarde_secret = secret SAUVEGARDE_SECRET).
select cron.unschedule('carte-cadeau-relance') where exists (select 1 from cron.job where jobname = 'carte-cadeau-relance');
select cron.schedule('carte-cadeau-relance', '7 7,19 * * *', $$
  select net.http_post(
    url := 'https://ixuwialfycbzvliezliv.supabase.co/functions/v1/carte-cadeau/relancer',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sauvegarde-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sauvegarde_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  )
  where exists (
    select 1 from public.commandes_carte_cadeau
    where statut in ('en_attente', 'echouee', 'payee')
      and sumup_checkout_id is not null
      and cree_le > now() - interval '24 hours'
  );
$$);
