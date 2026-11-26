# PATEB — Suivi des chantiers

Application web de suivi des travaux de construction des **salles de classe du
pré-primaire** (PATEB, Côte d'Ivoire) : 387 sites, 33 lots de travaux, 4 lots
de maîtrise d'œuvre.

> **Refonte en cours** — voir le [cahier de la refonte](docs/refonte/cahier-refonte.md).
> Étape 1 (socle) faite : base, profils et droits, liste des sites, thème
> unique, connexion identifiant + PIN. Étapes suivantes : formulaires hors
> ligne (2), administration (3), tableau de bord (4), exports (5).

## Stack

- **Next.js 14** (App Router, TypeScript) · **Tailwind CSS** · **Lucide**
- **Supabase** (PostgreSQL + Auth + Storage + RLS)
- Hébergement **Vercel**

## Profils

| Profil | Connexion | Accès |
|---|---|---|
| CSTC | identifiant + code PIN | formulaire et historique de son site |
| MOE — contrôleur | email | formulaires de ses sites |
| MOE — chef de mission | email | formulaires de tous les sites de son lot MOE |
| UG | email | tous les formulaires (lecture) + formulaire UG + tableau de bord |
| Admin | email | tout |

Les droits sont appliqués par la base (RLS) : voir [`supabase/README.md`](supabase/README.md).

## Charte graphique

Un seul design, une couleur d'accent par profil. Tout se règle à deux endroits :

- [`src/theme/theme.css`](src/theme/theme.css) — couleurs (y compris celle de chaque profil) et arrondis ;
- [`src/theme/marque.ts`](src/theme/marque.ts) — nom, sous-titre, logo.

Les composants n'utilisent que des noms d'usage (`bg-accent`, `text-texte-2`,
`border-bordure`…), jamais de couleur en dur. Police : Source Sans 3.

## Développement

```bash
npm install
cp .env.example .env.local   # URL + clé publishable d'un projet Supabase de TEST
npm run dev
```

⚠️ Sans `.env.local`, rien n'est configuré en local ; ne pas pointer le
développement sur la base de production.

| Commande | Rôle |
|---|---|
| `npm run test:db` | Teste le schéma et les droits sur un Postgres local (PGlite) |
| `npm run referentiel` | Régénère l'import des sites depuis `docs/refonte/sites_reference.csv` |

## Variables d'environnement

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé *publishable* (`sb_publishable_…`, publique) |

> Valeurs publiques par conception ; la sécurité des données repose sur les
> politiques RLS. Ne jamais committer la clé `service_role`.
