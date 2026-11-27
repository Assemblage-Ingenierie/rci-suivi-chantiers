-- ============================================================================
-- DONNÉES FICTIVES — visites de test sur les 387 sites (TEST UNIQUEMENT)
--
-- Génère, du 7 septembre 2026 à aujourd'hui :
--   - un rapport MOE par site et par semaine (quelques semaines manquées) ;
--   - un signalement CSTC par site et par semaine (assiduité variable) ;
--   - une fiche UG par site toutes les deux semaines (quelques oublis).
-- Chaque site a une date de démarrage et un rythme propres ; environ 8 % des
-- chantiers sont arrêtés, 4 % ne démarrent pas ; sur environ un site sur sept,
-- l'UG s'écarte de la MOE de 6 à 15 points (pour tester les écarts > 5 points).
--
-- Toutes les lignes portent donnees_test = true. Rejouable : les données
-- fictives existantes sont d'abord supprimées. Pour tout retirer :
--   delete from public.chantierci_visites where donnees_test;
--
-- Génération déterministe (même résultat à chaque exécution le même jour).
-- À exécuter dans le SQL Editor, APRÈS installation.sql (ou la migration
-- 20261125100000_formulaires.sql).
-- ============================================================================

do $$
begin
  if to_regclass('public.chantierci_visites') is null then
    raise exception 'Les formulaires ne sont pas installés : exécuter d''abord la migration 20261125100000_formulaires.sql.';
  end if;
end $$;

delete from public.chantierci_visites where donnees_test;

