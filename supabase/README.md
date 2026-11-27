# Base de données — refonte PATEB

Projet Supabase dédié (`cvdeckwvhowasdefzqlr`). Les objets restent préfixés
`chantierci_` ; les fonctions d'aide RLS vivent dans le schéma privé
`chantierci_private` (non exposé par l'API).

L'ancien schéma (suivi MEN, v1) est archivé dans [`archive-v1/`](archive-v1/)
pour mémoire : il n'est plus utilisé.

## Contenu

| Fichier | Rôle |
|---|---|
| `migrations/20261124100000_purge_v1.sql` | Supprime le schéma v1 (données factices) et ses comptes de test |
| `migrations/20261124100100_referentiel.sql` | Tables : lots MOE, lots de travaux, sites, profils, affectations |
| `migrations/20261124100200_fonctions.sql` | Fonctions d'aide RLS, triggers de protection et de cohérence |
| `migrations/20261124100300_politiques_rls.sql` | Droits par profil |
| `migrations/20261124100400_donnees_referentiel.sql` | 4 lots MOE, 33 lots, 387 sites (**fichier généré**) |
| `migrations/20261125100000_formulaires.sql` | Formulaires CSTC / MOE / UG, postes et poids, photos, calcul de l'avancement |
| `migrations/20261126100000_tableau_de_bord.sql` | Tableau de bord : chefs-lieux des départements, commentaires, vue `chantierci_v_etat_sites` |
| `migrations/20261127100000_tableau_de_bord_v2.sql` | Statut « ralenti » retiré, détail des difficultés, évolution hebdomadaire de l'avancement |
| `migrations/20261128100000_suivi_remplissage.sql` | Suivi du remplissage des formulaires par site et par semaine |
| `migrations/20261129100000_suivi_attendu.sql` | Suivi : formulaire attendu seulement si l'acteur a déclaré le chantier « en cours » |
| `migrations/20261130100000_performances.sql` | Performances : avancement enregistré dans chaque formulaire, évolution et remplissage calculés en une passe |
| `migrations/20261201100000_entreprises_positions.sql` | Entreprises titulaires des lots (provisoires) et positions GPS des sites (cartographie PATEB v4) |
| `migrations/20261202100000_dqe_alertes.sql` | Avancement pondéré par les montants du DQE (classe + latrines), corps d'état, date de début des sites, paramètres des alertes, 5 positions de plus |
| `seed/comptes_test.sql` | 6 comptes de test (développement uniquement) |
| `seed/donnees_fictives.sql` | Visites et commentaires fictifs sur les 387 sites (test uniquement, rejouable) |
| `installation.sql` | **Script unique pour une base vierge** (généré : réinitialisation + toutes les migrations) |
| `tests/` | Tests du schéma, des droits et de l'installation sur un Postgres local |

## Installation sur le projet Supabase

> ⚠️ N'exécuter **que** `supabase/installation.sql` (puis le seed). Les fichiers
> de `archive-v1/` sont l'ancienne version : les rejouer provoque des erreurs
> du type `policy "chantierci_paiements_update_national_admin" ... already exists`.

1. Supabase → **SQL Editor** → *New query* → coller **tout** le contenu de
   [`installation.sql`](installation.sql) → **Run**.
   Il efface les données de l'application (v1 factices) puis installe le
   schéma, les droits et les 387 sites, dans une transaction : en cas
   d'erreur, rien n'est modifié. Il est rejouable.
2. *(environnement de test)* nouvelle requête → coller
   [`seed/comptes_test.sql`](seed/comptes_test.sql) → **Run**.
3. Contrôle :
   ```sql
   select (select count(*) from public.chantierci_sites)    as sites,    -- 387
          (select count(*) from public.chantierci_lots)     as lots,     -- 33
          (select count(*) from public.chantierci_profiles) as comptes;  -- 6 avec le seed
   ```

### Mise à jour d'une base déjà installée

`installation.sql` **efface tout**, y compris les comptes créés à la main
(admin compris). Sur une base déjà installée, exécuter seulement les
nouvelles migrations, dans l'ordre, chacune dans une nouvelle requête :
`20261125100000_formulaires.sql`, `20261126100000_tableau_de_bord.sql`,
`20261127100000_tableau_de_bord_v2.sql`, `20261128100000_suivi_remplissage.sql`,
`20261129100000_suivi_attendu.sql`, `20261130100000_performances.sql`,
`20261201100000_entreprises_positions.sql` puis `20261202100000_dqe_alertes.sql`.
Elles sont rejouables. Ensuite, en test, `seed/donnees_fictives.sql`.

`installation.sql` est généré à partir de `migrations/` par
`npm run installation` : ne pas le modifier à la main.

Réglage à vérifier dans **Authentication → Providers → Email** : longueur
minimale des mots de passe = **6** (le code PIN des CSTC fait 6 chiffres).

## Comptes de test

| Connexion | Mot de passe / PIN | Profil |
|---|---|---|
| `admin@pateb.test` | `Pateb!2026` | Admin |
| `ug@pateb.test` | `Pateb!2026` | UG |
| `chef.moe2@pateb.test` | `Pateb!2026` | Chef de mission, lot MOE 2 (102 sites) |
| `controleur.moe2@pateb.test` | `Pateb!2026` | Contrôleur, sites du lot 19 (16 sites) |
| identifiant `cstc-l19-01` | PIN `123456` | CSTC de L19-01 EPP MAYAMA 1 |
| `attente@pateb.test` | `Pateb!2026` | Compte en attente (aucun accès) |

## Profils et droits

| Profil | Sites visibles | Écriture (étape 1) |
|---|---|---|
| CSTC | son site (1 affectation au plus) | son nom / téléphone |
| MOE contrôleur | ses affectations | son nom / téléphone |
| MOE chef de mission | tous les sites de son lot MOE | son nom / téléphone |
| UG | tous | son nom / téléphone |
| Admin | tous | tout |

- Le rôle vient toujours de `chantierci_profiles.role`, jamais des métadonnées
  utilisateur. Un compte `en_attente` ou `suspendu` ne voit rien d'autre que
  son profil.
- `role`, `statut_compte`, `lot_moe_id` et `identifiant` ne sont modifiables
  que par un admin (trigger).
- Un CSTC n'est rattaché qu'à un seul site ; seuls les CSTC et les
  contrôleurs MOE ont des affectations (trigger).
- Connexion CSTC : email technique `<identifiant>@cstc.pateb.invalid` + PIN
  (voir `src/lib/identifiants.ts`).

## Modifier la liste des sites

La source est [`docs/refonte/sites_reference.csv`](../docs/refonte/sites_reference.csv).
Après modification :

```bash
npm run referentiel    # régénère migrations/20261124100400_donnees_referentiel.sql
npm run installation   # régénère installation.sql
npm run test:db        # vérifie schéma, droits et installation
```

La migration de données est rejouable : elle met à jour les sites par code
sans rien supprimer (les affectations et les poids modifiés par l'admin sont
conservés). À terme, l'admin modifiera les sites directement dans
l'application (étape 3).

## Tests

`npm run test:db` travaille sur PGlite (Postgres compilé en WebAssembly, en
mémoire) avec une imitation des schémas Supabase (`auth`, `storage`). Aucune
base distante n'est touchée.

- `rls.test.mjs` : 36 règles (périmètre de chaque profil, écritures
  interdites, affectations, inscription, rejeu de l'import) ;
- `installation.test.mjs` : part d'une base contenant le schéma et les
  données v1, applique `installation.sql` deux fois, puis le seed.
