-- ============================================================================
-- TABLEAU DE BORD v2 — statut « ralenti » retiré, détail des difficultés,
-- évolution hebdomadaire de l'avancement
--
-- - Le statut « ralenti » n'est plus proposé : les visites existantes passent
--   « en cours » et une contrainte l'interdit (la valeur reste dans le type
--   énuméré, que Postgres ne permet pas de réduire simplement).
-- - Vue chantierci_v_etat_sites : + réponses et commentaires des dernières
--   visites MOE, UG et CSTC, + date de début de l'arrêt en cours.
-- - Fonction chantierci_evolution_avancement(lot_moe) : avancement global
--   pondéré, semaine par semaine (dernier rapport MOE connu à chaque date).
--
-- À exécuter APRÈS 20261126100000_tableau_de_bord.sql. Rejouable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Statut « ralenti » retiré
-- ----------------------------------------------------------------------------
alter table public.chantierci_visites drop constraint if exists chantierci_visites_sans_ralenti;
update public.chantierci_visites set statut = 'en_cours' where statut::text = 'ralenti';
alter table public.chantierci_visites
  add constraint chantierci_visites_sans_ralenti check (statut::text <> 'ralenti');

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
  cstc.statut as cstc_statut,
  -- Détail des dernières visites (onglet Difficultés)
  moe.reponses as moe_reponses,
  moe.commentaire as moe_commentaire,
  case when moe.statut = 'arrete' then arret.depuis end as moe_arrete_depuis,
  ug.reponses as ug_reponses,
  ug.commentaire as ug_commentaire,
  cstc.reponses as cstc_reponses,
  cstc.commentaire as cstc_commentaire
from public.chantierci_sites s
cross join params p
left join public.chantierci_departements d on d.nom = s.departement
left join lateral (
  select v.date_visite, v.statut, v.postes, v.reponses, v.commentaire
  from public.chantierci_visites v
  where v.site_id = s.id and v.source = 'moe'
  order by v.date_visite desc, v.created_at desc
  limit 1
) moe on true
left join lateral (
  select v.date_visite, v.statut, v.reponses, v.commentaire,
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
  'Une ligne par site actif : dernier rapport MOE (référence), dernière fiche UG et écart avec la visite MOE la plus proche, dernier signalement CSTC, position.';

grant select on public.chantierci_v_etat_sites to authenticated;
revoke all on public.chantierci_v_etat_sites from anon;

-- ----------------------------------------------------------------------------
-- Évolution de l'avancement global pondéré (une valeur par semaine, la
-- dernière à la date du jour). RLS appliquée : chacun ne voit que ses sites.
-- ----------------------------------------------------------------------------
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
    select s.id, s.lot_id, s.electricite, s.type_latrines
    from public.chantierci_sites s
    where s.actif and (p_lot_moe is null or s.lot_moe_id = p_lot_moe)
  ),
  etat as (
    select d.date_ref, st.lot_id,
      coalesce(chantierci_private.avancement_site(v.postes, st.electricite, st.type_latrines), 0) as av
    from dates d
    cross join sites st
    left join lateral (
      select v.postes from public.chantierci_visites v
      where v.site_id = st.id and v.source = 'moe' and v.date_visite <= d.date_ref
      order by v.date_visite desc, v.created_at desc
      limit 1
    ) v on true
  ),
  lots as (
    select e.date_ref, e.lot_id, avg(e.av) as av from etat e group by e.date_ref, e.lot_id
  )
  select l.date_ref, round(sum(l.av * lo.poids) / nullif(sum(lo.poids), 0), 1)
  from lots l
  join public.chantierci_lots lo on lo.id = l.lot_id
  group by l.date_ref
  order by l.date_ref;
$$;
comment on function public.chantierci_evolution_avancement(integer) is
  'Avancement global pondéré (source MOE) à chaque fin de semaine ; filtre facultatif par lot MOE.';
revoke all on function public.chantierci_evolution_avancement(integer) from public, anon;
grant execute on function public.chantierci_evolution_avancement(integer) to authenticated;
