import { exigerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chargerReferentielCalcul } from "@/lib/formulaires/chargement";
import { dateLongue } from "@/lib/tableau-de-bord/calculs";
import {
  alertesSite,
  COLONNES_ALERTES,
  FAMILLES,
  parametresAlertes,
  REGLES,
  type FamilleAlerte,
} from "@/lib/alertes/regles";
import { ListeAlertes, type RegleAffichee, type SiteAlertes } from "@/components/alertes/ListeAlertes";
import { EnPreparation } from "@/components/EnPreparation";
import { MARQUE } from "@/theme/marque";

export const metadata = { title: `Alertes — ${MARQUE.titreNavigateur}` };

const entier = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : null);

/** Alertes par site (UG, admin) : sites les plus en alerte en haut, règles affichées. */
export default async function PageAlertes({
  searchParams,
}: {
  searchParams: { famille?: string; lot_moe?: string; lot?: string };
}) {
  await exigerRole(["ug", "admin"]);
  const supabase = createClient();
  const [{ data: sites, error }, { data: lots }, { data: lotsMoe }, { parametres }] = await Promise.all([
    supabase.from("chantierci_v_etat_sites").select(COLONNES_ALERTES).order("code").range(0, 999),
    supabase.from("chantierci_lots").select("id, nom, entreprise:chantierci_entreprises(nom)").order("id"),
    supabase.from("chantierci_lots_moe").select("id, nom, regions").order("id"),
    chargerReferentielCalcul(supabase),
  ]);
  const p = parametresAlertes(parametres);
  const aujourdhui = new Date();
  // Alertes calculées ici : le navigateur ne reçoit que leur texte.
  const sitesAlertes: SiteAlertes[] = (sites ?? []).map((s) => ({
    id: s.id,
    code: s.code,
    nom: s.nom,
    localite: s.localite,
    lot_id: s.lot_id,
    lot_moe_id: s.lot_moe_id,
    avancement: s.moe_avancement === null ? null : Number(s.moe_avancement),
    alertes: alertesSite(s, p, aujourdhui),
  }));
  const regles: RegleAffichee[] = REGLES.map((r) => ({
    id: r.id,
    famille: r.famille,
    source: r.source,
    niveaux: r.niveaux,
    description: r.description(p),
  }));
  const famille = FAMILLES.some((f) => f.cle === searchParams.famille) ? (searchParams.famille as FamilleAlerte) : null;

  return (
    <div className="mx-auto max-w-[1500px] p-4 lg:p-6">
      <div className="mb-3">
        <h1 className="text-2xl font-bold">Alertes</h1>
        <p className="text-sm text-texte-2">
          Situation au {dateLongue(aujourdhui.toISOString().slice(0, 10))}, d&apos;après les formulaires MOE, CSTC et UG de moins de{" "}
          {p.fraicheurJours} jours. Les sites les plus en alerte sont en haut.
        </p>
      </div>
      {error ? (
        <EnPreparation titre="Les alertes ne sont pas encore installées dans la base">
          Exécuter dans le SQL Editor de Supabase la migration <code>supabase/migrations/20261202100000_dqe_alertes.sql</code>.
        </EnPreparation>
      ) : (
        <ListeAlertes
          sites={sitesAlertes}
          lots={(lots ?? []).map((l) => ({ id: l.id, nom: l.nom, entreprise: l.entreprise?.nom ?? "" }))}
          lotsMoe={lotsMoe ?? []}
          regles={regles}
          fraicheurJours={p.fraicheurJours}
          initial={{ famille, lotMoe: entier(searchParams.lot_moe), lot: entier(searchParams.lot) }}
        />
      )}
    </div>
  );
}
