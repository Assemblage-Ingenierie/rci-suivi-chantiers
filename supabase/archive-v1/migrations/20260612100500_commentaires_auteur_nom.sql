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
