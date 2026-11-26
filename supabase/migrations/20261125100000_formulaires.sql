-- ============================================================================
-- Refonte PATEB — étape 2 — Formulaires de visite (CSTC, MOE, UG)
--
-- - Une table unique de visites, discriminée par `source` (cstc / moe / ug).
--   Les réponses propres à chaque formulaire sont en JSON (`reponses`) ;
--   les champs communs (statut, postes d'avancement, date) sont en colonnes.
-- - Postes d'avancement alignés sur le DQE type et leurs poids : tables
--   paramétrables par l'admin. L'avancement d'une visite est CALCULÉ dans la
--   vue chantierci_v_visites : changer un poids met tout à jour.
-- - Photos : table chantierci_photos + bucket Storage privé.
-- ============================================================================

create type public.chantierci_source_formulaire as enum ('cstc', 'moe', 'ug');
create type public.chantierci_statut_chantier as enum (
  'non_demarre', 'en_cours', 'ralenti', 'arrete', 'termine', 'receptionne'
);

-- ----------------------------------------------------------------------------
-- Paramètres numériques (partage salle / latrines, seuil d'écart, délais)
-- ----------------------------------------------------------------------------
create table public.chantierci_parametres (
  cle text primary key,
  valeur numeric not null,
  libelle text not null default ''
);
comment on table public.chantierci_parametres is 'Paramètres de calcul, modifiables par l''admin.';

insert into public.chantierci_parametres (cle, valeur, libelle) values
  ('part_classe', 80, 'Poids de la salle de classe dans l''avancement d''un site (%)'),
  ('part_latrines', 20, 'Poids du bloc latrines dans l''avancement d''un site (%)'),
  ('seuil_ecart_ug_moe', 5, 'Écart MOE / UG signalé au-delà de (points)'),
  ('fenetre_comparaison_jours', 7, 'Visite MOE comparée à la visite UG la plus proche, à ce nombre de jours près'),
  ('delai_correction_cstc_jours', 3, 'Un CSTC peut corriger un formulaire pendant (jours après l''envoi)');

-- ----------------------------------------------------------------------------
-- Postes d'avancement (alignés sur le DQE type) et leurs poids
-- ----------------------------------------------------------------------------
create table public.chantierci_postes (
  ouvrage text not null check (ouvrage in ('classe', 'latrines_a_eau', 'latrines_seches')),
  code text not null check (code ~ '^[a-z_]+$'),
  libelle text not null,
  poids numeric not null check (poids >= 0),
  ordre smallint not null,
  primary key (ouvrage, code)
);
comment on table public.chantierci_postes is 'Postes d''avancement par ouvrage et poids (en %, estimations par défaut à ajuster).';

insert into public.chantierci_postes (ouvrage, code, libelle, poids, ordre) values
  ('classe', 'terrassements',   'Terrassements, implantation',                5, 1),
  ('classe', 'fondations',      'Gros œuvre — fondations, dallage',          18, 2),
  ('classe', 'elevation',       'Gros œuvre — élévation, enduits',           27, 3),
  ('classe', 'ouvrages_divers', 'Ouvrages divers (marches, rampe, clôture)',  4, 4),
  ('classe', 'charpente',       'Charpente bois',                             6, 5),
  ('classe', 'couverture',      'Couverture',                                 9, 6),
  ('classe', 'serrurerie',      'Serrurerie (portes, persiennes)',            7, 7),
  ('classe', 'electricite',     'Électricité',                                5, 8),
  ('classe', 'menuiserie',      'Menuiserie bois (tableau, placards)',        4, 9),
  ('classe', 'faux_plafond',    'Faux-plafond',                               6, 10),
  ('classe', 'peinture',        'Peinture',                                   9, 11),
  ('latrines_a_eau', 'terrassements',        'Terrassements',                 6, 1),
  ('latrines_a_eau', 'gros_oeuvre',          'Gros œuvre (fosses, élévation)', 45, 2),
  ('latrines_a_eau', 'charpente_couverture', 'Charpente, couverture',          8, 3),
  ('latrines_a_eau', 'menuiserie',           'Menuiserie bois',                6, 4),
  ('latrines_a_eau', 'plomberie',            'Plomberie, sanitaires',         20, 5),
  ('latrines_a_eau', 'revetements',          'Revêtements durs',               7, 6),
  ('latrines_a_eau', 'electricite',          'Électricité',                    3, 7),
  ('latrines_a_eau', 'peinture',             'Peinture',                       5, 8),
  ('latrines_seches', 'terrassements',        'Terrassements',                 8, 1),
  ('latrines_seches', 'gros_oeuvre',          'Gros œuvre (fosses, élévation)', 60, 2),
  ('latrines_seches', 'charpente_couverture', 'Charpente, couverture',         12, 3),
  ('latrines_seches', 'menuiserie',           'Menuiserie bois',                8, 4),
  ('latrines_seches', 'ventilation',          'Ventilation des fosses',         4, 5),
  ('latrines_seches', 'peinture',             'Peinture',                       8, 6);

-- ----------------------------------------------------------------------------
-- Visites
-- ----------------------------------------------------------------------------
create table public.chantierci_visites (
  id uuid primary key default gen_random_uuid(),   -- généré par le client (saisie hors ligne)
  site_id uuid not null references public.chantierci_sites (id) on delete cascade,
  source public.chantierci_source_formulaire not null,
  date_visite date not null default current_date,
  auteur_id uuid references public.chantierci_profiles (id) on delete set null,
  auteur_nom text not null default '',
  statut public.chantierci_statut_chantier not null,
  -- {"classe": {"<code>": 0-100, …}, "latrines": {"<code>": 0-100, …}} (MOE, UG)
  postes jsonb not null default '{}'::jsonb,
  -- réponses propres au formulaire (voir src/lib/formulaires/definitions.ts)
  reponses jsonb not null default '{}'::jsonb,
  commentaire text not null default '',
  donnees_test boolean not null default false,     -- visites fictives (supprimables)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  modifie_par uuid references public.chantierci_profiles (id) on delete set null,
  constraint chantierci_visites_date_valide check (date_visite <= current_date + 1),
  constraint chantierci_visites_postes_objet check (jsonb_typeof(postes) = 'object'),
  constraint chantierci_visites_reponses_objet check (jsonb_typeof(reponses) = 'object')
);
comment on table public.chantierci_visites is 'Formulaires de visite (source cstc / moe / ug).';

create index idx_chantierci_visites_site_source_date
  on public.chantierci_visites (site_id, source, date_visite desc, created_at desc);
create index idx_chantierci_visites_auteur on public.chantierci_visites (auteur_id);
create index idx_chantierci_visites_date on public.chantierci_visites (date_visite);

-- ----------------------------------------------------------------------------
-- Photos (fichier dans le bucket chantierci-photos-visites, chemin {visite_id}/…)
-- ----------------------------------------------------------------------------
create table public.chantierci_photos (
  id uuid primary key default gen_random_uuid(),
  visite_id uuid not null references public.chantierci_visites (id) on delete cascade,
  chemin text not null unique,
  legende text not null default '',
  question text not null default '',               -- question du formulaire liée (facultatif)
  latitude double precision,
  longitude double precision,
  prise_le timestamptz,
  created_at timestamptz not null default now()
);
create index idx_chantierci_photos_visite on public.chantierci_photos (visite_id);

-- ----------------------------------------------------------------------------
-- Calcul de l'avancement (pondération par les tables ci-dessus)
-- ----------------------------------------------------------------------------
-- Avancement d'un ouvrage : moyenne des postes pondérée ; le poste électricité
-- est ignoré pour un site sans électricité. NULL si aucun poste saisi.
create or replace function chantierci_private.avancement_ouvrage(
  p_postes jsonb, p_ouvrage text, p_electricite boolean
) returns numeric
language sql stable set search_path = ''
as $$
  select case
    when p_postes is null or jsonb_typeof(p_postes) <> 'object' or p_postes = '{}'::jsonb then null
    when sum(po.poids) = 0 then null
    else sum(po.poids * least(greatest(coalesce((p_postes ->> po.code)::numeric, 0), 0), 100)) / sum(po.poids)
  end
  from public.chantierci_postes po
  where po.ouvrage = p_ouvrage
    and (po.code <> 'electricite' or p_electricite);
$$;

-- Avancement d'un site = part_classe × salle + part_latrines × latrines.
create or replace function chantierci_private.avancement_site(
  p_postes jsonb, p_electricite boolean, p_type_latrines public.chantierci_type_latrines
) returns numeric
language plpgsql stable set search_path = ''
as $$
declare
  v_classe numeric := chantierci_private.avancement_ouvrage(p_postes -> 'classe', 'classe', p_electricite);
  v_latrines numeric := chantierci_private.avancement_ouvrage(
    p_postes -> 'latrines', 'latrines_' || p_type_latrines::text, p_electricite);
  v_pc numeric;
  v_pl numeric;
begin
  if v_classe is null and v_latrines is null then
    return null;
  end if;
  select coalesce(max(valeur) filter (where cle = 'part_classe'), 80),
         coalesce(max(valeur) filter (where cle = 'part_latrines'), 20)
    into v_pc, v_pl
  from public.chantierci_parametres;
  if v_pc + v_pl = 0 then
    return null;
  end if;
  return round((v_pc * coalesce(v_classe, 0) + v_pl * coalesce(v_latrines, 0)) / (v_pc + v_pl), 1);
end;
$$;

revoke all on function chantierci_private.avancement_ouvrage(jsonb, text, boolean) from public;
revoke all on function chantierci_private.avancement_site(jsonb, boolean, public.chantierci_type_latrines) from public;
grant execute on function chantierci_private.avancement_ouvrage(jsonb, text, boolean) to authenticated;
grant execute on function chantierci_private.avancement_site(jsonb, boolean, public.chantierci_type_latrines) to authenticated;

-- ----------------------------------------------------------------------------
-- Droits de saisie / modification
-- ----------------------------------------------------------------------------
-- Peut-on créer un formulaire `p_source` sur ce site ?
create or replace function chantierci_private.peut_saisir(p_site uuid, p_source public.chantierci_source_formulaire)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_role public.chantierci_role := chantierci_private.user_role();
begin
  if v_role is null then
    return false;
  elsif v_role = 'admin' then
    return true;
  elsif v_role = 'ug' then
    return p_source = 'ug';
  elsif v_role = 'cstc' then
    return p_source = 'cstc' and p_site in (select chantierci_private.sites_accessibles());
  elsif v_role in ('moe_controleur', 'moe_chef') then
    return p_source = 'moe' and p_site in (select chantierci_private.sites_accessibles());
  end if;
  return false;
end;
$$;

-- Peut-on modifier cette visite ?
--   admin : toutes · CSTC : les siennes pendant N jours · contrôleur : les siennes
--   chef de mission : les formulaires MOE de son lot · UG : les siennes
create or replace function chantierci_private.peut_modifier_visite(p_visite uuid)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_role public.chantierci_role := chantierci_private.user_role();
  v public.chantierci_visites;
  v_lot_moe smallint;
  v_delai numeric;
begin
  if v_role is null then
    return false;
  end if;
  select * into v from public.chantierci_visites where id = p_visite;
  if not found then
    return false;
  end if;
  if v_role = 'admin' then
    return true;
  elsif v_role = 'cstc' then
    select coalesce(max(valeur), 3) into v_delai
    from public.chantierci_parametres where cle = 'delai_correction_cstc_jours';
    return v.source = 'cstc' and v.auteur_id = (select auth.uid())
       and now() <= v.created_at + make_interval(days => v_delai::int);
  elsif v_role = 'moe_controleur' then
    return v.source = 'moe' and v.auteur_id = (select auth.uid());
  elsif v_role = 'moe_chef' then
    select lot_moe_id into v_lot_moe from public.chantierci_sites where id = v.site_id;
    return v.source = 'moe' and v_lot_moe = chantierci_private.user_lot_moe();
  elsif v_role = 'ug' then
    return v.source = 'ug' and v.auteur_id = (select auth.uid());
  end if;
  return false;
end;
$$;

-- Variante texte pour les politiques Storage (1er segment du chemin).
create or replace function chantierci_private.peut_modifier_visite_txt(p_visite text)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_visite !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return chantierci_private.peut_modifier_visite(p_visite::uuid);
end;
$$;

revoke all on function chantierci_private.peut_saisir(uuid, public.chantierci_source_formulaire) from public;
revoke all on function chantierci_private.peut_modifier_visite(uuid) from public;
revoke all on function chantierci_private.peut_modifier_visite_txt(text) from public;
grant execute on function chantierci_private.peut_saisir(uuid, public.chantierci_source_formulaire) to authenticated;
grant execute on function chantierci_private.peut_modifier_visite(uuid) to authenticated;
grant execute on function chantierci_private.peut_modifier_visite_txt(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Triggers : auteur imposé à la création, champs d'identité figés ensuite.
-- ----------------------------------------------------------------------------
create or replace function chantierci_private.visites_avant_insertion()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    -- Saisie depuis l'application : l'auteur est l'utilisateur connecté.
    new.auteur_id := (select auth.uid());
    select coalesce(nullif(nom_complet, ''), email, '') into new.auteur_nom
    from public.chantierci_profiles where id = new.auteur_id;
    new.donnees_test := false;
    new.created_at := now();
    new.modifie_par := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function chantierci_private.visites_avant_modification()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if chantierci_private.user_role() <> 'admin' and (
         new.site_id is distinct from old.site_id
      or new.source is distinct from old.source
      or new.auteur_id is distinct from old.auteur_id
      or new.donnees_test is distinct from old.donnees_test) then
      raise exception 'Le site, le type de formulaire et l''auteur d''une visite ne peuvent pas être modifiés';
    end if;
    new.created_at := old.created_at;
    new.modifie_par := (select auth.uid());
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function chantierci_private.visites_avant_insertion() from public;
revoke all on function chantierci_private.visites_avant_modification() from public;

create trigger chantierci_visites_avant_insertion
  before insert on public.chantierci_visites
  for each row execute function chantierci_private.visites_avant_insertion();
create trigger chantierci_visites_avant_modification
  before update on public.chantierci_visites
  for each row execute function chantierci_private.visites_avant_modification();

-- ----------------------------------------------------------------------------
-- Vue : visites + site + avancement calculé (RLS des tables appliquée)
-- ----------------------------------------------------------------------------
create view public.chantierci_v_visites
with (security_invoker = true) as
select
  v.*,
  s.code as site_code,
  s.nom as site_nom,
  s.lot_id,
  s.lot_moe_id,
  chantierci_private.avancement_site(v.postes, s.electricite, s.type_latrines) as avancement
from public.chantierci_visites v
join public.chantierci_sites s on s.id = v.site_id;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.chantierci_parametres enable row level security;
alter table public.chantierci_postes enable row level security;
alter table public.chantierci_visites enable row level security;
alter table public.chantierci_photos enable row level security;

create policy "chantierci_parametres_select" on public.chantierci_parametres
  for select to authenticated using ((select chantierci_private.user_role()) is not null);
create policy "chantierci_parametres_update_admin" on public.chantierci_parametres
  for update to authenticated
  using ((select chantierci_private.user_role()) = 'admin')
  with check ((select chantierci_private.user_role()) = 'admin');

create policy "chantierci_postes_select" on public.chantierci_postes
  for select to authenticated using ((select chantierci_private.user_role()) is not null);
create policy "chantierci_postes_update_admin" on public.chantierci_postes
  for update to authenticated
  using ((select chantierci_private.user_role()) = 'admin')
  with check ((select chantierci_private.user_role()) = 'admin');

-- Lecture : CSTC → formulaires CSTC de son site ; MOE → formulaires MOE de
-- son périmètre ; UG et admin → tout.
create policy "chantierci_visites_select" on public.chantierci_visites
  for select to authenticated
  using (
    site_id in (select chantierci_private.sites_accessibles())
    and (
      (select chantierci_private.user_role()) in ('admin', 'ug')
      or ((select chantierci_private.user_role()) = 'cstc' and source = 'cstc')
      or ((select chantierci_private.user_role()) in ('moe_controleur', 'moe_chef') and source = 'moe')
    )
  );
create policy "chantierci_visites_insert" on public.chantierci_visites
  for insert to authenticated
  with check (chantierci_private.peut_saisir(site_id, source));
create policy "chantierci_visites_update" on public.chantierci_visites
  for update to authenticated
  using (chantierci_private.peut_modifier_visite(id))
  with check (chantierci_private.peut_saisir(site_id, source) or (select chantierci_private.user_role()) = 'admin');
create policy "chantierci_visites_delete_admin" on public.chantierci_visites
  for delete to authenticated
  using ((select chantierci_private.user_role()) = 'admin');

create policy "chantierci_photos_select" on public.chantierci_photos
  for select to authenticated
  using (visite_id in (select id from public.chantierci_visites));
create policy "chantierci_photos_insert" on public.chantierci_photos
  for insert to authenticated
  with check (chantierci_private.peut_modifier_visite(visite_id));
create policy "chantierci_photos_delete" on public.chantierci_photos
  for delete to authenticated
  using (chantierci_private.peut_modifier_visite(visite_id));

grant select on public.chantierci_parametres, public.chantierci_postes, public.chantierci_v_visites to authenticated;
grant update on public.chantierci_parametres, public.chantierci_postes to authenticated;
grant select, insert, update, delete on public.chantierci_visites, public.chantierci_photos to authenticated;
revoke all on public.chantierci_parametres, public.chantierci_postes, public.chantierci_visites,
  public.chantierci_photos, public.chantierci_v_visites from anon;

-- ----------------------------------------------------------------------------
-- Storage : bucket privé des photos + politiques (schéma storage = Supabase)
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('chantierci-photos-visites', 'chantierci-photos-visites', false, 5242880,
            array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;

    execute $p$
      create policy "chantierci_photos_storage_select" on storage.objects
        for select to authenticated
        using (
          bucket_id = 'chantierci-photos-visites'
          and exists (select 1 from public.chantierci_visites v
                      where v.id::text = (storage.foldername(name))[1])
        )
    $p$;
    execute $p$
      create policy "chantierci_photos_storage_insert" on storage.objects
        for insert to authenticated
        with check (
          bucket_id = 'chantierci-photos-visites'
          and chantierci_private.peut_modifier_visite_txt((storage.foldername(name))[1])
        )
    $p$;
    execute $p$
      create policy "chantierci_photos_storage_delete" on storage.objects
        for delete to authenticated
        using (
          bucket_id = 'chantierci-photos-visites'
          and chantierci_private.peut_modifier_visite_txt((storage.foldername(name))[1])
        )
    $p$;
  end if;
end $$;
