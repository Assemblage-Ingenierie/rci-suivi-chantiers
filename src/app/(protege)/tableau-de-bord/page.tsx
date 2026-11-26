import { exigerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chargerReferentielCalcul } from "@/lib/formulaires/chargement";
import { dateLongue, type EtatSite } from "@/lib/tableau-de-bord/calculs";
import { TableauDeBord } from "@/components/tableau-de-bord/TableauDeBord";
import type { PointEvolution } from "@/components/tableau-de-bord/CourbeEvolution";
import { NB_SEMAINES, type LigneRemplissage } from "@/lib/suivi/remplissage";
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
    { postes },
    { data: evolution, error: erreurEvolution },
    { data: remplissage },
  ] = await Promise.all([
      supabase.from("chantierci_v_etat_sites").select("*").order("code").range(0, 999),
      supabase.from("chantierci_lots").select("id, nom, poids, entreprise_titulaire").order("id"),
      supabase.from("chantierci_lots_moe").select("id, nom, regions").order("id"),
      chargerReferentielCalcul(supabase),
      supabase.rpc("chantierci_evolution_avancement", { p_lot_moe: null }),
      supabase.rpc("chantierci_remplissage", { p_semaines: NB_SEMAINES }),
    ]);

  const aJour = new Date().toISOString().slice(0, 10);

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
          sites={(sites ?? []) as EtatSite[]}
          lots={(lots ?? []).map((l) => ({ ...l, poids: Number(l.poids) }))}
          lotsMoe={lotsMoe ?? []}
          postes={postes}
          evolutionInitiale={(evolution ?? []) as PointEvolution[]}
          remplissage={(remplissage ?? []) as LigneRemplissage[]}
        />
      )}
    </div>
  );
}
