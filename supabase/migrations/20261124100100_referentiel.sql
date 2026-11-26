-- ============================================================================
-- Refonte PATEB — 1/4 — Référentiel : lots, sites, profils, affectations
--
-- Hiérarchie : lot MOE (4) > lot de travaux (33) > site (387).
-- Le lot MOE est porté par le SITE (rattachement par région) : le lot de
-- travaux 16 « Bafing et Béré 1 » est partagé entre MOE 4 et MOE 2.
-- Les objets restent préfixés `chantierci_` (convention historique du projet).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Types énumérés
-- ----------------------------------------------------------------------------
create type public.chantierci_role as enum (
  'cstc',            -- comité de suivi communautaire : 1 site
  'moe_controleur',  -- contrôleur MOE : ses sites (affectations)
  'moe_chef',        -- chef de mission MOE : tous les sites de son lot MOE
  'ug',              -- unité de gestion : tous les sites
  'admin'
);
create type public.chantierci_statut_compte as enum ('en_attente', 'actif', 'suspendu');
create type public.chantierci_type_latrines as enum ('seches', 'a_eau');

-- ----------------------------------------------------------------------------
-- Lots MOE (missions de suivi et contrôle)
-- ----------------------------------------------------------------------------
create table public.chantierci_lots_moe (
  id smallint primary key,
  nom text not null,
  regions text[] not null default '{}',
  titulaire text not null default ''
);
comment on table public.chantierci_lots_moe is 'Lots de maîtrise d''œuvre (4). Rattachement des sites par région.';

-- ----------------------------------------------------------------------------
-- Lots de travaux (marchés)
-- ----------------------------------------------------------------------------
create table public.chantierci_lots (
  id smallint primary key,
  nom text not null,
  entreprise_titulaire text not null default '',
  -- Poids dans l'avancement global (paramétrable par l'admin, défaut = nb de sites).
  poids numeric not null default 1,
  constraint chantierci_lots_id_valide check (id between 1 and 99),
  constraint chantierci_lots_poids_positif check (poids >= 0)
);
comment on table public.chantierci_lots is 'Lots de travaux (33 marchés). poids = pondération dans l''avancement global.';

-- ----------------------------------------------------------------------------
-- Sites (une salle de pré-primaire + un bloc latrines 3 cabines par site)
-- ----------------------------------------------------------------------------
create table public.chantierci_sites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                       -- ex. L19-01
  lot_id smallint not null references public.chantierci_lots (id) on delete restrict,
  lot_moe_id smallint not null references public.chantierci_lots_moe (id) on delete restrict,
  nom text not null,
  region text not null,
  departement text not null default '',
  localite text not null default '',
  zone text not null default '',                   -- Rural / Peri-urbain / Urbain
  electricite boolean not null default true,
  type_latrines public.chantierci_type_latrines not null,
  latitude double precision,
  longitude double precision,
  a_verifier text not null default '',            -- remarque sur la donnée source
  actif boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint chantierci_sites_latitude_valide check (latitude is null or latitude between -90 and 90),
  constraint chantierci_sites_longitude_valide check (longitude is null or longitude between -180 and 180)
);
comment on table public.chantierci_sites is 'Sites de construction (référentiel issu du DAO, modifiable par l''admin uniquement).';

-- ----------------------------------------------------------------------------
-- Profils (id = auth.users.id)
-- ----------------------------------------------------------------------------
create table public.chantierci_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nom_complet text not null default '',
  email text not null default '',
  -- Identifiant de connexion des CSTC (connexion identifiant + PIN).
  identifiant text unique,
  telephone text not null default '',
  role public.chantierci_role not null default 'moe_controleur',
  -- Lot MOE du chef de mission (et, pour information, des contrôleurs).
  lot_moe_id smallint references public.chantierci_lots_moe (id) on delete set null,
  statut_compte public.chantierci_statut_compte not null default 'en_attente',
  created_at timestamptz not null default now(),
  constraint chantierci_profiles_identifiant_format
    check (identifiant is null or identifiant ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  constraint chantierci_profiles_chef_a_un_lot
    check (role <> 'moe_chef' or statut_compte <> 'actif' or lot_moe_id is not null)
);
comment on table public.chantierci_profiles is 'Profils. role / statut_compte / lot_moe_id / identifiant modifiables uniquement par un admin (trigger).';

-- ----------------------------------------------------------------------------
-- Affectations profil ↔ site (CSTC : 1 site ; contrôleur MOE : n sites)
-- ----------------------------------------------------------------------------
create table public.chantierci_affectations (
  profile_id uuid not null references public.chantierci_profiles (id) on delete cascade,
  site_id uuid not null references public.chantierci_sites (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, site_id)
);
comment on table public.chantierci_affectations is 'Sites dont un CSTC (1 au plus) ou un contrôleur MOE est chargé.';

-- ----------------------------------------------------------------------------
-- Index
-- ----------------------------------------------------------------------------
create index idx_chantierci_sites_lot_id on public.chantierci_sites (lot_id);
create index idx_chantierci_sites_lot_moe_id on public.chantierci_sites (lot_moe_id);
create index idx_chantierci_profiles_lot_moe_id on public.chantierci_profiles (lot_moe_id);
create index idx_chantierci_affectations_site_id on public.chantierci_affectations (site_id);
