-- ============================================================================
-- Migration — évolutions v2
--   1. Archivage des établissements et des visites (au lieu de suppression)
--   2. Statut de l'établissement dérivé de la dernière visite (trigger)
--   3. Rôle MEN viewer : lecture identique au national, aucune écriture
--   4. Édition des marchés et des paiements ouverte au national (pas que admin)
--   5. Vues : exposition de la colonne `archive`, exclusion des visites
--      archivées des agrégats (dernière visite, nb visites)
--
-- À exécuter APRÈS 20260612100800_role_men_viewer.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Colonnes d'archivage
-- ----------------------------------------------------------------------------
alter table public.chantierci_etablissements
  add column if not exists archive boolean not null default false;

alter table public.chantierci_visites
  add column if not exists archive boolean not null default false;

create index if not exists idx_chantierci_etablissements_archive
  on public.chantierci_etablissements (archive);
create index if not exists idx_chantierci_visites_archive
  on public.chantierci_visites (archive);

-- ----------------------------------------------------------------------------
-- 2. Statut de l'établissement = statut de la dernière visite non archivée
-- ----------------------------------------------------------------------------
create or replace function chantierci_private.maj_statut_etablissement(p_etab uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.chantierci_etablissements e
  set statut = coalesce(
    (
      select v.statut_chantier
      from public.chantierci_visites v
      where v.etablissement_id = p_etab
        and v.archive = false
      order by v.date_visite desc, v.created_at desc
      limit 1
    ),
    'non_demarre'::public.chantierci_statut_chantier
  )
  where e.id = p_etab;
$$;

revoke all on function chantierci_private.maj_statut_etablissement(uuid) from public;

create or replace function chantierci_private.trg_visite_statut()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'DELETE') then
    perform chantierci_private.maj_statut_etablissement(old.etablissement_id);
    return old;
  end if;
  perform chantierci_private.maj_statut_etablissement(new.etablissement_id);
  if (tg_op = 'UPDATE' and old.etablissement_id is distinct from new.etablissement_id) then
    perform chantierci_private.maj_statut_etablissement(old.etablissement_id);
  end if;
  return new;
end;
$$;

drop trigger if exists chantierci_visite_maj_statut on public.chantierci_visites;
create trigger chantierci_visite_maj_statut
  after insert or update or delete on public.chantierci_visites
  for each row
  execute function chantierci_private.trg_visite_statut();

-- Backfill : aligne le statut courant sur la dernière visite (établissements
-- qui ont au moins une visite non archivée).
update public.chantierci_etablissements e
set statut = sub.statut_chantier
from (
  select distinct on (v.etablissement_id)
    v.etablissement_id, v.statut_chantier
  from public.chantierci_visites v
  where v.archive = false
  order by v.etablissement_id, v.date_visite desc, v.created_at desc
) sub
where sub.etablissement_id = e.id;

-- ----------------------------------------------------------------------------
-- 3. Fonctions d'aide RLS : le rôle men_viewer voit comme le national
-- ----------------------------------------------------------------------------
create or replace function chantierci_private.accessible_lot_ids()
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.chantierci_user_role := chantierci_private.user_role();
begin
  if v_role in ('admin', 'national', 'men_viewer') then
    return coalesce((select array_agg(id) from public.chantierci_lots), '{}'::uuid[]);
  elsif v_role = 'regional' then
    return coalesce(
      (select array_agg(l.id)
       from public.chantierci_lots l
       where l.region in (
         select region from public.chantierci_lots
         where id = any(chantierci_private.user_lot_ids())
       )),
      '{}'::uuid[]
    );
  elsif v_role = 'coges' then
    return chantierci_private.user_lot_ids();
  else
    return '{}'::uuid[];
  end if;
end;
$$;

create or replace function chantierci_private.accessible_etablissement_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from public.chantierci_etablissements
  where lot_id = any(chantierci_private.accessible_lot_ids())
     or chantierci_private.user_role() in ('admin', 'national', 'men_viewer');
$$;

-- ----------------------------------------------------------------------------
-- 4. Politiques RLS — lecture men_viewer + écritures marché/paiement national
-- ----------------------------------------------------------------------------

