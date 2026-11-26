-- ============================================================================
-- Migration 4/5 — Vues SQL (calculs financiers dérivés, CDC §3.3)
--
-- Toutes les vues sont déclarées WITH (security_invoker = true) : elles
-- s'exécutent avec les droits de l'appelant, donc la RLS des tables
-- sous-jacentes s'applique (sans cette option, une vue contournerait la RLS).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- chantierci_v_marches_financier — un marché + ses agrégats financiers :
--   montant_paye, avancement_financier_pct, reste_a_payer
-- Sert la vue "Marchés de travaux" (CDC §5.3).
-- ----------------------------------------------------------------------------
create view public.chantierci_v_marches_financier
with (security_invoker = true) as
select
  m.id,
  m.etablissement_id,
  e.nom as etablissement_nom,
  e.lot_id,
  e.province,
  e.departement,
  e.statut as statut_etablissement,
  m.nom_entreprise,
  m.numero_marche,
  m.montant_marche,
  m.date_demarrage,
  m.date_fin_estimative,
  coalesce(p.montant_paye, 0) as montant_paye,
  case
    when m.montant_marche > 0
      then round(coalesce(p.montant_paye, 0) / m.montant_marche * 100, 1)
    else 0
  end as avancement_financier_pct,
  m.montant_marche - coalesce(p.montant_paye, 0) as reste_a_payer,
  coalesce(p.nb_paiements, 0) as nb_paiements
from public.chantierci_marches_travaux m
join public.chantierci_etablissements e on e.id = m.etablissement_id
left join (
  select marche_id, sum(montant) as montant_paye, count(*) as nb_paiements
  from public.chantierci_paiements
  group by marche_id
) p on p.marche_id = m.id;

comment on view public.chantierci_v_marches_financier is 'Marchés avec montant payé, avancement financier (%) et reste à payer (XOF).';

-- ----------------------------------------------------------------------------
-- chantierci_v_dernieres_visites — la visite la plus récente de chaque
-- établissement (groupement par défaut du tableau de suivi, CDC §5.3).
-- ----------------------------------------------------------------------------
create view public.chantierci_v_dernieres_visites
with (security_invoker = true) as
select distinct on (v.etablissement_id) v.*
from public.chantierci_visites v
order by v.etablissement_id, v.date_visite desc, v.created_at desc;

comment on view public.chantierci_v_dernieres_visites is 'Dernière visite par établissement (date_visite puis created_at décroissants).';

-- ----------------------------------------------------------------------------
-- chantierci_v_etablissements_suivi — vue de synthèse pour le dashboard, la
-- carte et le tableau de suivi : établissement + lot + marché le plus récent
-- + agrégats financiers + dernière visite. Une ligne par établissement.
-- ----------------------------------------------------------------------------
create view public.chantierci_v_etablissements_suivi
with (security_invoker = true) as
select
  e.id,
  e.nom,
  e.nom_directeur,
  e.telephone,
  e.email,
  e.latitude,
  e.longitude,
  e.province,
  e.departement,
  e.village,
  e.statut,
  e.created_at,
  e.lot_id,
  l.nom as lot_nom,
  l.region as lot_region,
  m.id as marche_id,
  m.nom_entreprise,
  m.numero_marche,
  m.montant_marche,
  m.date_demarrage,
  m.date_fin_estimative,
  coalesce(pp.montant_paye, 0) as montant_paye,
  case
    when m.montant_marche > 0
      then round(coalesce(pp.montant_paye, 0) / m.montant_marche * 100, 1)
  end as avancement_financier_pct,
  case
    when m.id is not null
      then m.montant_marche - coalesce(pp.montant_paye, 0)
  end as reste_a_payer,
  dv.id as derniere_visite_id,
  dv.date_visite as derniere_visite_date,
  dv.nom_visiteur as derniere_visite_visiteur,
  dv.statut_chantier as dernier_statut_chantier,
  dv.avancement_reel_pct as dernier_avancement_reel_pct,
  coalesce(nv.nb_visites, 0) as nb_visites
from public.chantierci_etablissements e
left join public.chantierci_lots l on l.id = e.lot_id
left join lateral (
  select *
  from public.chantierci_marches_travaux mt
  where mt.etablissement_id = e.id
  order by mt.date_demarrage desc nulls last
  limit 1
) m on true
left join lateral (
  select sum(p.montant) as montant_paye
  from public.chantierci_paiements p
  where p.marche_id = m.id
) pp on true
left join lateral (
  select v.id, v.date_visite, v.nom_visiteur, v.statut_chantier, v.avancement_reel_pct
  from public.chantierci_visites v
  where v.etablissement_id = e.id
  order by v.date_visite desc, v.created_at desc
  limit 1
) dv on true
left join lateral (
  select count(*) as nb_visites
  from public.chantierci_visites v
  where v.etablissement_id = e.id
) nv on true;

comment on view public.chantierci_v_etablissements_suivi is 'Synthèse par établissement : lot, marché le plus récent, financier, dernière visite. Alimente dashboard / carte / tableau de suivi.';

-- Les vues ne sont accessibles qu'aux utilisateurs authentifiés
-- (la RLS sous-jacente fait ensuite le filtrage par rôle).
revoke all on public.chantierci_v_marches_financier from anon;
revoke all on public.chantierci_v_dernieres_visites from anon;
revoke all on public.chantierci_v_etablissements_suivi from anon;
