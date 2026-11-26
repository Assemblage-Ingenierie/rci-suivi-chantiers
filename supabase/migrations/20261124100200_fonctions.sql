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
