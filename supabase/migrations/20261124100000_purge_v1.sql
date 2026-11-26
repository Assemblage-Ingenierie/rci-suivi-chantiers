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
