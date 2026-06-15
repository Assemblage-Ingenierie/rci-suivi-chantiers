-- ============================================================================
-- Migration — nouveau rôle « MEN viewer » (décideur, lecture seule)
--
-- IMPORTANT : ALTER TYPE ... ADD VALUE ne peut pas être utilisé dans la même
-- transaction qu'une requête qui consomme la nouvelle valeur. Cette valeur est
-- donc ajoutée DANS SON PROPRE fichier / sa propre transaction, à exécuter
-- AVANT la migration 20260612100900_evolutions.sql.
-- ============================================================================

alter type public.chantierci_user_role add value if not exists 'men_viewer';
