-- ============================================================================
-- PONDÉRATION DQE, CORPS D'ÉTAT, PLANNING ET ALERTES
--
-- 1. Poids des postes = montants du DQE (FCFA HT, DQE CONSTRUCTION PATEB
--    V130326) : salle de classe avec / sans électricité, latrines sèches et
--    latrines à eau (3 cabines). Classe et latrines sont réunies dans un même
--    calcul : avancement d'un site = Σ (montant du poste × % réalisé) / Σ
--    montants (remplace la répartition fixe 80 % / 20 %). Nouveau poste
--    « Plafonnage » des latrines à eau (lot 17 du DQE).
-- 2. Corps d'état (lots du DQE) : chaque poste est rattaché à un corps
--    d'état (diagramme d'avancement par corps d'état).
-- 3. Montant de chaque site (vue : colonne montant) ; poids d'un lot = somme
--    des montants de ses sites ; courbe d'évolution pondérée par les montants.
-- 4. Date de début des travaux de chaque site (planning théorique) et
--    paramètres des alertes.
-- 5. Positions de 5 sites supplémentaires (noms différents sur la carte).
--
-- À exécuter APRÈS 20261201100000_entreprises_positions.sql. Rejouable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1–2. Corps d'état et postes
-- ----------------------------------------------------------------------------
create table if not exists public.chantierci_corps_etat (
  code text primary key check (code ~ '^[a-z_]+$'),
  libelle text not null,
  ordre smallint not null
);
comment on table public.chantierci_corps_etat is 'Corps d''état (lots du DQE) regroupant les postes de la salle de classe et des latrines.';
alter table public.chantierci_corps_etat enable row level security;
drop policy if exists "chantierci_corps_etat_select" on public.chantierci_corps_etat;
create policy "chantierci_corps_etat_select" on public.chantierci_corps_etat
  for select to authenticated using ((select chantierci_private.user_role()) is not null);
drop policy if exists "chantierci_corps_etat_ecriture_admin" on public.chantierci_corps_etat;
create policy "chantierci_corps_etat_ecriture_admin" on public.chantierci_corps_etat
  for all to authenticated
  using ((select chantierci_private.user_role()) = 'admin')
  with check ((select chantierci_private.user_role()) = 'admin');
grant select, insert, update, delete on public.chantierci_corps_etat to authenticated;
revoke all on public.chantierci_corps_etat from anon;

insert into public.chantierci_corps_etat (code, libelle, ordre) values
  ('terrassements',        'Terrassements',              1),
  ('gros_oeuvre',          'Gros œuvre',                 2),
  ('charpente_couverture', 'Charpente, couverture',      3),
  ('plomberie',            'Plomberie, sanitaire',       4),
  ('electricite',          'Électricité',                5),
  ('serrurerie',           'Serrurerie',                 6),
  ('menuiserie',           'Menuiserie bois',            7),
  ('plafonds',             'Faux-plafond, plafonnage',   8),
  ('revetements',          'Revêtements durs',           9),
  ('peinture',             'Peinture',                  10)
on conflict (code) do update set libelle = excluded.libelle, ordre = excluded.ordre;

alter table public.chantierci_postes add column if not exists poids_sans_electricite numeric
  check (poids_sans_electricite is null or poids_sans_electricite >= 0);
alter table public.chantierci_postes add column if not exists corps_etat text
  references public.chantierci_corps_etat (code);
comment on column public.chantierci_postes.poids is 'Montant du poste au DQE (FCFA HT) : pondération de l''avancement.';
comment on column public.chantierci_postes.poids_sans_electricite is 'Montant pour un site sans électricité, s''il diffère (sinon poids).';

