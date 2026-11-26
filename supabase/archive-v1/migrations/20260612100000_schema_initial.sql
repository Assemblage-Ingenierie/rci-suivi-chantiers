-- ============================================================================
-- Migration 1/5 — Schéma initial
-- Suivi de chantiers scolaires — Côte d'Ivoire (MEN / Assemblage Ingénierie)
--
-- Déployé sur le projet Supabase partagé EXTERNAL (qui héberge aussi PEEB
-- Jordan) : tous les objets sont préfixés `chantierci_` pour éviter toute
-- collision (même convention que les apps du projet INTERNAL).
--
-- Tables : chantierci_lots, chantierci_profiles, chantierci_etablissements,
--          chantierci_marches_travaux, chantierci_paiements, chantierci_visites,
--          chantierci_photos_visites, chantierci_commentaires
-- Note : la table `chantierci_commentaires` ne figure pas dans le modèle du
-- CDC (§3) mais est requise par la fonctionnalité régionale (§5.4 —
-- "Possibilité d'ajouter un commentaire sur un établissement, visible MEN + admin").
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Types énumérés
-- ----------------------------------------------------------------------------
create type public.chantierci_user_role as enum ('coges', 'regional', 'national', 'admin');
create type public.chantierci_statut_compte as enum ('en_attente', 'actif', 'suspendu');
create type public.chantierci_statut_chantier as enum ('non_demarre', 'en_cours', 'arrete', 'receptionne');
create type public.chantierci_sync_status as enum ('synced', 'pending_sync');

-- ----------------------------------------------------------------------------
-- Table chantierci_lots — lots géographiques (Nord / Sud / Est / Ouest)
-- ----------------------------------------------------------------------------
create table public.chantierci_lots (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  region text not null
);

comment on table public.chantierci_lots is 'Lots géographiques de chantiers, rattachés à une région.';

-- ----------------------------------------------------------------------------
-- Table chantierci_profiles — profils utilisateurs (id = auth.users.id)
-- La ligne est créée automatiquement à l''inscription (trigger sur auth.users,
-- voir migration fonctions). Le rôle effectif et le statut sont gérés par
-- l''admin ; le compte reste `en_attente` sans aucun accès aux données.
-- ----------------------------------------------------------------------------
create table public.chantierci_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nom_complet text not null default '',
  telephone text not null default '',
  role public.chantierci_user_role not null default 'coges',
  lot_ids uuid[] not null default '{}',
  statut_compte public.chantierci_statut_compte not null default 'en_attente',
  created_at timestamptz not null default now()
);

comment on table public.chantierci_profiles is 'Profils utilisateurs. role/statut_compte/lot_ids modifiables uniquement par un admin (trigger de protection).';
comment on column public.chantierci_profiles.lot_ids is 'Lots attribués (COGES : accès direct ; régional : détermine la ou les régions accessibles).';

-- ----------------------------------------------------------------------------
-- Table chantierci_etablissements
-- ----------------------------------------------------------------------------
create table public.chantierci_etablissements (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  nom_directeur text,
  telephone text,
  email text,
  latitude double precision,
  longitude double precision,
  province text,
  departement text,
  village text,
  lot_id uuid references public.chantierci_lots (id) on delete restrict,
  statut public.chantierci_statut_chantier not null default 'non_demarre',
  created_at timestamptz not null default now(),
  constraint chantierci_etablissements_latitude_valide check (latitude is null or latitude between -90 and 90),
  constraint chantierci_etablissements_longitude_valide check (longitude is null or longitude between -180 and 180)
);

comment on table public.chantierci_etablissements is 'Établissements scolaires en construction (~350 chantiers).';

-- ----------------------------------------------------------------------------
-- Table chantierci_marches_travaux
-- ----------------------------------------------------------------------------
create table public.chantierci_marches_travaux (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references public.chantierci_etablissements (id) on delete cascade,
  nom_entreprise text not null,
  numero_marche text not null,
  montant_marche numeric not null,
  date_demarrage date,
  date_fin_estimative date,
  constraint chantierci_marches_montant_positif check (montant_marche >= 0)
);

comment on table public.chantierci_marches_travaux is 'Marchés de travaux (montants en XOF).';

-- ----------------------------------------------------------------------------
-- Table chantierci_paiements
-- ----------------------------------------------------------------------------
create table public.chantierci_paiements (
  id uuid primary key default gen_random_uuid(),
  marche_id uuid not null references public.chantierci_marches_travaux (id) on delete cascade,
  date_paiement date not null,
  montant numeric not null,
  libelle text not null default '',
  saisi_par uuid references public.chantierci_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint chantierci_paiements_montant_positif check (montant > 0)
);

