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
