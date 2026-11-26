-- ============================================================================
-- SUIVI DU REMPLISSAGE DES FORMULAIRES
--
-- Fonction chantierci_remplissage(semaines) : pour chaque site, nombre de
-- formulaires MOE, CSTC et UG reçus chacune des N dernières semaines
-- calendaires (du lundi au dimanche ; la dernière est la semaine en cours),
-- de la plus ancienne à la plus récente, et date du dernier formulaire de
-- chaque type. date_ref = lundi de la semaine en cours.
-- RLS appliquée : chacun ne compte que les formulaires qu'il peut lire.
--
-- À exécuter APRÈS 20261127100000_tableau_de_bord_v2.sql. Rejouable.
-- ============================================================================

create or replace function public.chantierci_remplissage(p_semaines integer default 8)
returns table (
  site_id uuid,
  date_ref date,          -- lundi de la semaine en cours
  moe integer[],
  cstc integer[],
  ug integer[],
  moe_dernier date,
  cstc_dernier date,
  ug_dernier date
)
language sql stable set search_path = ''
as $$
  with n as (
    select least(greatest(coalesce(p_semaines, 8), 1), 26) as nb,
           date_trunc('week', current_date)::date as lundi
  ),
  semaines as (
    select generate_series(0, (select nb from n) - 1) as k        -- 0 = semaine en cours
  ),
  sites as (
    select s.id from public.chantierci_sites s where s.actif
  ),
  comptes as (
    select v.site_id, v.source,
           ((select lundi from n) - date_trunc('week', v.date_visite)::date) / 7 as k,
           count(*)::int as nb
    from public.chantierci_visites v
    where v.date_visite >= (select lundi from n) - 7 * ((select nb from n) - 1)
      and v.date_visite < (select lundi from n) + 7
    group by 1, 2, 3
  ),
  grille as (
    select s.id as site_id, src.source, w.k, coalesce(c.nb, 0) as nb
    from sites s
    cross join semaines w
    cross join (values ('moe'::public.chantierci_source_formulaire),
                       ('cstc'::public.chantierci_source_formulaire),
                       ('ug'::public.chantierci_source_formulaire)) as src(source)
    left join comptes c on c.site_id = s.id and c.source = src.source and c.k = w.k
  ),
  derniers as (
    select v.site_id,
      max(v.date_visite) filter (where v.source = 'moe') as moe,
      max(v.date_visite) filter (where v.source = 'cstc') as cstc,
      max(v.date_visite) filter (where v.source = 'ug') as ug
    from public.chantierci_visites v
    group by v.site_id
  )
  select
    g.site_id,
    (select lundi from n),
    array_agg(g.nb order by g.k desc) filter (where g.source = 'moe'),
    array_agg(g.nb order by g.k desc) filter (where g.source = 'cstc'),
    array_agg(g.nb order by g.k desc) filter (where g.source = 'ug'),
    d.moe,
    d.cstc,
    d.ug
  from grille g
  left join derniers d on d.site_id = g.site_id
  group by g.site_id, d.moe, d.cstc, d.ug;
$$;

comment on function public.chantierci_remplissage(integer) is
  'Formulaires reçus par site, type et semaine calendaire (N dernières semaines, la dernière en cours), et date du dernier formulaire de chaque type.';
revoke all on function public.chantierci_remplissage(integer) from public, anon;
grant execute on function public.chantierci_remplissage(integer) to authenticated;