comment on table public.chantierci_paiements is 'Paiements sur marchés (XOF). Saisie réservée aux rôles national et admin.';

-- ----------------------------------------------------------------------------
-- Table chantierci_visites
-- ----------------------------------------------------------------------------
create table public.chantierci_visites (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references public.chantierci_etablissements (id) on delete cascade,
  date_visite date not null,
  nom_visiteur text not null default '',
  user_id uuid references public.chantierci_profiles (id) on delete set null,
  statut_chantier public.chantierci_statut_chantier not null,
  avancement_reel_pct integer,
  pct_excavation integer,
  pct_fondation integer,
  pct_verticaux integer,
  pct_charpente integer,
  pct_couverture integer,
  pct_finition integer,
  commentaire text,
  raisons_arret text[],
  raison_arret_autre text,
  sync_status public.chantierci_sync_status not null default 'synced',
  created_at timestamptz not null default now(),
  constraint chantierci_visites_avancement_valide check (avancement_reel_pct is null or avancement_reel_pct between 0 and 100),
  constraint chantierci_visites_pct_excavation_valide check (pct_excavation is null or pct_excavation between 0 and 100),
  constraint chantierci_visites_pct_fondation_valide check (pct_fondation is null or pct_fondation between 0 and 100),
  constraint chantierci_visites_pct_verticaux_valide check (pct_verticaux is null or pct_verticaux between 0 and 100),
  constraint chantierci_visites_pct_charpente_valide check (pct_charpente is null or pct_charpente between 0 and 100),
  constraint chantierci_visites_pct_couverture_valide check (pct_couverture is null or pct_couverture between 0 and 100),
  constraint chantierci_visites_pct_finition_valide check (pct_finition is null or pct_finition between 0 and 100),
  constraint chantierci_visites_raisons_arret_valides check (
    raisons_arret is null
    or raisons_arret <@ array['manque_effectif', 'manque_materiau', 'probleme_paiement', 'autre']::text[]
  )
);

comment on table public.chantierci_visites is 'Visites de chantier saisies par les COGES (saisie offline possible : sync_status).';
comment on column public.chantierci_visites.raisons_arret is 'Multi-select si statut arrêté : manque_effectif / manque_materiau / probleme_paiement / autre.';

-- ----------------------------------------------------------------------------
-- Table chantierci_photos_visites
-- ----------------------------------------------------------------------------
create table public.chantierci_photos_visites (
  id uuid primary key default gen_random_uuid(),
  visite_id uuid not null references public.chantierci_visites (id) on delete cascade,
  storage_path text not null,
  url_public text,
  taille_ko integer,
  sync_status public.chantierci_sync_status not null default 'synced',
  created_at timestamptz not null default now()
);

comment on table public.chantierci_photos_visites is 'Photos de visites. Convention de chemin Storage : {visite_id}/{nom_fichier} dans le bucket chantierci-photos-visites.';

-- ----------------------------------------------------------------------------
-- Table chantierci_commentaires — commentaires régionaux (CDC §5.4)
-- ----------------------------------------------------------------------------
create table public.chantierci_commentaires (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references public.chantierci_etablissements (id) on delete cascade,
  user_id uuid references public.chantierci_profiles (id) on delete set null,
  contenu text not null,
  created_at timestamptz not null default now()
);

comment on table public.chantierci_commentaires is 'Commentaires des responsables régionaux sur un établissement, visibles MEN + admin.';

-- ----------------------------------------------------------------------------
-- Index (clés étrangères + colonnes de filtre fréquentes)
-- ----------------------------------------------------------------------------
create index idx_chantierci_etablissements_lot_id on public.chantierci_etablissements (lot_id);
create index idx_chantierci_etablissements_statut on public.chantierci_etablissements (statut);
create index idx_chantierci_etablissements_province on public.chantierci_etablissements (province);
create index idx_chantierci_marches_etablissement_id on public.chantierci_marches_travaux (etablissement_id);
create index idx_chantierci_marches_numero on public.chantierci_marches_travaux (numero_marche);
create index idx_chantierci_paiements_marche_id on public.chantierci_paiements (marche_id);
create index idx_chantierci_paiements_saisi_par on public.chantierci_paiements (saisi_par);
create index idx_chantierci_visites_etablissement_date on public.chantierci_visites (etablissement_id, date_visite desc, created_at desc);
create index idx_chantierci_visites_user_id on public.chantierci_visites (user_id);
create index idx_chantierci_photos_visite_id on public.chantierci_photos_visites (visite_id);
create index idx_chantierci_commentaires_etablissement_id on public.chantierci_commentaires (etablissement_id);
create index idx_chantierci_commentaires_user_id on public.chantierci_commentaires (user_id);
create index idx_chantierci_lots_region on public.chantierci_lots (region);
