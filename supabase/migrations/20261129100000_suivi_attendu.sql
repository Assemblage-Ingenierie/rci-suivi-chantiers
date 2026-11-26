-- ============================================================================
-- SUIVI DU REMPLISSAGE — formulaire attendu selon la déclaration de l'acteur
--
-- Un formulaire n'est « attendu » (donc « manquant » s'il n'arrive pas) que si
-- le même acteur (MOE, CSTC ou UG) a indiqué « en cours » dans son dernier
-- formulaire. La fonction chantierci_remplissage renvoie donc en plus, pour
-- chaque type de formulaire :
--   - <type>_statuts : statut du dernier formulaire reçu AVANT le lundi de
--     chaque semaine (même ordre que les comptes : de la plus ancienne à la
--     semaine en cours ; null si aucun formulaire antérieur) ;
--   - <type>_dernier_statut : statut du dernier formulaire reçu.
--
-- Remplace la fonction de 20261128100000_suivi_remplissage.sql (le type de
-- retour change : suppression puis recréation). Rejouable.
-- ============================================================================

drop function if exists public.chantierci_remplissage(integer);

create function public.chantierci_remplissage(p_semaines integer default 8)
returns table (
  site_id uuid,
  date_ref date,          -- lundi de la semaine en cours
  moe integer[],
  cstc integer[],
  ug integer[],
  moe_dernier date,
  cstc_dernier date,
  ug_dernier date,
  moe_statuts text[],
  cstc_statuts text[],
  ug_statuts text[],
  moe_dernier_statut text,
  cstc_dernier_statut text,
  ug_dernier_statut text
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
  sources as (
    select unnest(array['moe', 'cstc', 'ug']::public.chantierci_source_formulaire[]) as source
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
    select s.id as site_id, src.source, w.k, coalesce(c.nb, 0) as nb,
      -- Statut déclaré par cet acteur dans son dernier formulaire avant la semaine.
      (select v.statut::text
       from public.chantierci_visites v
       where v.site_id = s.id and v.source = src.source
         and v.date_visite < (select lundi from n) - 7 * w.k
       order by v.date_visite desc, v.created_at desc
       limit 1) as statut_avant
    from sites s
    cross join semaines w
    cross join sources src
    left join comptes c on c.site_id = s.id and c.source = src.source and c.k = w.k
  ),
  derniers as (
    select distinct on (v.site_id, v.source) v.site_id, v.source, v.date_visite, v.statut::text as statut
    from public.chantierci_visites v
    order by v.site_id, v.source, v.date_visite desc, v.created_at desc
  )
  select
    g.site_id,
    (select lundi from n),
    array_agg(g.nb order by g.k desc) filter (where g.source = 'moe'),
    array_agg(g.nb order by g.k desc) filter (where g.source = 'cstc'),
    array_agg(g.nb order by g.k desc) filter (where g.source = 'ug'),
    max(d.date_visite) filter (where d.source = 'moe'),
    max(d.date_visite) filter (where d.source = 'cstc'),
    max(d.date_visite) filter (where d.source = 'ug'),
    array_agg(g.statut_avant order by g.k desc) filter (where g.source = 'moe'),
    array_agg(g.statut_avant order by g.k desc) filter (where g.source = 'cstc'),
    array_agg(g.statut_avant order by g.k desc) filter (where g.source = 'ug'),
    max(d.statut) filter (where d.source = 'moe'),
    max(d.statut) filter (where d.source = 'cstc'),
    max(d.statut) filter (where d.source = 'ug')
  from grille g
  left join derniers d on d.site_id = g.site_id and d.source = g.source
  group by g.site_id;
$$;

comment on function public.chantierci_remplissage(integer) is
  'Formulaires reçus par site, type et semaine calendaire (N dernières semaines), statut déclaré par chaque acteur avant chaque semaine, et dernier formulaire de chaque type.';
revoke all on function public.chantierci_remplissage(integer) from public, anon;
grant execute on function public.chantierci_remplissage(integer) to authenticated;
