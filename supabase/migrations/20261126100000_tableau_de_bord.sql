-- ============================================================================
-- ÉTAPE 4 — Tableau de bord : positions des sites, commentaires, état des sites
--
-- - chantierci_departements : chef-lieu de chaque département (position
--   approximative des sites tant que leurs coordonnées GPS ne sont pas
--   connues) ;
-- - chantierci_commentaires : commentaires de l'UG et de l'admin sur un site ;
-- - vue chantierci_v_etat_sites : une ligne par site avec le dernier rapport
--   MOE (avancement de référence), la dernière fiche UG comparée à la visite
--   MOE la plus proche (± fenêtre en jours), le dernier signalement CSTC et la
--   position à afficher sur la carte.
--
-- À exécuter APRÈS 20261125100000_formulaires.sql. Rejouable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Départements (chefs-lieux, coordonnées approximatives)
-- ----------------------------------------------------------------------------
create table if not exists public.chantierci_departements (
  nom text primary key,                       -- tel qu'écrit dans chantierci_sites.departement
  region text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180)
);
comment on table public.chantierci_departements is
  'Chef-lieu de chaque département : position approximative des sites sans coordonnées GPS.';

insert into public.chantierci_departements (nom, region, latitude, longitude) values
  ('Bouna',           'Bounkani',          9.270, -3.000),
  ('Doropo',          'Bounkani',          9.810, -3.350),
  ('Tehini',          'Bounkani',          9.600, -3.660),
  ('Nassian',         'Bounkani',          8.450, -3.470),
  ('Bondoukou',       'Gontougo',          8.040, -2.800),
  ('Tanda',           'Gontougo',          7.800, -3.170),
  ('Koun-Fao',        'Gontougo',          7.490, -3.250),
  ('Transua',         'Gontougo',          7.550, -3.010),
  ('Katiola',         'Hambol',            8.140, -5.100),
  ('Niakaramadougou', 'Hambol',            8.660, -5.290),
  ('Dabakala',        'Hambol',            8.360, -4.430),
  ('Ferkessedougou',  'Tchologo',          9.590, -5.200),
  ('Ouangolodougou',  'Tchologo',          9.970, -5.150),
  ('Kong',            'Tchologo',          9.150, -4.610),
  ('Odienne',         'Kabadougou',        9.510, -7.570),
  ('Kaniasso',        'Folon',             9.820, -7.510),
  ('Minignan',        'Folon',             9.990, -7.840),
  ('Boundiali',       'Bagoué',            9.520, -6.490),
  ('Kouto',           'Bagoué',            9.890, -6.410),
  ('Tengrela',        'Bagoué',           10.480, -6.410),
  ('Koro',            'Bafing',            8.550, -7.460),
  ('Ouaninou',        'Bafing',            8.240, -7.870),
  ('Touba',           'Bafing',            8.280, -7.680),
  ('Mankono',         'Béré',              8.060, -6.190),
  ('Kounahiri',       'Béré',              7.790, -5.840),
  ('Dianra',          'Béré',              8.750, -6.250),
  ('Kani',            'Worodougou',        8.480, -6.600),
  ('Seguela',         'Worodougou',        7.960, -6.670),
  ('Abengourou',      'Indénié-Djuablin',  6.730, -3.490),
  ('Agnibilekrou',    'Indénié-Djuablin',  7.130, -3.200),
  ('Meagui',          'Nawa',              5.400, -6.560),
  ('Soubre',          'Nawa',              5.790, -6.610),
  ('Gueyo',           'Nawa',              5.690, -6.070),
  ('Buyo',            'Nawa',              6.250, -7.000),
  ('Taï',             'Cavally',           5.870, -7.460),
  ('Toulepleu',       'Cavally',           6.580, -8.410),
  ('Guiglo',          'Cavally',           6.540, -7.490),
  ('Blolequin',       'Cavally',           6.570, -8.000),
  ('Sassandra',       'Gbôklé',            4.950, -6.090),
  ('Fresco',          'Gbôklé',            5.080, -5.570)
on conflict (nom) do nothing;

