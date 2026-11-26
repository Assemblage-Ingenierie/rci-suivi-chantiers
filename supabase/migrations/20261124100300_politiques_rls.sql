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
