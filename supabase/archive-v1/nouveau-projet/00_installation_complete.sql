-- ############################################################################
-- INSTALLATION COMPLETE — Suivi de chantiers scolaires (MEN Côte d'Ivoire)
-- Projet Supabase DEDIE (migration depuis le projet partagé EXTERNAL).
--
-- À exécuter UNE SEULE FOIS dans le SQL Editor du nouveau projet, d'un bloc.
-- Contient, dans l'ordre : les 7 migrations de schéma puis le seed de
-- développement (4 lots, 50 établissements, 8 comptes de test).
--
-- Comptes de test — mot de passe commun : ChantierCI!2026
--   admin@chantierci.test / national@chantierci.test
--   regional.nord@ / regional.sud@ / coges.nord@ / coges.sud@ /
--   coges.est@ / coges.ouest@chantierci.test
--
-- NB : les préfixes chantierci_ sont conservés (cohérence avec le code de
-- l'application). Le bucket Storage reste « chantierci-photos-visites ».
-- ############################################################################


-- ============================================================================
-- SOURCE : supabase\migrations\20260612100000_schema_initial.sql
-- ============================================================================
-- ============================================================================
-- Migration 1/5 — Schéma initial
-- Suivi de chantiers scolaires — Côte d'Ivoire (MEN / Assemblage Ingénierie)
--
-- Déployé sur le projet Supabase partagé EXTERNAL (qui héberge aussi PEEB
-- Jordan) : tous les objets sont préfixés `chantierci_` pour éviter toute
-- collision (même convention que les apps du projet INTERNAL).
--
-- Tables : chantierci_lots, chantierci_profiles, chantierci_etablissements,
--          chantierci_marches_travaux, chantierci_paiements, chantierci_visites,
--          chantierci_photos_visites, chantierci_commentaires
-- Note : la table `chantierci_commentaires` ne figure pas dans le modèle du
-- CDC (§3) mais est requise par la fonctionnalité régionale (§5.4 —
-- "Possibilité d'ajouter un commentaire sur un établissement, visible MEN + admin").
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Types énumérés
-- ----------------------------------------------------------------------------
create type public.chantierci_user_role as enum ('coges', 'regional', 'national', 'admin');
create type public.chantierci_statut_compte as enum ('en_attente', 'actif', 'suspendu');
create type public.chantierci_statut_chantier as enum ('non_demarre', 'en_cours', 'arrete', 'receptionne');
create type public.chantierci_sync_status as enum ('synced', 'pending_sync');

-- ----------------------------------------------------------------------------
-- Table chantierci_lots — lots géographiques (Nord / Sud / Est / Ouest)
-- ----------------------------------------------------------------------------
create table public.chantierci_lots (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  region text not null
);

comment on table public.chantierci_lots is 'Lots géographiques de chantiers, rattachés à une région.';

-- ----------------------------------------------------------------------------
-- Table chantierci_profiles — profils utilisateurs (id = auth.users.id)
-- La ligne est créée automatiquement à l''inscription (trigger sur auth.users,
-- voir migration fonctions). Le rôle effectif et le statut sont gérés par
-- l''admin ; le compte reste `en_attente` sans aucun accès aux données.
-- ----------------------------------------------------------------------------
create table public.chantierci_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nom_complet text not null default '',
  telephone text not null default '',
  role public.chantierci_user_role not null default 'coges',
  lot_ids uuid[] not null default '{}',
  statut_compte public.chantierci_statut_compte not null default 'en_attente',
  created_at timestamptz not null default now()
);

comment on table public.chantierci_profiles is 'Profils utilisateurs. role/statut_compte/lot_ids modifiables uniquement par un admin (trigger de protection).';
comment on column public.chantierci_profiles.lot_ids is 'Lots attribués (COGES : accès direct ; régional : détermine la ou les régions accessibles).';

-- ----------------------------------------------------------------------------
-- Table chantierci_etablissements
-- ----------------------------------------------------------------------------
create table public.chantierci_etablissements (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  nom_directeur text,
  telephone text,
  email text,
  latitude double precision,
  longitude double precision,
  province text,
  departement text,
  village text,
  lot_id uuid references public.chantierci_lots (id) on delete restrict,
  statut public.chantierci_statut_chantier not null default 'non_demarre',
  created_at timestamptz not null default now(),
  constraint chantierci_etablissements_latitude_valide check (latitude is null or latitude between -90 and 90),
  constraint chantierci_etablissements_longitude_valide check (longitude is null or longitude between -180 and 180)
);

comment on table public.chantierci_etablissements is 'Établissements scolaires en construction (~350 chantiers).';

-- ----------------------------------------------------------------------------
-- Table chantierci_marches_travaux
-- ----------------------------------------------------------------------------
create table public.chantierci_marches_travaux (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references public.chantierci_etablissements (id) on delete cascade,
  nom_entreprise text not null,
  numero_marche text not null,
  montant_marche numeric not null,
  date_demarrage date,
  date_fin_estimative date,
  constraint chantierci_marches_montant_positif check (montant_marche >= 0)
);

comment on table public.chantierci_marches_travaux is 'Marchés de travaux (montants en XOF).';

-- ----------------------------------------------------------------------------
-- Table chantierci_paiements
-- ----------------------------------------------------------------------------
create table public.chantierci_paiements (
  id uuid primary key default gen_random_uuid(),
  marche_id uuid not null references public.chantierci_marches_travaux (id) on delete cascade,
  date_paiement date not null,
  montant numeric not null,
  libelle text not null default '',
  saisi_par uuid references public.chantierci_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint chantierci_paiements_montant_positif check (montant > 0)
);

comment on table public.chantierci_paiements is 'Paiements sur marchés (XOF). Saisie réservée aux rôles national et admin.';

-- ----------------------------------------------------------------------------
-- Table chantierci_visites
-- ----------------------------------------------------------------------------
create table public.chantierci_visites (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references public.chantierci_etablissements (id) on delete cascade,
  date_visite date not null,
  nom_visiteur text not null default '',
  user_id uuid references public.chantierci_profiles (id) on delete set null,
  statut_chantier public.chantierci_statut_chantier not null,
  avancement_reel_pct integer,
  pct_excavation integer,
  pct_fondation integer,
  pct_verticaux integer,
  pct_charpente integer,
  pct_couverture integer,
  pct_finition integer,
  commentaire text,
  raisons_arret text[],
  raison_arret_autre text,
  sync_status public.chantierci_sync_status not null default 'synced',
  created_at timestamptz not null default now(),
  constraint chantierci_visites_avancement_valide check (avancement_reel_pct is null or avancement_reel_pct between 0 and 100),
  constraint chantierci_visites_pct_excavation_valide check (pct_excavation is null or pct_excavation between 0 and 100),
  constraint chantierci_visites_pct_fondation_valide check (pct_fondation is null or pct_fondation between 0 and 100),
  constraint chantierci_visites_pct_verticaux_valide check (pct_verticaux is null or pct_verticaux between 0 and 100),
  constraint chantierci_visites_pct_charpente_valide check (pct_charpente is null or pct_charpente between 0 and 100),
  constraint chantierci_visites_pct_couverture_valide check (pct_couverture is null or pct_couverture between 0 and 100),
  constraint chantierci_visites_pct_finition_valide check (pct_finition is null or pct_finition between 0 and 100),
  constraint chantierci_visites_raisons_arret_valides check (
    raisons_arret is null
    or raisons_arret <@ array['manque_effectif', 'manque_materiau', 'probleme_paiement', 'autre']::text[]
  )
);

comment on table public.chantierci_visites is 'Visites de chantier saisies par les COGES (saisie offline possible : sync_status).';
comment on column public.chantierci_visites.raisons_arret is 'Multi-select si statut arrêté : manque_effectif / manque_materiau / probleme_paiement / autre.';

-- ----------------------------------------------------------------------------
-- Table chantierci_photos_visites
-- ----------------------------------------------------------------------------
create table public.chantierci_photos_visites (
  id uuid primary key default gen_random_uuid(),
  visite_id uuid not null references public.chantierci_visites (id) on delete cascade,
  storage_path text not null,
  url_public text,
  taille_ko integer,
  sync_status public.chantierci_sync_status not null default 'synced',
  created_at timestamptz not null default now()
);

comment on table public.chantierci_photos_visites is 'Photos de visites. Convention de chemin Storage : {visite_id}/{nom_fichier} dans le bucket chantierci-photos-visites.';

-- ----------------------------------------------------------------------------
-- Table chantierci_commentaires — commentaires régionaux (CDC §5.4)
-- ----------------------------------------------------------------------------
create table public.chantierci_commentaires (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references public.chantierci_etablissements (id) on delete cascade,
  user_id uuid references public.chantierci_profiles (id) on delete set null,
  contenu text not null,
  created_at timestamptz not null default now()
);

comment on table public.chantierci_commentaires is 'Commentaires des responsables régionaux sur un établissement, visibles MEN + admin.';

-- ----------------------------------------------------------------------------
-- Index (clés étrangères + colonnes de filtre fréquentes)
-- ----------------------------------------------------------------------------
create index idx_chantierci_etablissements_lot_id on public.chantierci_etablissements (lot_id);
create index idx_chantierci_etablissements_statut on public.chantierci_etablissements (statut);
create index idx_chantierci_etablissements_province on public.chantierci_etablissements (province);
create index idx_chantierci_marches_etablissement_id on public.chantierci_marches_travaux (etablissement_id);
create index idx_chantierci_marches_numero on public.chantierci_marches_travaux (numero_marche);
create index idx_chantierci_paiements_marche_id on public.chantierci_paiements (marche_id);
create index idx_chantierci_paiements_saisi_par on public.chantierci_paiements (saisi_par);
create index idx_chantierci_visites_etablissement_date on public.chantierci_visites (etablissement_id, date_visite desc, created_at desc);
create index idx_chantierci_visites_user_id on public.chantierci_visites (user_id);
create index idx_chantierci_photos_visite_id on public.chantierci_photos_visites (visite_id);
create index idx_chantierci_commentaires_etablissement_id on public.chantierci_commentaires (etablissement_id);
create index idx_chantierci_commentaires_user_id on public.chantierci_commentaires (user_id);
create index idx_chantierci_lots_region on public.chantierci_lots (region);


-- ============================================================================
-- SOURCE : supabase\migrations\20260612100100_fonctions_et_triggers.sql
-- ============================================================================
-- ============================================================================
-- Migration 2/5 — Fonctions d'aide RLS et triggers
--
-- Toutes les fonctions vivent dans le schéma `chantierci_private`, NON exposé
-- par PostgREST (les fonctions SECURITY DEFINER ne doivent jamais être dans
-- un schéma exposé). Elles sont SECURITY DEFINER pour lire
-- `chantierci_profiles` sans déclencher la RLS (évite la récursion) — le rôle
-- effectif vient TOUJOURS de chantierci_profiles (géré par l'admin), jamais
-- de user_metadata (modifiable par l'utilisateur, donc inutilisable pour
-- l'autorisation).
-- ============================================================================

create schema if not exists chantierci_private;

-- Le schéma n'est accessible qu'aux rôles qui en ont besoin.
revoke all on schema chantierci_private from public;
grant usage on schema chantierci_private to authenticated;

-- ----------------------------------------------------------------------------
-- chantierci_private.user_role() — rôle de l'utilisateur courant, UNIQUEMENT
-- si son compte est actif. Retourne NULL pour un compte en_attente / suspendu
-- / inexistant : toutes les politiques échouent alors silencieusement.
-- ----------------------------------------------------------------------------
create or replace function chantierci_private.user_role()
returns public.chantierci_user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.chantierci_profiles
  where id = (select auth.uid())
    and statut_compte = 'actif';
$$;

-- ----------------------------------------------------------------------------
-- chantierci_private.user_lot_ids() — lots directement attribués à
-- l'utilisateur actif.
-- ----------------------------------------------------------------------------
create or replace function chantierci_private.user_lot_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select lot_ids
     from public.chantierci_profiles
     where id = (select auth.uid())
       and statut_compte = 'actif'),
    '{}'::uuid[]
  );
$$;

-- ----------------------------------------------------------------------------
-- chantierci_private.accessible_lot_ids() — lots visibles selon le rôle :
--   admin / national : tous les lots
--   regional         : tous les lots des régions de ses lots attribués
--   coges            : ses lots attribués uniquement
--   autre / inactif  : aucun
-- ----------------------------------------------------------------------------
create or replace function chantierci_private.accessible_lot_ids()
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.chantierci_user_role := chantierci_private.user_role();
begin
  if v_role in ('admin', 'national') then
    return coalesce((select array_agg(id) from public.chantierci_lots), '{}'::uuid[]);
  elsif v_role = 'regional' then
    return coalesce(
      (select array_agg(l.id)
       from public.chantierci_lots l
       where l.region in (
         select region from public.chantierci_lots
         where id = any(chantierci_private.user_lot_ids())
       )),
      '{}'::uuid[]
    );
  elsif v_role = 'coges' then
    return chantierci_private.user_lot_ids();
  else
    return '{}'::uuid[];
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- chantierci_private.accessible_etablissement_ids() — établissements visibles.
-- admin / national voient aussi les établissements sans lot (lot_id null).
-- ----------------------------------------------------------------------------
create or replace function chantierci_private.accessible_etablissement_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from public.chantierci_etablissements
  where lot_id = any(chantierci_private.accessible_lot_ids())
     or chantierci_private.user_role() in ('admin', 'national');
$$;

-- ----------------------------------------------------------------------------
-- chantierci_private.accessible_marche_ids() — marchés visibles
-- (via l'établissement).
-- ----------------------------------------------------------------------------
create or replace function chantierci_private.accessible_marche_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from public.chantierci_marches_travaux
  where etablissement_id in (select chantierci_private.accessible_etablissement_ids());
$$;

-- Les fonctions d'aide ne sont exécutables que par les rôles applicatifs.
revoke all on function chantierci_private.user_role() from public;
revoke all on function chantierci_private.user_lot_ids() from public;
revoke all on function chantierci_private.accessible_lot_ids() from public;
revoke all on function chantierci_private.accessible_etablissement_ids() from public;
revoke all on function chantierci_private.accessible_marche_ids() from public;
grant execute on function chantierci_private.user_role() to authenticated;
grant execute on function chantierci_private.user_lot_ids() to authenticated;
grant execute on function chantierci_private.accessible_lot_ids() to authenticated;
grant execute on function chantierci_private.accessible_etablissement_ids() to authenticated;
grant execute on function chantierci_private.accessible_marche_ids() to authenticated;

-- ----------------------------------------------------------------------------
-- Création du profil à l'inscription : PAS de trigger sur auth.users (table
-- partagée avec l'application PEEB hébergée sur le même projet — un trigger
-- s'exécuterait à chaque inscription PEEB et une erreur bloquerait leurs
-- inscriptions). Le profil est créé par l'application juste après signUp(),
-- via la politique RLS "chantierci_profiles_insert_soi" qui force
-- statut_compte = 'en_attente' et lot_ids = '{}' : aucun privilège
-- auto-attribuable, l'admin valide et fixe le rôle réel.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- Trigger : protection des colonnes sensibles de chantierci_profiles.
-- Un utilisateur peut mettre à jour son nom/téléphone, mais seuls un admin
-- (ou un contexte serveur sans auth.uid(), ex. service_role) peuvent modifier
-- role, statut_compte et lot_ids.
-- ----------------------------------------------------------------------------
create or replace function chantierci_private.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Contexte serveur (service_role, dashboard) ou admin actif : tout est permis.
  if (select auth.uid()) is null or chantierci_private.user_role() = 'admin' then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.statut_compte is distinct from old.statut_compte
     or new.lot_ids is distinct from old.lot_ids then
    raise exception 'Modification non autorisée des champs role, statut_compte ou lot_ids';
  end if;

  return new;
end;
$$;

revoke all on function chantierci_private.protect_profile_columns() from public;

create trigger chantierci_protect_profile_columns
  before update on public.chantierci_profiles
  for each row
  execute function chantierci_private.protect_profile_columns();


-- ============================================================================
-- SOURCE : supabase\migrations\20260612100200_politiques_rls.sql
-- ============================================================================
-- ============================================================================
-- Migration 3/5 — Politiques RLS
--
-- Matrice des permissions (CDC §4) :
--   COGES    : lecture sur ses lots ; saisie visites + photos sur ses lots
--   Régional : lecture sur sa région ; ajout de commentaires
--   National : lecture globale ; saisie paiements
--   Admin    : accès total
-- Un compte `en_attente` ou `suspendu` ne voit RIEN :
-- chantierci_private.user_role() retourne NULL et toutes les politiques
-- échouent. Toutes les politiques sont `to authenticated` : anon n'a aucun
-- accès. Les appels de fonctions indépendants de la ligne sont encapsulés
-- dans (select ...) pour être évalués une seule fois par requête (initplan).
-- ============================================================================

alter table public.chantierci_lots enable row level security;
alter table public.chantierci_profiles enable row level security;
alter table public.chantierci_etablissements enable row level security;
alter table public.chantierci_marches_travaux enable row level security;
alter table public.chantierci_paiements enable row level security;
alter table public.chantierci_visites enable row level security;
alter table public.chantierci_photos_visites enable row level security;
alter table public.chantierci_commentaires enable row level security;

-- ----------------------------------------------------------------------------
-- chantierci_lots — lecture pour tout utilisateur actif, écriture admin
-- ----------------------------------------------------------------------------
create policy "chantierci_lots_select_utilisateur_actif"
  on public.chantierci_lots for select to authenticated
  using ((select chantierci_private.user_role()) is not null);

create policy "chantierci_lots_insert_admin"
  on public.chantierci_lots for insert to authenticated
  with check ((select chantierci_private.user_role()) = 'admin');

create policy "chantierci_lots_update_admin"
  on public.chantierci_lots for update to authenticated
  using ((select chantierci_private.user_role()) = 'admin')
  with check ((select chantierci_private.user_role()) = 'admin');

create policy "chantierci_lots_delete_admin"
  on public.chantierci_lots for delete to authenticated
  using ((select chantierci_private.user_role()) = 'admin');

-- ----------------------------------------------------------------------------
-- chantierci_profiles — chacun voit/modifie son profil (même en_attente, pour
-- afficher l'écran "compte en attente de validation") ; l'admin voit/gère
-- tout. role / statut_compte / lot_ids sont verrouillés par trigger.
-- ----------------------------------------------------------------------------
create policy "chantierci_profiles_select_soi_ou_admin"
  on public.chantierci_profiles for select to authenticated
  using (id = (select auth.uid()) or (select chantierci_private.user_role()) = 'admin');

create policy "chantierci_profiles_update_soi_ou_admin"
  on public.chantierci_profiles for update to authenticated
  using (id = (select auth.uid()) or (select chantierci_private.user_role()) = 'admin')
  with check (id = (select auth.uid()) or (select chantierci_private.user_role()) = 'admin');

-- Auto-insertion du profil juste après l'inscription (pas de trigger sur
-- auth.users, partagé avec PEEB) : statut en_attente et aucun lot imposés.
-- Le rôle saisi n'est qu'un "rôle souhaité" : sans validation admin
-- (statut_compte = 'actif'), il ne donne accès à rien. L'admin peut aussi
-- créer des profils librement (politique unique pour éviter le lint
-- multiple_permissive_policies).
create policy "chantierci_profiles_insert"
  on public.chantierci_profiles for insert to authenticated
  with check (
    (
      id = (select auth.uid())
      and statut_compte = 'en_attente'
      and lot_ids = '{}'
    )
    or (select chantierci_private.user_role()) = 'admin'
  );

create policy "chantierci_profiles_delete_admin"
  on public.chantierci_profiles for delete to authenticated
  using ((select chantierci_private.user_role()) = 'admin');

-- ----------------------------------------------------------------------------
-- chantierci_etablissements — lecture selon le périmètre du rôle, écriture
-- admin (import CSV et modification des fiches : CDC §5.6)
-- ----------------------------------------------------------------------------
create policy "chantierci_etablissements_select_perimetre"
  on public.chantierci_etablissements for select to authenticated
  using (
    (select chantierci_private.user_role()) in ('admin', 'national')
    or lot_id in (select unnest(chantierci_private.accessible_lot_ids()))
  );

create policy "chantierci_etablissements_insert_admin"
  on public.chantierci_etablissements for insert to authenticated
  with check ((select chantierci_private.user_role()) = 'admin');

create policy "chantierci_etablissements_update_admin"
  on public.chantierci_etablissements for update to authenticated
  using ((select chantierci_private.user_role()) = 'admin')
  with check ((select chantierci_private.user_role()) = 'admin');

create policy "chantierci_etablissements_delete_admin"
  on public.chantierci_etablissements for delete to authenticated
  using ((select chantierci_private.user_role()) = 'admin');

-- ----------------------------------------------------------------------------
-- chantierci_marches_travaux — lecture via l'établissement, écriture admin
-- ----------------------------------------------------------------------------
create policy "chantierci_marches_select_perimetre"
  on public.chantierci_marches_travaux for select to authenticated
  using (etablissement_id in (select chantierci_private.accessible_etablissement_ids()));

create policy "chantierci_marches_insert_admin"
  on public.chantierci_marches_travaux for insert to authenticated
  with check ((select chantierci_private.user_role()) = 'admin');

create policy "chantierci_marches_update_admin"
  on public.chantierci_marches_travaux for update to authenticated
  using ((select chantierci_private.user_role()) = 'admin')
  with check ((select chantierci_private.user_role()) = 'admin');

create policy "chantierci_marches_delete_admin"
  on public.chantierci_marches_travaux for delete to authenticated
  using ((select chantierci_private.user_role()) = 'admin');

-- ----------------------------------------------------------------------------
-- chantierci_paiements — lecture via le marché ; saisie national + admin
-- (CDC §4) ; correction/suppression admin uniquement
-- ----------------------------------------------------------------------------
create policy "chantierci_paiements_select_perimetre"
  on public.chantierci_paiements for select to authenticated
  using (marche_id in (select chantierci_private.accessible_marche_ids()));

create policy "chantierci_paiements_insert_national_admin"
  on public.chantierci_paiements for insert to authenticated
  with check (
    (select chantierci_private.user_role()) in ('national', 'admin')
    and saisi_par = (select auth.uid())
    and marche_id in (select chantierci_private.accessible_marche_ids())
  );

create policy "chantierci_paiements_update_admin"
  on public.chantierci_paiements for update to authenticated
  using ((select chantierci_private.user_role()) = 'admin')
  with check ((select chantierci_private.user_role()) = 'admin');

create policy "chantierci_paiements_delete_admin"
  on public.chantierci_paiements for delete to authenticated
  using ((select chantierci_private.user_role()) = 'admin');

-- ----------------------------------------------------------------------------
-- chantierci_visites — lecture via l'établissement ; saisie COGES (sur ses
-- lots) + admin ; modification/suppression par l'auteur ou un admin
-- ----------------------------------------------------------------------------
create policy "chantierci_visites_select_perimetre"
  on public.chantierci_visites for select to authenticated
  using (etablissement_id in (select chantierci_private.accessible_etablissement_ids()));