alter table public.chantierci_departements enable row level security;
drop policy if exists "chantierci_departements_select" on public.chantierci_departements;
drop policy if exists "chantierci_departements_update_admin" on public.chantierci_departements;
create policy "chantierci_departements_select" on public.chantierci_departements
  for select to authenticated using ((select chantierci_private.user_role()) is not null);
create policy "chantierci_departements_update_admin" on public.chantierci_departements
  for update to authenticated
  using ((select chantierci_private.user_role()) = 'admin')
  with check ((select chantierci_private.user_role()) = 'admin');
grant select, update on public.chantierci_departements to authenticated;
revoke all on public.chantierci_departements from anon;

-- ----------------------------------------------------------------------------
-- Commentaires sur un site (UG et admin)
-- ----------------------------------------------------------------------------
-- La v1 avait une table du même nom (par établissement) : normalement
-- supprimée par la purge ; par sécurité, on la retire si elle subsiste.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'chantierci_commentaires'
               and column_name = 'etablissement_id') then
    drop table public.chantierci_commentaires cascade;
  end if;
end $$;

create table if not exists public.chantierci_commentaires (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.chantierci_sites (id) on delete cascade,
  auteur_id uuid references public.chantierci_profiles (id) on delete set null,
  auteur_nom text not null default '',
  texte text not null check (length(btrim(texte)) between 1 and 4000),
  donnees_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.chantierci_commentaires is 'Commentaires de suivi sur un site (UG, admin).';
create index if not exists idx_chantierci_commentaires_site
  on public.chantierci_commentaires (site_id, created_at desc);
create index if not exists idx_chantierci_commentaires_date
  on public.chantierci_commentaires (created_at desc);

create or replace function chantierci_private.commentaires_avant_ecriture()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if tg_op = 'INSERT' then
      new.auteur_id := (select auth.uid());
      select coalesce(nullif(nom_complet, ''), email, '') into new.auteur_nom
      from public.chantierci_profiles where id = new.auteur_id;
      new.donnees_test := false;
      new.created_at := now();
    else
      -- Seul le texte peut changer.
      new.site_id := old.site_id;
      new.auteur_id := old.auteur_id;
      new.auteur_nom := old.auteur_nom;
      new.donnees_test := old.donnees_test;
      new.created_at := old.created_at;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function chantierci_private.commentaires_avant_ecriture() from public;

drop trigger if exists chantierci_commentaires_avant_ecriture on public.chantierci_commentaires;
create trigger chantierci_commentaires_avant_ecriture
  before insert or update on public.chantierci_commentaires
  for each row execute function chantierci_private.commentaires_avant_ecriture();

alter table public.chantierci_commentaires enable row level security;
drop policy if exists "chantierci_commentaires_select" on public.chantierci_commentaires;
drop policy if exists "chantierci_commentaires_insert" on public.chantierci_commentaires;
drop policy if exists "chantierci_commentaires_update" on public.chantierci_commentaires;
drop policy if exists "chantierci_commentaires_delete" on public.chantierci_commentaires;
create policy "chantierci_commentaires_select" on public.chantierci_commentaires
  for select to authenticated
  using ((select chantierci_private.user_role()) in ('ug', 'admin'));
create policy "chantierci_commentaires_insert" on public.chantierci_commentaires
  for insert to authenticated
  with check (
    (select chantierci_private.user_role()) in ('ug', 'admin')
    and site_id in (select chantierci_private.sites_accessibles())
  );
create policy "chantierci_commentaires_update" on public.chantierci_commentaires
  for update to authenticated
  using (auteur_id = (select auth.uid()) and (select chantierci_private.user_role()) in ('ug', 'admin'))
  with check (auteur_id = (select auth.uid()));
create policy "chantierci_commentaires_delete" on public.chantierci_commentaires
  for delete to authenticated
  using (
    (select chantierci_private.user_role()) = 'admin'
    or (auteur_id = (select auth.uid()) and (select chantierci_private.user_role()) = 'ug')
  );
grant select, insert, update, delete on public.chantierci_commentaires to authenticated;
revoke all on public.chantierci_commentaires from anon;

-- ----------------------------------------------------------------------------
-- Vue : état de chaque site (RLS des tables appliquée)
-- ----------------------------------------------------------------------------
drop view if exists public.chantierci_v_etat_sites;
create view public.chantierci_v_etat_sites
with (security_invoker = true) as
with params as (
  select
    coalesce(max(valeur) filter (where cle = 'fenetre_comparaison_jours'), 7)::int as fenetre,
    coalesce(max(valeur) filter (where cle = 'seuil_ecart_ug_moe'), 5) as seuil
  from public.chantierci_parametres
)
select
  s.id,
  s.code,
  s.nom,
  s.lot_id,
  s.lot_moe_id,
  s.region,
  s.departement,
  s.localite,
  s.electricite,
  s.type_latrines,
  -- Position : coordonnées du site, sinon moyenne des photos géolocalisées,
  -- sinon chef-lieu du département (décalé de quelques km pour ne pas
  -- superposer les sites).
  coalesce(s.latitude, gps.latitude,
    d.latitude + ((('x' || substr(md5(s.code), 1, 4))::bit(16)::int) / 65535.0 - 0.5) * 0.16) as latitude,
  coalesce(s.longitude, gps.longitude,
    d.longitude + ((('x' || substr(md5(s.code), 5, 4))::bit(16)::int) / 65535.0 - 0.5) * 0.16) as longitude,
  case
    when s.latitude is not null and s.longitude is not null then 'site'
    when gps.latitude is not null then 'photos'
    when d.nom is not null then 'departement'
  end as origine_position,
  moe.date_visite as moe_date,
  moe.statut as moe_statut,
  moe.postes as moe_postes,
  chantierci_private.avancement_site(moe.postes, s.electricite, s.type_latrines) as moe_avancement,
  (select count(*) from public.chantierci_visites v where v.site_id = s.id and v.source = 'moe')::int as moe_nb,
  ug.date_visite as ug_date,
  ug.statut as ug_statut,
  ug.avancement as ug_avancement,
  ref.date_visite as ug_date_moe_comparee,
  ref.avancement as ug_avancement_moe_compare,
  round(ug.avancement - ref.avancement, 1) as ecart_ug_moe,
  coalesce(abs(ug.avancement - ref.avancement) > p.seuil, false) as discordance,
  cstc.date_visite as cstc_date,
  cstc.statut as cstc_statut
from public.chantierci_sites s
cross join params p
left join public.chantierci_departements d on d.nom = s.departement
left join lateral (
  select v.date_visite, v.statut, v.postes
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'moe'
  order by v.date_visite desc, v.created_at desc
  limit 1
) moe on true
left join lateral (
  select v.date_visite, v.statut,
         chantierci_private.avancement_site(v.postes, s.electricite, s.type_latrines) as avancement
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'ug'
  order by v.date_visite desc, v.created_at desc
  limit 1
) ug on true
left join lateral (
  select v.date_visite,
         chantierci_private.avancement_site(v.postes, s.electricite, s.type_latrines) as avancement
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'moe'
    and ug.date_visite is not null
    and abs(v.date_visite - ug.date_visite) <= p.fenetre
  order by abs(v.date_visite - ug.date_visite), v.date_visite desc, v.created_at desc
  limit 1
) ref on true
left join lateral (
  select v.date_visite, v.statut
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'cstc'
  order by v.date_visite desc, v.created_at desc
  limit 1
) cstc on true
left join lateral (
  select avg(ph.latitude) as latitude, avg(ph.longitude) as longitude
  from public.chantierci_photos ph
  join public.chantierci_visites v on v.id = ph.visite_id
  where v.site_id = s.id and ph.latitude is not null and ph.longitude is not null
) gps on true
where s.actif;

comment on view public.chantierci_v_etat_sites is
  'Une ligne par site actif : dernier rapport MOE (référence), dernière fiche UG et écart avec la visite MOE la plus proche, dernier signalement CSTC, position.';

grant select on public.chantierci_v_etat_sites to authenticated;
revoke all on public.chantierci_v_etat_sites from anon;