-- Établissements : lecture globale pour admin / national / men_viewer.
drop policy if exists "chantierci_etablissements_select_perimetre" on public.chantierci_etablissements;
create policy "chantierci_etablissements_select_perimetre"
  on public.chantierci_etablissements for select to authenticated
  using (
    (select chantierci_private.user_role()) in ('admin', 'national', 'men_viewer')
    or lot_id in (select unnest(chantierci_private.accessible_lot_ids()))
  );

-- Commentaires : lecture pour national / admin / men_viewer (+ auteur + régional).
drop policy if exists "chantierci_commentaires_select_men_admin_regional" on public.chantierci_commentaires;
create policy "chantierci_commentaires_select_men_admin_regional"
  on public.chantierci_commentaires for select to authenticated
  using (
    (select chantierci_private.user_role()) in ('national', 'admin', 'men_viewer')
    or user_id = (select auth.uid())
    or (
      (select chantierci_private.user_role()) = 'regional'
      and etablissement_id in (select chantierci_private.accessible_etablissement_ids())
    )
  );

-- Marchés : insertion / modification ouvertes au national + admin (CDC §5.3).
drop policy if exists "chantierci_marches_insert_admin" on public.chantierci_marches_travaux;
drop policy if exists "chantierci_marches_update_admin" on public.chantierci_marches_travaux;
drop policy if exists "chantierci_marches_insert_national_admin" on public.chantierci_marches_travaux;
drop policy if exists "chantierci_marches_update_national_admin" on public.chantierci_marches_travaux;

create policy "chantierci_marches_insert_national_admin"
  on public.chantierci_marches_travaux for insert to authenticated
  with check ((select chantierci_private.user_role()) in ('national', 'admin'));

create policy "chantierci_marches_update_national_admin"
  on public.chantierci_marches_travaux for update to authenticated
  using ((select chantierci_private.user_role()) in ('national', 'admin'))
  with check ((select chantierci_private.user_role()) in ('national', 'admin'));

-- Paiements : modification / suppression ouvertes au national + admin.
-- (consolide les anciennes politiques admin-only et l'ajout 100700)
drop policy if exists "chantierci_paiements_update_admin" on public.chantierci_paiements;
drop policy if exists "chantierci_paiements_delete_admin" on public.chantierci_paiements;
drop policy if exists "chantierci_paiements_update" on public.chantierci_paiements;
drop policy if exists "chantierci_paiements_delete" on public.chantierci_paiements;

create policy "chantierci_paiements_update_national_admin"
  on public.chantierci_paiements for update to authenticated
  using ((select chantierci_private.user_role()) in ('national', 'admin'))
  with check ((select chantierci_private.user_role()) in ('national', 'admin'));

create policy "chantierci_paiements_delete_national_admin"
  on public.chantierci_paiements for delete to authenticated
  using ((select chantierci_private.user_role()) in ('national', 'admin'));

-- Nettoyage : politique de visite redondante éventuellement créée en 100700
-- (la mise à jour par l'auteur est déjà couverte par
-- chantierci_visites_update_auteur_admin).
drop policy if exists "chantierci_visites_update_propre" on public.chantierci_visites;

-- ----------------------------------------------------------------------------
-- 5. Vues — exposition de `archive`, exclusion des visites archivées
-- ----------------------------------------------------------------------------
create or replace view public.chantierci_v_etablissements_suivi
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
  coalesce(nv.nb_visites, 0) as nb_visites,
  e.archive
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
    and v.archive = false
  order by v.date_visite desc, v.created_at desc
  limit 1
) dv on true
left join lateral (
  select count(*) as nb_visites
  from public.chantierci_visites v
  where v.etablissement_id = e.id
    and v.archive = false
) nv on true;

create or replace view public.chantierci_v_marches_financier
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
  coalesce(p.nb_paiements, 0) as nb_paiements,
  e.archive as etablissement_archive
from public.chantierci_marches_travaux m
join public.chantierci_etablissements e on e.id = m.etablissement_id
left join (
  select marche_id, sum(montant) as montant_paye, count(*) as nb_paiements
  from public.chantierci_paiements
  group by marche_id
) p on p.marche_id = m.id;