create policy "chantierci_visites_insert_coges_admin"
  on public.chantierci_visites for insert to authenticated
  with check (
    (select chantierci_private.user_role()) in ('coges', 'admin')
    and user_id = (select auth.uid())
    and etablissement_id in (select chantierci_private.accessible_etablissement_ids())
  );

create policy "chantierci_visites_update_auteur_admin"
  on public.chantierci_visites for update to authenticated
  using (user_id = (select auth.uid()) or (select chantierci_private.user_role()) = 'admin')
  with check (user_id = (select auth.uid()) or (select chantierci_private.user_role()) = 'admin');

create policy "chantierci_visites_delete_auteur_admin"
  on public.chantierci_visites for delete to authenticated
  using (user_id = (select auth.uid()) or (select chantierci_private.user_role()) = 'admin');

-- ----------------------------------------------------------------------------
-- chantierci_photos_visites — mêmes règles que la visite parente
-- (les sous-requêtes sur chantierci_visites s'exécutent sous sa RLS)
-- ----------------------------------------------------------------------------
create policy "chantierci_photos_select_perimetre"
  on public.chantierci_photos_visites for select to authenticated
  using (
    visite_id in (
      select v.id from public.chantierci_visites v
      where v.etablissement_id in (select chantierci_private.accessible_etablissement_ids())
    )
  );

create policy "chantierci_photos_insert_auteur_admin"
  on public.chantierci_photos_visites for insert to authenticated
  with check (
    exists (
      select 1 from public.chantierci_visites v
      where v.id = visite_id
        and (v.user_id = (select auth.uid()) or (select chantierci_private.user_role()) = 'admin')
    )
  );

create policy "chantierci_photos_delete_auteur_admin"
  on public.chantierci_photos_visites for delete to authenticated
  using (
    exists (
      select 1 from public.chantierci_visites v
      where v.id = visite_id
        and (v.user_id = (select auth.uid()) or (select chantierci_private.user_role()) = 'admin')
    )
  );

-- ----------------------------------------------------------------------------
-- chantierci_commentaires — saisie par les régionaux (sur leur région) +
-- admin ; lecture : MEN (national) + admin + l'auteur + les régionaux de la
-- région (CDC §5.4 : "visible MEN + admin")
-- ----------------------------------------------------------------------------
create policy "chantierci_commentaires_select_men_admin_regional"
  on public.chantierci_commentaires for select to authenticated
  using (
    (select chantierci_private.user_role()) in ('national', 'admin')
    or user_id = (select auth.uid())
    or (
      (select chantierci_private.user_role()) = 'regional'
      and etablissement_id in (select chantierci_private.accessible_etablissement_ids())
    )
  );

create policy "chantierci_commentaires_insert_regional_admin"
  on public.chantierci_commentaires for insert to authenticated
  with check (
    (select chantierci_private.user_role()) in ('regional', 'admin')
    and user_id = (select auth.uid())
    and etablissement_id in (select chantierci_private.accessible_etablissement_ids())
  );

create policy "chantierci_commentaires_update_auteur_admin"
  on public.chantierci_commentaires for update to authenticated
  using (user_id = (select auth.uid()) or (select chantierci_private.user_role()) = 'admin')
  with check (user_id = (select auth.uid()) or (select chantierci_private.user_role()) = 'admin');

create policy "chantierci_commentaires_delete_auteur_admin"
  on public.chantierci_commentaires for delete to authenticated
  using (user_id = (select auth.uid()) or (select chantierci_private.user_role()) = 'admin');


-- ============================================================================
-- SOURCE : supabase\migrations\20260612100300_vues.sql
-- ============================================================================
-- ============================================================================
-- Migration 4/5 — Vues SQL (calculs financiers dérivés, CDC §3.3)
--
-- Toutes les vues sont déclarées WITH (security_invoker = true) : elles
-- s'exécutent avec les droits de l'appelant, donc la RLS des tables
-- sous-jacentes s'applique (sans cette option, une vue contournerait la RLS).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- chantierci_v_marches_financier — un marché + ses agrégats financiers :
--   montant_paye, avancement_financier_pct, reste_a_payer
-- Sert la vue "Marchés de travaux" (CDC §5.3).
-- ----------------------------------------------------------------------------
create view public.chantierci_v_marches_financier
with (security_invoker = true) as
select
  m.id,
  m.etablissement_id,
  e.nom as etablissement_nom,
  e.lot_id,
  e.province,
  e.departement,
  e.statut as statut_etablissement,
  m.nom_entreprise,
  m.numero_marche,
  m.montant_marche,
  m.date_demarrage,
  m.date_fin_estimative,
  coalesce(p.montant_paye, 0) as montant_paye,
  case
    when m.montant_marche > 0
      then round(coalesce(p.montant_paye, 0) / m.montant_marche * 100, 1)
    else 0
  end as avancement_financier_pct,
  m.montant_marche - coalesce(p.montant_paye, 0) as reste_a_payer,
  coalesce(p.nb_paiements, 0) as nb_paiements
from public.chantierci_marches_travaux m
join public.chantierci_etablissements e on e.id = m.etablissement_id
left join (
  select marche_id, sum(montant) as montant_paye, count(*) as nb_paiements
  from public.chantierci_paiements
  group by marche_id
) p on p.marche_id = m.id;

comment on view public.chantierci_v_marches_financier is 'Marchés avec montant payé, avancement financier (%) et reste à payer (XOF).';

-- ----------------------------------------------------------------------------
-- chantierci_v_dernieres_visites — la visite la plus récente de chaque
-- établissement (groupement par défaut du tableau de suivi, CDC §5.3).
-- ----------------------------------------------------------------------------
create view public.chantierci_v_dernieres_visites
with (security_invoker = true) as
select distinct on (v.etablissement_id) v.*
from public.chantierci_visites v
order by v.etablissement_id, v.date_visite desc, v.created_at desc;

comment on view public.chantierci_v_dernieres_visites is 'Dernière visite par établissement (date_visite puis created_at décroissants).';

-- ----------------------------------------------------------------------------
-- chantierci_v_etablissements_suivi — vue de synthèse pour le dashboard, la
-- carte et le tableau de suivi : établissement + lot + marché le plus récent
-- + agrégats financiers + dernière visite. Une ligne par établissement.
-- ----------------------------------------------------------------------------
create view public.chantierci_v_etablissements_suivi
with (security_invoker = true) as
select
  e.id,
  e.nom,
  e.nom_directeur,
  e.telephone,
  e.email,
  e.latitude,
  e.longitude,
  e.province,
  e.departement,
  e.village,
  e.statut,
  e.created_at,
  e.lot_id,
  l.nom as lot_nom,
  l.region as lot_region,
  m.id as marche_id,
  m.nom_entreprise,
  m.numero_marche,
  m.montant_marche,
  m.date_demarrage,
  m.date_fin_estimative,
  coalesce(pp.montant_paye, 0) as montant_paye,
  case
    when m.montant_marche > 0
      then round(coalesce(pp.montant_paye, 0) / m.montant_marche * 100, 1)
  end as avancement_financier_pct,
  case
    when m.id is not null
      then m.montant_marche - coalesce(pp.montant_paye, 0)
  end as reste_a_payer,
  dv.id as derniere_visite_id,
  dv.date_visite as derniere_visite_date,
  dv.nom_visiteur as derniere_visite_visiteur,
  dv.statut_chantier as dernier_statut_chantier,
  dv.avancement_reel_pct as dernier_avancement_reel_pct,
  coalesce(nv.nb_visites, 0) as nb_visites
from public.chantierci_etablissements e
left join public.chantierci_lots l on l.id = e.lot_id
left join lateral (
  select *
  from public.chantierci_marches_travaux mt
  where mt.etablissement_id = e.id
  order by mt.date_demarrage desc nulls last
  limit 1
) m on true
left join lateral (
  select sum(p.montant) as montant_paye
  from public.chantierci_paiements p
  where p.marche_id = m.id
) pp on true
left join lateral (
  select v.id, v.date_visite, v.nom_visiteur, v.statut_chantier, v.avancement_reel_pct
  from public.chantierci_visites v
  where v.etablissement_id = e.id
  order by v.date_visite desc, v.created_at desc
  limit 1
) dv on true
left join lateral (
  select count(*) as nb_visites
  from public.chantierci_visites v
  where v.etablissement_id = e.id
) nv on true;

comment on view public.chantierci_v_etablissements_suivi is 'Synthèse par établissement : lot, marché le plus récent, financier, dernière visite. Alimente dashboard / carte / tableau de suivi.';

-- Les vues ne sont accessibles qu'aux utilisateurs authentifiés
-- (la RLS sous-jacente fait ensuite le filtrage par rôle).
revoke all on public.chantierci_v_marches_financier from anon;
revoke all on public.chantierci_v_dernieres_visites from anon;
revoke all on public.chantierci_v_etablissements_suivi from anon;


-- ============================================================================
-- SOURCE : supabase\migrations\20260612100400_storage.sql
-- ============================================================================
-- ============================================================================
-- Migration 5/5 — Supabase Storage : bucket photos de visites
--
-- Bucket privé `chantierci-photos-visites` (les URLs remises au client sont
-- des URLs signées, cf. CDC §3.5 "url_public : URL signée").
-- Convention de chemin : {visite_id}/{nom_fichier}
-- Limite 5 Mo par fichier (la compression côté client cible < 500 Ko),
-- types MIME image uniquement.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chantierci-photos-visites',
  'chantierci-photos-visites',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Upload : auteur de la visite (COGES sur ses lots) ou admin.
-- Le 1er segment du chemin doit être l'id d'une visite que l'utilisateur
-- a le droit de voir (RLS de chantierci_visites appliquée dans la
-- sous-requête) et dont il est l'auteur (ou être admin).
-- ----------------------------------------------------------------------------
create policy "chantierci_photos_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chantierci-photos-visites'
    and exists (
      select 1
      from public.chantierci_visites v
      where v.id::text = (storage.foldername(name))[1]
        and (v.user_id = (select auth.uid()) or (select chantierci_private.user_role()) = 'admin')
    )
  );

