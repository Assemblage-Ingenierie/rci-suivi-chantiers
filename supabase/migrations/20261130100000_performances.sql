-- ============================================================================
-- PERFORMANCES — tableau de bord, suivi et difficultés plus rapides
--
-- 1. Avancement enregistré dans chaque formulaire (colonne avancement) : il
--    était recalculé à chaque affichage (≈ 20 000 calculs pour la courbe
--    d'évolution, 3 par site pour la vue). Il est désormais calculé à
--    l'enregistrement du formulaire, et recalculé si l'électricité ou le
--    type de latrines du site change.
-- 2. Vue chantierci_v_etat_sites : lit l'avancement enregistré (mêmes
--    colonnes qu'avant).
-- 3. chantierci_evolution_avancement : une seule passe sur les rapports MOE
--    (chaque rapport est valable jusqu'au rapport suivant) au lieu d'une
--    recherche par site et par semaine. Mêmes résultats.
-- 4. chantierci_remplissage : statut déclaré avant chaque semaine obtenu de
--    la même façon, sans sous-requête par site, semaine et acteur. Mêmes
--    résultats.
--
-- À exécuter APRÈS 20261129100000_suivi_attendu.sql. Rejouable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Avancement enregistré
-- ----------------------------------------------------------------------------
alter table public.chantierci_visites add column if not exists avancement numeric;
comment on column public.chantierci_visites.avancement is
  'Avancement (%) calculé à partir des postes et du site (MOE, UG) ; tenu à jour par la base, ne pas saisir.';

-- Calcul à chaque enregistrement : la valeur envoyée par le client est ignorée.
create or replace function chantierci_private.visites_calcul_avancement()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.source in ('moe', 'ug') then
    select chantierci_private.avancement_site(new.postes, s.electricite, s.type_latrines)
      into new.avancement
    from public.chantierci_sites s where s.id = new.site_id;
  else
    new.avancement := null;
  end if;
  return new;
end;
$$;
revoke all on function chantierci_private.visites_calcul_avancement() from public;

drop trigger if exists chantierci_visites_calcul_avancement on public.chantierci_visites;
create trigger chantierci_visites_calcul_avancement
  before insert or update on public.chantierci_visites
  for each row execute function chantierci_private.visites_calcul_avancement();

-- Un recalcul de l'avancement seul n'est pas une modification du formulaire :
-- ni date de modification, ni « modifié par » (même fonction qu'avant sinon).
create or replace function chantierci_private.visites_avant_modification()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (to_jsonb(new) - 'avancement') = (to_jsonb(old) - 'avancement') then
    return new;
  end if;
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

-- Recalcul des formulaires d'un site quand ses caractéristiques changent.
create or replace function chantierci_private.sites_recalcul_avancement()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.chantierci_visites v
  set avancement = chantierci_private.avancement_site(v.postes, new.electricite, new.type_latrines)
  where v.site_id = new.id and v.source in ('moe', 'ug');
  return null;
end;
$$;
revoke all on function chantierci_private.sites_recalcul_avancement() from public;

drop trigger if exists chantierci_sites_recalcul_avancement on public.chantierci_sites;
create trigger chantierci_sites_recalcul_avancement
  after update of electricite, type_latrines on public.chantierci_sites
  for each row
  when (old.electricite is distinct from new.electricite or old.type_latrines is distinct from new.type_latrines)
  execute function chantierci_private.sites_recalcul_avancement();

-- Formulaires existants.
update public.chantierci_visites v
set avancement = case when v.source in ('moe', 'ug')
                      then chantierci_private.avancement_site(v.postes, s.electricite, s.type_latrines) end
from public.chantierci_sites s
where s.id = v.site_id
  and v.avancement is distinct from case when v.source in ('moe', 'ug')
                      then chantierci_private.avancement_site(v.postes, s.electricite, s.type_latrines) end;

-- ----------------------------------------------------------------------------
-- 2. Vue : état de chaque site (avancement enregistré)
-- ----------------------------------------------------------------------------
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
  cstc.commentaire as cstc_commentaire
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
  'Une ligne par site actif : dernier rapport MOE (référence), dernière fiche UG et écart avec la visite MOE la plus proche, dernier signalement CSTC, position.';
grant select on public.chantierci_v_etat_sites to authenticated;
revoke all on public.chantierci_v_etat_sites from anon;

-- ----------------------------------------------------------------------------
-- 3. Évolution de l'avancement global, semaine par semaine
--    À chaque date, chaque site vaut l'avancement de son dernier rapport MOE
--    (0 % sans rapport) ; lot = moyenne de ses sites ; global = pondéré par
--    le poids des lots.
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
    select s.id, s.lot_id
    from public.chantierci_sites s
    where s.actif and (p_lot_moe is null or s.lot_moe_id = p_lot_moe)
  ),
  -- Chaque rapport MOE est valable de sa date jusqu'au rapport suivant du site.
  rapports as (
    select v.site_id, st.lot_id, v.date_visite, coalesce(v.avancement, 0) as av,
           lead(v.date_visite) over (partition by v.site_id order by v.date_visite, v.created_at) as suivant
    from public.chantierci_visites v
    join sites st on st.id = v.site_id
    where v.source = 'moe'
  ),
  sommes as (
    select d.date_ref, r.lot_id, sum(r.av) as total
    from dates d
    join rapports r on r.date_visite <= d.date_ref and (r.suivant is null or r.suivant > d.date_ref)
    group by d.date_ref, r.lot_id
  ),
  lots as (
    select st.lot_id, count(*) as nb_sites from sites st group by st.lot_id
  )
  select d.date_ref,
         round(sum(coalesce(so.total, 0) / l.nb_sites * lo.poids) / nullif(sum(lo.poids), 0), 1)
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
-- 4. Remplissage des formulaires (même résultat que 20261129100000)
-- ----------------------------------------------------------------------------
create or replace function public.chantierci_remplissage(p_semaines integer default 8)
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
    select k, (select lundi from n) - 7 * k as lundi
    from generate_series(0, (select nb from n) - 1) as k        -- 0 = semaine en cours
  ),
  sources as (
    select unnest(array['moe', 'cstc', 'ug']::public.chantierci_source_formulaire[]) as source
  ),
  sites as (
    select s.id from public.chantierci_sites s where s.actif
  ),
  -- Formulaires de chaque acteur, avec la date de son formulaire suivant.
  historique as (
    select v.site_id, v.source, v.date_visite, v.statut::text as statut,
           lead(v.date_visite) over (partition by v.site_id, v.source order by v.date_visite, v.created_at) as suivant,
           row_number() over (partition by v.site_id, v.source order by v.date_visite desc, v.created_at desc) as rang
    from public.chantierci_visites v
  ),
  -- Statut déclaré dans le dernier formulaire reçu avant le lundi de chaque semaine.
  avant as (
    select h.site_id, h.source, w.k, h.statut
    from semaines w
    join historique h on h.date_visite < w.lundi and (h.suivant is null or h.suivant >= w.lundi)
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
    select s.id as site_id, src.source, w.k, coalesce(c.nb, 0) as nb, a.statut as statut_avant
    from sites s
    cross join semaines w
    cross join sources src
    left join comptes c on c.site_id = s.id and c.source = src.source and c.k = w.k
    left join avant a on a.site_id = s.id and a.source = src.source and a.k = w.k
  ),
  derniers as (
    select h.site_id, h.source, h.date_visite, h.statut from historique h where h.rang = 1
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
