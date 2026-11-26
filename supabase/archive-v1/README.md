# Base de données — Suivi de chantiers scolaires (MEN Côte d'Ivoire)

## Hébergement : projet Supabase partagé

Le schéma est déployé sur le projet Supabase **EXTERNAL** (`grnkbnldfzdzrgleorra`, eu-west-3), **partagé avec l'application PEEB Jordan**. Conséquences :

- **Tous les objets sont préfixés `chantierci_`** (tables, vues, enums, index, politiques) et les fonctions vivent dans le schéma dédié `chantierci_private` (non exposé par PostgREST). Même convention que les apps du projet INTERNAL.
- Le bucket Storage s'appelle `chantierci-photos-visites`.
- **`auth.users` est partagé** entre les deux applications :
  - Pas de trigger chantierci sur `auth.users` (un trigger s'exécuterait à chaque inscription PEEB et une erreur bloquerait leurs inscriptions). Le profil est créé **par l'application** juste après `signUp()`, encadré par la politique RLS `chantierci_profiles_insert` (statut `en_attente` et `lot_ids = '{}'` imposés).
  - ⚠️ Réciproquement, le trigger PEEB `on_auth_user_created` crée un profil PEEB `is_approved = true` (viewer) pour **tout** nouvel inscrit, y compris nos utilisateurs COGES. À arbitrer côté PEEB si c'est un problème.

## Migrations (appliquées le 12/06/2026, historique `supabase_migrations`)

| Fichier local | Migration distante | Contenu |
|---|---|---|
| `20260612100000_schema_initial.sql` | `chantierci_schema_initial` | Enums, 8 tables, contraintes, index |
| `20260612100100_fonctions_et_triggers.sql` | `chantierci_fonctions_et_triggers` | Schéma `chantierci_private`, fonctions d'aide RLS, trigger de protection des colonnes sensibles |
| `20260612100200_politiques_rls.sql` | `chantierci_politiques_rls` (+ `chantierci_fusion_politique_insert_profiles`) | RLS activée + politiques par rôle sur toutes les tables |
| `20260612100300_vues.sql` | `chantierci_vues` | Vues financières et de synthèse (`security_invoker = true`) |
| `20260612100400_storage.sql` | `chantierci_storage` | Bucket privé `chantierci-photos-visites` + politiques Storage |

Les fichiers locaux sont la référence versionnée ; ils ont été appliqués via le MCP Supabase (`apply_migration`). Pour un nouveau déploiement : exécuter les fichiers dans l'ordre (SQL Editor ou `supabase db push`).

## Décisions de conception

### Sécurité / RLS
- **Le rôle effectif vient de `chantierci_profiles.role`**, jamais de `user_metadata` (modifiable par l'utilisateur, donc inutilisable pour l'autorisation). Le `role_souhaite` saisi à l'inscription n'est qu'indicatif : le compte naît `en_attente` et l'admin fixe le rôle réel à la validation.
- **Compte `en_attente` / `suspendu` = zéro accès** : `chantierci_private.user_role()` retourne `NULL` si le compte n'est pas `actif`, ce qui fait échouer toutes les politiques. Seule exception : l'utilisateur lit/édite son propre profil (écran « compte en attente »).
- Fonctions d'aide **SECURITY DEFINER dans `chantierci_private`** (non exposé) : pas de récursion RLS sur profiles, pas de fonction privilégiée accessible par l'API. `search_path = ''` partout.
- `role`, `statut_compte` et `lot_ids` sont **verrouillés par trigger** (`chantierci_protect_profile_columns`) : seuls un admin ou un contexte serveur (service_role) peuvent les modifier.
- Vues en **`security_invoker = true`** : la RLS des tables sous-jacentes s'applique.
- Toutes les politiques sont `to authenticated` : `anon` n'a accès à rien.

### Périmètres par rôle (matrice CDC §4)
- **COGES** : établissements dont `lot_id ∈ profiles.lot_ids`. Saisie visites + photos sur ce périmètre. Modification/suppression de ses propres visites.
- **Régional** : ses `lot_ids` déterminent ses **régions** ; il voit tous les lots de ces régions (lecture + commentaires).
- **National (MEN)** : lecture globale + saisie des paiements (`saisi_par = auth.uid()` imposé).
- **Admin** : tout, y compris gestion des profils, lots, établissements et marchés.

### Modèle
- Table **`chantierci_commentaires`** ajoutée : absente du modèle du CDC (§3) mais requise par la fonctionnalité régionale (§5.4). Visible MEN + admin + auteur + régionaux de la région.
- Montants en `numeric` (XOF) — évite les erreurs de flottants.
- Photos : bucket **privé**, chemin `{visite_id}/{nom_fichier}`, URLs signées côté client. Limite 5 Mo/fichier, MIME image uniquement (compression client cible < 500 Ko).
- `sync_status` sur visites et photos : suivi de la file de synchronisation offline (IndexedDB → Supabase).

### Vues
- `chantierci_v_marches_financier` : marché + `montant_paye`, `avancement_financier_pct`, `reste_a_payer` → vue « Marchés de travaux ».
- `chantierci_v_dernieres_visites` : dernière visite par établissement → groupement par défaut du tableau de suivi.
- `chantierci_v_etablissements_suivi` : une ligne par établissement (lot, marché le plus récent, financier, dernière visite) → dashboard, carte Leaflet, tableau de suivi. **Toujours paginer côté serveur** (`.range()`).

## Vérifications effectuées (12/06/2026)

- Test RLS transactionnel (jeu d'essai annulé par rollback) : périmètres COGES / régional / national corrects, compte `en_attente` sans accès, refus d'auto-promotion admin, refus de saisie paiement par COGES, refus de visite hors lot, avancement financier calculé = 30 % attendu.
- Advisors Supabase : **aucun finding sécurité ni performance sur les objets `chantierci_*`** (les warnings restants concernent l'app PEEB préexistante : fonctions `peeb_*` sans `search_path`, `pg_net` dans public, protection mots de passe compromis désactivée).