-- ----------------------------------------------------------------------------
-- Lecture : tout utilisateur actif pouvant voir la visite parente
-- (la RLS de chantierci_visites filtre automatiquement le périmètre par rôle).
-- ----------------------------------------------------------------------------
create policy "chantierci_photos_storage_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chantierci-photos-visites'
    and exists (
      select 1
      from public.chantierci_visites v
      where v.id::text = (storage.foldername(name))[1]
    )
  );

-- ----------------------------------------------------------------------------
-- Suppression : auteur de la visite ou admin.
-- ----------------------------------------------------------------------------
create policy "chantierci_photos_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'chantierci-photos-visites'
    and exists (
      select 1
      from public.chantierci_visites v
      where v.id::text = (storage.foldername(name))[1]
        and (v.user_id = (select auth.uid()) or (select chantierci_private.user_role()) = 'admin')
    )
  );


-- ============================================================================
-- SOURCE : supabase\migrations\20260612100500_commentaires_auteur_nom.sql
-- ============================================================================
-- ============================================================================
-- Migration 6 — chantierci_commentaires.auteur_nom
--
-- Nom de l'auteur dénormalisé : la RLS de chantierci_profiles (chacun ne lit
-- que son propre profil, sauf admin) empêche les lecteurs MEN/régionaux de
-- joindre les profils des autres utilisateurs. Même principe que
-- chantierci_visites.nom_visiteur.
-- ============================================================================

