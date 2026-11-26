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