insert into public.chantierci_postes (ouvrage, code, libelle, poids, poids_sans_electricite, ordre, corps_etat) values
  ('classe', 'terrassements',   'Terrassements, implantation',               398125, null,  1, 'terrassements'),
  ('classe', 'fondations',      'Gros œuvre — fondations, dallage',         2210700, null,  2, 'gros_oeuvre'),
  ('classe', 'elevation',       'Gros œuvre — élévation, enduits',          2559200, null,  3, 'gros_oeuvre'),
  ('classe', 'ouvrages_divers', 'Ouvrages divers (marches, rampe, clôture)', 1462020, null,  4, 'gros_oeuvre'),
  ('classe', 'charpente',       'Charpente bois',                            276200, null,  5, 'charpente_couverture'),
  ('classe', 'couverture',      'Couverture',                                847040, null,  6, 'charpente_couverture'),
  ('classe', 'serrurerie',      'Serrurerie (portes, persiennes)',           385240, null,  7, 'serrurerie'),
  ('classe', 'electricite',     'Électricité',                               488790, 135000, 8, 'electricite'),
  ('classe', 'menuiserie',      'Menuiserie bois (tableau, placards)',        47600, null,  9, 'menuiserie'),
  ('classe', 'faux_plafond',    'Faux-plafond',                              890000, null, 10, 'plafonds'),
  ('classe', 'peinture',        'Peinture',                                  672465, null, 11, 'peinture'),
  ('latrines_a_eau', 'terrassements',        'Terrassements',                   70940, null, 1, 'terrassements'),
  ('latrines_a_eau', 'gros_oeuvre',          'Gros œuvre (fosses, élévation)', 1069580, null, 2, 'gros_oeuvre'),
  ('latrines_a_eau', 'charpente_couverture', 'Charpente, couverture',           306000, null, 3, 'charpente_couverture'),
  ('latrines_a_eau', 'plafonnage',           'Plafonnage',                      172500, null, 4, 'plafonds'),
  ('latrines_a_eau', 'menuiserie',           'Menuiserie bois',                 135000, null, 5, 'menuiserie'),
  ('latrines_a_eau', 'plomberie',            'Plomberie, sanitaires',          1879500, null, 6, 'plomberie'),
  ('latrines_a_eau', 'revetements',          'Revêtements durs',                132225, null, 7, 'revetements'),
  ('latrines_a_eau', 'electricite',          'Électricité',                      94000, null, 8, 'electricite'),
  ('latrines_a_eau', 'peinture',             'Peinture',                        105000, null, 9, 'peinture'),
  ('latrines_seches', 'terrassements',        'Terrassements',                  125080, null, 1, 'terrassements'),
  ('latrines_seches', 'gros_oeuvre',          'Gros œuvre (fosses, élévation)', 1835270, null, 2, 'gros_oeuvre'),
  ('latrines_seches', 'charpente_couverture', 'Charpente, couverture',          215600, null, 3, 'charpente_couverture'),
  ('latrines_seches', 'menuiserie',           'Menuiserie bois',                135000, null, 4, 'menuiserie'),
  ('latrines_seches', 'ventilation',          'Ventilation, équipements sanitaires', 39600, null, 5, 'plomberie'),
  ('latrines_seches', 'peinture',             'Peinture',                       114000, null, 6, 'peinture')
on conflict (ouvrage, code) do update set
  libelle = excluded.libelle, poids = excluded.poids, poids_sans_electricite = excluded.poids_sans_electricite,
  ordre = excluded.ordre, corps_etat = excluded.corps_etat;

-- ----------------------------------------------------------------------------
-- Calcul : classe et latrines réunies, pondérées par les montants du DQE.
-- Le poste électricité compte aussi pour un site sans électricité (montant
-- poids_sans_electricite). NULL si aucun poste saisi.
-- ----------------------------------------------------------------------------
create or replace function chantierci_private.avancement_ouvrage(
  p_postes jsonb, p_ouvrage text, p_electricite boolean
) returns numeric
language sql stable set search_path = ''
as $$
  select case
    when p_postes is null or jsonb_typeof(p_postes) <> 'object' or p_postes = '{}'::jsonb then null
    when sum(p.poids) = 0 then null
    else sum(p.poids * least(greatest(coalesce((p_postes ->> p.code)::numeric, 0), 0), 100)) / sum(p.poids)
  end
  from (
    select po.code,
           case when not p_electricite and po.poids_sans_electricite is not null
                then po.poids_sans_electricite else po.poids end as poids
    from public.chantierci_postes po
    where po.ouvrage = p_ouvrage
  ) p;
$$;

create or replace function chantierci_private.avancement_site(
  p_postes jsonb, p_electricite boolean, p_type_latrines public.chantierci_type_latrines
) returns numeric
language sql stable set search_path = ''
as $$
  select case
    when p_postes is null or jsonb_typeof(p_postes) <> 'object'
      or (coalesce(p_postes -> 'classe', '{}'::jsonb) = '{}'::jsonb
          and coalesce(p_postes -> 'latrines', '{}'::jsonb) = '{}'::jsonb) then null
    when sum(p.poids) = 0 then null
    else round(sum(p.poids * least(greatest(coalesce(p.valeur, 0), 0), 100)) / sum(p.poids), 1)
  end
  from (
    select case when not p_electricite and po.poids_sans_electricite is not null
                then po.poids_sans_electricite else po.poids end as poids,
           (case when po.ouvrage = 'classe' then p_postes -> 'classe' else p_postes -> 'latrines' end
             ->> po.code)::numeric as valeur
    from public.chantierci_postes po
    where po.ouvrage in ('classe', 'latrines_' || p_type_latrines::text)
  ) p;