alter table public.chantierci_commentaires
  add column auteur_nom text not null default '';

-- Rattrapage des commentaires du seed (auteurs régionaux de test).
update public.chantierci_commentaires
set auteur_nom = case user_id
  when '22222222-2222-4222-8222-00000000000c' then 'Tidiane SANOGO'
  when '22222222-2222-4222-8222-00000000000d' then 'Marie-Laure ABBÉ'
  else auteur_nom
end;


-- ============================================================================
-- SOURCE : supabase\migrations\20260612100600_profiles_email.sql
-- ============================================================================
-- ============================================================================
-- Migration 7 — chantierci_profiles.email
--
-- Email dénormalisé : auth.users n'est pas lisible par l'API côté client, et
-- l'écran admin de validation des comptes doit afficher l'email. Renseigné à
-- la création du profil par l'application (creerProfilSiAbsent).
-- ============================================================================

alter table public.chantierci_profiles
  add column email text not null default '';

update public.chantierci_profiles p
set email = coalesce(u.email, '')
from auth.users u
where u.id = p.id;


-- ============================================================================
-- SOURCE : supabase\seed\seed.sql
-- ============================================================================
-- ============================================================================
-- SEED — Suivi de chantiers scolaires Côte d'Ivoire (données de développement)
--
-- Contenu (CDC §6) :
--   - 4 lots géographiques (Nord / Sud / Est / Ouest)
--   - 8 comptes de test (4 COGES, 2 régionaux, 1 national, 1 admin)
--     mot de passe commun : ChantierCI!2026
--   - 50 établissements réalistes (provinces/départements réels)
--   - 1 marché par établissement (50 M à 200 M XOF, entreprises fictives)
--   - 1-2 visites (non démarrés) ou 2-5 visites (autres) à avancement progressif
--   - 0-4 paiements par marché, cohérents avec l'avancement physique
--   - quelques commentaires régionaux
--
-- Générateurs déterministes : hashtext(id) => relançable à l'identique sur une
-- base vide. Un garde-fou empêche un double-seed.
-- À exécuter en tant que postgres (SQL Editor / MCP), PAS via l'API.
-- ============================================================================

