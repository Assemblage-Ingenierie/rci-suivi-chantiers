import { exigerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { COLONNES_SITES, dateLongue, type SiteSuivi } from "@/lib/tableau-de-bord/calculs";
import { NB_SEMAINES, SOURCES_SUIVI, type LigneRemplissage } from "@/lib/suivi/remplissage";
import type { SourceFormulaire } from "@/lib/formulaires/types";
import { SuiviRemplissage } from "@/components/suivi/SuiviRemplissage";
import { EnPreparation } from "@/components/EnPreparation";
import { MARQUE } from "@/theme/marque";

export const metadata = { title: `Suivi des formulaires — ${MARQUE.titreNavigateur}` };

/** Suivi du remplissage des formulaires MOE, CSTC et UG, par lot MOE et par site (UG, admin). */
export default async function PageSuivi({
  searchParams,
}: {
  searchParams: { lot_moe?: string; source?: string; retard?: string };
}) {
  await exigerRole(["ug", "admin"]);
  const supabase = createClient();
  const [{ data: sites }, { data: lots }, { data: lotsMoe }, { data: remplissage, error }] = await Promise.all([
    supabase.from("chantierci_v_etat_sites").select(COLONNES_SITES.suivi).order("code").range(0, 999),
    supabase.from("chantierci_lots").select("id, nom").order("id"),
    supabase.from("chantierci_lots_moe").select("id, nom, regions").order("id"),
    supabase.rpc("chantierci_remplissage", { p_semaines: NB_SEMAINES }),
  ]);
  const lotMoe = /^\d+$/.test(searchParams.lot_moe ?? "") ? Number(searchParams.lot_moe) : null;
  const source = SOURCES_SUIVI.some((r) => r.cle === searchParams.source) ? (searchParams.source as SourceFormulaire) : null;

  return (
    <div className="mx-auto max-w-[1400px] p-4 lg:p-6">
      <div className="mb-3">
        <h1 className="text-2xl font-bold">Suivi des formulaires</h1>
        <p className="text-sm text-texte-2">
          Régularité des formulaires MOE, CSTC et UG · semaines du lundi au dimanche · situation au{" "}
          {dateLongue(new Date().toISOString().slice(0, 10))}
        </p>
      </div>
      {error ? (
        <EnPreparation titre="Le suivi n'est pas encore installé dans la base">
          Exécuter dans le SQL Editor de Supabase les migrations <code>20261128100000_suivi_remplissage.sql</code> puis{" "}
          <code>20261129100000_suivi_attendu.sql</code> (dossier <code>supabase/migrations</code>).
        </EnPreparation>
      ) : (
        <SuiviRemplissage
          sites={(sites ?? []) as SiteSuivi[]}
          lots={lots ?? []}
          lotsMoe={lotsMoe ?? []}
          remplissage={(remplissage ?? []) as LigneRemplissage[]}
          initial={{ lotMoe, source, retard: searchParams.retard === "1" }}
        />
      )}
    </div>
  );
}
