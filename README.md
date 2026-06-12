# Suivi de chantiers scolaires — MEN Côte d'Ivoire

Application web de suivi des chantiers de construction scolaire du **Ministère
de l'Éducation Nationale de Côte d'Ivoire**. AMO : **Assemblage Ingénierie**.

## Stack

- **Next.js 14** (App Router, TypeScript) · **Tailwind CSS** · **Lucide**
- **Supabase** (PostgreSQL + Auth + Storage + RLS)
- **Leaflet** + OpenStreetMap (carte interactive)
- **Service Worker (Workbox) + IndexedDB (idb)** — mode hors ligne
- Exports **jsPDF / SheetJS / docx / JSZip**
- Hébergement **Vercel**

## Fonctionnalités

- Authentification par email avec **validation des comptes par un admin**
  (4 rôles : COGES, régional, national/MEN, admin), permissions appliquées
  par **RLS Supabase**.
- **Interface COGES** mobile-first **100 % hors ligne** : liste, fiche, saisie
  de visite avec photos compressées, file de synchronisation.
- **Dashboard MEN** : KPI, carte Leaflet (2 modes de couleur), tableau de
  suivi (colonnes configurables, filtres, recherche, pagination serveur).
- **Marchés de travaux** : suivi financier, saisie des paiements.
- **Interface régionale** restreinte à la région + commentaires.
- **Exports** PDF / Word / Excel (fiches de visite avec photos, tableaux).
- **Administration** : validation des comptes, attribution des lots, gestion
  des lots, import CSV des établissements, modification des fiches.

## Développement

```bash
npm install
cp .env.example .env.local   # puis renseigner l'URL + la clé publishable Supabase
npm run dev
```

## Base de données

Schéma, politiques RLS, vues et seed dans [`supabase/`](supabase/). Tous les
objets sont préfixés `chantierci_`. Voir [`supabase/README.md`](supabase/README.md)
et, pour (ré)installer sur un projet,
[`supabase/nouveau-projet/`](supabase/nouveau-projet/README.md).

## Variables d'environnement

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé *publishable* (`sb_publishable_…`, publique) |

> Valeurs publiques par conception (inlinées dans le bundle navigateur) ; la
> sécurité des données repose sur les politiques RLS. Ne jamais committer la
> clé `service_role`.

---

*Cahier des charges : [`CdC_ChantierCI.md`](CdC_ChantierCI.md).*