-- ============================== SECTION A ===================================
-- Garde-fou + lots + comptes de test
-- ============================================================================

do $$
begin
  if exists (select 1 from public.chantierci_lots) then
    raise exception 'Seed déjà appliqué : chantierci_lots n''est pas vide.';
  end if;
end $$;

insert into public.chantierci_lots (id, nom, region) values
  ('11111111-1111-4111-8111-000000000001', 'Lot Nord',  'Nord'),
  ('11111111-1111-4111-8111-000000000002', 'Lot Sud',   'Sud'),
  ('11111111-1111-4111-8111-000000000003', 'Lot Est',   'Est'),
  ('11111111-1111-4111-8111-000000000004', 'Lot Ouest', 'Ouest');

-- Comptes de test (auth.users + identities + profils chantierci).
-- NB : le trigger PEEB du projet partagé créera aussi un profil PEEB pour
-- chacun de ces comptes (cross-talk documenté dans supabase/README.md).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current
)
select
  '00000000-0000-0000-0000-000000000000', v.id::uuid, 'authenticated',
  'authenticated', v.email,
  extensions.crypt('ChantierCI!2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('nom_complet', v.nom),
  now(), now(), '', '', '', '', ''
from (values
  ('22222222-2222-4222-8222-00000000000a', 'admin@chantierci.test',         'Clément DAVY'),
  ('22222222-2222-4222-8222-00000000000b', 'national@chantierci.test',      'Serge BALLO'),
  ('22222222-2222-4222-8222-00000000000c', 'regional.nord@chantierci.test', 'Tidiane SANOGO'),
  ('22222222-2222-4222-8222-00000000000d', 'regional.sud@chantierci.test',  'Marie-Laure ABBÉ'),
  ('22222222-2222-4222-8222-000000000001', 'coges.nord@chantierci.test',    'Brahima KONÉ'),
  ('22222222-2222-4222-8222-000000000002', 'coges.sud@chantierci.test',     'Affoué KOUAMÉ'),
  ('22222222-2222-4222-8222-000000000003', 'coges.est@chantierci.test',     'Kouadio N''ZI'),
  ('22222222-2222-4222-8222-000000000004', 'coges.ouest@chantierci.test',   'Cécile GOHOU')
) as v(id, email, nom);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email,
                     'email_verified', true, 'phone_verified', false),
  'email', now(), now(), now()
from auth.users u
where u.email like '%@chantierci.test';

insert into public.chantierci_profiles (id, nom_complet, email, telephone, role, lot_ids, statut_compte) values
  ('22222222-2222-4222-8222-00000000000a', 'Clément DAVY',     'admin@chantierci.test',         '+225 07 00 00 00 01', 'admin',    '{}', 'actif'),
  ('22222222-2222-4222-8222-00000000000b', 'Serge BALLO',      'national@chantierci.test',      '+225 07 00 00 00 02', 'national', '{}', 'actif'),
  ('22222222-2222-4222-8222-00000000000c', 'Tidiane SANOGO',   'regional.nord@chantierci.test', '+225 07 00 00 00 03', 'regional', array['11111111-1111-4111-8111-000000000001']::uuid[], 'actif'),
  ('22222222-2222-4222-8222-00000000000d', 'Marie-Laure ABBÉ', 'regional.sud@chantierci.test',  '+225 07 00 00 00 04', 'regional', array['11111111-1111-4111-8111-000000000002']::uuid[], 'actif'),
  ('22222222-2222-4222-8222-000000000001', 'Brahima KONÉ',     'coges.nord@chantierci.test',    '+225 07 00 00 00 05', 'coges',    array['11111111-1111-4111-8111-000000000001']::uuid[], 'actif'),
  ('22222222-2222-4222-8222-000000000002', 'Affoué KOUAMÉ',    'coges.sud@chantierci.test',     '+225 07 00 00 00 06', 'coges',    array['11111111-1111-4111-8111-000000000002']::uuid[], 'actif'),
  ('22222222-2222-4222-8222-000000000003', 'Kouadio N''ZI',    'coges.est@chantierci.test',     '+225 07 00 00 00 07', 'coges',    array['11111111-1111-4111-8111-000000000003']::uuid[], 'actif'),
  ('22222222-2222-4222-8222-000000000004', 'Cécile GOHOU',     'coges.ouest@chantierci.test',   '+225 07 00 00 00 08', 'coges',    array['11111111-1111-4111-8111-000000000004']::uuid[], 'actif');

-- ============================== SECTION B ===================================
-- 50 établissements + marchés de travaux
-- ============================================================================

insert into public.chantierci_etablissements
  (nom, nom_directeur, telephone, email, latitude, longitude, province, departement, village, lot_id, statut)
