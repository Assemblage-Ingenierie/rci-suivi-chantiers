import { exigerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chargerReferentielCalcul } from "@/lib/formulaires/chargement";
import { COLONNES_SITES, dateLongue, type SiteTableau } from "@/lib/tableau-de-bord/calculs";
import { alertesSite, nbCritiques, parametresAlertes } from "@/lib/alertes/regles";
import { TableauDeBord } from "@/components/tableau-de-bord/TableauDeBord";
import type { PointEvolution } from "@/components/tableau-de-bord/CourbeEvolution";
import { NB_SEMAINES, suivi, synthese, type LigneRemplissage } from "@/lib/suivi/remplissage";
import { corpsEtatSites, type SegmentCorpsEtat } from "@/lib/formulaires/avancement";
import type { RemplissageTableau } from "@/components/tableau-de-bord/TableauDeBord";
import { EnPreparation } from "@/components/EnPreparation";
import { MARQUE } from "@/theme/marque";

export const metadata = { title: `Tableau de bord — ${MARQUE.titreNavigateur}` };

/** Tableau de bord UG / admin : vue d'ensemble pour la décision (cahier § 5). */
export default async function PageTableauDeBord() {
  await exigerRole(["ug", "admin"]);
  const supabase = createClient();
  const [
    { data: sites, error },
    { data: lots },
    { data: lotsMoe },
    { postes, corps, parametres },
    { data: evolution, error: erreurEvolution },
    { data: remplissage },
  ] = await Promise.all([
      supabase.from("chantierci_v_etat_sites").select(COLONNES_SITES.tableau).order("code").range(0, 999),
      supabase.from("chantierci_lots").select("id, nom, poids").order("id"),
      supabase.from("chantierci_lots_moe").select("id, nom, regions").order("id"),
      chargerReferentielCalcul(supabase),
      supabase.rpc("chantierci_evolution_avancement", { p_lot_moe: null }),
      supabase.rpc("chantierci_remplissage", { p_semaines: NB_SEMAINES }),
    ]);

  const aJour = new Date().toISOString().slice(0, 10);
  // Sites allégés pour le navigateur : les réponses des formulaires ne servent
  // qu'à compter les sites à suivre, calculé ici.
  const aujourdhui = new Date();
  const regles = parametresAlertes(parametres);
  const sitesTableau: SiteTableau[] = (sites ?? []).map((s) => ({
    id: s.id,
    code: s.code,
    nom: s.nom,
    departement: s.departement,
    localite: s.localite,
    lot_id: s.lot_id,
    lot_moe_id: s.lot_moe_id,
    electricite: s.electricite,
    type_latrines: s.type_latrines,
    latitude: s.latitude,
    longitude: s.longitude,
    origine_position: s.origine_position,
    moe_statut: s.moe_statut,
    moe_date: s.moe_date,
    moe_avancement: s.moe_avancement,
    montant: s.montant,
    ecart_ug_moe: s.ecart_ug_moe,
    discordance: s.discordance,
    a_suivre: nbCritiques(alertesSite(s, regles, aujourdhui)) > 0,
  }));

  // Agrégats calculés ici (le navigateur ne reçoit ni les postes de chaque site
  // ni le détail du remplissage) : corps d'état par lot, remplissage par périmètre.
  const parLot = new Map<number, { electricite: boolean; type_latrines: "a_eau" | "seches"; postes: unknown }[]>();
  for (const s of sites ?? [])
    parLot.set(s.lot_id, [...(parLot.get(s.lot_id) ?? []), { electricite: s.electricite, type_latrines: s.type_latrines, postes: s.moe_postes }]);
  const corpsParLot: Record<number, SegmentCorpsEtat[]> = Object.fromEntries(
    [...parLot].map(([lot, ss]) => [lot, corpsEtatSites(ss, postes, corps)])
  );
  const lignes = (remplissage ?? []) as LigneRemplissage[];
  const ligneParSite = new Map(lignes.map((l) => [l.site_id, l]));
  const perimetre = (lotMoe: number | null) => {
    const ids = (sites ?? []).filter((s) => !lotMoe || s.lot_moe_id === lotMoe).map((s) => s.id).filter((id) => suivi(ligneParSite.get(id)));
    return { syntheses: synthese(ids, ligneParSite), nbSuivis: ids.length };
  };
  const remplissageTableau: RemplissageTableau | null = lignes.length
    ? {
        dateRef: lignes[0].date_ref,
        parPerimetre: Object.fromEntries([["tous", perimetre(null)], ...(lotsMoe ?? []).map((m) => [String(m.id), perimetre(m.id)])]),
      }
    : null;

  return (
    <div className="mx-auto max-w-[1400px] p-4 lg:p-6">
      <div className="mb-3">
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-sm text-texte-2">
          Construction des salles du pré-primaire · situation au {dateLongue(aJour)} · avancement de référence : dernier
          rapport MOE de chaque site
        </p>
      </div>
      {error || erreurEvolution ? (
        <EnPreparation titre="Le tableau de bord n'est pas à jour dans la base">
          Exécuter dans le SQL Editor de Supabase la migration{" "}
          <code>supabase/migrations/20261127100000_tableau_de_bord_v2.sql</code>.
        </EnPreparation>
      ) : (
        <TableauDeBord
          sites={sitesTableau}
          lots={(lots ?? []).map((l) => ({ ...l, poids: Number(l.poids) }))}
          lotsMoe={lotsMoe ?? []}
          corpsParLot={corpsParLot}
          evolutionInitiale={(evolution ?? []) as PointEvolution[]}
          remplissage={remplissageTableau}
        />
      )}
    </div>
  );
}
