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