values
  -- ---- Lot Nord (12) ----
  ('EPP Koko',                          'KONÉ Adama',          '+225 07 49 12 30 01', 'epp.koko@men.test',                9.4660, -5.6400, 'Poro',             'Korhogo',          'Koko',           '11111111-1111-4111-8111-000000000001', 'en_cours'),
  ('EPP Natiokobadara',                 'SILUÉ Kassoum',       '+225 05 86 22 41 02', 'epp.natiokobadara@men.test',       9.4910, -5.6630, 'Poro',             'Korhogo',          'Natiokobadara',  '11111111-1111-4111-8111-000000000001', 'en_cours'),
  ('Collège de Proximité de Napié',     'YÉO Madeleine',       '+225 07 58 33 52 03', 'cp.napie@men.test',                9.3010, -5.5520, 'Poro',             'Korhogo',          'Napié',          '11111111-1111-4111-8111-000000000001', 'arrete'),
  ('EPP Ferké Plateau',                 'OUATTARA Drissa',     '+225 01 71 44 63 04', 'epp.ferke.plateau@men.test',       9.6010, -5.1980, 'Tchologo',         'Ferkessédougou',   'Plateau',        '11111111-1111-4111-8111-000000000001', 'en_cours'),
  ('Groupe Scolaire de Kong',           'CISSÉ Mariam',        '+225 07 02 55 74 05', 'gs.kong@men.test',                 9.1500, -4.6200, 'Tchologo',         'Kong',             'Kong',           '11111111-1111-4111-8111-000000000001', 'non_demarre'),
  ('EPP Boundiali Centre',              'FOFANA Tiémoko',      '+225 05 13 66 85 06', 'epp.boundiali@men.test',           9.5210, -6.4890, 'Bagoué',           'Boundiali',        'Centre',         '11111111-1111-4111-8111-000000000001', 'receptionne'),
  ('EPP Kouto',                         'DOSSO Aïcha',         '+225 07 24 77 96 07', 'epp.kouto@men.test',               9.8900, -6.4100, 'Bagoué',           'Kouto',            'Kouto',          '11111111-1111-4111-8111-000000000001', 'en_cours'),
  ('Collège Moderne d''Odienné',        'DIOMANDÉ Vassiriki',  '+225 01 35 88 07 08', 'cm.odienne@men.test',              9.5100, -7.5640, 'Kabadougou',       'Odienné',          'Centre',         '11111111-1111-4111-8111-000000000001', 'en_cours'),
  ('EPP Madinani',                      'BAMBA Sita',          '+225 07 46 99 18 09', 'epp.madinani@men.test',            9.6200, -7.1800, 'Kabadougou',       'Madinani',         'Madinani',       '11111111-1111-4111-8111-000000000001', 'non_demarre'),
  ('Collège Moderne de Katiola',        'TRAORÉ Souleymane',   '+225 05 57 10 29 10', 'cm.katiola@men.test',              8.1400, -5.1010, 'Hambol',           'Katiola',          'Centre',         '11111111-1111-4111-8111-000000000001', 'receptionne'),
  ('EPP Niakaramandougou',              'SORO Pélagie',        '+225 07 68 21 40 11', 'epp.niakara@men.test',             8.6600, -5.2900, 'Hambol',           'Niakaramandougou', 'Niakara',        '11111111-1111-4111-8111-000000000001', 'en_cours'),
  ('EPP Tengréla',                      'COULIBALY Lacina',    '+225 01 79 32 51 12', 'epp.tengrela@men.test',           10.4800, -6.4100, 'Bagoué',           'Tengréla',         'Tengréla',       '11111111-1111-4111-8111-000000000001', 'arrete'),
  -- ---- Lot Sud (14) ----
  ('EPP Adjouffou 1',                   'AKA Bertin',          '+225 07 08 12 30 13', 'epp.adjouffou1@men.test',          5.2610, -3.9290, 'Abidjan',          'Port-Bouët',       'Adjouffou',      '11111111-1111-4111-8111-000000000002', 'en_cours'),
  ('EPP Anonkoi 3',                     'N''GUESSAN Estelle',  '+225 05 19 23 41 14', 'epp.anonkoi3@men.test',            5.4310, -4.0120, 'Abidjan',          'Abobo',            'Anonkoi-Kouté',  '11111111-1111-4111-8111-000000000002', 'en_cours'),
  ('Groupe Scolaire Niangon Sud',       'KOFFI Jean-Marc',     '+225 07 20 34 52 15', 'gs.niangon.sud@men.test',          5.3220, -4.0890, 'Abidjan',          'Yopougon',         'Niangon',        '11111111-1111-4111-8111-000000000002', 'receptionne'),
  ('EPP Abobo-Baoulé',                  'ASSI Henriette',      '+225 01 31 45 63 16', 'epp.abobo.baoule@men.test',        5.4180, -3.9620, 'Abidjan',          'Cocody',           'Abobo-Baoulé',   '11111111-1111-4111-8111-000000000002', 'en_cours'),
  ('Collège Moderne de Grand-Bassam',   'TANOH Maurice',       '+225 07 42 56 74 17', 'cm.grand.bassam@men.test',         5.2110, -3.7380, 'Sud-Comoé',        'Grand-Bassam',     'France',         '11111111-1111-4111-8111-000000000002', 'en_cours'),
  ('EPP Moossou',                       'EHOUMAN Solange',     '+225 05 53 67 85 18', 'epp.moossou@men.test',             5.2210, -3.7560, 'Sud-Comoé',        'Grand-Bassam',     'Moossou',        '11111111-1111-4111-8111-000000000002', 'non_demarre'),
  ('EPP Aboisso Château',               'KOUAMÉ Firmin',       '+225 07 64 78 96 19', 'epp.aboisso.chateau@men.test',     5.4710, -3.2070, 'Sud-Comoé',        'Aboisso',          'Château',        '11111111-1111-4111-8111-000000000002', 'receptionne'),
  ('EPP Dabou Lycée',                   'LATH Rosine',         '+225 01 75 89 07 20', 'epp.dabou.lycee@men.test',         5.3250, -4.3770, 'Grands-Ponts',     'Dabou',            'Lycée',          '11111111-1111-4111-8111-000000000002', 'en_cours'),
  ('Collège de Proximité de Jacqueville','AHOUSSI Norbert',    '+225 07 86 90 18 21', 'cp.jacqueville@men.test',          5.2060, -4.4140, 'Grands-Ponts',     'Jacqueville',      'Centre',         '11111111-1111-4111-8111-000000000002', 'arrete'),
  ('EPP Bardot',                        'GNAHORÉ Léa',         '+225 05 97 01 29 22', 'epp.bardot@men.test',              4.7590, -6.6510, 'San-Pédro',        'San-Pédro',        'Bardot',         '11111111-1111-4111-8111-000000000002', 'en_cours'),
  ('Lycée Moderne de San-Pédro 2',      'DJÉ Olivier',         '+225 07 18 12 40 23', 'lm.sanpedro2@men.test',            4.7680, -6.6320, 'San-Pédro',        'San-Pédro',        'Cité',           '11111111-1111-4111-8111-000000000002', 'en_cours'),
  ('EPP Sassandra Phare',               'KOUADIO Albertine',   '+225 01 29 23 51 24', 'epp.sassandra.phare@men.test',     4.9530, -6.0850, 'Gbôklé',           'Sassandra',        'Phare',          '11111111-1111-4111-8111-000000000002', 'non_demarre'),
  ('EPP Divo Konankro',                 'ZADI Hervé',          '+225 07 30 34 62 25', 'epp.divo.konankro@men.test',       5.8390, -5.3600, 'Lôh-Djiboua',      'Divo',             'Konankro',       '11111111-1111-4111-8111-000000000002', 'receptionne'),
  ('EPP Agboville Gare',                'ADOU Patricia',       '+225 05 41 45 73 26', 'epp.agboville.gare@men.test',      5.9280, -4.2130, 'Agnéby-Tiassa',    'Agboville',        'Gare',           '11111111-1111-4111-8111-000000000002', 'en_cours'),
  -- ---- Lot Est (11) ----
  ('EPP Abengourou Plateau',            'AMOIKON Didier',      '+225 07 52 56 84 27', 'epp.abengourou.plateau@men.test',  6.7290, -3.4960, 'Indénié-Djuablin', 'Abengourou',       'Plateau',        '11111111-1111-4111-8111-000000000003', 'en_cours'),
  ('Groupe Scolaire de Niablé',         'EBA Véronique',       '+225 01 63 67 95 28', 'gs.niable@men.test',               6.7860, -3.3010, 'Indénié-Djuablin', 'Abengourou',       'Niablé',         '11111111-1111-4111-8111-000000000003', 'en_cours'),
  ('Collège Moderne d''Agnibilékrou',   'KOUASSI Apollinaire', '+225 07 74 78 06 29', 'cm.agnibilekrou@men.test',         7.1290, -3.2040, 'Indénié-Djuablin', 'Agnibilékrou',     'Centre',         '11111111-1111-4111-8111-000000000003', 'receptionne'),
  ('EPP Bondoukou Zanzan',              'OUATTARA Ramata',     '+225 05 85 89 17 30', 'epp.bondoukou.zanzan@men.test',    8.0400, -2.8000, 'Gontougo',         'Bondoukou',        'Zanzan',         '11111111-1111-4111-8111-000000000003', 'en_cours'),
  ('EPP Tanda',                         'KONATÉ Issouf',       '+225 07 96 90 28 31', 'epp.tanda@men.test',               7.8030, -3.1680, 'Gontougo',         'Tanda',            'Tanda',          '11111111-1111-4111-8111-000000000003', 'arrete'),
  ('Collège de Proximité de Sandégué',  'BINI Carole',         '+225 01 07 01 39 32', 'cp.sandegue@men.test',             7.9700, -3.4500, 'Gontougo',         'Sandégué',         'Sandégué',       '11111111-1111-4111-8111-000000000003', 'non_demarre'),
  ('EPP Daoukro Commerce',              'N''DRI Pascal',       '+225 07 18 12 50 33', 'epp.daoukro.commerce@men.test',    7.0560, -3.9630, 'Iffou',            'Daoukro',          'Commerce',       '11111111-1111-4111-8111-000000000003', 'en_cours'),
  ('EPP M''Bahiakro',                   'YAO Hortense',        '+225 05 29 23 61 34', 'epp.mbahiakro@men.test',           7.4540, -4.3390, 'Iffou',            'M''Bahiakro',      'Centre',         '11111111-1111-4111-8111-000000000003', 'en_cours'),
  ('Collège Moderne de Bongouanou',     'ASSALÉ Marius',       '+225 07 40 34 72 35', 'cm.bongouanou@men.test',           6.6520, -4.2040, 'Moronou',          'Bongouanou',       'Centre',         '11111111-1111-4111-8111-000000000003', 'receptionne'),
  ('EPP Arrah',                         'MEL Florence',        '+225 01 51 45 83 36', 'epp.arrah@men.test',               6.6730, -3.9690, 'Moronou',          'Arrah',            'Arrah',          '11111111-1111-4111-8111-000000000003', 'en_cours'),
  ('EPP Prikro',                        'KONAN Bénédicte',     '+225 07 62 56 94 37', 'epp.prikro@men.test',              7.6590, -3.9530, 'Iffou',            'Prikro',           'Prikro',         '11111111-1111-4111-8111-000000000003', 'arrete'),
  -- ---- Lot Ouest (13) ----
  ('EPP Man Libreville',                'GUÉ Christelle',      '+225 05 73 67 05 38', 'epp.man.libreville@men.test',      7.4120, -7.5540, 'Tonkpi',           'Man',              'Libreville',     '11111111-1111-4111-8111-000000000004', 'en_cours'),
  ('Collège Moderne de Biankouma',      'DOH Sylvain',         '+225 07 84 78 16 39', 'cm.biankouma@men.test',            7.7390, -7.6130, 'Tonkpi',           'Biankouma',        'Centre',         '11111111-1111-4111-8111-000000000004', 'en_cours'),
  ('EPP Danané Frontière',              'OULAÏ Judith',        '+225 01 95 89 27 40', 'epp.danane@men.test',              7.2620, -8.1550, 'Tonkpi',           'Danané',           'Gningleu',       '11111111-1111-4111-8111-000000000004', 'non_demarre'),
  ('EPP Daloa Tazibouo',                'TRA BI Ernest',       '+225 07 06 90 38 41', 'epp.daloa.tazibouo@men.test',      6.8890, -6.4380, 'Haut-Sassandra',   'Daloa',            'Tazibouo',       '11111111-1111-4111-8111-000000000004', 'en_cours'),
  ('Groupe Scolaire Lobia',             'ZAHUI Marcelline',    '+225 05 17 01 49 42', 'gs.lobia@men.test',                6.8640, -6.4660, 'Haut-Sassandra',   'Daloa',            'Lobia',          '11111111-1111-4111-8111-000000000004', 'receptionne'),
  ('EPP Issia Carrefour',               'SÉRY Gaston',         '+225 07 28 12 60 43', 'epp.issia.carrefour@men.test',     6.4920, -6.5860, 'Haut-Sassandra',   'Issia',            'Carrefour',      '11111111-1111-4111-8111-000000000004', 'en_cours'),
  ('EPP Vavoua',                        'KALOU Bérénice',      '+225 01 39 23 71 44', 'epp.vavoua@men.test',              7.3810, -6.4770, 'Haut-Sassandra',   'Vavoua',           'Vavoua',         '11111111-1111-4111-8111-000000000004', 'arrete'),
  ('Collège Moderne de Duékoué',        'GLA Honoré',          '+225 07 50 34 82 45', 'cm.duekoue@men.test',              6.7420, -7.3490, 'Guémon',           'Duékoué',          'Centre',         '11111111-1111-4111-8111-000000000004', 'en_cours'),
  ('EPP Bangolo',                       'DIAHI Léontine',      '+225 05 61 45 93 46', 'epp.bangolo@men.test',             7.0120, -7.4860, 'Guémon',           'Bangolo',          'Bangolo',        '11111111-1111-4111-8111-000000000004', 'arrete'),
  ('EPP Guiglo Nicla',                  'PEHE Roland',         '+225 07 72 56 04 47', 'epp.guiglo.nicla@men.test',        6.5430, -7.4930, 'Cavally',          'Guiglo',           'Nicla',          '11111111-1111-4111-8111-000000000004', 'non_demarre'),
  ('Collège Moderne de Séguéla',        'DIABATÉ Fanta',       '+225 01 83 67 15 48', 'cm.seguela@men.test',              7.9610, -6.6730, 'Worodougou',       'Séguéla',          'Centre',         '11111111-1111-4111-8111-000000000004', 'receptionne'),
  ('EPP Touba',                         'SAVANÉ Moussa',       '+225 07 94 78 26 49', 'epp.touba@men.test',               8.2830, -7.6840, 'Bafing',           'Touba',            'Touba',          '11111111-1111-4111-8111-000000000004', 'en_cours'),
  ('EPP Gagnoa Dioulabougou',           'GNAMBA Édith',        '+225 05 05 89 37 50', 'epp.gagnoa.dioulabougou@men.test', 6.1320, -5.9510, 'Gôh',              'Gagnoa',           'Dioulabougou',   '11111111-1111-4111-8111-000000000004', 'receptionne');