$$;
revoke all on function chantierci_private.avancement_site(jsonb, boolean, public.chantierci_type_latrines) from public;
grant execute on function chantierci_private.avancement_site(jsonb, boolean, public.chantierci_type_latrines) to authenticated;

-- Montant d'un site au DQE (salle de classe + latrines de son type, FCFA HT).
create or replace function chantierci_private.montant_site(
  p_electricite boolean, p_type_latrines public.chantierci_type_latrines
) returns numeric
language sql stable set search_path = ''
as $$
  select coalesce(sum(case when not p_electricite and po.poids_sans_electricite is not null
                           then po.poids_sans_electricite else po.poids end), 0)
  from public.chantierci_postes po
  where po.ouvrage in ('classe', 'latrines_' || p_type_latrines::text);
$$;
revoke all on function chantierci_private.montant_site(boolean, public.chantierci_type_latrines) from public;
grant execute on function chantierci_private.montant_site(boolean, public.chantierci_type_latrines) to authenticated;

-- La répartition fixe classe / latrines ne sert plus ; paramètres du planning et des alertes.
delete from public.chantierci_parametres where cle in ('part_classe', 'part_latrines');
insert into public.chantierci_parametres (cle, valeur, libelle) values
  ('delai_travaux_mois', 5, 'Délai des travaux d''un site (mois) : avancement théorique linéaire depuis la date de début'),
  ('fraicheur_alertes_jours', 30, 'Alertes : seuls les formulaires de moins de N jours sont pris en compte'),
  ('seuil_retard_orange', 10, 'Alerte « à surveiller » : retard sur l''avancement théorique d''au moins (points)'),
  ('seuil_retard_rouge', 20, 'Alerte critique : retard sur l''avancement théorique d''au moins (points)')
on conflict (cle) do nothing;

-- ----------------------------------------------------------------------------
-- 3–4. Date de début, montant des sites, poids des lots
-- ----------------------------------------------------------------------------
alter table public.chantierci_sites add column if not exists date_debut date;
comment on column public.chantierci_sites.date_debut is 'Début des travaux (planning théorique : délai delai_travaux_mois).';

update public.chantierci_lots l
set poids = coalesce((
  select sum(chantierci_private.montant_site(s.electricite, s.type_latrines))
  from public.chantierci_sites s where s.lot_id = l.id and s.actif), 0);
comment on column public.chantierci_lots.poids is 'Poids du lot dans l''avancement global : montant DQE de ses sites (FCFA HT) par défaut.';

-- Vue : + montant DQE et date de début (colonnes ajoutées à la fin)
create or replace view public.chantierci_v_etat_sites
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
  moe.avancement as moe_avancement,
  (select count(*) from public.chantierci_visites v where v.site_id = s.id and v.source = 'moe')::int as moe_nb,
  ug.date_visite as ug_date,
  ug.statut as ug_statut,
  ug.avancement as ug_avancement,
  ref.date_visite as ug_date_moe_comparee,
  ref.avancement as ug_avancement_moe_compare,
  round(ug.avancement - ref.avancement, 1) as ecart_ug_moe,
  coalesce(abs(ug.avancement - ref.avancement) > p.seuil, false) as discordance,
  cstc.date_visite as cstc_date,
  cstc.statut as cstc_statut,
  -- Détail des dernières visites (onglet Difficultés)
  moe.reponses as moe_reponses,
  moe.commentaire as moe_commentaire,
  case when moe.statut = 'arrete' then arret.depuis end as moe_arrete_depuis,
  ug.reponses as ug_reponses,
  ug.commentaire as ug_commentaire,
  cstc.reponses as cstc_reponses,
  cstc.commentaire as cstc_commentaire,
  -- Montant DQE du site et début des travaux (planning théorique)
  chantierci_private.montant_site(s.electricite, s.type_latrines) as montant,
  s.date_debut
from public.chantierci_sites s
cross join params p
left join public.chantierci_departements d on d.nom = s.departement
left join lateral (
  select v.date_visite, v.statut, v.postes, v.reponses, v.commentaire, v.avancement
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'moe'
  order by v.date_visite desc, v.created_at desc
  limit 1
) moe on true
left join lateral (
  select v.date_visite, v.statut, v.reponses, v.commentaire,
         v.avancement
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'ug'
  order by v.date_visite desc, v.created_at desc
  limit 1
) ug on true
left join lateral (
  select v.date_visite,
         v.avancement
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'moe'
    and ug.date_visite is not null
    and abs(v.date_visite - ug.date_visite) <= p.fenetre
  order by abs(v.date_visite - ug.date_visite), v.date_visite desc, v.created_at desc
  limit 1
) ref on true
left join lateral (
  select v.date_visite, v.statut, v.reponses, v.commentaire
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'cstc'
  order by v.date_visite desc, v.created_at desc
  limit 1
) cstc on true
-- Début de l'arrêt en cours : premier rapport « arrêté » après le dernier rapport d'un autre statut.
left join lateral (
  select min(v.date_visite) as depuis
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'moe' and v.statut = 'arrete'
    and v.date_visite > coalesce(
      (select max(w.date_visite) from public.chantierci_visites w
       where w.site_id = s.id and w.source = 'moe' and w.statut <> 'arrete'),
      '-infinity'::date)
) arret on true
left join lateral (
  select avg(ph.latitude) as latitude, avg(ph.longitude) as longitude
  from public.chantierci_photos ph
  join public.chantierci_visites v on v.id = ph.visite_id
  where v.site_id = s.id and ph.latitude is not null and ph.longitude is not null
) gps on true
where s.actif;

