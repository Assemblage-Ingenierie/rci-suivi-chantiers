-- ############################################################################
-- INSTALLATION / RÉINITIALISATION — refonte PATEB
-- (FICHIER GÉNÉRÉ par npm run installation — ne pas modifier à la main)
--
-- À coller en entier dans Supabase → SQL Editor → Run.
--
-- ⚠️  EFFACE TOUTES LES DONNÉES DE L'APPLICATION (v1 et refonte) puis
--     réinstalle le schéma, les droits et les 387 sites. À n'utiliser que
--     tant que la base ne contient que des données de test.
--
-- Tout s'exécute dans une transaction : en cas d'erreur, la base reste
-- inchangée. Contenu : 20261124100000_purge_v1.sql, 20261124100100_referentiel.sql, 20261124100200_fonctions.sql, 20261124100300_politiques_rls.sql, 20261124100400_donnees_referentiel.sql, 20261125100000_formulaires.sql, 20261126100000_tableau_de_bord.sql, 20261127100000_tableau_de_bord_v2.sql, 20261128100000_suivi_remplissage.sql, 20261129100000_suivi_attendu.sql, 20261130100000_performances.sql.
-- Comptes de test (optionnel, ensuite) : supabase/seed/comptes_test.sql
-- ############################################################################

begin;

-- >>>>>>>>>>>>>>>>>>>> Réinitialisation des objets de la refonte (si déjà installés)
-- Le schéma privé d'abord : ses fonctions sont utilisées par les politiques
-- (y compris Storage), supprimées avec lui.
drop schema if exists chantierci_private cascade;
drop function if exists public.chantierci_evolution_avancement(integer);
drop function if exists public.chantierci_remplissage(integer);
drop view if exists public.chantierci_v_etat_sites;
drop view if exists public.chantierci_v_visites;
drop table if exists public.chantierci_commentaires cascade;
drop table if exists public.chantierci_departements cascade;
drop table if exists public.chantierci_photos cascade;
drop table if exists public.chantierci_visites cascade;
drop table if exists public.chantierci_postes cascade;
drop table if exists public.chantierci_parametres cascade;
drop type if exists public.chantierci_source_formulaire;
drop type if exists public.chantierci_statut_chantier cascade;
drop table if exists public.chantierci_affectations cascade;
drop table if exists public.chantierci_sites cascade;
drop table if exists public.chantierci_profiles cascade;
drop table if exists public.chantierci_lots cascade;
drop table if exists public.chantierci_lots_moe cascade;
drop type if exists public.chantierci_role;
drop type if exists public.chantierci_type_latrines;
drop type if exists public.chantierci_statut_compte;
delete from auth.users where email like '%@pateb.test' or email like '%@cstc.pateb.invalid';

-- >>>>>>>>>>>>>>>>>>>> 20261124100000_purge_v1.sql
-- ============================================================================
-- Refonte PATEB — 0/4 — Purge du schéma v1 (suivi MEN)
--
-- Les données v1 sont factices : on repart d'une base propre. Supprime tous
-- les objets chantierci_* de la v1 (tables, vues, fonctions, types, politiques
-- Storage) et les comptes de test @chantierci.test.
-- Le bucket Storage `chantierci-photos-visites` est conservé (réutilisé à
-- l'étape 2) ; seules ses politiques v1 sont retirées.
-- Idempotent : peut être rejoué sur une base vide.
-- ============================================================================

-- Politiques Storage v1 (le schéma storage n'existe que sur Supabase).
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'objects') then
    execute 'drop policy if exists "chantierci_photos_storage_insert" on storage.objects';
    execute 'drop policy if exists "chantierci_photos_storage_select" on storage.objects';
    execute 'drop policy if exists "chantierci_photos_storage_delete" on storage.objects';
    execute 'drop policy if exists "chantierci_photos_storage_update" on storage.objects';
  end if;
end $$;

drop view if exists public.chantierci_v_etablissements_suivi;
drop view if exists public.chantierci_v_marches_financier;
drop view if exists public.chantierci_v_dernieres_visites;

drop table if exists public.chantierci_commentaires   cascade;
drop table if exists public.chantierci_photos_visites cascade;
drop table if exists public.chantierci_paiements      cascade;
drop table if exists public.chantierci_visites        cascade;
drop table if exists public.chantierci_marches_travaux cascade;
drop table if exists public.chantierci_etablissements cascade;
drop table if exists public.chantierci_profiles       cascade;
drop table if exists public.chantierci_lots           cascade;

drop schema if exists chantierci_private cascade;

drop type if exists public.chantierci_statut_chantier;
drop type if exists public.chantierci_statut_compte;
drop type if exists public.chantierci_sync_status;
drop type if exists public.chantierci_user_role;

delete from auth.users where email like '%@chantierci.test';

-- >>>>>>>>>>>>>>>>>>>> 20261124100100_referentiel.sql
-- ============================================================================
-- Refonte PATEB — 1/4 — Référentiel : lots, sites, profils, affectations
--
-- Hiérarchie : lot MOE (4) > lot de travaux (33) > site (387).
-- Le lot MOE est porté par le SITE (rattachement par région) : le lot de
-- travaux 16 « Bafing et Béré 1 » est partagé entre MOE 4 et MOE 2.
-- Les objets restent préfixés `chantierci_` (convention historique du projet).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Types énumérés
-- ----------------------------------------------------------------------------
create type public.chantierci_role as enum (
  'cstc',            -- comité de suivi communautaire : 1 site
  'moe_controleur',  -- contrôleur MOE : ses sites (affectations)
  'moe_chef',        -- chef de mission MOE : tous les sites de son lot MOE
  'ug',              -- unité de gestion : tous les sites
  'admin'
);
create type public.chantierci_statut_compte as enum ('en_attente', 'actif', 'suspendu');
create type public.chantierci_type_latrines as enum ('seches', 'a_eau');

-- ----------------------------------------------------------------------------
-- Lots MOE (missions de suivi et contrôle)
-- ----------------------------------------------------------------------------
create table public.chantierci_lots_moe (
  id smallint primary key,
  nom text not null,
  regions text[] not null default '{}',
  titulaire text not null default ''
);
comment on table public.chantierci_lots_moe is 'Lots de maîtrise d''œuvre (4). Rattachement des sites par région.';

-- ----------------------------------------------------------------------------
-- Lots de travaux (marchés)
-- ----------------------------------------------------------------------------
create table public.chantierci_lots (
  id smallint primary key,
  nom text not null,
  entreprise_titulaire text not null default '',
  -- Poids dans l'avancement global (paramétrable par l'admin, défaut = nb de sites).
  poids numeric not null default 1,
  constraint chantierci_lots_id_valide check (id between 1 and 99),
  constraint chantierci_lots_poids_positif check (poids >= 0)
);
comment on table public.chantierci_lots is 'Lots de travaux (33 marchés). poids = pondération dans l''avancement global.';

-- ----------------------------------------------------------------------------
-- Sites (une salle de pré-primaire + un bloc latrines 3 cabines par site)
-- ----------------------------------------------------------------------------
create table public.chantierci_sites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                       -- ex. L19-01
  lot_id smallint not null references public.chantierci_lots (id) on delete restrict,
  lot_moe_id smallint not null references public.chantierci_lots_moe (id) on delete restrict,
  nom text not null,
  region text not null,
  departement text not null default '',
  localite text not null default '',
  zone text not null default '',                   -- Rural / Peri-urbain / Urbain
  electricite boolean not null default true,
  type_latrines public.chantierci_type_latrines not null,
  latitude double precision,
  longitude double precision,
  a_verifier text not null default '',            -- remarque sur la donnée source
  actif boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint chantierci_sites_latitude_valide check (latitude is null or latitude between -90 and 90),
  constraint chantierci_sites_longitude_valide check (longitude is null or longitude between -180 and 180)
);
comment on table public.chantierci_sites is 'Sites de construction (référentiel issu du DAO, modifiable par l''admin uniquement).';

-- ----------------------------------------------------------------------------
-- Profils (id = auth.users.id)
-- ----------------------------------------------------------------------------
create table public.chantierci_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nom_complet text not null default '',
  email text not null default '',
  -- Identifiant de connexion des CSTC (connexion identifiant + PIN).
  identifiant text unique,
  telephone text not null default '',
  role public.chantierci_role not null default 'moe_controleur',
  -- Lot MOE du chef de mission (et, pour information, des contrôleurs).
  lot_moe_id smallint references public.chantierci_lots_moe (id) on delete set null,
  statut_compte public.chantierci_statut_compte not null default 'en_attente',
  created_at timestamptz not null default now(),
  constraint chantierci_profiles_identifiant_format
    check (identifiant is null or identifiant ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  constraint chantierci_profiles_chef_a_un_lot
    check (role <> 'moe_chef' or statut_compte <> 'actif' or lot_moe_id is not null)
);
comment on table public.chantierci_profiles is 'Profils. role / statut_compte / lot_moe_id / identifiant modifiables uniquement par un admin (trigger).';

-- ----------------------------------------------------------------------------
-- Affectations profil ↔ site (CSTC : 1 site ; contrôleur MOE : n sites)
-- ----------------------------------------------------------------------------
create table public.chantierci_affectations (
  profile_id uuid not null references public.chantierci_profiles (id) on delete cascade,
  site_id uuid not null references public.chantierci_sites (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, site_id)
);
comment on table public.chantierci_affectations is 'Sites dont un CSTC (1 au plus) ou un contrôleur MOE est chargé.';

-- ----------------------------------------------------------------------------
-- Index
-- ----------------------------------------------------------------------------
create index idx_chantierci_sites_lot_id on public.chantierci_sites (lot_id);
create index idx_chantierci_sites_lot_moe_id on public.chantierci_sites (lot_moe_id);
create index idx_chantierci_profiles_lot_moe_id on public.chantierci_profiles (lot_moe_id);
create index idx_chantierci_affectations_site_id on public.chantierci_affectations (site_id);

-- >>>>>>>>>>>>>>>>>>>> 20261124100200_fonctions.sql
-- ============================================================================
-- Refonte PATEB — 2/4 — Fonctions d'aide RLS et triggers
--
-- Schéma `chantierci_private` non exposé par l'API. Fonctions SECURITY
-- DEFINER (lecture des profils sans récursion RLS), search_path vide.
-- Le rôle effectif vient TOUJOURS de chantierci_profiles, jamais de
-- user_metadata (modifiable par l'utilisateur).
-- ============================================================================

create schema if not exists chantierci_private;
revoke all on schema chantierci_private from public;
grant usage on schema chantierci_private to authenticated;

-- Rôle de l'utilisateur courant, uniquement si son compte est actif (sinon NULL :
-- toutes les politiques échouent).
create or replace function chantierci_private.user_role()
returns public.chantierci_role
language sql stable security definer set search_path = ''
as $$
  select role from public.chantierci_profiles
  where id = (select auth.uid()) and statut_compte = 'actif';
$$;

-- Lot MOE de l'utilisateur actif.
create or replace function chantierci_private.user_lot_moe()
returns smallint
language sql stable security definer set search_path = ''
as $$
  select lot_moe_id from public.chantierci_profiles
  where id = (select auth.uid()) and statut_compte = 'actif';
$$;

-- Sites visibles :
--   admin, ug       : tous
--   moe_chef        : tous les sites de son lot MOE
--   moe_controleur  : ses affectations
--   cstc            : son affectation
create or replace function chantierci_private.sites_accessibles()
returns setof uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_role public.chantierci_role := chantierci_private.user_role();
begin
  if v_role in ('admin', 'ug') then
    return query select s.id from public.chantierci_sites s;
  elsif v_role = 'moe_chef' then
    return query select s.id from public.chantierci_sites s
                 where s.lot_moe_id = chantierci_private.user_lot_moe();
  elsif v_role in ('moe_controleur', 'cstc') then
    return query select a.site_id from public.chantierci_affectations a
                 where a.profile_id = (select auth.uid());
  end if;
end;
$$;

revoke all on function chantierci_private.user_role() from public;
revoke all on function chantierci_private.user_lot_moe() from public;
revoke all on function chantierci_private.sites_accessibles() from public;
grant execute on function chantierci_private.user_role() to authenticated;
grant execute on function chantierci_private.user_lot_moe() to authenticated;
grant execute on function chantierci_private.sites_accessibles() to authenticated;

-- ----------------------------------------------------------------------------
-- Protection des colonnes sensibles du profil : seul un admin (ou un contexte
-- serveur sans auth.uid(), ex. service_role) modifie role, statut_compte,
-- lot_moe_id et identifiant.
-- ----------------------------------------------------------------------------
create or replace function chantierci_private.protect_profile_columns()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or chantierci_private.user_role() = 'admin' then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.statut_compte is distinct from old.statut_compte
     or new.lot_moe_id is distinct from old.lot_moe_id
     or new.identifiant is distinct from old.identifiant then
    raise exception 'Modification non autorisée des champs role, statut_compte, lot_moe_id ou identifiant';
  end if;
  return new;
end;
$$;
revoke all on function chantierci_private.protect_profile_columns() from public;

create trigger chantierci_protect_profile_columns
  before update on public.chantierci_profiles
  for each row execute function chantierci_private.protect_profile_columns();

-- ----------------------------------------------------------------------------
-- Cohérence des affectations : seuls les CSTC et contrôleurs MOE en ont, et
-- un CSTC n'a qu'un site.
-- ----------------------------------------------------------------------------
create or replace function chantierci_private.verifier_affectation()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.chantierci_role;
begin
  select role into v_role from public.chantierci_profiles where id = new.profile_id;
  if v_role not in ('cstc', 'moe_controleur') then
    raise exception 'Seuls les CSTC et les contrôleurs MOE sont affectés à des sites (rôle : %)', v_role;
  end if;
  if v_role = 'cstc' and exists (
    select 1 from public.chantierci_affectations
    where profile_id = new.profile_id and site_id <> new.site_id
  ) then
    raise exception 'Un CSTC ne peut être chargé que d''un seul site';
  end if;
  return new;
end;
$$;
revoke all on function chantierci_private.verifier_affectation() from public;

create trigger chantierci_verifier_affectation
  before insert or update on public.chantierci_affectations
  for each row execute function chantierci_private.verifier_affectation();

-- Horodatage des modifications du référentiel des sites.
create or replace function chantierci_private.maj_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function chantierci_private.maj_updated_at() from public;

create trigger chantierci_sites_updated_at
  before update on public.chantierci_sites
  for each row execute function chantierci_private.maj_updated_at();

-- >>>>>>>>>>>>>>>>>>>> 20261124100300_politiques_rls.sql
-- ============================================================================
-- Refonte PATEB — 3/4 — Politiques RLS
--
--   CSTC            : son site
--   MOE contrôleur  : ses sites
--   MOE chef        : les sites de son lot MOE
--   UG              : tous les sites (lecture)
--   Admin           : tout, seul à modifier le référentiel et les comptes
-- Compte en_attente / suspendu : aucun accès (user_role() = NULL), sauf son
-- propre profil. Toutes les politiques sont `to authenticated`.
-- ============================================================================

alter table public.chantierci_lots_moe enable row level security;
alter table public.chantierci_lots enable row level security;
alter table public.chantierci_sites enable row level security;
alter table public.chantierci_profiles enable row level security;
alter table public.chantierci_affectations enable row level security;

-- ---------------------------------------------------------------------------
-- Lots MOE et lots de travaux : lecture pour tout compte actif, écriture admin
-- ---------------------------------------------------------------------------
create policy "chantierci_lots_moe_select" on public.chantierci_lots_moe
  for select to authenticated
  using ((select chantierci_private.user_role()) is not null);
create policy "chantierci_lots_moe_insert_admin" on public.chantierci_lots_moe
  for insert to authenticated
  with check ((select chantierci_private.user_role()) = 'admin');
create policy "chantierci_lots_moe_update_admin" on public.chantierci_lots_moe
  for update to authenticated
  using ((select chantierci_private.user_role()) = 'admin')
  with check ((select chantierci_private.user_role()) = 'admin');
create policy "chantierci_lots_moe_delete_admin" on public.chantierci_lots_moe
  for delete to authenticated
  using ((select chantierci_private.user_role()) = 'admin');

create policy "chantierci_lots_select" on public.chantierci_lots
  for select to authenticated
  using ((select chantierci_private.user_role()) is not null);
create policy "chantierci_lots_insert_admin" on public.chantierci_lots
  for insert to authenticated
  with check ((select chantierci_private.user_role()) = 'admin');
create policy "chantierci_lots_update_admin" on public.chantierci_lots
  for update to authenticated
  using ((select chantierci_private.user_role()) = 'admin')
  with check ((select chantierci_private.user_role()) = 'admin');
create policy "chantierci_lots_delete_admin" on public.chantierci_lots
  for delete to authenticated
  using ((select chantierci_private.user_role()) = 'admin');

-- ---------------------------------------------------------------------------
-- Sites : lecture selon le périmètre, écriture admin uniquement
-- ---------------------------------------------------------------------------
create policy "chantierci_sites_select" on public.chantierci_sites
  for select to authenticated
  using (id in (select chantierci_private.sites_accessibles()));
create policy "chantierci_sites_insert_admin" on public.chantierci_sites
  for insert to authenticated
  with check ((select chantierci_private.user_role()) = 'admin');
create policy "chantierci_sites_update_admin" on public.chantierci_sites
  for update to authenticated
  using ((select chantierci_private.user_role()) = 'admin')
  with check ((select chantierci_private.user_role()) = 'admin');
create policy "chantierci_sites_delete_admin" on public.chantierci_sites
  for delete to authenticated
  using ((select chantierci_private.user_role()) = 'admin');

-- ---------------------------------------------------------------------------
-- Profils : chacun voit / modifie le sien (nom, téléphone), l'admin gère tout.
-- Les colonnes sensibles sont verrouillées par trigger.
-- ---------------------------------------------------------------------------
create policy "chantierci_profiles_select" on public.chantierci_profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select chantierci_private.user_role()) = 'admin');

create policy "chantierci_profiles_update" on public.chantierci_profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select chantierci_private.user_role()) = 'admin')
  with check (id = (select auth.uid()) or (select chantierci_private.user_role()) = 'admin');

-- Auto-création du profil après inscription par email (MOE / UG) : compte en
-- attente, sans lot ni identifiant. Les comptes CSTC sont créés par l'admin.
create policy "chantierci_profiles_insert" on public.chantierci_profiles
  for insert to authenticated
  with check (
    (
      id = (select auth.uid())
      and statut_compte = 'en_attente'
      and role in ('moe_controleur', 'moe_chef', 'ug')
      and lot_moe_id is null
      and identifiant is null
    )
    or (select chantierci_private.user_role()) = 'admin'
  );

create policy "chantierci_profiles_delete_admin" on public.chantierci_profiles
  for delete to authenticated
  using ((select chantierci_private.user_role()) = 'admin');

-- ---------------------------------------------------------------------------
-- Affectations : chacun voit les siennes ; UG et chef MOE voient celles de leur
-- périmètre ; seul l'admin les modifie.
-- ---------------------------------------------------------------------------
create policy "chantierci_affectations_select" on public.chantierci_affectations
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or (
      (select chantierci_private.user_role()) in ('admin', 'ug', 'moe_chef')
      and site_id in (select chantierci_private.sites_accessibles())
    )
  );
create policy "chantierci_affectations_insert_admin" on public.chantierci_affectations
  for insert to authenticated
  with check ((select chantierci_private.user_role()) = 'admin');