-- Marchés : 1 par établissement, 50 M à 200 M XOF, entreprises fictives,
-- démarrage passé (chantiers lancés) ou T3 2026 (non démarrés).
with base as (
  select
    e.id, e.statut,
    abs(hashtext(e.id::text || 'montant'))    as hm,
    abs(hashtext(e.id::text || 'dates'))      as hd,
    abs(hashtext(e.id::text || 'entreprise')) as he,
    row_number() over (order by e.nom)        as rn
  from public.chantierci_etablissements e
)
insert into public.chantierci_marches_travaux
  (etablissement_id, nom_entreprise, numero_marche, montant_marche, date_demarrage, date_fin_estimative)
select
  b.id,
  (array['BTIC','SOGECI','CBCI','SOTRABA-CI','EGC Sassandra','BATIMAT-CI',
         'Entreprise FADIGA & Fils','Groupe KARAMOKO BTP','IVOIRE CONSTRUCTION',
         'SONIBAT','ETRACOM-CI','NOVABAT Afrique'])[1 + b.he % 12],
  '2025-MEN-TRX-' || lpad(b.rn::text, 4, '0'),
  (50 + b.hm % 151) * 1000000,
  case when b.statut = 'non_demarre'
       then date '2026-07-01' + (b.hd % 60)
       else date '2025-01-15' + (b.hd % 270) end,
  case when b.statut = 'non_demarre'
       then date '2026-07-01' + (b.hd % 60) + (240 + b.hd % 180)
       else date '2025-01-15' + (b.hd % 270) + (240 + b.hd % 180) end
from base b;

-- ============================== SECTION C ===================================
-- Visites, paiements, commentaires
-- ============================================================================

-- Visites : avancement progressif et corps d'état cohérents.
-- Pondération des corps d'état (cumul = 100 % de l'avancement global) :
-- excavation 10, fondation 15, verticaux 25, charpente 15, couverture 15,
-- finition 20. Chaque pct = part de SA phase réalisée pour un global donné.
do $$
declare
  e record;
  h int; n int; g_final int; g_prev int; g_i int; i int;
  d_start date; d_end date; v_date date; prev_date date;
  v_statut public.chantierci_statut_chantier;
  v_raisons text[]; v_raison_autre text;
  coges_uid uuid; coges_nom text;
  commentaires text[] := array[
    'RAS, chantier propre et bien tenu.',
    'Présence effective de l''entreprise, bonne cadence.',
    'Stock de ciment faible, à surveiller.',
    'Ferraillage conforme aux plans visés.',
    'Effectif réduit constaté ce jour.',
    'Qualité des agglos satisfaisante.',
    'Prévoir le repli de la base vie.',
    null, null, null];
