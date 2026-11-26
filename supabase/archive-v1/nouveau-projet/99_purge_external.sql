-- ############################################################################
-- PURGE du projet « chantiers CI » dans la base PARTAGÉE « EXTERNAL »
-- (grnkbnldfzdzrgleorra) — retire toute trace de l'application.
--
-- ⚠️  À N'EXÉCUTER QU'APRÈS avoir vérifié que le nouveau projet dédié
--     fonctionne (connexion + données OK). Opération IRRÉVERSIBLE.
--
-- N'affecte QUE les objets préfixés chantierci_ + le bucket dédié + les
-- comptes @chantierci.test. Les objets de l'application PEEB qui partage ce
-- projet (buildings, app_params, profiles, fonctions peeb_*) ne sont PAS
-- touchés.
-- ############################################################################

-- 1) Politiques Storage du bucket dédié
drop policy if exists "chantierci_photos_storage_insert" on storage.objects;
drop policy if exists "chantierci_photos_storage_select" on storage.objects;
drop policy if exists "chantierci_photos_storage_delete" on storage.objects;
-- NB : la suppression du bucket lui-même est BLOQUÉE en SQL par une garde
-- Supabase (storage.protect_delete). Le bucket « chantierci-photos-visites »
-- (vide) doit être supprimé depuis le Dashboard → Storage → … → Delete bucket,
-- ou via l'API Storage. Ligne SQL volontairement retirée :
-- delete from storage.buckets where id = 'chantierci-photos-visites';

-- 2) Vues (dépendent des tables → avant les tables)
drop view if exists public.chantierci_v_etablissements_suivi;
drop view if exists public.chantierci_v_marches_financier;
drop view if exists public.chantierci_v_dernieres_visites;

-- 3) Tables (cascade : FK internes + politiques RLS + triggers de table)
drop table if exists public.chantierci_commentaires    cascade;
drop table if exists public.chantierci_photos_visites  cascade;
drop table if exists public.chantierci_paiements        cascade;
drop table if exists public.chantierci_visites          cascade;
drop table if exists public.chantierci_marches_travaux  cascade;
drop table if exists public.chantierci_etablissements   cascade;
drop table if exists public.chantierci_profiles         cascade;
drop table if exists public.chantierci_lots             cascade;

-- 4) Schéma privé (fonctions d'aide RLS SECURITY DEFINER)
drop schema if exists chantierci_private cascade;

-- 5) Types énumérés (après les fonctions/tables qui les utilisaient)
drop type if exists public.chantierci_statut_chantier;
drop type if exists public.chantierci_statut_compte;
drop type if exists public.chantierci_sync_status;
drop type if exists public.chantierci_user_role;

-- 6) Comptes de test (FK profiles → auth.users en ON DELETE CASCADE :
--    supprime aussi les profils PEEB créés par effet de bord + les identités).
--    NB : peut nécessiter des droits élevés / être bloqué par la console ;
--    si l'instruction échoue, l'exécuter depuis le SQL Editor (rôle postgres).
delete from auth.users where email like '%@chantierci.test';
