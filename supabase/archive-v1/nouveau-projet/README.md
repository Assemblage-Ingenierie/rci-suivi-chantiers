# Migration vers le nouveau projet Supabase dédié

Déplacement de la base depuis le projet **partagé** `EXTERNAL`
(`grnkbnldfzdzrgleorra`, organisation Assemblage) vers un **projet dédié** :
`cvdeckwvhowasdefzqlr` (https://cvdeckwvhowasdefzqlr.supabase.co).

> Le MCP Supabase de l'assistant n'a pas accès au nouveau compte : l'étape 1
> ci-dessous se fait **manuellement** dans le SQL Editor du nouveau projet.
> Les préfixes `chantierci_` sont **conservés** (aucune modification du code).

## Contenu du dossier

| Fichier | Rôle |
|---|---|
| `00_installation_complete.sql` | Schéma complet (7 migrations) + seed (4 lots, 50 établissements, 8 comptes de test). À exécuter sur le **nouveau** projet. |
| `99_purge_external.sql` | Retire toute trace de l'app du projet **partagé EXTERNAL**. À exécuter **en dernier**, après vérification. |

---

## Étape 1 — Installer le schéma + les données sur le nouveau projet

1. Ouvrir le **nouveau** projet dans le dashboard Supabase
   (`cvdeckwvhowasdefzqlr`).
2. **SQL Editor** → New query → coller **tout** le contenu de
   [`00_installation_complete.sql`](00_installation_complete.sql) → **Run**.
3. Vérifier en fin d'exécution (aucune erreur). Contrôle rapide :
   ```sql
   select
     (select count(*) from public.chantierci_lots)           as lots,           -- 4
     (select count(*) from public.chantierci_etablissements) as etablissements, -- 50
     (select count(*) from public.chantierci_visites)        as visites,        -- 136
     (select count(*) from public.chantierci_paiements)      as paiements;      -- 106
   ```

> Le script est rejouable une seule fois : une garde lève une erreur explicite
> (« Seed déjà appliqué ») s'il est relancé sur une base déjà peuplée.

### Comptes de test (identiques à l'ancien projet)
Mot de passe commun : **`ChantierCI!2026`**
`admin@` · `national@` · `regional.nord@` · `regional.sud@` ·
`coges.nord@` · `coges.sud@` · `coges.est@` · `coges.ouest@chantierci.test`

> ⚠️ Confirmation d'email : si le nouveau projet a « Confirm email » activé
> (Authentication → Providers → Email), les comptes de test seront déjà
> confirmés (le seed pose `email_confirmed_at`). Pour les **inscriptions
> réelles**, configurez l'envoi d'emails ou désactivez la confirmation selon
> votre besoin.

## Étape 2 — Brancher l'application sur le nouveau projet

1. Dashboard du nouveau projet → **Project Settings → API**.
2. Copier la **Publishable key** (`sb_publishable_...`).
3. Dans [`.env.local`](../../.env.local) (déjà pointé sur la nouvelle URL),
   remplacer `COLLER_ICI_LA_CLE_PUBLISHABLE_DU_NOUVEAU_PROJET` par cette clé.
4. Redémarrer le serveur (`npm run dev`) et **se connecter** avec un compte de
   test pour valider de bout en bout (liste, fiche, dashboard, carte…).

## Étape 3 — Purger l'ancien projet partagé (EXTERNAL)

**Uniquement après** que l'étape 2 est validée (vous arrivez à vous connecter
et les données s'affichent sur le nouveau projet).

- Exécuter [`99_purge_external.sql`](99_purge_external.sql) sur le projet
  **EXTERNAL** (SQL Editor, ou demander à l'assistant de l'appliquer via MCP).
- Ce script ne touche **que** les objets `chantierci_*`, le bucket
  `chantierci-photos-visites` et les comptes `@chantierci.test`. L'application
  **PEEB** qui partage ce projet n'est pas affectée.
- La dernière instruction supprime les comptes `@chantierci.test` ; grâce au
  `ON DELETE CASCADE`, cela nettoie aussi les profils PEEB créés par effet de
  bord à l'inscription (le « cross-talk » documenté précédemment).

## Notes

- **Storage** : 0 photo à migrer (toutes les données de test ont été nettoyées
  au fil du développement) ; le bucket est recréé vide par l'étape 1.
- **Trigger sur `auth.users`** : volontairement absent (comme sur EXTERNAL) ;
  le profil est créé par l'application à la première connexion. Sur un projet
  dédié, un trigger serait possible, mais entrerait en conflit avec cette
  création côté client — on conserve donc le comportement actuel, déjà testé.
- Les fichiers de migration d'origine (`supabase/migrations/`) restent la
  référence versionnée ; `00_installation_complete.sql` n'est que leur
  concaténation ordonnée + le seed, pour un déploiement en un seul collage.