-- Nombre pseudo-aléatoire déterministe dans [0, 1[ à partir d'un texte.
create or replace function pg_temp.alea(t text) returns double precision
language sql immutable as $$
  select ((('x' || substr(md5(t), 1, 8))::bit(32)::int)::bigint + 4294967296) % 4294967296 / 4294967296.0
$$;

-- Avancement par poste (pas de 10 %) pour un avancement global p d'un
-- ouvrage : les postes se remplissent dans l'ordre du DQE.
create or replace function pg_temp.postes(p double precision, ouvrage text, elec boolean) returns jsonb
language sql stable as $$
  select coalesce(jsonb_object_agg(
           code,
           (round(least(greatest((p / 100.0 * total - cum_avant) / nullif(poids, 0), 0), 1) * 10) * 10)::int
         ), '{}'::jsonb)
  from (
    select code, poids,
           sum(poids) over (order by ordre) - poids as cum_avant,
           sum(poids) over () as total
    from public.chantierci_postes
    where chantierci_postes.ouvrage = $2 and (code <> 'electricite' or $3)
  ) x
$$;

create or replace function pg_temp.pct(postes jsonb, code text) returns double precision
language sql immutable as $$ select coalesce((postes ->> code)::double precision, 0) / 100 $$;

with sites as (
  select st.*,
    pg_temp.alea(st.code || 'jamais') < 0.04 as jamais,
    pg_temp.alea(st.code || 'arret') < 0.08 as stoppe,
    date '2026-07-20' + (pg_temp.alea(st.code || 'debut') * 80)::int as debut,
    (0.55 + pg_temp.alea(st.code || 'vitesse') * 0.75) * (0.8 + pg_temp.alea(st.lot_id::text || 'lot') * 0.4) as vitesse,
    -- UG proche de la MOE (±3 pts) sur 6 sites sur 7 ; écart de 6 à 15 pts sur les autres.
    case when pg_temp.alea(st.code || 'ecart-site') < 0.15
         then sign(pg_temp.alea(st.code || 'ecart-sens') - 0.5) * (6 + pg_temp.alea(st.code || 'ecart') * 9)
         else (pg_temp.alea(st.code || 'ecart') - 0.5) * 6 end as bruit_ug
  from public.chantierci_sites st
),
sites2 as (
  select s.*,
    case when jamais then date '2099-01-01' else debut end as debut_eff,
    debut + 20 + (pg_temp.alea(code || 'jarret') * 30)::int as date_arret
  from sites s
),
semaines as (
  select generate_series(date '2026-09-07', current_date, interval '7 days')::date as semaine
),
brutes as (
  select s.*, src.source, w.semaine,
    least(w.semaine + (pg_temp.alea(s.code || w.semaine::text || src.source) * 4)::int, current_date) as d
  from sites2 s
  cross join semaines w
  cross join (values ('moe'), ('cstc'), ('ug')) as src(source)
  -- Remplissage imparfait (pour tester le suivi) : la MOE oublie ~4 % des
  -- semaines (~15 % pour le lot MOE 3) ; l'assiduité des CSTC varie d'un
  -- site à l'autre (5 à 65 % de semaines manquées) ; l'UG oublie ~8 % des visites.
  where (src.source = 'moe'
         and pg_temp.alea(s.code || w.semaine::text || 'saut-moe') > case s.lot_moe_id when 3 then 0.15 else 0.04 end)
     or (src.source = 'cstc'
         and pg_temp.alea(s.code || w.semaine::text || 'saut') > 0.05 + 0.6 * power(pg_temp.alea(s.code || 'assiduite'), 3))
     or (src.source = 'ug' and ((w.semaine - date '2026-09-07') / 7) % 2 = 1
         and pg_temp.alea(s.code || w.semaine::text || 'saut-ug') > 0.08)
),
calc as (
  select b.*,
    least(100.0, greatest(0, least(b.d, case when b.stoppe then b.date_arret else b.d end) - b.debut_eff)
                 * b.vitesse / 150.0 * 100) as p_moe
  from brutes b
),
calc2 as (
  select c.*,
    case when c.source = 'ug' and c.p_moe > 0
         then least(100.0, greatest(0.0, c.p_moe + c.bruit_ug)) else c.p_moe end as p,
    case
      when c.d < c.debut_eff then 'non_demarre'
      when c.stoppe and c.d > c.date_arret then 'arrete'
      when c.p_moe >= 100 then 'termine'
      else 'en_cours'
    end as statut_base,
    -- Chantier lent (pas de statut dédié) : effectif insuffisant signalé.
    c.vitesse < 0.6 as lent,
    pg_temp.alea(c.code || c.d::text || c.source || 'r') as r
  from calc c
),
calc3 as (
  select c.*,
    -- Statut déclaré : la MOE déclare l'état réel ; le CSTC et l'UG divergent
    -- parfois (pour tester la règle « manquant seulement après un en cours ») :
    -- le CSTC voit la classe finie un peu avant la MOE, ou déclare « arrêté »
    -- les jours sans ouvriers ; l'UG déclare parfois « arrêté » un chantier lent.
    case
      when c.source = 'cstc' and c.statut_base = 'en_cours' and c.p >= 92 then 'termine'
      when c.source = 'cstc' and c.statut_base = 'en_cours'
           and (c.lent or pg_temp.alea(c.code || 'cstc-vue') < 0.08) and c.r < 0.5 then 'arrete'
      when c.source = 'ug' and c.statut_base = 'en_cours' and c.lent and c.r < 0.35 then 'arrete'
      else c.statut_base
    end as statut,
    greatest(0.0, c.p - 25) * 100 / 75 as p_lat,
    pg_temp.postes(c.p, 'classe', c.electricite) as pc,
    pg_temp.postes(greatest(0.0, c.p - 25) * 100 / 75, 'latrines_' || c.type_latrines::text, c.electricite) as pl
  from calc2 c
)
insert into public.chantierci_visites
  (site_id, source, date_visite, auteur_id, auteur_nom, statut, postes, reponses, commentaire,
   donnees_test, created_at, updated_at)
select
  c.id,
  c.source::public.chantierci_source_formulaire,
  c.d,
  null,
  case c.source
    when 'moe' then 'Contrôleur MOE ' || c.lot_moe_id || ' (fictif)'
    when 'cstc' then 'CSTC ' || c.code || ' (fictif)'
    else 'Mission UG (fictif)'
  end,
  c.statut::public.chantierci_statut_chantier,
  case when c.source = 'cstc' then '{}'::jsonb else jsonb_build_object('classe', c.pc, 'latrines', c.pl) end,
  case c.source
    when 'cstc' then jsonb_build_object(
      'ouvriers_presents', case when c.statut = 'en_cours' and c.r < 0.9 then 'oui'
                                else 'non' end,
      'securite', jsonb_build_object(
        'separe_cour', case when c.r < 0.88 then 'oui' else 'non' end,
        'dangers', case when c.r > 0.97 and c.p > 0 then 'oui' else 'non' end,
        'epi', case when c.r < 0.75 then 'oui' else 'non' end),
      'problemes_batiment', case when c.p > 40 and c.r > 0.92 then '["fissure"]'::jsonb
                                 when c.p > 70 and c.r > 0.88 then '["toit"]'::jsonb
                                 else '["aucun"]'::jsonb end,
      'latrines', case when c.p_lat = 0 then 'pas_commencees' when c.p_lat < 100 then 'en_cours' else 'terminees' end,
      'tensions', case when c.statut_base = 'arrete' then '["entreprise"]'::jsonb
                       when c.r > 0.98 then '["village"]'::jsonb else '["aucune"]'::jsonb end,
      'mobilier', case when c.p >= 100 and c.r < 0.5 then 'oui_tout' when c.p >= 100 then 'en_partie' else 'pas_encore' end)
    when 'moe' then jsonb_build_object(
      'retard_semaines', case when c.statut = 'arrete' or (c.lent and c.statut = 'en_cours') then 2 + (c.r * 5)::int
                              when c.vitesse < 0.85 then 1 else 0 end,
      -- Qualité : conforme / non conforme au CCTP (élément pas encore réalisé : sans réponse).
      'qualite', jsonb_strip_nulls(jsonb_build_object(
        'implantation', case when c.p > 3 then 'conforme' end,
        'beton_fondation', case when c.p < 15 then null when c.r > 0.95 then 'non_conforme' else 'conforme' end,
        'ferraillage', case when c.p < 25 then null when c.r < 0.04 then 'non_conforme' else 'conforme' end,
        'maconnerie', case when c.p < 30 then null when c.r > 0.93 then 'non_conforme' else 'conforme' end,
        'charpente', case when c.p >= 55 then 'conforme' end,
        'latrines', case when c.p_lat < 10 then null when c.r < 0.03 then 'non_conforme' else 'conforme' end)),
      -- Observation obligatoire dès qu'un élément est non conforme.
      'qualite_observations', case
        when (c.p >= 15 and c.r > 0.93) or (c.p >= 25 and c.r < 0.04) or (c.p_lat >= 10 and c.r < 0.03)
        then 'Non conforme au CCTP : enrobage insuffisant des aciers, aplomb des murs à reprendre. Reprise demandée avant la suite des travaux.'
        else '' end,
      'securite', jsonb_build_object(
        'panneau', case when c.r < 0.92 then 'oui' else 'non' end,
        'zone_balisee', case when c.r < 0.9 then 'oui' else 'non' end,
        'epi', case when c.r < 0.78 then 'oui' else 'non' end,
        'stockage', case when c.r < 0.86 then 'oui' else 'non' end),
      'ouvriers', case when c.statut <> 'en_cours' then 0 when c.lent then 1 + (c.r * 3)::int else 4 + (c.r * 8)::int end,
      'ouvriers_qualifies', case when c.statut <> 'en_cours' then 0 when c.lent then (c.r * 2)::int else 1 + (c.r * 3)::int end,
      'chef_chantier', case when c.statut = 'en_cours' and c.r < 0.8 then 'oui' else 'non' end,
      'problemes', case when c.statut = 'arrete' then case when c.r < 0.5 then '["paiement"]'::jsonb else '["approvisionnement"]'::jsonb end
                        when c.lent and c.statut = 'en_cours' then '["effectif"]'::jsonb
                        when c.statut = 'en_cours' and c.r > 0.96 then '["intemperies"]'::jsonb
                        else '["aucun"]'::jsonb end)
    else jsonb_build_object(
      -- Suivi environnemental et social (« oui » = mesure respectée).
      'es', jsonb_build_object(
        'dechets', case when c.r < 0.85 then 'oui' else 'non' end,
        'drainage', case when c.r < 0.92 then 'oui' else 'non' end,
        'nuisances', case when c.r < 0.9 then 'oui' else 'non' end,
        'hygiene', case when c.r < 0.8 then 'oui' else 'non' end,
        'emploi_local', case when c.r < 0.95 then 'oui' else 'non' end,
        'pas_enfants', case when c.r < 0.995 then 'oui' else 'non' end,
        'code_conduite', case when c.r < 0.75 then 'oui' else 'non' end,
        'mecanisme_plaintes', case when c.r < 0.7 then 'oui' else 'non' end),
      'plaintes', case when c.r > 0.97 then 'oui' else 'non' end,
      'es_observations', case when c.r >= 0.7
        then 'Code de conduite non affiché et mécanisme de plaintes à présenter au COGES. Rappel fait à l''entreprise.'
        else '' end,
      'difficultes', case when c.statut = 'arrete' then '["entreprise_absente"]'::jsonb
                          when c.lent and c.statut = 'en_cours' then '["materiaux_manquants"]'::jsonb
                          when c.r > 0.96 and c.p > 0 then '["stockage_non_protege"]'::jsonb
                          else '["aucune"]'::jsonb end)
  end,
  case
    when c.statut = 'arrete' then 'Aucun ouvrier sur site depuis la dernière visite. Chef de chantier injoignable.'
    when c.lent and c.statut = 'en_cours' and c.source = 'moe' then 'Effectif réduit. Entreprise relancée pour renforcer l''équipe.'
    else ''
  end,
  true,
  c.d + time '08:00' + make_interval(mins => (c.r * 540)::int),
  c.d + time '08:00' + make_interval(mins => (c.r * 540)::int)
from calc3 c;

-- Commentaires fictifs de l'UG (si la migration du tableau de bord est installée) :
-- sur les chantiers arrêtés, lents (effectif insuffisant) ou en écart MOE / UG.
do $$
begin
  if to_regclass('public.chantierci_commentaires') is null then
    raise notice 'Commentaires fictifs ignorés : migration 20261126100000_tableau_de_bord.sql non installée.';
    return;
  end if;
  execute $c$
    delete from public.chantierci_commentaires where donnees_test;
    insert into public.chantierci_commentaires (site_id, auteur_nom, texte, donnees_test, created_at, updated_at)
    select e.id, 'Mission UG (fictif)',
      case
        when e.moe_statut = 'arrete' then 'Chantier à l''arrêt constaté. Point à faire avec l''entreprise et la MOE au prochain comité.'
        when e.discordance then 'Écart avec le rapport MOE : avancement à vérifier lors de la prochaine visite conjointe.'
        when lent.oui then 'Rythme insuffisant. Demander un planning de rattrapage à l''entreprise.'
        else 'RAS. Bonne tenue du chantier, propreté correcte.'
      end,
      true,
      e.ug_date + time '17:30', e.ug_date + time '17:30'
    from public.chantierci_v_etat_sites e
    cross join lateral (
      select exists (select 1 from public.chantierci_visites v
                     where v.site_id = e.id and v.source = 'moe' and v.date_visite = e.moe_date
                       and v.reponses -> 'problemes' ? 'effectif') as oui
    ) lent
    where e.ug_date is not null
      and (e.moe_statut = 'arrete' or lent.oui or e.discordance or pg_temp.alea(e.code || 'com') < 0.05)
  $c$;
end $$;

-- Contrôle : nombre de visites fictives par type.
select source, count(*) as visites, min(date_visite) as du, max(date_visite) as au
from public.chantierci_visites
where donnees_test
group by source
order by source;