begin
  for e in
    select et.id, et.statut, et.lot_id, m.date_demarrage, m.date_fin_estimative
    from public.chantierci_etablissements et
    join public.chantierci_marches_travaux m on m.etablissement_id = et.id
  loop
    h := abs(hashtext(e.id::text || 'visites'));
    coges_uid := case e.lot_id
      when '11111111-1111-4111-8111-000000000001' then '22222222-2222-4222-8222-000000000001'::uuid
      when '11111111-1111-4111-8111-000000000002' then '22222222-2222-4222-8222-000000000002'::uuid
      when '11111111-1111-4111-8111-000000000003' then '22222222-2222-4222-8222-000000000003'::uuid
      else '22222222-2222-4222-8222-000000000004'::uuid end;
    coges_nom := case e.lot_id
      when '11111111-1111-4111-8111-000000000001' then 'Brahima KONÉ'
      when '11111111-1111-4111-8111-000000000002' then 'Affoué KOUAMÉ'
      when '11111111-1111-4111-8111-000000000003' then 'Kouadio N''ZI'
      else 'Cécile GOHOU' end;

    -- Non démarré : 1-2 visites de constat à 0 %.
    if e.statut = 'non_demarre' then
      n := 1 + h % 2;
      for i in 1..n loop
        insert into public.chantierci_visites
          (etablissement_id, date_visite, nom_visiteur, user_id, statut_chantier,
           avancement_reel_pct, pct_excavation, pct_fondation, pct_verticaux,
           pct_charpente, pct_couverture, pct_finition, commentaire, sync_status, created_at)
        values
          (e.id, current_date - (80 - i * 30 + h % 15), coges_nom, coges_uid,
           'non_demarre', 0, 0, 0, 0, 0, 0, 0,
           'Site non encore mobilisé par l''entreprise.', 'synced',
           now() + make_interval(secs => i));
      end loop;
      continue;
    end if;

    n := 2 + h % 4;  -- 2 à 5 visites
    g_final := case e.statut
      when 'receptionne' then 100
      when 'en_cours'    then 25 + h % 56   -- 25-80 %
      else                    15 + h % 51   -- arrêté : 15-65 %
    end;
    d_start := e.date_demarrage + 21;
    d_end := case when e.statut = 'receptionne'
                  then least(e.date_fin_estimative, current_date - 30)
                  else current_date - (7 + h % 21) end;
    if d_end <= d_start then d_end := d_start + 45; end if;

    g_prev := 0; prev_date := null;
    for i in 1..n loop
      if i = n then
        g_i := g_final;
      else
        g_i := round(g_final * i::numeric / n) + (abs(hashtext(e.id::text || i::text)) % 9) - 4;
        g_i := greatest(g_prev + 1, least(g_i, g_final - (n - i)));
      end if;
      -- chantier arrêté : la dernière visite constate la stagnation
      if e.statut = 'arrete' and i = n then g_i := g_prev; end if;

      v_statut := case when i = n then e.statut else 'en_cours' end;
      v_raisons := null; v_raison_autre := null;
      if v_statut = 'arrete' then
        case h % 4
          when 0 then v_raisons := array['probleme_paiement'];
          when 1 then v_raisons := array['manque_materiau'];
          when 2 then v_raisons := array['manque_effectif', 'manque_materiau'];
          else v_raisons := array['autre'];
               v_raison_autre := 'Litige foncier avec la communauté villageoise.';
        end case;
      end if;

      v_date := d_start + (((d_end - d_start) * (i - 1)) / greatest(n - 1, 1));
      if prev_date is not null and v_date <= prev_date then v_date := prev_date + 7; end if;
      prev_date := v_date;

      insert into public.chantierci_visites
        (etablissement_id, date_visite, nom_visiteur, user_id, statut_chantier,
         avancement_reel_pct, pct_excavation, pct_fondation, pct_verticaux,
         pct_charpente, pct_couverture, pct_finition,
         commentaire, raisons_arret, raison_arret_autre, sync_status, created_at)
      values
        (e.id, v_date, coges_nom, coges_uid, v_statut, g_i,
         least(100, greatest(0, round((g_i -  0) * 100.0 / 10)))::int,
         least(100, greatest(0, round((g_i - 10) * 100.0 / 15)))::int,
         least(100, greatest(0, round((g_i - 25) * 100.0 / 25)))::int,
         least(100, greatest(0, round((g_i - 50) * 100.0 / 15)))::int,
         least(100, greatest(0, round((g_i - 65) * 100.0 / 15)))::int,
         least(100, greatest(0, round((g_i - 80) * 100.0 / 20)))::int,
         commentaires[1 + (h + i) % 10], v_raisons, v_raison_autre, 'synced',
         now() + make_interval(secs => i));

      g_prev := g_i;
    end loop;
  end loop;
end $$;

-- Paiements : avance de démarrage + décomptes, total cohérent avec
-- l'avancement physique (jamais supérieur au montant du marché).
do $$
declare
  m record; h int; g int; nb int; i int;
  total numeric; avance numeric; reste numeric; tranche numeric;
  p_date date;
  nat uuid := '22222222-2222-4222-8222-00000000000b';  -- compte national
begin
  for m in
    select mt.id, mt.etablissement_id, mt.montant_marche, mt.date_demarrage, e.statut
    from public.chantierci_marches_travaux mt
    join public.chantierci_etablissements e on e.id = mt.etablissement_id
  loop
    h := abs(hashtext(m.id::text || 'paiements'));

    -- Non démarré : une avance pour la moitié des marchés, sinon rien.
    if m.statut = 'non_demarre' then
      if h % 2 = 0 then
        insert into public.chantierci_paiements (marche_id, date_paiement, montant, libelle, saisi_par)
        values (m.id, current_date - (10 + h % 40),
                round(m.montant_marche * 0.15, -5), 'Avance de démarrage', nat);
      end if;
      continue;
    end if;

    select coalesce(max(avancement_reel_pct), 0) into g
    from public.chantierci_visites v where v.etablissement_id = m.etablissement_id;

    if m.statut = 'receptionne' then
      total := round(m.montant_marche * (85 + h % 16) / 100.0, -5);   -- 85-100 %
    else
      total := round(m.montant_marche * greatest(10, least(90, g - 5 + h % 15)) / 100.0, -5);
    end if;

    nb := 1 + h % 4;  -- 1 à 4 paiements
    avance := round(m.montant_marche * 0.15, -5);
    if avance >= total or nb = 1 then
      avance := total; nb := 1;
    end if;

    p_date := m.date_demarrage + 7;
    insert into public.chantierci_paiements (marche_id, date_paiement, montant, libelle, saisi_par)
    values (m.id, p_date, avance, 'Avance de démarrage', nat);

    if nb > 1 then
      reste := total - avance;
      for i in 1..(nb - 1) loop
        tranche := round(reste / (nb - 1), -5);
        if i = nb - 1 then tranche := reste - tranche * (nb - 2); end if;
        p_date := p_date + (30 + (h + i) % 50);
        insert into public.chantierci_paiements (marche_id, date_paiement, montant, libelle, saisi_par)
        values (m.id, p_date, tranche, 'Décompte n°' || i, nat);
      end loop;
    end if;
  end loop;
end $$;

-- Commentaires régionaux (lots Nord et Sud : les deux régionaux de test).
insert into public.chantierci_commentaires (etablissement_id, user_id, auteur_nom, contenu)
select
  e.id,
  case l.nom when 'Lot Nord'
    then '22222222-2222-4222-8222-00000000000c'::uuid
    else '22222222-2222-4222-8222-00000000000d'::uuid end,
  case l.nom when 'Lot Nord' then 'Tidiane SANOGO' else 'Marie-Laure ABBÉ' end,
  (array['Chantier visité lors de la tournée régionale : avancement conforme aux remontées COGES.',
         'Signalé à la direction régionale : accès au site difficile en saison des pluies.',
         'L''entreprise a été relancée sur le retard constaté.'])[1 + abs(hashtext(e.id::text || 'comm')) % 3]
from public.chantierci_etablissements e
join public.chantierci_lots l on l.id = e.lot_id
where l.nom in ('Lot Nord', 'Lot Sud')
  and abs(hashtext(e.id::text || 'pick')) % 4 = 0;

