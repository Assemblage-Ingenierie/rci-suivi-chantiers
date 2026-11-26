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