create policy "chantierci_affectations_update_admin" on public.chantierci_affectations
  for update to authenticated
  using ((select chantierci_private.user_role()) = 'admin')
  with check ((select chantierci_private.user_role()) = 'admin');
create policy "chantierci_affectations_delete_admin" on public.chantierci_affectations
  for delete to authenticated
  using ((select chantierci_private.user_role()) = 'admin');

-- ---------------------------------------------------------------------------
-- Privilèges de table (Supabase les accorde par défaut ; explicites ici pour
-- les bases qui ne le font pas). anon n'a rien.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on
  public.chantierci_lots_moe, public.chantierci_lots, public.chantierci_sites,
  public.chantierci_profiles, public.chantierci_affectations
  to authenticated;
revoke all on
  public.chantierci_lots_moe, public.chantierci_lots, public.chantierci_sites,
  public.chantierci_profiles, public.chantierci_affectations
  from anon;

-- >>>>>>>>>>>>>>>>>>>> 20261124100400_donnees_referentiel.sql
-- ============================================================================
-- Refonte PATEB — 4/4 — Données du référentiel (FICHIER GÉNÉRÉ)
--
-- Source : docs/refonte/sites_reference.csv (DAO travaux PATEB, 387 sites)
-- Généré par : node scripts/generer-referentiel.mjs — ne pas modifier à la main.
-- Poids des lots par défaut = nombre de sites du lot.
-- Rejouable : met à jour par identifiant / code sans rien supprimer (les
-- affectations et les poids déjà modifiés par l'admin sont conservés).
-- ============================================================================

insert into public.chantierci_lots_moe (id, nom, regions) values
  (1, 'Lot MOE 1', array['Bounkani', 'Gontougo', 'Indénié-Djuablin']::text[]),
  (2, 'Lot MOE 2', array['Hambol', 'Béré', 'Worodougou']::text[]),
  (3, 'Lot MOE 3', array['Cavally', 'Nawa']::text[]),
  (4, 'Lot MOE 4', array['Tchologo', 'Bagoué', 'Bafing', 'Kabadougou', 'Folon', 'Gbôklé']::text[])
on conflict (id) do update set nom = excluded.nom, regions = excluded.regions;

insert into public.chantierci_lots (id, nom, poids) values
  (1, 'Bounkani 1', 7),
  (2, 'Bounkani 2', 11),
  (3, 'Gontougo 1', 11),
  (4, 'Gontougo 2', 16),
  (5, 'Hambol 1', 12),
  (6, 'Hambol 2', 13),
  (7, 'Hambol 3', 12),
  (8, 'Hambol 4', 15),
  (9, 'Tchologo 1', 12),
  (10, 'Tchologo 2', 11),
  (11, 'Tchologo 3', 8),
  (12, 'Tchologo 4', 9),
  (13, 'Kabadougou et Folon', 8),
  (14, 'Bagoué 1', 10),
  (15, 'Bagoué 2', 8),
  (16, 'Bafing et Béré 1', 14),
  (17, 'Béré 2', 11),
  (18, 'Worodougou 1', 16),
  (19, 'Worodougou 2', 16),
  (20, 'Indénié-Djuablin 1', 8),
  (21, 'Indénié-Djuablin 2', 10),
  (22, 'Indénié-Djuablin 3', 14),
  (23, 'Indénié-Djuablin 4', 11),
  (24, 'Indénié-Djuablin 5', 14),
  (25, 'Nawa 1', 11),
  (26, 'Nawa 2', 13),
  (27, 'Nawa 3', 11),
  (28, 'Nawa 4', 13),
  (29, 'Cavally 1', 12),
  (30, 'Cavally 2', 14),
  (31, 'Cavally 3', 11),
  (32, 'Cavally 4', 11),
  (33, 'Gbôklé', 14)
on conflict (id) do update set nom = excluded.nom;

insert into public.chantierci_sites
  (code, lot_id, lot_moe_id, nom, region, departement, localite, zone, electricite, type_latrines, a_verifier)
values
  ('L01-01', 1, 1, 'EPP BOUKO', 'Bounkani', 'Bouna', 'Bouko', 'Rural', true, 'seches', ''),
  ('L01-02', 1, 1, 'EPP BOUKO 3', 'Bounkani', 'Bouna', 'Bouko', 'Rural', true, 'seches', ''),
  ('L01-03', 1, 1, 'EPP NAKELE', 'Bounkani', 'Doropo', 'Nakele', 'Rural', true, 'seches', ''),
  ('L01-04', 1, 1, 'EPP TINGO-YALO', 'Bounkani', 'Doropo', 'Tingo-Yalo', 'Rural', true, 'seches', ''),
  ('L01-05', 1, 1, 'EPP TEHINI 2B', 'Bounkani', 'Tehini', 'Tehini', 'Peri-urbain', true, 'a_eau', ''),
  ('L01-06', 1, 1, 'EPP TEHINI 2A', 'Bounkani', 'Tehini', 'Tehini', 'Peri-urbain', true, 'a_eau', 'orthographe différente dans le tableau AAO : ''EPP TEHINI A'''),
  ('L01-07', 1, 1, 'EPP TEHINI 1', 'Bounkani', 'Tehini', 'Tehini', 'Peri-urbain', true, 'a_eau', ''),
  ('L02-01', 2, 1, 'EPP BROMAKOTE-EXTENSION', 'Bounkani', 'Bouna', 'Bouna', 'Peri-urbain', true, 'a_eau', ''),
  ('L02-02', 2, 1, 'EPP BROMAKOTE', 'Bounkani', 'Bouna', 'Bouna', 'Peri-urbain', true, 'seches', ''),
  ('L02-03', 2, 1, 'EPP BROMAKOTE 2', 'Bounkani', 'Bouna', 'Bouna', 'Peri-urbain', true, 'seches', ''),
  ('L02-04', 2, 1, 'EPP BOUNA 2A', 'Bounkani', 'Bouna', 'Bouna', 'Peri-urbain', true, 'a_eau', ''),
  ('L02-05', 2, 1, 'EPP BOUNA 2B', 'Bounkani', 'Bouna', 'Bouna', 'Peri-urbain', true, 'a_eau', ''),
  ('L02-06', 2, 1, 'EPP SEHO', 'Bounkani', 'Bouna', 'Bouna', 'Peri-urbain', true, 'seches', ''),
  ('L02-07', 2, 1, 'EPP BONDOYO', 'Bounkani', 'Nassian', 'Bondoyo', 'Rural', true, 'seches', ''),
  ('L02-08', 2, 1, 'EPP PARHADI 1', 'Bounkani', 'Nassian', 'Paradhi', 'Rural', true, 'seches', ''),
  ('L02-09', 2, 1, 'EPP SEVE', 'Bounkani', 'Nassian', 'Seve', 'Rural', true, 'seches', ''),
  ('L02-10', 2, 1, 'EPP TESSODOUO', 'Bounkani', 'Bouna', 'Tessedouo', 'Rural', true, 'seches', 'orthographe différente dans le tableau AAO : ''EPP TESSEDOUO'''),
  ('L02-11', 2, 1, 'EPP LEOMIDOUO', 'Bounkani', 'Bouna', 'Leomidouo', 'Rural', true, 'seches', ''),
  ('L03-01', 3, 1, 'EPP YAOKOKOROKO', 'Gontougo', 'Bondoukou', 'Yaokokoroko', 'Rural', true, 'seches', ''),
  ('L03-02', 3, 1, 'EPP TAMBI 3', 'Gontougo', 'Bondoukou', 'Tambi', 'Rural', true, 'seches', ''),
  ('L03-03', 3, 1, 'EPP SOKO 1', 'Gontougo', 'Bondoukou', 'Soko', 'Rural', true, 'seches', ''),
  ('L03-04', 3, 1, 'EPP BOROMBA 1', 'Gontougo', 'Bondoukou', 'Boromba', 'Rural', true, 'seches', ''),
  ('L03-05', 3, 1, 'EPP MERE', 'Gontougo', 'Bondoukou', 'Mere', 'Rural', true, 'seches', ''),
  ('L03-06', 3, 1, 'EPP KIENDI-BA 1', 'Gontougo', 'Bondoukou', 'Kiendi-Ba', 'Rural', true, 'seches', ''),
  ('L03-07', 3, 1, 'EPP YANVO', 'Gontougo', 'Tanda', 'Yanvo', 'Rural', true, 'seches', ''),
  ('L03-08', 3, 1, 'EPP KOROKO-FOUMASSA', 'Gontougo', 'Tanda', 'Koroko-Foumassa', 'Rural', true, 'seches', ''),
  ('L03-09', 3, 1, 'EPP LOMO 1', 'Gontougo', 'Tanda', 'Lomo', 'Rural', true, 'seches', ''),
  ('L03-10', 3, 1, 'EPP DJANI-YAO', 'Gontougo', 'Tanda', 'Djani-Yao', 'Rural', true, 'seches', ''),
  ('L03-11', 3, 1, 'EPP TOUNDIANI', 'Gontougo', 'Tanda', 'Toundiani', 'Rural', true, 'seches', ''),
  ('L04-01', 4, 1, 'EPP BRAYE', 'Gontougo', 'Koun-Fao', 'Braye', 'Rural', true, 'a_eau', ''),
  ('L04-02', 4, 1, 'EPP OUATTE 1', 'Gontougo', 'Koun-Fao', 'Ouatte', 'Rural', true, 'a_eau', ''),
  ('L04-03', 4, 1, 'EPP DOKANOU', 'Gontougo', 'Koun-Fao', 'Dokanou', 'Rural', true, 'a_eau', ''),
  ('L04-04', 4, 1, 'EPP DJORO DJORO', 'Gontougo', 'Koun-Fao', 'Djoro Djoro', 'Rural', true, 'seches', ''),
  ('L04-05', 4, 1, 'EPP ASSINDI 2', 'Gontougo', 'Koun-Fao', 'Assindi', 'Rural', true, 'seches', ''),
  ('L04-06', 4, 1, 'EPP ADOUKRO', 'Gontougo', 'Koun-Fao', 'Adoukro', 'Rural', true, 'seches', ''),
  ('L04-07', 4, 1, 'EPP TANOKOFFIKRO', 'Gontougo', 'Koun-Fao', 'Tanokoffikro', 'Rural', true, 'seches', ''),
  ('L04-08', 4, 1, 'EPP KOTOGANDA 1', 'Gontougo', 'Koun-Fao', 'Kotoganda', 'Rural', true, 'seches', ''),
  ('L04-09', 4, 1, 'EPP PRESSO 1', 'Gontougo', 'Koun-Fao', 'Presso', 'Rural', true, 'seches', ''),
  ('L04-10', 4, 1, 'EPP YAOKRO 1', 'Gontougo', 'Koun-Fao', 'Yaokro', 'Rural', true, 'seches', ''),
  ('L04-11', 4, 1, 'EPP OUANGUI', 'Gontougo', 'Koun-Fao', 'Ouangui', 'Rural', true, 'seches', ''),
  ('L04-12', 4, 1, 'EPP KOROBO 1', 'Gontougo', 'Tanda', 'Korobo', 'Rural', true, 'seches', ''),
  ('L04-13', 4, 1, 'EPP YOMIAN', 'Gontougo', 'Transua', 'Yomian', 'Rural', true, 'seches', ''),
  ('L04-14', 4, 1, 'EPP AMOROFIKRO', 'Gontougo', 'Transua', 'Amorofikro', 'Rural', true, 'seches', ''),
  ('L04-15', 4, 1, 'EPP PRITTI 1', 'Gontougo', 'Transua', 'Pritti', 'Rural', true, 'seches', ''),
  ('L04-16', 4, 1, 'EPP SIGNAHALE', 'Gontougo', 'Transua', 'Signakale', 'Rural', true, 'seches', 'orthographe différente dans le tableau AAO : ''EPP SIGNAKALE'''),
  ('L05-01', 5, 2, 'EPP ATTIENKAHA', 'Hambol', 'Katiola', 'Attienkaha', 'Rural', true, 'seches', ''),
  ('L05-02', 5, 2, 'EPP KASSEME', 'Hambol', 'Katiola', 'Kasseme', 'Rural', true, 'seches', ''),
  ('L05-03', 5, 2, 'EPP BAD-GBEDEKAHA', 'Hambol', 'Katiola', 'Gbedekaha', 'Peri-urbain', true, 'a_eau', ''),
  ('L05-04', 5, 2, 'EPP KATIONON', 'Hambol', 'Katiola', 'Kationon', 'Rural', true, 'seches', ''),
  ('L05-05', 5, 2, 'EPP KOWARA', 'Hambol', 'Katiola', 'Kowara', 'Rural', true, 'seches', ''),
  ('L05-06', 5, 2, 'EPP YODANKAHA', 'Hambol', 'Katiola', 'Yodankaha', 'Rural', true, 'seches', ''),
  ('L05-07', 5, 2, 'EPP LAFONKAHA', 'Hambol', 'Katiola', 'Lafonkaha', 'Peri-urbain', true, 'a_eau', ''),
  ('L05-08', 5, 2, 'EPP 3 SODESUCRE FERKE 2', 'Hambol', 'Niakaramadougou', 'Ferke 2 (Village 3)', 'Rural', true, 'a_eau', ''),
  ('L05-09', 5, 2, 'EPP 2 SODESUCRE FERKE 2', 'Hambol', 'Niakaramadougou', 'Sodesucre Ferke 2', 'Rural', true, 'a_eau', ''),
  ('L05-10', 5, 2, 'EPP 5 SODESUCRE FERKE 2', 'Hambol', 'Niakaramadougou', 'Sodesucre Ferke 2', 'Rural', true, 'a_eau', ''),
  ('L05-11', 5, 2, 'EPP SELILEKAHA', 'Hambol', 'Niakaramadougou', 'Selilekaha', 'Rural', true, 'a_eau', ''),
  ('L05-12', 5, 2, 'EPP DE FOLOFONKAHA', 'Hambol', 'Niakaramadougou', 'Folofonkaha', 'Rural', true, 'a_eau', ''),
  ('L06-01', 6, 2, 'EPP NAMAGNONDOUGOU', 'Hambol', 'Dabakala', 'Namagnondougou', 'Rural', true, 'seches', ''),
  ('L06-02', 6, 2, 'EPP SATAMA SOKORO 2', 'Hambol', 'Dabakala', 'Satama Sokoro 2', 'Rural', true, 'seches', ''),
  ('L06-03', 6, 2, 'EPP BASSAWA 1', 'Hambol', 'Dabakala', 'Bassawa', 'Peri-urbain', true, 'a_eau', ''),
  ('L06-04', 6, 2, 'EPP BASSAWA 2', 'Hambol', 'Dabakala', 'Bassawa', 'Peri-urbain', true, 'a_eau', ''),
  ('L06-05', 6, 2, 'EPP KALEGUERA', 'Hambol', 'Dabakala', 'Kaleguera', 'Rural', false, 'seches', ''),
  ('L06-06', 6, 2, 'EPP LITIARI', 'Hambol', 'Dabakala', 'Litiari', 'Rural', false, 'seches', ''),
  ('L06-07', 6, 2, 'EPP BAKORO', 'Hambol', 'Dabakala', 'Bakoro', 'Rural', true, 'seches', ''),
  ('L06-08', 6, 2, 'EPP PINSOLODOUDOUGOU1', 'Hambol', 'Dabakala', 'Pinsolodoudougou', 'Rural', true, 'seches', ''),
  ('L06-09', 6, 2, 'EPP BOKALA 1', 'Hambol', 'Dabakala', 'Bokala', 'Rural', true, 'seches', ''),
  ('L06-10', 6, 2, 'EPP BOKALA 2', 'Hambol', 'Dabakala', 'Bokala', 'Rural', true, 'seches', ''),
  ('L06-11', 6, 2, 'EPP KOHOUARA 1', 'Hambol', 'Dabakala', 'Kohouara', 'Rural', true, 'seches', ''),
  ('L06-12', 6, 2, 'EPP NIEMENE 2', 'Hambol', 'Dabakala', 'Niemene', 'Peri-urbain', true, 'seches', ''),
  ('L06-13', 6, 2, 'EPP NIEMENE 1', 'Hambol', 'Dabakala', 'Niemene', 'Peri-urbain', true, 'seches', ''),
  ('L07-01', 7, 2, 'EPP TIEMOKO KONE 1 DE NIAKARA', 'Hambol', 'Niakaramadougou', 'Kalehe Extention', 'Peri-urbain', true, 'a_eau', ''),
  ('L07-02', 7, 2, 'EPP TIEMOKO KONE 2 DE NIAKARA', 'Hambol', 'Niakaramadougou', 'Niakara', 'Peri-urbain', true, 'a_eau', ''),
  ('L07-03', 7, 2, 'EPP NANLO BAMBA 1 DE NIAKARA', 'Hambol', 'Niakaramadougou', 'Plateau', 'Peri-urbain', true, 'seches', ''),
  ('L07-04', 7, 2, 'EPP NANLO BAMBA 2 DE NIAKARA', 'Hambol', 'Niakaramadougou', 'Plateau', 'Peri-urbain', true, 'seches', ''),
  ('L07-05', 7, 2, 'EPP 1 DE NIAKARA CHATEAU', 'Hambol', 'Niakaramadougou', 'Chateau D''Eau', 'Peri-urbain', true, 'a_eau', ''),
  ('L07-06', 7, 2, 'EPP 2 DE BAMBARASSO', 'Hambol', 'Dabakala', 'Bambarasso', 'Peri-urbain', false, 'seches', ''),
  ('L07-07', 7, 2, 'EPP 1 DE BAMBARASSO', 'Hambol', 'Dabakala', 'Dabakala', 'Peri-urbain', false, 'seches', ''),
  ('L07-08', 7, 2, 'EPP DE FOLOFONKAHA', 'Hambol', 'Niakaramadougou', 'Folofonkaha', 'Rural', false, 'seches', ''),
  ('L07-09', 7, 2, 'EPP 1 DE NIAKARA RESIDENTIEL', 'Hambol', 'Niakaramadougou', 'Residentiel', 'Peri-urbain', true, 'seches', ''),
  ('L07-10', 7, 2, 'EPP DE LAFIGUE', 'Hambol', 'Dabakala', 'Lafigue', 'Rural', true, 'seches', ''),
  ('L07-11', 7, 2, 'EPP HORO TITCHIETA DE ANGOLOKAHA', 'Hambol', 'Niakaramadougou', 'Angolokaha', 'Rural', false, 'seches', ''),
  ('L07-12', 7, 2, 'EPP DE TENINDIERI', 'Hambol', 'Niakaramadougou', '', 'Rural', true, 'seches', 'le tableau AAO nomme ce site ''EPP CHATEAU 1'' (localité Tenindieri) : nom à confirmer'),
  ('L08-01', 8, 2, 'EPP CHATEAU 1', 'Hambol', 'Katiola', 'Tortiya', 'Peri-urbain', true, 'a_eau', ''),
  ('L08-02', 8, 2, 'EPP CHATEAU 2', 'Hambol', 'Katiola', 'Katiola', 'Peri-urbain', true, 'a_eau', ''),
  ('L08-03', 8, 2, 'EPP DIMBEKAHA 1', 'Hambol', 'Katiola', 'Lafonkaha', 'Peri-urbain', true, 'a_eau', ''),
  ('L08-04', 8, 2, 'EPP NANDIEPLEKAHA', 'Hambol', 'Katiola', 'Katiola', 'Peri-urbain', true, 'seches', ''),
  ('L08-05', 8, 2, 'EPP GBOROGBODOUGOU', 'Hambol', 'Katiola', 'Pediakaha', 'Peri-urbain', true, 'a_eau', ''),
  ('L08-06', 8, 2, 'EPP OFFIAKAHA 1', 'Hambol', 'Katiola', 'Katiola', 'Peri-urbain', true, 'a_eau', ''),
  ('L08-07', 8, 2, 'EPP TAFIRE 2A', 'Hambol', 'Niakaramadougou', 'Offiakaha', 'Peri-urbain', true, 'seches', ''),
  ('L08-08', 8, 2, 'EPP TAFIRE 2B', 'Hambol', 'Niakaramadougou', 'Tafire', 'Peri-urbain', true, 'seches', ''),
  ('L08-09', 8, 2, 'EPP KANAKAHA 2', 'Hambol', 'Niakaramadougou', 'Tafire', 'Peri-urbain', true, 'seches', ''),
  ('L08-10', 8, 2, 'EPP KANAKAHA 1', 'Hambol', 'Niakaramadougou', 'Tafire', 'Peri-urbain', true, 'seches', ''),
  ('L08-11', 8, 2, 'EPP DE BADIOKAHA', 'Hambol', 'Niakaramadougou', 'Tafire', 'Rural', true, 'seches', ''),
  ('L08-12', 8, 2, 'EPP 1 DE NIEDIEKAHA', 'Hambol', 'Niakaramadougou', 'Badiokaha', 'Rural', true, 'a_eau', ''),
  ('L08-13', 8, 2, 'EPP 2 DE NIAKARA RESIDENTIEL', 'Hambol', 'Niakaramadougou', 'Niediekaha', 'Peri-urbain', true, 'seches', ''),
  ('L08-14', 8, 2, 'EPP 1A DE TORTIYA', 'Hambol', 'Niakaramadougou', 'R.T.I', 'Peri-urbain', true, 'seches', ''),
  ('L08-15', 8, 2, 'EPP 1B DE TORTIYA', 'Hambol', 'Niakaramadougou', 'Tortiya', 'Peri-urbain', true, 'seches', ''),
  ('L09-01', 9, 4, 'EPP FERKE GARE 1', 'Tchologo', 'Ferkessedougou', 'Gare', 'Peri-urbain', true, 'a_eau', ''),
  ('L09-02', 9, 4, 'EPP KAFALOVOGO', 'Tchologo', 'Ferkessedougou', 'Kafalovogo', 'Rural', true, 'seches', ''),
  ('L09-03', 9, 4, 'EPP MARIATOU KONE DE PISSANKAHA', 'Tchologo', 'Ferkessedougou', 'Pissankaha', 'Rural', true, 'a_eau', ''),
  ('L09-04', 9, 4, 'EPP SODESUCRE B2', 'Tchologo', 'Ferkessedougou', 'Sucaf-Ci Ferke 1', 'Rural', true, 'a_eau', ''),
  ('L09-05', 9, 4, 'EPP SODESUCRE C2', 'Tchologo', 'Ferkessedougou', 'Sucaf Ci Ferke 1', 'Rural', true, 'a_eau', ''),
  ('L09-06', 9, 4, 'EPP SODESUCRE C3', 'Tchologo', 'Ferkessedougou', 'Sucaf-Ci Ferke1-Village C', 'Rural', true, 'a_eau', ''),
  ('L09-07', 9, 4, 'EPP SODESUCRE C1', 'Tchologo', 'Ferkessedougou', 'Village C', 'Rural', true, 'a_eau', ''),
  ('L09-08', 9, 4, 'EPP SODESUCRE B1', 'Tchologo', 'Ferkessedougou', 'Village B', 'Rural', true, 'a_eau', ''),
  ('L09-09', 9, 4, 'EPP DIAWALA 5', 'Tchologo', 'Ouangolodougou', 'Diawala', 'Peri-urbain', true, 'a_eau', ''),
  ('L09-10', 9, 4, 'EPP DIAWALA 1', 'Tchologo', 'Ouangolodougou', 'Diawala', 'Peri-urbain', true, 'a_eau', ''),
  ('L09-11', 9, 4, 'EPP NIELLE 3', 'Tchologo', 'Ouangolodougou', 'Nielle', 'Peri-urbain', true, 'a_eau', ''),
  ('L09-12', 9, 4, 'EPP NIELLE 4', 'Tchologo', 'Ouangolodougou', 'Parawalakaha', 'Peri-urbain', true, 'a_eau', ''),
  ('L10-01', 10, 4, 'EPP PARAWALAKAHA', 'Tchologo', 'Ferkessedougou', 'Lanviara', 'Rural', false, 'seches', ''),
  ('L10-02', 10, 4, 'EPP BAD-LANVIARA1', 'Tchologo', 'Ferkessedougou', 'Kinyekaha', 'Peri-urbain', true, 'a_eau', ''),
  ('L10-03', 10, 4, 'EPP KINYEKAHA', 'Tchologo', 'Ferkessedougou', 'Kalakala', 'Rural', false, 'seches', ''),
  ('L10-04', 10, 4, 'EPP KALAKALA', 'Tchologo', 'Ferkessedougou', 'Bromakote', 'Rural', false, 'seches', ''),
  ('L10-05', 10, 4, 'EPP BROMAKOTE EXTENSION -1', 'Tchologo', 'Ferkessedougou', 'Bromakote', 'Peri-urbain', true, 'a_eau', ''),
  ('L10-06', 10, 4, 'EPP BROMAKOTE EXTENSION 2', 'Tchologo', 'Ferkessedougou', 'Bromakote', 'Peri-urbain', true, 'a_eau', ''),
  ('L10-07', 10, 4, 'EPP BROMAKOTE EXTENSION-3', 'Tchologo', 'Ferkessedougou', 'Nambonkaha', 'Peri-urbain', true, 'a_eau', ''),
  ('L10-08', 10, 4, 'EPP NAMBONKAHA', 'Tchologo', 'Ferkessedougou', 'Sepenediokaha', 'Rural', true, 'a_eau', ''),
  ('L10-09', 10, 4, 'EPP SEPENEDIOKAHA 1', 'Tchologo', 'Ferkessedougou', 'Tionrolokaha', 'Rural', true, 'seches', ''),
  ('L10-10', 10, 4, 'EPP SODEFEL', 'Tchologo', 'Ferkessedougou', 'Lanviara', 'Rural', false, 'seches', ''),
  ('L10-11', 10, 4, 'EPP BAD LANVIARA 2', 'Tchologo', 'Ferkessedougou', 'Parawalakaha', 'Peri-urbain', true, 'a_eau', ''),
  ('L11-01', 11, 4, 'EPP KONGOLO', 'Tchologo', 'Kong', 'Kongolo', 'Rural', true, 'seches', ''),
  ('L11-02', 11, 4, 'EPP 1 NAFANA', 'Tchologo', 'Kong', 'Nafana', 'Rural', true, 'seches', ''),
  ('L11-03', 11, 4, 'EPP KAFOLO BAC', 'Tchologo', 'Kong', 'Kafolo Bac', 'Rural', false, 'seches', ''),
  ('L11-04', 11, 4, 'EPP 1 LINGUEKORO', 'Tchologo', 'Kong', 'Sikolo', 'Rural', true, 'seches', ''),
  ('L11-05', 11, 4, 'EPP FASSELEMOU', 'Tchologo', 'Kong', 'Fasselemou', 'Rural', false, 'seches', ''),
  ('L11-06', 11, 4, 'EPP MANOGOTA', 'Tchologo', 'Kong', 'Manogota', 'Peri-urbain', false, 'seches', ''),
  ('L11-07', 11, 4, 'EPP KONG3', 'Tchologo', 'Kong', 'Kong', 'Peri-urbain', true, 'seches', ''),
  ('L11-08', 11, 4, 'EPP KONG1', 'Tchologo', 'Kong', 'Kong', 'Peri-urbain', true, 'a_eau', ''),
  ('L12-01', 12, 4, 'EPP NAMBINGUE', 'Tchologo', 'Ouangolodougou', 'Nambingue', 'Rural', true, 'seches', ''),
  ('L12-02', 12, 4, 'EPP NAMBINGUE 2', 'Tchologo', 'Ouangolodougou', 'Nambingue', 'Rural', true, 'seches', ''),
  ('L12-03', 12, 4, 'EPP ZANDANANKAHA', 'Tchologo', 'Ouangolodougou', 'Zandanakaha', 'Rural', true, 'seches', ''),
  ('L12-04', 12, 4, 'EPP KAOUARA', 'Tchologo', 'Ouangolodougou', 'Kaouara', 'Rural', true, 'seches', ''),
  ('L12-05', 12, 4, 'EPP BAD OUANGOLO', 'Tchologo', 'Ouangolodougou', 'Residentiel 2', 'Peri-urbain', true, 'seches', ''),
  ('L12-06', 12, 4, 'EPP BROUNDOUGOU', 'Tchologo', 'Ouangolodougou', 'Broundougou', 'Peri-urbain', true, 'seches', ''),
  ('L12-07', 12, 4, 'EPP AVIATION', 'Tchologo', 'Ouangolodougou', 'Aviation', 'Peri-urbain', true, 'seches', ''),
  ('L12-08', 12, 4, 'EPP SECO', 'Tchologo', 'Ouangolodougou', 'Hamdalaye', 'Peri-urbain', true, 'seches', ''),
  ('L12-09', 12, 4, 'EPP OUANGOLOSSO 3', 'Tchologo', 'Ouangolodougou', '', 'Peri-urbain', true, 'seches', 'le tableau AAO indique à la place ''EPP 2 DE BOLO V1'' (site du lot 33) : erreur probable de l''AAO'),
  ('L13-01', 13, 4, 'EPP DE KORONDOUGOU', 'Kabadougou', 'Odienne', 'Korondougou', 'Rural', true, 'seches', ''),
  ('L13-02', 13, 4, 'EPP 2 DE SOKORODOUGOU', 'Kabadougou', 'Odienne', 'Sokorodougou', 'Rural', true, 'seches', ''),
  ('L13-03', 13, 4, 'EPP DE TCHIGBELA', 'Kabadougou', 'Odienne', 'Tchigbela', 'Rural', true, 'seches', ''),
  ('L13-04', 13, 4, 'EPP KROUKRO-MAFELE', 'Kabadougou', 'Odienne', 'Kroukro-Mafele', 'Rural', true, 'seches', ''),
  ('L13-05', 13, 4, 'EPP DE SOKOURABA-TRON', 'Folon', 'Kaniasso', 'Sokouraba Tron', 'Rural', true, 'seches', ''),
  ('L13-06', 13, 4, 'EPP 1 MINIGNAN', 'Folon', 'Minignan', 'Minignan', 'Rural', true, 'seches', ''),
  ('L13-07', 13, 4, 'EPP 2 DE TIENKO', 'Folon', 'Minignan', 'Tienko', 'Rural', true, 'seches', ''),
  ('L13-08', 13, 4, 'EPP 1 DE KOTOULA', 'Folon', 'Minignan', 'Kotoula', 'Rural', true, 'seches', ''),
  ('L14-01', 14, 4, 'EPP NONGANA', 'Bagoué', 'Boundiali', 'Nongana', 'Rural', false, 'seches', ''),
  ('L14-02', 14, 4, 'EPP N''DARA', 'Bagoué', 'Boundiali', 'N''Dara', 'Rural', true, 'seches', ''),
  ('L14-03', 14, 4, 'EPP FATOUMATA GON COULIBALY', 'Bagoué', 'Boundiali', 'Sissedougou', 'Rural', true, 'a_eau', ''),
  ('L14-04', 14, 4, 'EPP SIEMPURGO', 'Bagoué', 'Boundiali', 'Siempurgo', 'Rural', true, 'seches', ''),
  ('L14-05', 14, 4, 'EPP KORO', 'Bagoué', 'Kouto', 'Koro', 'Rural', false, 'seches', ''),
  ('L14-06', 14, 4, 'EPP DOUASSO', 'Bagoué', 'Kouto', 'Douasso', 'Rural', false, 'seches', ''),
  ('L14-07', 14, 4, 'EPP LANDIOUGOU 1', 'Bagoué', 'Boundiali', 'Landiougou', 'Rural', false, 'seches', ''),
  ('L14-08', 14, 4, 'EPP MARANAMA', 'Bagoué', 'Kouto', 'Maranama', 'Rural', true, 'seches', ''),
  ('L14-09', 14, 4, 'EPP KATANRA', 'Bagoué', 'Kouto', 'Katanra', 'Rural', true, 'seches', ''),
  ('L14-10', 14, 4, 'EPP MAHALE 1', 'Bagoué', 'Kouto', 'Mahale', 'Rural', false, 'seches', ''),
  ('L15-01', 15, 4, 'EPP SAN 1', 'Bagoué', 'Tengrela', 'San', 'Rural', true, 'a_eau', ''),
  ('L15-02', 15, 4, 'EPP TIOGO', 'Bagoué', 'Kouto', 'Tiogo', 'Rural', true, 'seches', ''),
  ('L15-03', 15, 4, 'EPP 1 WORA', 'Bagoué', 'Kouto', 'Wora', 'Rural', true, 'a_eau', ''),
  ('L15-04', 15, 4, 'EPP 1 TINDARA', 'Bagoué', 'Kouto', 'Tindara', 'Rural', true, 'a_eau', ''),
  ('L15-05', 15, 4, 'EPP 2 TINDARA', 'Bagoué', 'Kouto', 'Tindara', 'Rural', true, 'a_eau', ''),
  ('L15-06', 15, 4, 'EPP TABAKORONI', 'Bagoué', 'Kouto', 'Tabakoroni', 'Rural', true, 'seches', ''),
  ('L15-07', 15, 4, 'EPP ZAGUINASSO 1', 'Bagoué', 'Kouto', 'Zaguinasso', 'Rural', true, 'seches', ''),
  ('L15-08', 15, 4, 'EPP WOMON', 'Bagoué', 'Kouto', 'Womon', 'Rural', true, 'seches', ''),
  ('L16-01', 16, 4, 'EPP COMPLEXE SUCRIER DE BOROTOU-KORO 1', 'Bafing', 'Koro', 'Borotou-Koro', 'Rural', true, 'seches', ''),
  ('L16-02', 16, 4, 'EPP BOROTOU-KORO', 'Bafing', 'Koro', 'Borotou-Koro', 'Rural', true, 'seches', ''),
  ('L16-03', 16, 4, 'EPP GANHOUE 1', 'Bafing', 'Ouaninou', 'Ganhoue', 'Rural', true, 'seches', ''),
  ('L16-04', 16, 4, 'EPP B FENAN 2', 'Bafing', 'Touba', 'Fenan 2', 'Rural', true, 'seches', ''),
  ('L16-05', 16, 4, 'EPP OUEBASSO', 'Bafing', 'Touba', 'Ouebasso', 'Rural', true, 'seches', ''),
  ('L16-06', 16, 4, 'EPP TENEMASSA', 'Bafing', 'Ouaninou', 'Tenemassa', 'Rural', true, 'seches', ''),
  ('L16-07', 16, 4, 'EPP NIOKOSSO 1', 'Bafing', 'Koro', 'Niokosso', 'Rural', true, 'seches', ''),
  ('L16-08', 16, 2, 'EPP TIEMA 1', 'Béré', 'Mankono', 'Tiema', 'Rural', true, 'seches', ''),
  ('L16-09', 16, 2, 'EPP ADAMASSO', 'Béré', 'Mankono', 'Adamasso', 'Rural', true, 'seches', ''),
  ('L16-10', 16, 2, 'EPP HEREMANKONO 1', 'Béré', 'Mankono', 'Heremankono', 'Rural', true, 'seches', ''),
  ('L16-11', 16, 2, 'EPP SOUKOUROUGBAN 1', 'Béré', 'Kounahiri', 'Soukourougban', 'Rural', true, 'seches', ''),
  ('L16-12', 16, 2, 'EPP FIZANLOUMA 1', 'Béré', 'Mankono', 'Fizanlouma', 'Rural', true, 'seches', ''),
  ('L16-13', 16, 2, 'EPP FIZANLOUMA 2', 'Béré', 'Mankono', 'Fizanlouma', 'Rural', true, 'seches', ''),
  ('L16-14', 16, 2, 'EPP KOROKOPLA 3', 'Béré', 'Kounahiri', 'Korokopla', 'Rural', true, 'seches', ''),
  ('L17-01', 17, 2, 'EPP KAMORO 2', 'Béré', 'Mankono', 'Kamoro', 'Rural', true, 'seches', ''),
  ('L17-02', 17, 2, 'EPP NIANGOURALA-TIENE', 'Béré', 'Mankono', 'Niangourala-Tiene', 'Rural', true, 'seches', ''),
  ('L17-03', 17, 2, 'EPP KOBADALLAH', 'Béré', 'Mankono', 'Kobadallah', 'Rural', true, 'seches', ''),
  ('L17-04', 17, 2, 'EPP MAMOUROUTOGODA', 'Béré', 'Mankono', 'Mamouroukaha', 'Rural', true, 'seches', ''),
  ('L17-05', 17, 2, 'EPP POKOUTOU', 'Béré', 'Mankono', 'Pokoutou', 'Rural', true, 'seches', ''),
  ('L17-06', 17, 2, 'EPP LOKOLO', 'Béré', 'Dianra', 'Lokolo', 'Rural', true, 'seches', ''),
  ('L17-07', 17, 2, 'EPP YERETIELE', 'Béré', 'Dianra', 'Yeretiele', 'Rural', true, 'seches', ''),
  ('L17-08', 17, 2, 'EPP KAFEGUE', 'Béré', 'Dianra', 'Kafegue', 'Rural', true, 'seches', ''),
  ('L17-09', 17, 2, 'EPP SONONZO 1', 'Béré', 'Dianra', 'Sononzo', 'Rural', true, 'seches', ''),
  ('L17-10', 17, 2, 'EPP KAN-SOKOURA', 'Béré', 'Dianra', 'Kan-Sokoura', 'Rural', true, 'seches', ''),
  ('L17-11', 17, 2, 'EPP NAWOKAHA', 'Béré', 'Mankono', 'Nawokaha', 'Rural', true, 'seches', ''),
  ('L18-01', 18, 2, 'EPP FADJADOUGOU 1', 'Worodougou', 'Kani', 'Fadiadougou', 'Peri-urbain', true, 'seches', ''),
  ('L18-02', 18, 2, 'EPP FINGOLO', 'Worodougou', 'Kani', 'Fingolo', 'Rural', true, 'seches', ''),
  ('L18-03', 18, 2, 'EPP KANI 2', 'Worodougou', 'Kani', 'Kani', 'Peri-urbain', true, 'seches', ''),
  ('L18-04', 18, 2, 'EPP BABASSO 1', 'Worodougou', 'Kani', 'Babasso', 'Rural', true, 'seches', ''),
  ('L18-05', 18, 2, 'EPP KANI 3', 'Worodougou', 'Kani', 'Kani', 'Peri-urbain', true, 'seches', ''),
  ('L18-06', 18, 2, 'EPP SILAKORO', 'Worodougou', 'Kani', 'Silakoro', 'Rural', true, 'seches', ''),
  ('L18-07', 18, 2, 'EPP KANI 1', 'Worodougou', 'Kani', 'Kani', 'Peri-urbain', true, 'seches', ''),
  ('L18-08', 18, 2, 'EPP KANI 4', 'Worodougou', 'Kani', 'Kani', 'Peri-urbain', true, 'seches', ''),
  ('L18-09', 18, 2, 'EPP 6 DE KANI', 'Worodougou', 'Kani', 'Bamanankounda', 'Peri-urbain', true, 'seches', ''),
  ('L18-10', 18, 2, 'EPP GBEMANZO 1', 'Worodougou', 'Seguela', 'Gbemanzo', 'Rural', true, 'seches', ''),
  ('L18-11', 18, 2, 'EPP KONDOGO', 'Worodougou', 'Seguela', 'Kondogo', 'Rural', true, 'seches', ''),
  ('L18-12', 18, 2, 'EPP GBEMANZO 2', 'Worodougou', 'Seguela', 'Gbemazo', 'Rural', true, 'seches', ''),
  ('L18-13', 18, 2, 'EPP KOUEGO', 'Worodougou', 'Seguela', 'Kouego', 'Rural', true, 'seches', ''),
  ('L18-14', 18, 2, 'EPP TIEMA', 'Worodougou', 'Seguela', 'Tiema', 'Rural', true, 'seches', ''),
  ('L18-15', 18, 2, 'EPP KOHEMON', 'Worodougou', 'Seguela', 'Kohimon', 'Rural', true, 'seches', ''),
  ('L18-16', 18, 2, 'EPP KATO 2', 'Worodougou', 'Seguela', 'Kato', 'Rural', true, 'seches', ''),
  ('L19-01', 19, 2, 'EPP MAYAMA 1', 'Worodougou', 'Seguela', 'Seguela', 'Peri-urbain', true, 'seches', ''),
  ('L19-02', 19, 2, 'EPP BENA', 'Worodougou', 'Seguela', 'Bena', 'Rural', true, 'seches', ''),
  ('L19-03', 19, 2, 'EPP SANDALA', 'Worodougou', 'Seguela', 'Sandala', 'Rural', true, 'seches', ''),
  ('L19-04', 19, 2, 'EPP SEGUELA AN-18 A', 'Worodougou', 'Seguela', 'Bakayoko Extension', 'Peri-urbain', true, 'seches', ''),
  ('L19-05', 19, 2, 'EPP MAYAMA 2', 'Worodougou', 'Seguela', 'Seguela', 'Peri-urbain', true, 'seches', ''),
  ('L19-06', 19, 2, 'EPP DIORHOLE 1', 'Worodougou', 'Seguela', 'Diorhole', 'Rural', true, 'seches', ''),
  ('L19-07', 19, 2, 'EPP TIEMASSOBA', 'Worodougou', 'Seguela', 'Tiemassoba', 'Rural', true, 'seches', ''),
  ('L19-08', 19, 2, 'EPP GBIANA', 'Worodougou', 'Seguela', 'Gbiana', 'Rural', true, 'seches', ''),
  ('L19-09', 19, 2, 'EPP SIANA', 'Worodougou', 'Seguela', 'Siana', 'Rural', true, 'seches', ''),
  ('L19-10', 19, 2, 'EPP SAGOURA-DOUGOULA', 'Worodougou', 'Seguela', 'Sagoura-Dougoula', 'Rural', true, 'seches', ''),
  ('L19-11', 19, 2, 'EPP BABIEN 2', 'Worodougou', 'Seguela', 'Babien', 'Rural', true, 'seches', ''),
  ('L19-12', 19, 2, 'EPP BABIEN 1', 'Worodougou', 'Seguela', 'Babien', 'Rural', true, 'seches', ''),
  ('L19-13', 19, 2, 'EPP DASSO', 'Worodougou', 'Seguela', 'Dasso', 'Rural', true, 'seches', ''),
  ('L19-14', 19, 2, 'EPP TALA', 'Worodougou', 'Seguela', 'Tala', 'Rural', true, 'seches', ''),
  ('L19-15', 19, 2, 'EPP DIENFE', 'Worodougou', 'Seguela', 'Dienfe', 'Rural', true, 'seches', ''),
  ('L19-16', 19, 2, 'EPP BERENI MARHANA', 'Worodougou', 'Seguela', 'Bereni Marhana', 'Rural', true, 'seches', ''),
  ('L20-01', 20, 1, 'EPP ADAHOU 1', 'Indénié-Djuablin', 'Abengourou', 'Adaou', 'Peri-urbain', true, 'a_eau', ''),
  ('L20-02', 20, 1, 'EPP ADAHOU 3', 'Indénié-Djuablin', 'Abengourou', 'Adaou', 'Rural', true, 'a_eau', ''),
  ('L20-03', 20, 1, 'EPP AGNI 3', 'Indénié-Djuablin', 'Abengourou', 'Abengourou', 'Peri-urbain', true, 'a_eau', ''),
  ('L20-04', 20, 1, 'EPP AGNI EECI', 'Indénié-Djuablin', 'Abengourou', 'Abengourou', 'Peri-urbain', true, 'a_eau', ''),
  ('L20-05', 20, 1, 'EPP KIRIFI', 'Indénié-Djuablin', 'Abengourou', 'Abengourou', 'Peri-urbain', true, 'a_eau', ''),
  ('L20-06', 20, 1, 'EPP PLATEAU 1', 'Indénié-Djuablin', 'Abengourou', 'Abengourou', 'Peri-urbain', true, 'a_eau', ''),
  ('L20-07', 20, 1, 'EPP PLATEAU 3', 'Indénié-Djuablin', 'Abengourou', 'Abengourou', 'Peri-urbain', true, 'a_eau', ''),
  ('L20-08', 20, 1, 'EPP PLATEAU 2', 'Indénié-Djuablin', 'Abengourou', 'Abengourou', 'Peri-urbain', true, 'a_eau', ''),
  ('L21-01', 21, 1, 'EPP BOSSEMATIE', 'Indénié-Djuablin', 'Abengourou', 'Bossematie', 'Rural', true, 'seches', ''),
  ('L21-02', 21, 1, 'EPP EHUASSO 2', 'Indénié-Djuablin', 'Abengourou', 'Ehuasso', 'Rural', true, 'a_eau', ''),
  ('L21-03', 21, 1, 'EPP EHUASSO 1', 'Indénié-Djuablin', 'Abengourou', 'Ehuasso', 'Rural', true, 'a_eau', ''),
  ('L21-04', 21, 1, 'EPP M''BASSO', 'Indénié-Djuablin', 'Abengourou', 'M''Basso', 'Rural', true, 'a_eau', ''),
  ('L21-05', 21, 1, 'EPP OUSMANE COULIBALY BEBOU', 'Indénié-Djuablin', 'Abengourou', 'Bebou', 'Rural', true, 'a_eau', ''),
  ('L21-06', 21, 1, 'EPP SOUKOU-SOUKOU', 'Indénié-Djuablin', 'Abengourou', 'Soukou-Soukou', 'Rural', true, 'seches', ''),
  ('L21-07', 21, 1, 'EPP BOKAKOKORE 1', 'Indénié-Djuablin', 'Abengourou', 'Bokakokore', 'Rural', true, 'a_eau', ''),
  ('L21-08', 21, 1, 'EPP EBILASSOKRO 2', 'Indénié-Djuablin', 'Abengourou', 'Ebilassokro', 'Peri-urbain', true, 'a_eau', ''),
  ('L21-09', 21, 1, 'EPP MIAN ANE KOUASSI DE ZARANOU', 'Indénié-Djuablin', 'Abengourou', 'Zaranou', 'Peri-urbain', true, 'a_eau', ''),
  ('L21-10', 21, 1, 'EPP BOKAKOKORE 2', 'Indénié-Djuablin', 'Abengourou', 'Bokakokore', 'Rural', true, 'a_eau', ''),
  ('L22-01', 22, 1, 'EPP KONGODIA 2', 'Indénié-Djuablin', 'Agnibilekrou', 'Kongodia', 'Rural', true, 'a_eau', ''),
  ('L22-02', 22, 1, 'EPP YOBOUAKRO 1', 'Indénié-Djuablin', 'Agnibilekrou', 'Yobouakro', 'Rural', true, 'seches', ''),
  ('L22-03', 22, 1, 'EPP YOBOUAKRO 3', 'Indénié-Djuablin', 'Agnibilekrou', 'Yobuakro', 'Rural', true, 'a_eau', ''),
  ('L22-04', 22, 1, 'EPP DAME 1', 'Indénié-Djuablin', 'Agnibilekrou', 'Dame', 'Peri-urbain', true, 'a_eau', ''),
  ('L22-05', 22, 1, 'EPP AGNI-OUEST EXTENSION', 'Indénié-Djuablin', 'Agnibilekrou', 'Belle Ville', 'Peri-urbain', true, 'a_eau', ''),
  ('L22-06', 22, 1, 'EPP KOTOKOSSO 1', 'Indénié-Djuablin', 'Agnibilekrou', 'Kotokosso', 'Rural', true, 'a_eau', ''),
  ('L22-07', 22, 1, 'EPP AGNI-PLATEAU 4', 'Indénié-Djuablin', 'Agnibilekrou', 'Agnibilekrou', 'Peri-urbain', true, 'a_eau', ''),
  ('L22-08', 22, 1, 'EPP BAD AGNI 1', 'Indénié-Djuablin', 'Agnibilekrou', 'Lycee Residentiel', 'Peri-urbain', true, 'a_eau', ''),
  ('L22-09', 22, 1, 'EPP BAD AGNI 2', 'Indénié-Djuablin', 'Agnibilekrou', 'Agnibilekrou', 'Peri-urbain', true, 'a_eau', ''),
  ('L22-10', 22, 1, 'EPP AGNI-PLATEAU 2', 'Indénié-Djuablin', 'Agnibilekrou', 'Plateau', 'Peri-urbain', true, 'a_eau', ''),
  ('L22-11', 22, 1, 'EPP AGNI-PLATEAU 3', 'Indénié-Djuablin', 'Agnibilekrou', 'Plateau', 'Peri-urbain', true, 'a_eau', ''),
  ('L22-12', 22, 1, 'EPP AGNI-OUEST 2', 'Indénié-Djuablin', 'Agnibilekrou', 'Sodeci', 'Peri-urbain', true, 'a_eau', ''),
  ('L22-13', 22, 1, 'EPP AGNI-OUEST 4', 'Indénié-Djuablin', 'Agnibilekrou', 'Sodeci', 'Peri-urbain', true, 'a_eau', ''),
  ('L22-14', 22, 1, 'EPP AGNI-RESIDENTIEL', 'Indénié-Djuablin', 'Agnibilekrou', 'Agnibilekrou', 'Peri-urbain', true, 'a_eau', ''),
  ('L23-01', 23, 1, 'EPP ZEBENOU 1', 'Indénié-Djuablin', 'Abengourou', 'Zebenou', 'Peri-urbain', true, 'seches', ''),
  ('L23-02', 23, 1, 'EPP ZOUHOUNOU 2', 'Indénié-Djuablin', 'Abengourou', 'Zouhounou', 'Rural', true, 'seches', ''),
  ('L23-03', 23, 1, 'EPP KOITIENKRO 2', 'Indénié-Djuablin', 'Abengourou', 'Koitienkro', 'Rural', true, 'seches', ''),
  ('L23-04', 23, 1, 'EPP AFFALIKRO 2', 'Indénié-Djuablin', 'Abengourou', 'Affalikro', 'Rural', true, 'a_eau', ''),
  ('L23-05', 23, 1, 'EPP SATIKRAN 2', 'Indénié-Djuablin', 'Abengourou', 'Satikran', 'Rural', true, 'seches', ''),
  ('L23-06', 23, 1, 'EPP ANIASSUE 1', 'Indénié-Djuablin', 'Abengourou', 'Aniassue', 'Peri-urbain', true, 'seches', ''),
  ('L23-07', 23, 1, 'EPP ANIASSUE 3', 'Indénié-Djuablin', 'Abengourou', 'Aniassue', 'Peri-urbain', true, 'seches', ''),
  ('L23-08', 23, 1, 'EPP AMIANKOUASSIKRO 2', 'Indénié-Djuablin', 'Abengourou', 'Amiankouassikro 2', 'Rural', true, 'seches', ''),
  ('L23-09', 23, 1, 'EPP ASSAKRO 1', 'Indénié-Djuablin', 'Abengourou', 'Assakro', 'Rural', true, 'seches', ''),
  ('L23-10', 23, 1, 'EPP ASSAKRO 2', 'Indénié-Djuablin', 'Abengourou', 'Assakro', 'Rural', true, 'seches', ''),
  ('L23-11', 23, 1, 'EPP N''GRAKON 1', 'Indénié-Djuablin', 'Abengourou', 'N''Grakon', 'Rural', true, 'seches', ''),
  ('L24-01', 24, 1, '(site à identifier — lot 24)', 'Indénié-Djuablin', 'Abengourou', '', '', true, 'a_eau', 'ligne sans nom dans l''allotissement (le total du lot compte 14 classes pour 13 sites nommés) : site à identifier'),
  ('L24-02', 24, 1, 'EPP SANKADIOKRO 3', 'Indénié-Djuablin', 'Abengourou', 'Sankadiokro', 'Rural', true, 'a_eau', ''),
  ('L24-03', 24, 1, 'EPP ESPERANCE-SCIERIE', 'Indénié-Djuablin', 'Abengourou', 'La Scierie', 'Rural', true, 'seches', ''),
  ('L24-04', 24, 1, 'EPP KOUAMEZIANKRO 1', 'Indénié-Djuablin', 'Abengourou', 'Kouameziankro', 'Rural', true, 'a_eau', ''),
  ('L24-05', 24, 1, 'EPP APPROMPRONOU 1', 'Indénié-Djuablin', 'Abengourou', 'Apprompronou', 'Rural', true, 'a_eau', ''),
  ('L24-06', 24, 1, 'EPP ZINZENOU 1', 'Indénié-Djuablin', 'Abengourou', 'Zinzenou', 'Rural', true, 'a_eau', ''),
  ('L24-07', 24, 1, 'EPP YAKASSE 3', 'Indénié-Djuablin', 'Abengourou', 'Yakasse-Feyasse', 'Peri-urbain', true, 'seches', ''),
  ('L24-08', 24, 1, 'EPP ADOU FRANÏOIS', 'Indénié-Djuablin', 'Agnibilekrou', 'Manzanouan', 'Rural', true, 'a_eau', ''),
  ('L24-09', 24, 1, 'EPP ATTOBRO', 'Indénié-Djuablin', 'Agnibilekrou', 'Attobro', 'Rural', true, 'a_eau', ''),
  ('L24-10', 24, 1, 'EPP 1 N''GUESSANKRO', 'Indénié-Djuablin', 'Agnibilekrou', 'N''Guessankro', 'Rural', true, 'a_eau', ''),
  ('L24-11', 24, 1, 'EPP AKOBOISSUE 1', 'Indénié-Djuablin', 'Agnibilekrou', 'Akoboissue', 'Peri-urbain', true, 'a_eau', ''),
  ('L24-12', 24, 1, 'EPP KOUAME AMOIKON', 'Indénié-Djuablin', 'Agnibilekrou', 'Akoboissue', 'Peri-urbain', true, 'a_eau', ''),
  ('L24-13', 24, 1, 'EPP 1 VAHO GABRIEL', 'Indénié-Djuablin', 'Agnibilekrou', 'Tanguelan', 'Peri-urbain', true, 'a_eau', ''),
  ('L24-14', 24, 1, 'EPP 4 TANGUELAN', 'Indénié-Djuablin', 'Agnibilekrou', 'Tanguelan', 'Peri-urbain', true, 'a_eau', ''),
  ('L25-01', 25, 3, 'EPP KANGAGUI A', 'Nawa', 'Meagui', 'Kangagui', 'Rural', true, 'seches', ''),
  ('L25-02', 25, 3, 'EPP BLEDOUAGUI', 'Nawa', 'Meagui', 'Bledouagui', 'Rural', true, 'seches', ''),
  ('L25-03', 25, 3, 'EPP BROUAGUI B', 'Nawa', 'Meagui', 'Brouagui', 'Rural', true, 'seches', ''),
  ('L25-04', 25, 3, 'EPP AMARAGUI 1', 'Nawa', 'Meagui', 'Amaragui', 'Rural', true, 'seches', ''),
  ('L25-05', 25, 3, 'EPP KRA N''GUESSANKRO', 'Nawa', 'Meagui', 'Kra N''Guessankro', 'Rural', true, 'seches', ''),
  ('L25-06', 25, 3, 'EPP KOREAGUI', 'Nawa', 'Meagui', 'Koreagui', 'Rural', true, 'a_eau', ''),
  ('L25-07', 25, 3, 'EPP CEDAR', 'Nawa', 'Meagui', 'Cedar', 'Rural', true, 'seches', ''),
  ('L25-08', 25, 3, 'EPP ALLAKRO', 'Nawa', 'Meagui', 'Koreagui 2', 'Rural', true, 'a_eau', ''),
  ('L25-09', 25, 3, 'EPP PETIT-BONDOUKOU', 'Nawa', 'Meagui', 'Petit-Bondoukou', 'Rural', true, 'seches', ''),
  ('L25-10', 25, 3, 'EPP N''DRIAGUI', 'Nawa', 'Meagui', 'N''Driagui', 'Rural', true, 'seches', ''),
  ('L25-11', 25, 3, 'EPP YAO-ETIENNEKRO', 'Nawa', 'Meagui', 'Yao-Etiennekro', 'Rural', true, 'seches', ''),
  ('L26-01', 26, 3, 'EPP LESSIRI 4', 'Nawa', 'Soubre', 'Lessiri', 'Rural', true, 'seches', ''),
  ('L26-02', 26, 3, 'EPP GNOGBOYO KFW', 'Nawa', 'Soubre', 'Gnogboyo', 'Rural', true, 'seches', ''),
  ('L26-03', 26, 3, 'EPP SAYO', 'Nawa', 'Soubre', 'Sayo', 'Rural', true, 'seches', ''),
  ('L26-04', 26, 3, 'EPP KOZIAYO A', 'Nawa', 'Soubre', 'Koziayo', 'Rural', true, 'seches', ''),
  ('L26-05', 26, 3, 'EPP PETIT BOUAKE', 'Nawa', 'Soubre', 'Petit Bouake', 'Rural', true, 'seches', ''),
  ('L26-06', 26, 3, 'EPP YACOLO 2', 'Nawa', 'Soubre', 'Yacolo', 'Rural', true, 'seches', ''),
  ('L26-07', 26, 3, 'EPP YACOLO 1', 'Nawa', 'Soubre', 'Yacolo', 'Rural', true, 'seches', ''),
  ('L26-08', 26, 3, 'EPP YACOLI BAD', 'Nawa', 'Soubre', 'Yacolidabouo', 'Rural', true, 'a_eau', ''),
  ('L26-09', 26, 3, 'EPP BOTE ZADI', 'Nawa', 'Soubre', 'Yacolidabouo', 'Rural', true, 'a_eau', ''),
  ('L26-10', 26, 3, 'EPP ARRAH-KONANKRO', 'Nawa', 'Soubre', 'Arrah-Konankro', 'Rural', true, 'seches', ''),
  ('L26-11', 26, 3, 'EPP ROA 2', 'Nawa', 'Soubre', 'Roa', 'Rural', true, 'seches', ''),
  ('L26-12', 26, 3, 'EPP YABAYO 6', 'Nawa', 'Soubre', 'Yabayo', 'Rural', true, 'a_eau', ''),
  ('L26-13', 26, 3, 'EPP ZERGBEU 2', 'Nawa', 'Soubre', 'Zergbeu', 'Rural', true, 'a_eau', ''),
  ('L27-01', 27, 3, 'EPP BERNARDKRO 1', 'Nawa', 'Soubre', 'Bernardkro', 'Rural', true, 'seches', ''),
  ('L27-02', 27, 3, 'EPP ZOGBODOUA 1', 'Nawa', 'Soubre', 'Zogbodoua', 'Rural', true, 'seches', ''),
  ('L27-03', 27, 3, 'EPP KOUAKOUKRO GUIBOUO', 'Nawa', 'Soubre', 'Kouakoukro Guibouo', 'Rural', true, 'seches', ''),
  ('L27-04', 27, 3, 'EPP KAYO', 'Nawa', 'Soubre', 'Kayo', 'Rural', true, 'seches', ''),
  ('L27-05', 27, 3, 'EPP GUEDEYO', 'Nawa', 'Soubre', 'Ottawa', 'Rural', true, 'seches', ''),
  ('L27-06', 27, 3, 'EPP OKROUYO SODEPALM 2', 'Nawa', 'Soubre', 'Sipef-Ci', 'Rural', true, 'seches', ''),
  ('L27-07', 27, 3, 'EPP KOSSOYO', 'Nawa', 'Gueyo', 'Kossoyo', 'Rural', true, 'seches', ''),
  ('L27-08', 27, 3, 'EPP KOUAMEKRO', 'Nawa', 'Gueyo', 'Kouamekro', 'Rural', true, 'seches', ''),
  ('L27-09', 27, 3, 'EPP KONANKRO', 'Nawa', 'Gueyo', 'Konankro', 'Rural', true, 'seches', ''),
  ('L27-10', 27, 3, 'EPP BALEKO 2', 'Nawa', 'Gueyo', 'Baleko', 'Rural', true, 'seches', ''),
  ('L27-11', 27, 3, 'EPP BAKAYO 1', 'Nawa', 'Gueyo', 'Bakayo', 'Rural', true, 'seches', ''),
  ('L28-01', 28, 3, 'EPP ASSAWUEKRO', 'Nawa', 'Meagui', 'Assawuekro', 'Rural', true, 'a_eau', ''),
  ('L28-02', 28, 3, 'EPP MIANGANDOUGOU', 'Nawa', 'Meagui', 'Blagbanie', 'Rural', true, 'a_eau', ''),
  ('L28-03', 28, 3, 'EPP GNITI-TOUADJI A', 'Nawa', 'Meagui', 'Gnititouadji', 'Rural', true, 'a_eau', ''),
  ('L28-04', 28, 3, 'EPP TOUADJI 1A', 'Nawa', 'Meagui', 'Touadji 1', 'Rural', true, 'a_eau', ''),
  ('L28-05', 28, 3, 'EPP TOUADJI 1B', 'Nawa', 'Meagui', 'Touadji 1', 'Rural', true, 'a_eau', ''),
  ('L28-06', 28, 3, 'EPP KONANKRO 1', 'Nawa', 'Meagui', 'Konankro 1', 'Rural', true, 'a_eau', ''),
  ('L28-07', 28, 3, 'EPP KOUADIOBAKRO', 'Nawa', 'Meagui', 'Kouadiobakro', 'Rural', true, 'a_eau', ''),
  ('L28-08', 28, 3, 'EPP LOBOVILLE B', 'Nawa', 'Buyo', 'Loboville', 'Rural', true, 'a_eau', ''),
  ('L28-09', 28, 3, 'EPP KORE ZOUZOU PAUL 2', 'Nawa', 'Buyo', 'Gbili', 'Rural', true, 'a_eau', ''),
  ('L28-10', 28, 3, 'EPP ASSAMOIKRO', 'Nawa', 'Buyo', 'Assamoikro', 'Rural', true, 'a_eau', ''),
  ('L28-11', 28, 3, 'EPP ALEXANDREKRO 1', 'Nawa', 'Buyo', 'Alexandrekro', 'Rural', true, 'a_eau', ''),
  ('L28-12', 28, 3, 'EPP AMOUKRO', 'Nawa', 'Buyo', 'Amoinkro', 'Rural', true, 'a_eau', ''),
  ('L28-13', 28, 3, 'EPP LOGBOZOA', 'Nawa', 'Buyo', 'Logbozoa', 'Rural', true, 'a_eau', ''),
  ('L29-01', 29, 3, 'EPP GAHABLY', 'Cavally', 'Taï', 'Gahably', 'Rural', true, 'seches', ''),
  ('L29-02', 29, 3, 'EPP ZIRIGLO 1', 'Cavally', 'Taï', 'Ziriglo', 'Rural', true, 'seches', ''),
  ('L29-03', 29, 3, 'EPP AKAFOUKRO', 'Cavally', 'Taï', 'Akafoukro', 'Rural', true, 'seches', ''),
  ('L29-04', 29, 3, 'EPP PAHOUBLY', 'Cavally', 'Toulepleu', 'Pahoubly', 'Rural', true, 'seches', ''),
  ('L29-05', 29, 3, 'EPP PANHOULO-DOUHOZON', 'Cavally', 'Toulepleu', 'Panhoulo-Douhozon', 'Rural', true, 'seches', ''),
  ('L29-06', 29, 3, 'EPP BOHIBLY', 'Cavally', 'Toulepleu', 'Bohibly', 'Rural', true, 'seches', ''),
  ('L29-07', 29, 3, 'EPP SAHIBLY', 'Cavally', 'Toulepleu', 'Sahibly', 'Rural', true, 'seches', ''),
  ('L29-08', 29, 3, 'EPP MEO', 'Cavally', 'Toulepleu', 'Meo', 'Rural', true, 'seches', ''),
  ('L29-09', 29, 3, 'EPP GUIELLE', 'Cavally', 'Toulepleu', 'Guielle', 'Rural', true, 'seches', ''),
  ('L29-10', 29, 3, 'EPP TOUAPLEBLY', 'Cavally', 'Toulepleu', 'Touaplebly', 'Rural', true, 'seches', ''),
  ('L29-11', 29, 3, 'EPP SEIZAIBLY', 'Cavally', 'Toulepleu', 'Seizaibly', 'Rural', true, 'seches', ''),
  ('L29-12', 29, 3, 'EPP NEZOBLY-2', 'Cavally', 'Toulepleu', 'Nezobly', 'Rural', true, 'seches', ''),
  ('L30-01', 30, 3, 'EPP BLOC 4 YAOUDE', 'Cavally', 'Guiglo', 'Kouadiokro1', 'Rural', true, 'seches', ''),
  ('L30-02', 30, 3, 'EPP ZRO V17', 'Cavally', 'Guiglo', 'Nizahon', 'Rural', true, 'seches', ''),
  ('L30-03', 30, 3, 'EPP MONA', 'Cavally', 'Guiglo', 'Mona', 'Rural', true, 'seches', ''),
  ('L30-04', 30, 3, 'EPP GLOPAOUDY', 'Cavally', 'Guiglo', 'Glopaoudy', 'Rural', true, 'seches', ''),
  ('L30-05', 30, 3, 'EPP GUEZON', 'Cavally', 'Guiglo', 'Guezon', 'Rural', true, 'seches', ''),
  ('L30-06', 30, 3, 'EPP BLAO GOYA 1A', 'Cavally', 'Guiglo', 'Goya1', 'Rural', true, 'seches', ''),
  ('L30-07', 30, 3, 'EPP BLAO GOYA 1B', 'Cavally', 'Guiglo', 'Goya 1', 'Rural', true, 'seches', ''),
  ('L30-08', 30, 3, 'EPP ZRO V15A', 'Cavally', 'Guiglo', 'Behebo V15', 'Rural', true, 'seches', ''),
  ('L30-09', 30, 3, 'EPP DOUEDY-GUEZON', 'Cavally', 'Guiglo', 'Douedy-Guezon', 'Rural', true, 'seches', ''),
  ('L30-10', 30, 3, 'EPP GUINKIN', 'Cavally', 'Guiglo', 'Guinkin', 'Rural', true, 'seches', ''),
  ('L30-11', 30, 3, 'EPP SOKOURA 2B', 'Cavally', 'Guiglo', 'Soukoura 2', 'Rural', true, 'seches', ''),
  ('L30-12', 30, 3, 'EPP 4 CARREFOURS', 'Cavally', 'Guiglo', '4 Carrefours', 'Rural', true, 'seches', ''),
  ('L30-13', 30, 3, 'EPP YAOUDE', 'Cavally', 'Guiglo', 'Yaoude', 'Rural', true, 'seches', ''),
  ('L30-14', 30, 3, 'EPP PARIS LEONA 1', 'Cavally', 'Guiglo', 'Paris Leona', 'Rural', true, 'seches', ''),
  ('L31-01', 31, 3, 'EPP BEDY GOAZON 1', 'Cavally', 'Guiglo', 'Bedy-Goazon', 'Rural', true, 'seches', ''),
  ('L31-02', 31, 3, 'EPP ZOUAN 2', 'Cavally', 'Guiglo', 'Zouan', 'Rural', true, 'seches', ''),
  ('L31-03', 31, 3, 'EPP KATI', 'Cavally', 'Guiglo', 'Kati', 'Rural', true, 'seches', ''),
  ('L31-04', 31, 3, 'EPP DITROUDRA BEOUE 1', 'Cavally', 'Guiglo', 'Ditroudra Beoue', 'Rural', true, 'seches', ''),
  ('L31-05', 31, 3, 'EPP NOUNOUBAYE', 'Cavally', 'Guiglo', 'Nounoubaye', 'Rural', true, 'seches', ''),
  ('L31-06', 31, 3, 'EPP PONA GUIGLO', 'Cavally', 'Guiglo', 'Pona', 'Rural', true, 'seches', ''),
  ('L31-07', 31, 3, 'EPP GOYA1', 'Cavally', 'Blolequin', 'Goya 1', 'Rural', true, 'seches', ''),
  ('L31-08', 31, 3, 'EPP YOYA-GOYA', 'Cavally', 'Blolequin', 'Yoya', 'Rural', true, 'seches', ''),
  ('L31-09', 31, 3, 'EPP BEOUE 2', 'Cavally', 'Blolequin', 'Beoue', 'Rural', true, 'seches', ''),
  ('L31-10', 31, 3, 'EPP DEDJEAN', 'Cavally', 'Blolequin', 'Dedjean', 'Rural', true, 'seches', ''),
  ('L31-11', 31, 3, 'EPP ZILEBLY', 'Cavally', 'Blolequin', 'Zilebly', 'Rural', true, 'seches', ''),
  ('L32-01', 32, 3, 'EPP OULAÏ DAGOBERT', 'Cavally', 'Blolequin', '', 'Rural', true, 'seches', ''),
  ('L32-02', 32, 3, 'EPP PETIT GUIGLO', 'Cavally', 'Blolequin', '', 'Rural', true, 'seches', ''),
  ('L32-03', 32, 3, 'EPP PLATEAU BLOLEQUIN', 'Cavally', 'Blolequin', '', 'Rural', true, 'seches', ''),
  ('L32-04', 32, 3, 'EPP MEDIBLY', 'Cavally', 'Blolequin', '', 'Rural', true, 'seches', ''),
  ('L32-05', 32, 3, 'EPP TUAMBLY', 'Cavally', 'Blolequin', '', 'Rural', true, 'seches', ''),
  ('L32-06', 32, 3, 'EPP BLEDI DEYA1', 'Cavally', 'Blolequin', '', 'Rural', true, 'seches', ''),
  ('L32-07', 32, 3, 'EPP BLEDI DIEYA2', 'Cavally', 'Blolequin', '', 'Rural', true, 'seches', ''),
  ('L32-08', 32, 3, 'EPP DOKE 1', 'Cavally', 'Blolequin', '', 'Rural', true, 'seches', ''),
  ('L32-09', 32, 3, 'EPP BABLY VAYA TOUAWIN', 'Cavally', 'Blolequin', '', 'Rural', true, 'seches', ''),
  ('L32-10', 32, 3, 'EPP POHAN BADOUEBLY', 'Cavally', 'Blolequin', '', 'Rural', true, 'seches', ''),
  ('L32-11', 32, 3, 'EPP KE-BOUEBO', 'Cavally', 'Blolequin', '', 'Rural', true, 'seches', ''),
  ('L33-01', 33, 4, 'EPP 1 DE DIAKOUAKOUKRO', 'Gbôklé', 'Sassandra', 'Diakouakoukro', 'Rural', true, 'seches', ''),
  ('L33-02', 33, 4, 'EPP 2 DE KOKOLOPOZO', 'Gbôklé', 'Sassandra', 'Kokolopozo', 'Rural', true, 'seches', ''),
  ('L33-03', 33, 4, 'EPP 1 DE ADEBEM', 'Gbôklé', 'Sassandra', 'Adebem', 'Rural', true, 'seches', ''),
  ('L33-04', 33, 4, 'EPP 2 DE GODJIBOUE', 'Gbôklé', 'Sassandra', 'Godjiboue', 'Rural', true, 'seches', ''),
  ('L33-05', 33, 4, 'EPP 1 DE GUEDIKPO', 'Gbôklé', 'Sassandra', 'Guedikpo', 'Rural', true, 'seches', ''),
  ('L33-06', 33, 4, 'EPP DE MANABOUE', 'Gbôklé', 'Sassandra', 'Manaboue', 'Rural', true, 'seches', ''),
  ('L33-07', 33, 4, 'EPP 1 DE LOHIRI-GODIE', 'Gbôklé', 'Sassandra', 'Lohiri-Godie', 'Rural', true, 'seches', ''),
  ('L33-08', 33, 4, 'EPP 2 DE BOLO V1', 'Gbôklé', 'Sassandra', 'Bolo V1', 'Rural', true, 'seches', ''),
  ('L33-09', 33, 4, 'EPP 2 DE GAOULOU', 'Gbôklé', 'Sassandra', 'Gaoulou', 'Rural', true, 'seches', ''),
  ('L33-10', 33, 4, 'EPP 1 DE LABAKUYA', 'Gbôklé', 'Sassandra', 'Labakuya', 'Rural', true, 'seches', 'orthographe différente dans le tableau AAO : ''EPP 1 DE LOBAKUYA'''),
  ('L33-11', 33, 4, 'EPP DE PETIT-SENTIER', 'Gbôklé', 'Sassandra', 'Petit-Sentier', 'Rural', true, 'seches', ''),
  ('L33-12', 33, 4, 'EPP DE ZAKAREKO', 'Gbôklé', 'Fresco', 'Zakareko', 'Rural', true, 'seches', ''),
  ('L33-13', 33, 4, 'EPP 3 DE OKROMODOU', 'Gbôklé', 'Fresco', 'Okromodou', 'Rural', true, 'seches', ''),
  ('L33-14', 33, 4, 'EPP DE NIEZEKO-LEBLEKO', 'Gbôklé', 'Sassandra', 'Niezeko-Lebleko', 'Rural', true, 'seches', '')
on conflict (code) do update set
  lot_id = excluded.lot_id, lot_moe_id = excluded.lot_moe_id, nom = excluded.nom,
  region = excluded.region, departement = excluded.departement, localite = excluded.localite,
  zone = excluded.zone, electricite = excluded.electricite,
  type_latrines = excluded.type_latrines, a_verifier = excluded.a_verifier;

-- >>>>>>>>>>>>>>>>>>>> 20261125100000_formulaires.sql
-- ============================================================================
-- Refonte PATEB — étape 2 — Formulaires de visite (CSTC, MOE, UG)
--
-- - Une table unique de visites, discriminée par `source` (cstc / moe / ug).
--   Les réponses propres à chaque formulaire sont en JSON (`reponses`) ;
--   les champs communs (statut, postes d'avancement, date) sont en colonnes.
-- - Postes d'avancement alignés sur le DQE type et leurs poids : tables
--   paramétrables par l'admin. L'avancement d'une visite est CALCULÉ dans la
--   vue chantierci_v_visites : changer un poids met tout à jour.
-- - Photos : table chantierci_photos + bucket Storage privé.
-- ============================================================================

create type public.chantierci_source_formulaire as enum ('cstc', 'moe', 'ug');
create type public.chantierci_statut_chantier as enum (
  'non_demarre', 'en_cours', 'ralenti', 'arrete', 'termine', 'receptionne'
);

-- ----------------------------------------------------------------------------
-- Paramètres numériques (partage salle / latrines, seuil d'écart, délais)
-- ----------------------------------------------------------------------------
create table public.chantierci_parametres (
  cle text primary key,
  valeur numeric not null,
  libelle text not null default ''
);
comment on table public.chantierci_parametres is 'Paramètres de calcul, modifiables par l''admin.';

insert into public.chantierci_parametres (cle, valeur, libelle) values
  ('part_classe', 80, 'Poids de la salle de classe dans l''avancement d''un site (%)'),
  ('part_latrines', 20, 'Poids du bloc latrines dans l''avancement d''un site (%)'),
  ('seuil_ecart_ug_moe', 5, 'Écart MOE / UG signalé au-delà de (points)'),
  ('fenetre_comparaison_jours', 7, 'Visite MOE comparée à la visite UG la plus proche, à ce nombre de jours près'),
  ('delai_correction_cstc_jours', 3, 'Un CSTC peut corriger un formulaire pendant (jours après l''envoi)');

-- ----------------------------------------------------------------------------
-- Postes d'avancement (alignés sur le DQE type) et leurs poids
-- ----------------------------------------------------------------------------
create table public.chantierci_postes (
  ouvrage text not null check (ouvrage in ('classe', 'latrines_a_eau', 'latrines_seches')),
  code text not null check (code ~ '^[a-z_]+$'),
  libelle text not null,
  poids numeric not null check (poids >= 0),
  ordre smallint not null,
  primary key (ouvrage, code)
);
comment on table public.chantierci_postes is 'Postes d''avancement par ouvrage et poids (en %, estimations par défaut à ajuster).';

insert into public.chantierci_postes (ouvrage, code, libelle, poids, ordre) values
  ('classe', 'terrassements',   'Terrassements, implantation',                5, 1),
  ('classe', 'fondations',      'Gros œuvre — fondations, dallage',          18, 2),
  ('classe', 'elevation',       'Gros œuvre — élévation, enduits',           27, 3),
  ('classe', 'ouvrages_divers', 'Ouvrages divers (marches, rampe, clôture)',  4, 4),
  ('classe', 'charpente',       'Charpente bois',                             6, 5),
  ('classe', 'couverture',      'Couverture',                                 9, 6),
  ('classe', 'serrurerie',      'Serrurerie (portes, persiennes)',            7, 7),
  ('classe', 'electricite',     'Électricité',                                5, 8),
  ('classe', 'menuiserie',      'Menuiserie bois (tableau, placards)',        4, 9),
  ('classe', 'faux_plafond',    'Faux-plafond',                               6, 10),
  ('classe', 'peinture',        'Peinture',                                   9, 11),
  ('latrines_a_eau', 'terrassements',        'Terrassements',                 6, 1),
  ('latrines_a_eau', 'gros_oeuvre',          'Gros œuvre (fosses, élévation)', 45, 2),
  ('latrines_a_eau', 'charpente_couverture', 'Charpente, couverture',          8, 3),
  ('latrines_a_eau', 'menuiserie',           'Menuiserie bois',                6, 4),
  ('latrines_a_eau', 'plomberie',            'Plomberie, sanitaires',         20, 5),
  ('latrines_a_eau', 'revetements',          'Revêtements durs',               7, 6),
  ('latrines_a_eau', 'electricite',          'Électricité',                    3, 7),
  ('latrines_a_eau', 'peinture',             'Peinture',                       5, 8),
  ('latrines_seches', 'terrassements',        'Terrassements',                 8, 1),
  ('latrines_seches', 'gros_oeuvre',          'Gros œuvre (fosses, élévation)', 60, 2),
  ('latrines_seches', 'charpente_couverture', 'Charpente, couverture',         12, 3),
  ('latrines_seches', 'menuiserie',           'Menuiserie bois',                8, 4),
  ('latrines_seches', 'ventilation',          'Ventilation des fosses',         4, 5),
  ('latrines_seches', 'peinture',             'Peinture',                       8, 6);

-- ----------------------------------------------------------------------------
-- Visites
-- ----------------------------------------------------------------------------
create table public.chantierci_visites (
  id uuid primary key default gen_random_uuid(),   -- généré par le client (saisie hors ligne)
  site_id uuid not null references public.chantierci_sites (id) on delete cascade,
  source public.chantierci_source_formulaire not null,
  date_visite date not null default current_date,
  auteur_id uuid references public.chantierci_profiles (id) on delete set null,
  auteur_nom text not null default '',
  statut public.chantierci_statut_chantier not null,
  -- {"classe": {"<code>": 0-100, …}, "latrines": {"<code>": 0-100, …}} (MOE, UG)
  postes jsonb not null default '{}'::jsonb,
  -- réponses propres au formulaire (voir src/lib/formulaires/definitions.ts)
  reponses jsonb not null default '{}'::jsonb,
  commentaire text not null default '',
  donnees_test boolean not null default false,     -- visites fictives (supprimables)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  modifie_par uuid references public.chantierci_profiles (id) on delete set null,
  constraint chantierci_visites_date_valide check (date_visite <= current_date + 1),
  constraint chantierci_visites_postes_objet check (jsonb_typeof(postes) = 'object'),
  constraint chantierci_visites_reponses_objet check (jsonb_typeof(reponses) = 'object')
);
comment on table public.chantierci_visites is 'Formulaires de visite (source cstc / moe / ug).';

create index idx_chantierci_visites_site_source_date
  on public.chantierci_visites (site_id, source, date_visite desc, created_at desc);
create index idx_chantierci_visites_auteur on public.chantierci_visites (auteur_id);
create index idx_chantierci_visites_date on public.chantierci_visites (date_visite);

-- ----------------------------------------------------------------------------
-- Photos (fichier dans le bucket chantierci-photos-visites, chemin {visite_id}/…)
-- ----------------------------------------------------------------------------
create table public.chantierci_photos (
  id uuid primary key default gen_random_uuid(),
  visite_id uuid not null references public.chantierci_visites (id) on delete cascade,
  chemin text not null unique,
  legende text not null default '',
  question text not null default '',               -- question du formulaire liée (facultatif)
  latitude double precision,
  longitude double precision,
  prise_le timestamptz,
  created_at timestamptz not null default now()
);
create index idx_chantierci_photos_visite on public.chantierci_photos (visite_id);

-- ----------------------------------------------------------------------------
-- Calcul de l'avancement (pondération par les tables ci-dessus)
-- ----------------------------------------------------------------------------
-- Avancement d'un ouvrage : moyenne des postes pondérée ; le poste électricité
-- est ignoré pour un site sans électricité. NULL si aucun poste saisi.
create or replace function chantierci_private.avancement_ouvrage(
  p_postes jsonb, p_ouvrage text, p_electricite boolean
) returns numeric
language sql stable set search_path = ''
as $$
  select case
    when p_postes is null or jsonb_typeof(p_postes) <> 'object' or p_postes = '{}'::jsonb then null
    when sum(po.poids) = 0 then null
    else sum(po.poids * least(greatest(coalesce((p_postes ->> po.code)::numeric, 0), 0), 100)) / sum(po.poids)
  end
  from public.chantierci_postes po
  where po.ouvrage = p_ouvrage
    and (po.code <> 'electricite' or p_electricite);
$$;

-- Avancement d'un site = part_classe × salle + part_latrines × latrines.
create or replace function chantierci_private.avancement_site(
  p_postes jsonb, p_electricite boolean, p_type_latrines public.chantierci_type_latrines
) returns numeric
language plpgsql stable set search_path = ''
as $$
declare
  v_classe numeric := chantierci_private.avancement_ouvrage(p_postes -> 'classe', 'classe', p_electricite);
  v_latrines numeric := chantierci_private.avancement_ouvrage(
    p_postes -> 'latrines', 'latrines_' || p_type_latrines::text, p_electricite);
  v_pc numeric;
  v_pl numeric;
begin
  if v_classe is null and v_latrines is null then
    return null;
  end if;
  select coalesce(max(valeur) filter (where cle = 'part_classe'), 80),
         coalesce(max(valeur) filter (where cle = 'part_latrines'), 20)
    into v_pc, v_pl
  from public.chantierci_parametres;
  if v_pc + v_pl = 0 then
    return null;
  end if;
  return round((v_pc * coalesce(v_classe, 0) + v_pl * coalesce(v_latrines, 0)) / (v_pc + v_pl), 1);
end;
$$;

revoke all on function chantierci_private.avancement_ouvrage(jsonb, text, boolean) from public;
revoke all on function chantierci_private.avancement_site(jsonb, boolean, public.chantierci_type_latrines) from public;
grant execute on function chantierci_private.avancement_ouvrage(jsonb, text, boolean) to authenticated;
grant execute on function chantierci_private.avancement_site(jsonb, boolean, public.chantierci_type_latrines) to authenticated;

-- ----------------------------------------------------------------------------
-- Droits de saisie / modification
-- ----------------------------------------------------------------------------
-- Peut-on créer un formulaire `p_source` sur ce site ?
create or replace function chantierci_private.peut_saisir(p_site uuid, p_source public.chantierci_source_formulaire)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_role public.chantierci_role := chantierci_private.user_role();
begin
  if v_role is null then
    return false;
  elsif v_role = 'admin' then
    return true;
  elsif v_role = 'ug' then
    return p_source = 'ug';
  elsif v_role = 'cstc' then
    return p_source = 'cstc' and p_site in (select chantierci_private.sites_accessibles());
  elsif v_role in ('moe_controleur', 'moe_chef') then
    return p_source = 'moe' and p_site in (select chantierci_private.sites_accessibles());
  end if;
  return false;
end;
$$;

-- Peut-on modifier cette visite ?
--   admin : toutes · CSTC : les siennes pendant N jours · contrôleur : les siennes
--   chef de mission : les formulaires MOE de son lot · UG : les siennes
create or replace function chantierci_private.peut_modifier_visite(p_visite uuid)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_role public.chantierci_role := chantierci_private.user_role();
  v public.chantierci_visites;
  v_lot_moe smallint;
  v_delai numeric;
begin
  if v_role is null then
    return false;
  end if;
  select * into v from public.chantierci_visites where id = p_visite;
  if not found then
    return false;
  end if;
  if v_role = 'admin' then
    return true;
  elsif v_role = 'cstc' then
    select coalesce(max(valeur), 3) into v_delai
    from public.chantierci_parametres where cle = 'delai_correction_cstc_jours';
    return v.source = 'cstc' and v.auteur_id = (select auth.uid())
       and now() <= v.created_at + make_interval(days => v_delai::int);
  elsif v_role = 'moe_controleur' then
    return v.source = 'moe' and v.auteur_id = (select auth.uid());
  elsif v_role = 'moe_chef' then
    select lot_moe_id into v_lot_moe from public.chantierci_sites where id = v.site_id;
    return v.source = 'moe' and v_lot_moe = chantierci_private.user_lot_moe();
  elsif v_role = 'ug' then
    return v.source = 'ug' and v.auteur_id = (select auth.uid());
  end if;
  return false;
end;
$$;

-- Variante texte pour les politiques Storage (1er segment du chemin).
create or replace function chantierci_private.peut_modifier_visite_txt(p_visite text)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_visite !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return chantierci_private.peut_modifier_visite(p_visite::uuid);
end;
$$;

revoke all on function chantierci_private.peut_saisir(uuid, public.chantierci_source_formulaire) from public;
revoke all on function chantierci_private.peut_modifier_visite(uuid) from public;
revoke all on function chantierci_private.peut_modifier_visite_txt(text) from public;
grant execute on function chantierci_private.peut_saisir(uuid, public.chantierci_source_formulaire) to authenticated;
grant execute on function chantierci_private.peut_modifier_visite(uuid) to authenticated;
grant execute on function chantierci_private.peut_modifier_visite_txt(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Triggers : auteur imposé à la création, champs d'identité figés ensuite.
-- ----------------------------------------------------------------------------
create or replace function chantierci_private.visites_avant_insertion()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    -- Saisie depuis l'application : l'auteur est l'utilisateur connecté.
    new.auteur_id := (select auth.uid());
    select coalesce(nullif(nom_complet, ''), email, '') into new.auteur_nom
    from public.chantierci_profiles where id = new.auteur_id;
    new.donnees_test := false;
    new.created_at := now();
    new.modifie_par := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function chantierci_private.visites_avant_modification()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if chantierci_private.user_role() <> 'admin' and (
         new.site_id is distinct from old.site_id
      or new.source is distinct from old.source
      or new.auteur_id is distinct from old.auteur_id
      or new.donnees_test is distinct from old.donnees_test) then
      raise exception 'Le site, le type de formulaire et l''auteur d''une visite ne peuvent pas être modifiés';
    end if;
    new.created_at := old.created_at;
    new.modifie_par := (select auth.uid());
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function chantierci_private.visites_avant_insertion() from public;
revoke all on function chantierci_private.visites_avant_modification() from public;

create trigger chantierci_visites_avant_insertion
  before insert on public.chantierci_visites
  for each row execute function chantierci_private.visites_avant_insertion();
create trigger chantierci_visites_avant_modification
  before update on public.chantierci_visites
  for each row execute function chantierci_private.visites_avant_modification();

-- ----------------------------------------------------------------------------
-- Vue : visites + site + avancement calculé (RLS des tables appliquée)
-- ----------------------------------------------------------------------------
create view public.chantierci_v_visites
with (security_invoker = true) as
select
  v.*,
  s.code as site_code,
  s.nom as site_nom,
  s.lot_id,
  s.lot_moe_id,
  chantierci_private.avancement_site(v.postes, s.electricite, s.type_latrines) as avancement
from public.chantierci_visites v
join public.chantierci_sites s on s.id = v.site_id;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.chantierci_parametres enable row level security;
alter table public.chantierci_postes enable row level security;
alter table public.chantierci_visites enable row level security;
alter table public.chantierci_photos enable row level security;

create policy "chantierci_parametres_select" on public.chantierci_parametres
  for select to authenticated using ((select chantierci_private.user_role()) is not null);
create policy "chantierci_parametres_update_admin" on public.chantierci_parametres
  for update to authenticated
  using ((select chantierci_private.user_role()) = 'admin')
  with check ((select chantierci_private.user_role()) = 'admin');

create policy "chantierci_postes_select" on public.chantierci_postes
  for select to authenticated using ((select chantierci_private.user_role()) is not null);
create policy "chantierci_postes_update_admin" on public.chantierci_postes
  for update to authenticated
  using ((select chantierci_private.user_role()) = 'admin')
  with check ((select chantierci_private.user_role()) = 'admin');

-- Lecture : CSTC → formulaires CSTC de son site ; MOE → formulaires MOE de
-- son périmètre ; UG et admin → tout.
create policy "chantierci_visites_select" on public.chantierci_visites
  for select to authenticated
  using (
    site_id in (select chantierci_private.sites_accessibles())
    and (
      (select chantierci_private.user_role()) in ('admin', 'ug')
      or ((select chantierci_private.user_role()) = 'cstc' and source = 'cstc')
      or ((select chantierci_private.user_role()) in ('moe_controleur', 'moe_chef') and source = 'moe')
    )
  );
create policy "chantierci_visites_insert" on public.chantierci_visites
  for insert to authenticated
  with check (chantierci_private.peut_saisir(site_id, source));
create policy "chantierci_visites_update" on public.chantierci_visites
  for update to authenticated
  using (chantierci_private.peut_modifier_visite(id))
  with check (chantierci_private.peut_saisir(site_id, source) or (select chantierci_private.user_role()) = 'admin');
create policy "chantierci_visites_delete_admin" on public.chantierci_visites
  for delete to authenticated
  using ((select chantierci_private.user_role()) = 'admin');

create policy "chantierci_photos_select" on public.chantierci_photos
  for select to authenticated
  using (visite_id in (select id from public.chantierci_visites));
create policy "chantierci_photos_insert" on public.chantierci_photos
  for insert to authenticated
  with check (chantierci_private.peut_modifier_visite(visite_id));
create policy "chantierci_photos_delete" on public.chantierci_photos
  for delete to authenticated
  using (chantierci_private.peut_modifier_visite(visite_id));

grant select on public.chantierci_parametres, public.chantierci_postes, public.chantierci_v_visites to authenticated;
grant update on public.chantierci_parametres, public.chantierci_postes to authenticated;
grant select, insert, update, delete on public.chantierci_visites, public.chantierci_photos to authenticated;
revoke all on public.chantierci_parametres, public.chantierci_postes, public.chantierci_visites,
  public.chantierci_photos, public.chantierci_v_visites from anon;

-- ----------------------------------------------------------------------------
-- Storage : bucket privé des photos + politiques (schéma storage = Supabase)
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('chantierci-photos-visites', 'chantierci-photos-visites', false, 5242880,
            array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;

    execute $p$
      create policy "chantierci_photos_storage_select" on storage.objects
        for select to authenticated
        using (
          bucket_id = 'chantierci-photos-visites'
          and exists (select 1 from public.chantierci_visites v
                      where v.id::text = (storage.foldername(name))[1])
        )
    $p$;
    execute $p$
      create policy "chantierci_photos_storage_insert" on storage.objects
        for insert to authenticated
        with check (
          bucket_id = 'chantierci-photos-visites'
          and chantierci_private.peut_modifier_visite_txt((storage.foldername(name))[1])
        )
    $p$;
    execute $p$
      create policy "chantierci_photos_storage_delete" on storage.objects
        for delete to authenticated
        using (
          bucket_id = 'chantierci-photos-visites'
          and chantierci_private.peut_modifier_visite_txt((storage.foldername(name))[1])
        )
    $p$;
  end if;
end $$;

-- >>>>>>>>>>>>>>>>>>>> 20261126100000_tableau_de_bord.sql
-- ============================================================================
-- ÉTAPE 4 — Tableau de bord : positions des sites, commentaires, état des sites
--
-- - chantierci_departements : chef-lieu de chaque département (position
--   approximative des sites tant que leurs coordonnées GPS ne sont pas
--   connues) ;
-- - chantierci_commentaires : commentaires de l'UG et de l'admin sur un site ;
-- - vue chantierci_v_etat_sites : une ligne par site avec le dernier rapport
--   MOE (avancement de référence), la dernière fiche UG comparée à la visite
--   MOE la plus proche (± fenêtre en jours), le dernier signalement CSTC et la
--   position à afficher sur la carte.
--
-- À exécuter APRÈS 20261125100000_formulaires.sql. Rejouable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Départements (chefs-lieux, coordonnées approximatives)
-- ----------------------------------------------------------------------------
create table if not exists public.chantierci_departements (
  nom text primary key,                       -- tel qu'écrit dans chantierci_sites.departement
  region text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180)
);
comment on table public.chantierci_departements is
  'Chef-lieu de chaque département : position approximative des sites sans coordonnées GPS.';

insert into public.chantierci_departements (nom, region, latitude, longitude) values
  ('Bouna',           'Bounkani',          9.270, -3.000),
  ('Doropo',          'Bounkani',          9.810, -3.350),
  ('Tehini',          'Bounkani',          9.600, -3.660),
  ('Nassian',         'Bounkani',          8.450, -3.470),
  ('Bondoukou',       'Gontougo',          8.040, -2.800),
  ('Tanda',           'Gontougo',          7.800, -3.170),
  ('Koun-Fao',        'Gontougo',          7.490, -3.250),
  ('Transua',         'Gontougo',          7.550, -3.010),
  ('Katiola',         'Hambol',            8.140, -5.100),
  ('Niakaramadougou', 'Hambol',            8.660, -5.290),
  ('Dabakala',        'Hambol',            8.360, -4.430),
  ('Ferkessedougou',  'Tchologo',          9.590, -5.200),
  ('Ouangolodougou',  'Tchologo',          9.970, -5.150),
  ('Kong',            'Tchologo',          9.150, -4.610),
  ('Odienne',         'Kabadougou',        9.510, -7.570),
  ('Kaniasso',        'Folon',             9.820, -7.510),
  ('Minignan',        'Folon',             9.990, -7.840),
  ('Boundiali',       'Bagoué',            9.520, -6.490),
  ('Kouto',           'Bagoué',            9.890, -6.410),
  ('Tengrela',        'Bagoué',           10.480, -6.410),
  ('Koro',            'Bafing',            8.550, -7.460),
  ('Ouaninou',        'Bafing',            8.240, -7.870),
  ('Touba',           'Bafing',            8.280, -7.680),
  ('Mankono',         'Béré',              8.060, -6.190),
  ('Kounahiri',       'Béré',              7.790, -5.840),
  ('Dianra',          'Béré',              8.750, -6.250),
  ('Kani',            'Worodougou',        8.480, -6.600),
  ('Seguela',         'Worodougou',        7.960, -6.670),
  ('Abengourou',      'Indénié-Djuablin',  6.730, -3.490),
  ('Agnibilekrou',    'Indénié-Djuablin',  7.130, -3.200),
  ('Meagui',          'Nawa',              5.400, -6.560),
  ('Soubre',          'Nawa',              5.790, -6.610),
  ('Gueyo',           'Nawa',              5.690, -6.070),
  ('Buyo',            'Nawa',              6.250, -7.000),
  ('Taï',             'Cavally',           5.870, -7.460),
  ('Toulepleu',       'Cavally',           6.580, -8.410),
  ('Guiglo',          'Cavally',           6.540, -7.490),
  ('Blolequin',       'Cavally',           6.570, -8.000),
  ('Sassandra',       'Gbôklé',            4.950, -6.090),
  ('Fresco',          'Gbôklé',            5.080, -5.570)
on conflict (nom) do nothing;

alter table public.chantierci_departements enable row level security;
drop policy if exists "chantierci_departements_select" on public.chantierci_departements;
drop policy if exists "chantierci_departements_update_admin" on public.chantierci_departements;
create policy "chantierci_departements_select" on public.chantierci_departements
  for select to authenticated using ((select chantierci_private.user_role()) is not null);
create policy "chantierci_departements_update_admin" on public.chantierci_departements
  for update to authenticated
  using ((select chantierci_private.user_role()) = 'admin')
  with check ((select chantierci_private.user_role()) = 'admin');
grant select, update on public.chantierci_departements to authenticated;
revoke all on public.chantierci_departements from anon;

-- ----------------------------------------------------------------------------
-- Commentaires sur un site (UG et admin)
-- ----------------------------------------------------------------------------
-- La v1 avait une table du même nom (par établissement) : normalement
-- supprimée par la purge ; par sécurité, on la retire si elle subsiste.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'chantierci_commentaires'
               and column_name = 'etablissement_id') then
    drop table public.chantierci_commentaires cascade;
  end if;
end $$;

create table if not exists public.chantierci_commentaires (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.chantierci_sites (id) on delete cascade,
  auteur_id uuid references public.chantierci_profiles (id) on delete set null,
  auteur_nom text not null default '',
  texte text not null check (length(btrim(texte)) between 1 and 4000),
  donnees_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.chantierci_commentaires is 'Commentaires de suivi sur un site (UG, admin).';
create index if not exists idx_chantierci_commentaires_site
  on public.chantierci_commentaires (site_id, created_at desc);
create index if not exists idx_chantierci_commentaires_date
  on public.chantierci_commentaires (created_at desc);

create or replace function chantierci_private.commentaires_avant_ecriture()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if tg_op = 'INSERT' then
      new.auteur_id := (select auth.uid());
      select coalesce(nullif(nom_complet, ''), email, '') into new.auteur_nom
      from public.chantierci_profiles where id = new.auteur_id;
      new.donnees_test := false;
      new.created_at := now();
    else
      -- Seul le texte peut changer.
      new.site_id := old.site_id;
      new.auteur_id := old.auteur_id;
      new.auteur_nom := old.auteur_nom;
      new.donnees_test := old.donnees_test;
      new.created_at := old.created_at;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function chantierci_private.commentaires_avant_ecriture() from public;

drop trigger if exists chantierci_commentaires_avant_ecriture on public.chantierci_commentaires;
create trigger chantierci_commentaires_avant_ecriture
  before insert or update on public.chantierci_commentaires
  for each row execute function chantierci_private.commentaires_avant_ecriture();

alter table public.chantierci_commentaires enable row level security;
drop policy if exists "chantierci_commentaires_select" on public.chantierci_commentaires;
drop policy if exists "chantierci_commentaires_insert" on public.chantierci_commentaires;
drop policy if exists "chantierci_commentaires_update" on public.chantierci_commentaires;
drop policy if exists "chantierci_commentaires_delete" on public.chantierci_commentaires;
create policy "chantierci_commentaires_select" on public.chantierci_commentaires
  for select to authenticated
  using ((select chantierci_private.user_role()) in ('ug', 'admin'));
create policy "chantierci_commentaires_insert" on public.chantierci_commentaires
  for insert to authenticated
  with check (
    (select chantierci_private.user_role()) in ('ug', 'admin')
    and site_id in (select chantierci_private.sites_accessibles())
  );
create policy "chantierci_commentaires_update" on public.chantierci_commentaires
  for update to authenticated
  using (auteur_id = (select auth.uid()) and (select chantierci_private.user_role()) in ('ug', 'admin'))
  with check (auteur_id = (select auth.uid()));
create policy "chantierci_commentaires_delete" on public.chantierci_commentaires
  for delete to authenticated
  using (
    (select chantierci_private.user_role()) = 'admin'
    or (auteur_id = (select auth.uid()) and (select chantierci_private.user_role()) = 'ug')
  );
grant select, insert, update, delete on public.chantierci_commentaires to authenticated;
revoke all on public.chantierci_commentaires from anon;

-- ----------------------------------------------------------------------------
-- Vue : état de chaque site (RLS des tables appliquée)
-- ----------------------------------------------------------------------------
drop view if exists public.chantierci_v_etat_sites;
create view public.chantierci_v_etat_sites
with (security_invoker = true) as
with params as (
  select
    coalesce(max(valeur) filter (where cle = 'fenetre_comparaison_jours'), 7)::int as fenetre,
    coalesce(max(valeur) filter (where cle = 'seuil_ecart_ug_moe'), 5) as seuil
  from public.chantierci_parametres
)
select
  s.id,
  s.code,
  s.nom,
  s.lot_id,
  s.lot_moe_id,
  s.region,
  s.departement,
  s.localite,
  s.electricite,
  s.type_latrines,
  -- Position : coordonnées du site, sinon moyenne des photos géolocalisées,
  -- sinon chef-lieu du département (décalé de quelques km pour ne pas
  -- superposer les sites).
  coalesce(s.latitude, gps.latitude,
    d.latitude + ((('x' || substr(md5(s.code), 1, 4))::bit(16)::int) / 65535.0 - 0.5) * 0.16) as latitude,
  coalesce(s.longitude, gps.longitude,
    d.longitude + ((('x' || substr(md5(s.code), 5, 4))::bit(16)::int) / 65535.0 - 0.5) * 0.16) as longitude,
  case
    when s.latitude is not null and s.longitude is not null then 'site'
    when gps.latitude is not null then 'photos'
    when d.nom is not null then 'departement'
  end as origine_position,
  moe.date_visite as moe_date,
  moe.statut as moe_statut,
  moe.postes as moe_postes,
  chantierci_private.avancement_site(moe.postes, s.electricite, s.type_latrines) as moe_avancement,
  (select count(*) from public.chantierci_visites v where v.site_id = s.id and v.source = 'moe')::int as moe_nb,
  ug.date_visite as ug_date,
  ug.statut as ug_statut,
  ug.avancement as ug_avancement,
  ref.date_visite as ug_date_moe_comparee,
  ref.avancement as ug_avancement_moe_compare,
  round(ug.avancement - ref.avancement, 1) as ecart_ug_moe,
  coalesce(abs(ug.avancement - ref.avancement) > p.seuil, false) as discordance,
  cstc.date_visite as cstc_date,
  cstc.statut as cstc_statut
from public.chantierci_sites s
cross join params p
left join public.chantierci_departements d on d.nom = s.departement
left join lateral (
  select v.date_visite, v.statut, v.postes
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'moe'
  order by v.date_visite desc, v.created_at desc
  limit 1
) moe on true
left join lateral (
  select v.date_visite, v.statut,
         chantierci_private.avancement_site(v.postes, s.electricite, s.type_latrines) as avancement
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'ug'
  order by v.date_visite desc, v.created_at desc
  limit 1
) ug on true
left join lateral (
  select v.date_visite,
         chantierci_private.avancement_site(v.postes, s.electricite, s.type_latrines) as avancement
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'moe'
    and ug.date_visite is not null
    and abs(v.date_visite - ug.date_visite) <= p.fenetre
  order by abs(v.date_visite - ug.date_visite), v.date_visite desc, v.created_at desc
  limit 1
) ref on true
left join lateral (
  select v.date_visite, v.statut
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'cstc'
  order by v.date_visite desc, v.created_at desc
  limit 1
) cstc on true
left join lateral (
  select avg(ph.latitude) as latitude, avg(ph.longitude) as longitude
  from public.chantierci_photos ph
  join public.chantierci_visites v on v.id = ph.visite_id
  where v.site_id = s.id and ph.latitude is not null and ph.longitude is not null
) gps on true
where s.actif;

comment on view public.chantierci_v_etat_sites is
  'Une ligne par site actif : dernier rapport MOE (référence), dernière fiche UG et écart avec la visite MOE la plus proche, dernier signalement CSTC, position.';

grant select on public.chantierci_v_etat_sites to authenticated;
revoke all on public.chantierci_v_etat_sites from anon;

-- >>>>>>>>>>>>>>>>>>>> 20261127100000_tableau_de_bord_v2.sql
-- ============================================================================
-- TABLEAU DE BORD v2 — statut « ralenti » retiré, détail des difficultés,
-- évolution hebdomadaire de l'avancement
--
-- - Le statut « ralenti » n'est plus proposé : les visites existantes passent
--   « en cours » et une contrainte l'interdit (la valeur reste dans le type
--   énuméré, que Postgres ne permet pas de réduire simplement).
-- - Vue chantierci_v_etat_sites : + réponses et commentaires des dernières
--   visites MOE, UG et CSTC, + date de début de l'arrêt en cours.
-- - Fonction chantierci_evolution_avancement(lot_moe) : avancement global
--   pondéré, semaine par semaine (dernier rapport MOE connu à chaque date).
--
-- À exécuter APRÈS 20261126100000_tableau_de_bord.sql. Rejouable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Statut « ralenti » retiré
-- ----------------------------------------------------------------------------
alter table public.chantierci_visites drop constraint if exists chantierci_visites_sans_ralenti;
update public.chantierci_visites set statut = 'en_cours' where statut::text = 'ralenti';
alter table public.chantierci_visites
  add constraint chantierci_visites_sans_ralenti check (statut::text <> 'ralenti');

-- ----------------------------------------------------------------------------
-- Vue : état de chaque site (RLS des tables appliquée)
-- ----------------------------------------------------------------------------
drop view if exists public.chantierci_v_etat_sites;
create view public.chantierci_v_etat_sites
with (security_invoker = true) as
with params as (
  select
    coalesce(max(valeur) filter (where cle = 'fenetre_comparaison_jours'), 7)::int as fenetre,
    coalesce(max(valeur) filter (where cle = 'seuil_ecart_ug_moe'), 5) as seuil
  from public.chantierci_parametres
)
select
  s.id,
  s.code,
  s.nom,
  s.lot_id,
  s.lot_moe_id,
  s.region,
  s.departement,
  s.localite,
  s.electricite,
  s.type_latrines,
  -- Position : coordonnées du site, sinon moyenne des photos géolocalisées,
  -- sinon chef-lieu du département (décalé de quelques km pour ne pas
  -- superposer les sites).
  coalesce(s.latitude, gps.latitude,
    d.latitude + ((('x' || substr(md5(s.code), 1, 4))::bit(16)::int) / 65535.0 - 0.5) * 0.16) as latitude,
  coalesce(s.longitude, gps.longitude,
    d.longitude + ((('x' || substr(md5(s.code), 5, 4))::bit(16)::int) / 65535.0 - 0.5) * 0.16) as longitude,
  case
    when s.latitude is not null and s.longitude is not null then 'site'
    when gps.latitude is not null then 'photos'
    when d.nom is not null then 'departement'
  end as origine_position,
  moe.date_visite as moe_date,
  moe.statut as moe_statut,
  moe.postes as moe_postes,
  chantierci_private.avancement_site(moe.postes, s.electricite, s.type_latrines) as moe_avancement,
  (select count(*) from public.chantierci_visites v where v.site_id = s.id and v.source = 'moe')::int as moe_nb,
  ug.date_visite as ug_date,
  ug.statut as ug_statut,
  ug.avancement as ug_avancement,
  ref.date_visite as ug_date_moe_comparee,
  ref.avancement as ug_avancement_moe_compare,
  round(ug.avancement - ref.avancement, 1) as ecart_ug_moe,
  coalesce(abs(ug.avancement - ref.avancement) > p.seuil, false) as discordance,
  cstc.date_visite as cstc_date,
  cstc.statut as cstc_statut,
  -- Détail des dernières visites (onglet Difficultés)
  moe.reponses as moe_reponses,
  moe.commentaire as moe_commentaire,
  case when moe.statut = 'arrete' then arret.depuis end as moe_arrete_depuis,
  ug.reponses as ug_reponses,
  ug.commentaire as ug_commentaire,
  cstc.reponses as cstc_reponses,
  cstc.commentaire as cstc_commentaire
from public.chantierci_sites s
cross join params p
left join public.chantierci_departements d on d.nom = s.departement
left join lateral (
  select v.date_visite, v.statut, v.postes, v.reponses, v.commentaire
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'moe'
  order by v.date_visite desc, v.created_at desc
  limit 1
) moe on true
left join lateral (
  select v.date_visite, v.statut, v.reponses, v.commentaire,
         chantierci_private.avancement_site(v.postes, s.electricite, s.type_latrines) as avancement
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'ug'
  order by v.date_visite desc, v.created_at desc
  limit 1
) ug on true
left join lateral (
  select v.date_visite,
         chantierci_private.avancement_site(v.postes, s.electricite, s.type_latrines) as avancement
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'moe'
    and ug.date_visite is not null
    and abs(v.date_visite - ug.date_visite) <= p.fenetre
  order by abs(v.date_visite - ug.date_visite), v.date_visite desc, v.created_at desc
  limit 1
) ref on true
left join lateral (
  select v.date_visite, v.statut, v.reponses, v.commentaire
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'cstc'
  order by v.date_visite desc, v.created_at desc
  limit 1
) cstc on true
-- Début de l'arrêt en cours : premier rapport « arrêté » après le dernier rapport d'un autre statut.
left join lateral (
  select min(v.date_visite) as depuis
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'moe' and v.statut = 'arrete'
    and v.date_visite > coalesce(
      (select max(w.date_visite) from public.chantierci_visites w
       where w.site_id = s.id and w.source = 'moe' and w.statut <> 'arrete'),
      '-infinity'::date)
) arret on true
left join lateral (
  select avg(ph.latitude) as latitude, avg(ph.longitude) as longitude
  from public.chantierci_photos ph
  join public.chantierci_visites v on v.id = ph.visite_id
  where v.site_id = s.id and ph.latitude is not null and ph.longitude is not null
) gps on true
where s.actif;

comment on view public.chantierci_v_etat_sites is
  'Une ligne par site actif : dernier rapport MOE (référence), dernière fiche UG et écart avec la visite MOE la plus proche, dernier signalement CSTC, position.';

grant select on public.chantierci_v_etat_sites to authenticated;
revoke all on public.chantierci_v_etat_sites from anon;

-- ----------------------------------------------------------------------------
-- Évolution de l'avancement global pondéré (une valeur par semaine, la
-- dernière à la date du jour). RLS appliquée : chacun ne voit que ses sites.
-- ----------------------------------------------------------------------------
create or replace function public.chantierci_evolution_avancement(p_lot_moe integer default null)
returns table (date_ref date, avancement numeric)
language sql stable set search_path = ''
as $$
  with bornes as (
    select min(v.date_visite) as debut from public.chantierci_visites v where v.source = 'moe'
  ),
  dates as (
    select (current_date - 7 * n)::date as date_ref
    from bornes, generate_series(0, least(52, greatest(0, (current_date - bornes.debut) / 7 + 1))) as n
    where bornes.debut is not null
  ),
  sites as (
    select s.id, s.lot_id, s.electricite, s.type_latrines
    from public.chantierci_sites s
    where s.actif and (p_lot_moe is null or s.lot_moe_id = p_lot_moe)
  ),
  etat as (
    select d.date_ref, st.lot_id,
      coalesce(chantierci_private.avancement_site(v.postes, st.electricite, st.type_latrines), 0) as av
    from dates d
    cross join sites st
    left join lateral (
      select v.postes from public.chantierci_visites v
      where v.site_id = st.id and v.source = 'moe' and v.date_visite <= d.date_ref
      order by v.date_visite desc, v.created_at desc
      limit 1
    ) v on true
  ),
  lots as (
    select e.date_ref, e.lot_id, avg(e.av) as av from etat e group by e.date_ref, e.lot_id
  )
  select l.date_ref, round(sum(l.av * lo.poids) / nullif(sum(lo.poids), 0), 1)
  from lots l
  join public.chantierci_lots lo on lo.id = l.lot_id
  group by l.date_ref
  order by l.date_ref;
$$;
comment on function public.chantierci_evolution_avancement(integer) is
  'Avancement global pondéré (source MOE) à chaque fin de semaine ; filtre facultatif par lot MOE.';
revoke all on function public.chantierci_evolution_avancement(integer) from public, anon;
grant execute on function public.chantierci_evolution_avancement(integer) to authenticated;

-- >>>>>>>>>>>>>>>>>>>> 20261128100000_suivi_remplissage.sql
-- ============================================================================
-- SUIVI DU REMPLISSAGE DES FORMULAIRES
--
-- Fonction chantierci_remplissage(semaines) : pour chaque site, nombre de
-- formulaires MOE, CSTC et UG reçus chacune des N dernières semaines
-- calendaires (du lundi au dimanche ; la dernière est la semaine en cours),
-- de la plus ancienne à la plus récente, et date du dernier formulaire de
-- chaque type. date_ref = lundi de la semaine en cours.
-- RLS appliquée : chacun ne compte que les formulaires qu'il peut lire.
--
-- À exécuter APRÈS 20261127100000_tableau_de_bord_v2.sql. Rejouable.
-- ============================================================================

create or replace function public.chantierci_remplissage(p_semaines integer default 8)
returns table (
  site_id uuid,
  date_ref date,          -- lundi de la semaine en cours
  moe integer[],
  cstc integer[],
  ug integer[],
  moe_dernier date,
  cstc_dernier date,
  ug_dernier date
)
language sql stable set search_path = ''
as $$
  with n as (
    select least(greatest(coalesce(p_semaines, 8), 1), 26) as nb,
           date_trunc('week', current_date)::date as lundi
  ),
  semaines as (
    select generate_series(0, (select nb from n) - 1) as k        -- 0 = semaine en cours
  ),
  sites as (
    select s.id from public.chantierci_sites s where s.actif
  ),
  comptes as (
    select v.site_id, v.source,
           ((select lundi from n) - date_trunc('week', v.date_visite)::date) / 7 as k,
           count(*)::int as nb
    from public.chantierci_visites v
    where v.date_visite >= (select lundi from n) - 7 * ((select nb from n) - 1)
      and v.date_visite < (select lundi from n) + 7
    group by 1, 2, 3
  ),
  grille as (
    select s.id as site_id, src.source, w.k, coalesce(c.nb, 0) as nb
    from sites s
    cross join semaines w
    cross join (values ('moe'::public.chantierci_source_formulaire),
                       ('cstc'::public.chantierci_source_formulaire),
                       ('ug'::public.chantierci_source_formulaire)) as src(source)
    left join comptes c on c.site_id = s.id and c.source = src.source and c.k = w.k
  ),
  derniers as (
    select v.site_id,
      max(v.date_visite) filter (where v.source = 'moe') as moe,
      max(v.date_visite) filter (where v.source = 'cstc') as cstc,
      max(v.date_visite) filter (where v.source = 'ug') as ug
    from public.chantierci_visites v
    group by v.site_id
  )
  select
    g.site_id,
    (select lundi from n),
    array_agg(g.nb order by g.k desc) filter (where g.source = 'moe'),
    array_agg(g.nb order by g.k desc) filter (where g.source = 'cstc'),
    array_agg(g.nb order by g.k desc) filter (where g.source = 'ug'),
    d.moe,
    d.cstc,
    d.ug
  from grille g
  left join derniers d on d.site_id = g.site_id
  group by g.site_id, d.moe, d.cstc, d.ug;
$$;

comment on function public.chantierci_remplissage(integer) is
  'Formulaires reçus par site, type et semaine calendaire (N dernières semaines, la dernière en cours), et date du dernier formulaire de chaque type.';
revoke all on function public.chantierci_remplissage(integer) from public, anon;
grant execute on function public.chantierci_remplissage(integer) to authenticated;

-- >>>>>>>>>>>>>>>>>>>> 20261129100000_suivi_attendu.sql
-- ============================================================================
-- SUIVI DU REMPLISSAGE — formulaire attendu selon la déclaration de l'acteur
--
-- Un formulaire n'est « attendu » (donc « manquant » s'il n'arrive pas) que si
-- le même acteur (MOE, CSTC ou UG) a indiqué « en cours » dans son dernier
-- formulaire. La fonction chantierci_remplissage renvoie donc en plus, pour
-- chaque type de formulaire :
--   - <type>_statuts : statut du dernier formulaire reçu AVANT le lundi de
--     chaque semaine (même ordre que les comptes : de la plus ancienne à la
--     semaine en cours ; null si aucun formulaire antérieur) ;
--   - <type>_dernier_statut : statut du dernier formulaire reçu.
--
-- Remplace la fonction de 20261128100000_suivi_remplissage.sql (le type de
-- retour change : suppression puis recréation). Rejouable.
-- ============================================================================

drop function if exists public.chantierci_remplissage(integer);

create function public.chantierci_remplissage(p_semaines integer default 8)
returns table (
  site_id uuid,
  date_ref date,          -- lundi de la semaine en cours
  moe integer[],
  cstc integer[],
  ug integer[],
  moe_dernier date,
  cstc_dernier date,
  ug_dernier date,
  moe_statuts text[],
  cstc_statuts text[],
  ug_statuts text[],
  moe_dernier_statut text,
  cstc_dernier_statut text,
  ug_dernier_statut text
)
language sql stable set search_path = ''
as $$
  with n as (
    select least(greatest(coalesce(p_semaines, 8), 1), 26) as nb,
           date_trunc('week', current_date)::date as lundi
  ),
  semaines as (
    select generate_series(0, (select nb from n) - 1) as k        -- 0 = semaine en cours
  ),
  sources as (
    select unnest(array['moe', 'cstc', 'ug']::public.chantierci_source_formulaire[]) as source
  ),
  sites as (
    select s.id from public.chantierci_sites s where s.actif
  ),
  comptes as (
    select v.site_id, v.source,
           ((select lundi from n) - date_trunc('week', v.date_visite)::date) / 7 as k,
           count(*)::int as nb
    from public.chantierci_visites v
    where v.date_visite >= (select lundi from n) - 7 * ((select nb from n) - 1)
      and v.date_visite < (select lundi from n) + 7
    group by 1, 2, 3
  ),
  grille as (
    select s.id as site_id, src.source, w.k, coalesce(c.nb, 0) as nb,
      -- Statut déclaré par cet acteur dans son dernier formulaire avant la semaine.
      (select v.statut::text
       from public.chantierci_visites v
       where v.site_id = s.id and v.source = src.source
         and v.date_visite < (select lundi from n) - 7 * w.k
       order by v.date_visite desc, v.created_at desc
       limit 1) as statut_avant
    from sites s
    cross join semaines w
    cross join sources src
    left join comptes c on c.site_id = s.id and c.source = src.source and c.k = w.k
  ),
  derniers as (
    select distinct on (v.site_id, v.source) v.site_id, v.source, v.date_visite, v.statut::text as statut
    from public.chantierci_visites v
    order by v.site_id, v.source, v.date_visite desc, v.created_at desc
  )
  select
    g.site_id,
    (select lundi from n),
    array_agg(g.nb order by g.k desc) filter (where g.source = 'moe'),
    array_agg(g.nb order by g.k desc) filter (where g.source = 'cstc'),
    array_agg(g.nb order by g.k desc) filter (where g.source = 'ug'),
    max(d.date_visite) filter (where d.source = 'moe'),
    max(d.date_visite) filter (where d.source = 'cstc'),
    max(d.date_visite) filter (where d.source = 'ug'),
    array_agg(g.statut_avant order by g.k desc) filter (where g.source = 'moe'),
    array_agg(g.statut_avant order by g.k desc) filter (where g.source = 'cstc'),
    array_agg(g.statut_avant order by g.k desc) filter (where g.source = 'ug'),
    max(d.statut) filter (where d.source = 'moe'),
    max(d.statut) filter (where d.source = 'cstc'),
    max(d.statut) filter (where d.source = 'ug')
  from grille g
  left join derniers d on d.site_id = g.site_id and d.source = g.source
  group by g.site_id;
$$;

comment on function public.chantierci_remplissage(integer) is
  'Formulaires reçus par site, type et semaine calendaire (N dernières semaines), statut déclaré par chaque acteur avant chaque semaine, et dernier formulaire de chaque type.';
revoke all on function public.chantierci_remplissage(integer) from public, anon;
grant execute on function public.chantierci_remplissage(integer) to authenticated;

-- >>>>>>>>>>>>>>>>>>>> 20261130100000_performances.sql
-- ============================================================================
-- PERFORMANCES — tableau de bord, suivi et difficultés plus rapides
--
-- 1. Avancement enregistré dans chaque formulaire (colonne avancement) : il
--    était recalculé à chaque affichage (≈ 20 000 calculs pour la courbe
--    d'évolution, 3 par site pour la vue). Il est désormais calculé à
--    l'enregistrement du formulaire, et recalculé si l'électricité ou le
--    type de latrines du site change.
-- 2. Vue chantierci_v_etat_sites : lit l'avancement enregistré (mêmes
--    colonnes qu'avant).
-- 3. chantierci_evolution_avancement : une seule passe sur les rapports MOE
--    (chaque rapport est valable jusqu'au rapport suivant) au lieu d'une
--    recherche par site et par semaine. Mêmes résultats.
-- 4. chantierci_remplissage : statut déclaré avant chaque semaine obtenu de
--    la même façon, sans sous-requête par site, semaine et acteur. Mêmes
--    résultats.
--
-- À exécuter APRÈS 20261129100000_suivi_attendu.sql. Rejouable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Avancement enregistré
-- ----------------------------------------------------------------------------
alter table public.chantierci_visites add column if not exists avancement numeric;
comment on column public.chantierci_visites.avancement is
  'Avancement (%) calculé à partir des postes et du site (MOE, UG) ; tenu à jour par la base, ne pas saisir.';

-- Calcul à chaque enregistrement : la valeur envoyée par le client est ignorée.
create or replace function chantierci_private.visites_calcul_avancement()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.source in ('moe', 'ug') then
    select chantierci_private.avancement_site(new.postes, s.electricite, s.type_latrines)
      into new.avancement
    from public.chantierci_sites s where s.id = new.site_id;
  else
    new.avancement := null;
  end if;
  return new;
end;
$$;
revoke all on function chantierci_private.visites_calcul_avancement() from public;

drop trigger if exists chantierci_visites_calcul_avancement on public.chantierci_visites;
create trigger chantierci_visites_calcul_avancement
  before insert or update on public.chantierci_visites
  for each row execute function chantierci_private.visites_calcul_avancement();

-- Un recalcul de l'avancement seul n'est pas une modification du formulaire :
-- ni date de modification, ni « modifié par » (même fonction qu'avant sinon).
create or replace function chantierci_private.visites_avant_modification()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (to_jsonb(new) - 'avancement') = (to_jsonb(old) - 'avancement') then
    return new;
  end if;
  if (select auth.uid()) is not null then
    if chantierci_private.user_role() <> 'admin' and (
         new.site_id is distinct from old.site_id
      or new.source is distinct from old.source
      or new.auteur_id is distinct from old.auteur_id
      or new.donnees_test is distinct from old.donnees_test) then
      raise exception 'Le site, le type de formulaire et l''auteur d''une visite ne peuvent pas être modifiés';
    end if;
    new.created_at := old.created_at;
    new.modifie_par := (select auth.uid());
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Recalcul des formulaires d'un site quand ses caractéristiques changent.
create or replace function chantierci_private.sites_recalcul_avancement()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.chantierci_visites v
  set avancement = chantierci_private.avancement_site(v.postes, new.electricite, new.type_latrines)
  where v.site_id = new.id and v.source in ('moe', 'ug');
  return null;
end;
$$;
revoke all on function chantierci_private.sites_recalcul_avancement() from public;

drop trigger if exists chantierci_sites_recalcul_avancement on public.chantierci_sites;
create trigger chantierci_sites_recalcul_avancement
  after update of electricite, type_latrines on public.chantierci_sites
  for each row
  when (old.electricite is distinct from new.electricite or old.type_latrines is distinct from new.type_latrines)
  execute function chantierci_private.sites_recalcul_avancement();

-- Formulaires existants.
update public.chantierci_visites v
set avancement = case when v.source in ('moe', 'ug')
                      then chantierci_private.avancement_site(v.postes, s.electricite, s.type_latrines) end
from public.chantierci_sites s
where s.id = v.site_id
  and v.avancement is distinct from case when v.source in ('moe', 'ug')
                      then chantierci_private.avancement_site(v.postes, s.electricite, s.type_latrines) end;

-- ----------------------------------------------------------------------------
-- 2. Vue : état de chaque site (avancement enregistré)
-- ----------------------------------------------------------------------------
create or replace view public.chantierci_v_etat_sites
with (security_invoker = true) as
with params as (
  select
    coalesce(max(valeur) filter (where cle = 'fenetre_comparaison_jours'), 7)::int as fenetre,
    coalesce(max(valeur) filter (where cle = 'seuil_ecart_ug_moe'), 5) as seuil
  from public.chantierci_parametres
)
select
  s.id,
  s.code,
  s.nom,
  s.lot_id,
  s.lot_moe_id,
  s.region,
  s.departement,
  s.localite,
  s.electricite,
  s.type_latrines,
  -- Position : coordonnées du site, sinon moyenne des photos géolocalisées,
  -- sinon chef-lieu du département (décalé de quelques km pour ne pas
  -- superposer les sites).
  coalesce(s.latitude, gps.latitude,
    d.latitude + ((('x' || substr(md5(s.code), 1, 4))::bit(16)::int) / 65535.0 - 0.5) * 0.16) as latitude,
  coalesce(s.longitude, gps.longitude,
    d.longitude + ((('x' || substr(md5(s.code), 5, 4))::bit(16)::int) / 65535.0 - 0.5) * 0.16) as longitude,
  case
    when s.latitude is not null and s.longitude is not null then 'site'
    when gps.latitude is not null then 'photos'
    when d.nom is not null then 'departement'
  end as origine_position,
  moe.date_visite as moe_date,
  moe.statut as moe_statut,
  moe.postes as moe_postes,
  moe.avancement as moe_avancement,
  (select count(*) from public.chantierci_visites v where v.site_id = s.id and v.source = 'moe')::int as moe_nb,
  ug.date_visite as ug_date,
  ug.statut as ug_statut,
  ug.avancement as ug_avancement,
  ref.date_visite as ug_date_moe_comparee,
  ref.avancement as ug_avancement_moe_compare,
  round(ug.avancement - ref.avancement, 1) as ecart_ug_moe,
  coalesce(abs(ug.avancement - ref.avancement) > p.seuil, false) as discordance,
  cstc.date_visite as cstc_date,
  cstc.statut as cstc_statut,
  -- Détail des dernières visites (onglet Difficultés)
  moe.reponses as moe_reponses,
  moe.commentaire as moe_commentaire,
  case when moe.statut = 'arrete' then arret.depuis end as moe_arrete_depuis,
  ug.reponses as ug_reponses,
  ug.commentaire as ug_commentaire,
  cstc.reponses as cstc_reponses,
  cstc.commentaire as cstc_commentaire
from public.chantierci_sites s
cross join params p
left join public.chantierci_departements d on d.nom = s.departement
left join lateral (
  select v.date_visite, v.statut, v.postes, v.reponses, v.commentaire, v.avancement
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'moe'
  order by v.date_visite desc, v.created_at desc
  limit 1
) moe on true
left join lateral (
  select v.date_visite, v.statut, v.reponses, v.commentaire,
         v.avancement
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'ug'
  order by v.date_visite desc, v.created_at desc
  limit 1
) ug on true
left join lateral (
  select v.date_visite,
         v.avancement
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'moe'
    and ug.date_visite is not null
    and abs(v.date_visite - ug.date_visite) <= p.fenetre
  order by abs(v.date_visite - ug.date_visite), v.date_visite desc, v.created_at desc
  limit 1
) ref on true
left join lateral (
  select v.date_visite, v.statut, v.reponses, v.commentaire
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'cstc'
  order by v.date_visite desc, v.created_at desc
  limit 1
) cstc on true
-- Début de l'arrêt en cours : premier rapport « arrêté » après le dernier rapport d'un autre statut.
left join lateral (
  select min(v.date_visite) as depuis
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'moe' and v.statut = 'arrete'
    and v.date_visite > coalesce(
      (select max(w.date_visite) from public.chantierci_visites w
       where w.site_id = s.id and w.source = 'moe' and w.statut <> 'arrete'),
      '-infinity'::date)
) arret on true
left join lateral (
  select avg(ph.latitude) as latitude, avg(ph.longitude) as longitude
  from public.chantierci_photos ph
  join public.chantierci_visites v on v.id = ph.visite_id
  where v.site_id = s.id and ph.latitude is not null and ph.longitude is not null
) gps on true
where s.actif;

comment on view public.chantierci_v_etat_sites is
  'Une ligne par site actif : dernier rapport MOE (référence), dernière fiche UG et écart avec la visite MOE la plus proche, dernier signalement CSTC, position.';
grant select on public.chantierci_v_etat_sites to authenticated;
revoke all on public.chantierci_v_etat_sites from anon;

-- ----------------------------------------------------------------------------
-- 3. Évolution de l'avancement global, semaine par semaine
--    À chaque date, chaque site vaut l'avancement de son dernier rapport MOE
--    (0 % sans rapport) ; lot = moyenne de ses sites ; global = pondéré par
--    le poids des lots.
-- ----------------------------------------------------------------------------
create or replace function public.chantierci_evolution_avancement(p_lot_moe integer default null)
returns table (date_ref date, avancement numeric)
language sql stable set search_path = ''
as $$
  with bornes as (
    select min(v.date_visite) as debut from public.chantierci_visites v where v.source = 'moe'
  ),
  dates as (
    select (current_date - 7 * n)::date as date_ref
    from bornes, generate_series(0, least(52, greatest(0, (current_date - bornes.debut) / 7 + 1))) as n
    where bornes.debut is not null
  ),
  sites as (
    select s.id, s.lot_id
    from public.chantierci_sites s
    where s.actif and (p_lot_moe is null or s.lot_moe_id = p_lot_moe)
  ),
  -- Chaque rapport MOE est valable de sa date jusqu'au rapport suivant du site.
  rapports as (
    select v.site_id, st.lot_id, v.date_visite, coalesce(v.avancement, 0) as av,
           lead(v.date_visite) over (partition by v.site_id order by v.date_visite, v.created_at) as suivant
    from public.chantierci_visites v
    join sites st on st.id = v.site_id
    where v.source = 'moe'
  ),
  sommes as (
    select d.date_ref, r.lot_id, sum(r.av) as total
    from dates d
    join rapports r on r.date_visite <= d.date_ref and (r.suivant is null or r.suivant > d.date_ref)
    group by d.date_ref, r.lot_id
  ),
  lots as (
    select st.lot_id, count(*) as nb_sites from sites st group by st.lot_id
  )
  select d.date_ref,
         round(sum(coalesce(so.total, 0) / l.nb_sites * lo.poids) / nullif(sum(lo.poids), 0), 1)
  from dates d
  cross join lots l
  join public.chantierci_lots lo on lo.id = l.lot_id
  left join sommes so on so.date_ref = d.date_ref and so.lot_id = l.lot_id
  group by d.date_ref
  order by d.date_ref;
$$;
revoke all on function public.chantierci_evolution_avancement(integer) from public, anon;
grant execute on function public.chantierci_evolution_avancement(integer) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Remplissage des formulaires (même résultat que 20261129100000)
-- ----------------------------------------------------------------------------
create or replace function public.chantierci_remplissage(p_semaines integer default 8)
returns table (
  site_id uuid,
  date_ref date,          -- lundi de la semaine en cours
  moe integer[],
  cstc integer[],
  ug integer[],
  moe_dernier date,
  cstc_dernier date,
  ug_dernier date,
  moe_statuts text[],
  cstc_statuts text[],
  ug_statuts text[],
  moe_dernier_statut text,
  cstc_dernier_statut text,
  ug_dernier_statut text
)
language sql stable set search_path = ''
as $$
  with n as (
    select least(greatest(coalesce(p_semaines, 8), 1), 26) as nb,
           date_trunc('week', current_date)::date as lundi
  ),
  semaines as (
    select k, (select lundi from n) - 7 * k as lundi
    from generate_series(0, (select nb from n) - 1) as k        -- 0 = semaine en cours
  ),
  sources as (
    select unnest(array['moe', 'cstc', 'ug']::public.chantierci_source_formulaire[]) as source
  ),
  sites as (
    select s.id from public.chantierci_sites s where s.actif
  ),
  -- Formulaires de chaque acteur, avec la date de son formulaire suivant.
  historique as (
    select v.site_id, v.source, v.date_visite, v.statut::text as statut,
           lead(v.date_visite) over (partition by v.site_id, v.source order by v.date_visite, v.created_at) as suivant,
           row_number() over (partition by v.site_id, v.source order by v.date_visite desc, v.created_at desc) as rang
    from public.chantierci_visites v
  ),
  -- Statut déclaré dans le dernier formulaire reçu avant le lundi de chaque semaine.
  avant as (
    select h.site_id, h.source, w.k, h.statut
    from semaines w
    join historique h on h.date_visite < w.lundi and (h.suivant is null or h.suivant >= w.lundi)
  ),
  comptes as (
    select v.site_id, v.source,
           ((select lundi from n) - date_trunc('week', v.date_visite)::date) / 7 as k,
           count(*)::int as nb
    from public.chantierci_visites v
    where v.date_visite >= (select lundi from n) - 7 * ((select nb from n) - 1)
      and v.date_visite < (select lundi from n) + 7
    group by 1, 2, 3
  ),
  grille as (
    select s.id as site_id, src.source, w.k, coalesce(c.nb, 0) as nb, a.statut as statut_avant
    from sites s
    cross join semaines w
    cross join sources src
    left join comptes c on c.site_id = s.id and c.source = src.source and c.k = w.k
    left join avant a on a.site_id = s.id and a.source = src.source and a.k = w.k
  ),
  derniers as (
    select h.site_id, h.source, h.date_visite, h.statut from historique h where h.rang = 1
  )
  select
    g.site_id,
    (select lundi from n),
    array_agg(g.nb order by g.k desc) filter (where g.source = 'moe'),
    array_agg(g.nb order by g.k desc) filter (where g.source = 'cstc'),
    array_agg(g.nb order by g.k desc) filter (where g.source = 'ug'),
    max(d.date_visite) filter (where d.source = 'moe'),
    max(d.date_visite) filter (where d.source = 'cstc'),
    max(d.date_visite) filter (where d.source = 'ug'),
    array_agg(g.statut_avant order by g.k desc) filter (where g.source = 'moe'),
    array_agg(g.statut_avant order by g.k desc) filter (where g.source = 'cstc'),
    array_agg(g.statut_avant order by g.k desc) filter (where g.source = 'ug'),
    max(d.statut) filter (where d.source = 'moe'),
    max(d.statut) filter (where d.source = 'cstc'),
    max(d.statut) filter (where d.source = 'ug')
  from grille g
  left join derniers d on d.site_id = g.site_id and d.source = g.source
  group by g.site_id;
$$;
comment on function public.chantierci_remplissage(integer) is
  'Formulaires reçus par site, type et semaine calendaire (N dernières semaines), statut déclaré par chaque acteur avant chaque semaine, et dernier formulaire de chaque type.';
revoke all on function public.chantierci_remplissage(integer) from public, anon;
grant execute on function public.chantierci_remplissage(integer) to authenticated;

commit;