comment on view public.chantierci_v_etat_sites is
  'Une ligne par site actif : dernier rapport MOE (référence), dernière fiche UG et écart avec la visite MOE la plus proche, dernier signalement CSTC, position, montant DQE, début des travaux.';
grant select on public.chantierci_v_etat_sites to authenticated;
revoke all on public.chantierci_v_etat_sites from anon;

-- Avancement enregistré de tous les formulaires, recalculé avec les montants du DQE.
update public.chantierci_visites v
set avancement = chantierci_private.avancement_site(v.postes, s.electricite, s.type_latrines)
from public.chantierci_sites s
where s.id = v.site_id and v.source in ('moe', 'ug')
  and v.avancement is distinct from chantierci_private.avancement_site(v.postes, s.electricite, s.type_latrines);

-- Évolution de l'avancement global : sites pondérés par leur montant DQE
-- dans chaque lot ; global pondéré par le poids des lots.
create or replace function public.chantierci_evolution_avancement(p_lot_moe integer default null)
returns table (date_ref date, avancement numeric)
language sql stable set search_path = ''
as $$
  with bornes as (
    select min(v.date_visite) as debut from public.chantierci_visites v where v.source = 'moe'
  ),
  dates as (
    select (current_date - 7 * n)::date as date_ref
    from bornes, generate_series(0, least(52, greatest(0, (current_date - bornes.debut) / 7 + 1))) as n
    where bornes.debut is not null
  ),
  sites as (
    select s.id, s.lot_id, chantierci_private.montant_site(s.electricite, s.type_latrines) as montant
    from public.chantierci_sites s
    where s.actif and (p_lot_moe is null or s.lot_moe_id = p_lot_moe)
  ),
  rapports as (
    select v.site_id, st.lot_id, st.montant, v.date_visite, coalesce(v.avancement, 0) as av,
           lead(v.date_visite) over (partition by v.site_id order by v.date_visite, v.created_at) as suivant
    from public.chantierci_visites v
    join sites st on st.id = v.site_id
    where v.source = 'moe'
  ),
  sommes as (
    select d.date_ref, r.lot_id, sum(r.av * r.montant) as total
    from dates d
    join rapports r on r.date_visite <= d.date_ref and (r.suivant is null or r.suivant > d.date_ref)
    group by d.date_ref, r.lot_id
  ),
  lots as (
    select st.lot_id, sum(st.montant) as montant from sites st group by st.lot_id
  )
  select d.date_ref,
         round(sum(coalesce(so.total, 0) / nullif(l.montant, 0) * lo.poids) / nullif(sum(lo.poids), 0), 1)
  from dates d
  cross join lots l
  join public.chantierci_lots lo on lo.id = l.lot_id
  left join sommes so on so.date_ref = d.date_ref and so.lot_id = l.lot_id
  group by d.date_ref
  order by d.date_ref;
$$;
revoke all on function public.chantierci_evolution_avancement(integer) from public, anon;
grant execute on function public.chantierci_evolution_avancement(integer) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Positions : sites dont le nom diffère sur la cartographie PATEB v4
-- ----------------------------------------------------------------------------
update public.chantierci_sites s
set latitude = p.latitude, longitude = p.longitude
from (values
  ('L01-02', 9.477547, -3.17374),    -- EPP BOUKO 3 : « EPP BOUKO 2 » sur la carte
  ('L06-09', 8.405857, -4.608368),   -- EPP BOKALA 1 : un seul point « EPP BOKALA »
  ('L06-10', 8.405857, -4.608368),   -- EPP BOKALA 2 : idem
  ('L07-08', 8.5754, -5.207088),     -- EPP DE FOLOFONKAHA (2e classe, même école que L05-12)
  ('L08-14', 8.765324, -5.684324)    -- EPP 1A DE TORTIYA : point du groupe scolaire « 1B »
) as p (code, latitude, longitude)
where s.code = p.code and s.latitude is null and s.longitude is null;
