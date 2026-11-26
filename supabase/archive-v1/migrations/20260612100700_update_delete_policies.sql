-- Autoriser les créateurs de visites à modifier leurs propres visites.
create policy "chantierci_visites_update_propre"
  on chantierci_visites for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Autoriser national/admin à modifier les paiements.
create policy "chantierci_paiements_update"
  on chantierci_paiements for update
  using (chantierci_private.user_role() in ('national', 'admin'))
  with check (chantierci_private.user_role() in ('national', 'admin'));

-- Autoriser national/admin à supprimer les paiements.
create policy "chantierci_paiements_delete"
  on chantierci_paiements for delete
  using (chantierci_private.user_role() in ('national', 'admin'));
