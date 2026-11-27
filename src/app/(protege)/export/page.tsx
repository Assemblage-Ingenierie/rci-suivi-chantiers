import { exigerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { lireParametres } from "@/lib/export/rapport";
import { FormulaireExport } from "@/components/export/FormulaireExport";
import { MARQUE } from "@/theme/marque";

export const metadata = { title: `Export — ${MARQUE.titreNavigateur}` };

/** Onglet Export : choix des sources, du périmètre et de la période du rapport PDF (UG, admin). */
export default async function PageExport({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await exigerRole(["ug", "admin"]);
  const supabase = createClient();
  const [{ data: sites }, { data: lots }, { data: lotsMoe }] = await Promise.all([
    supabase.from("chantierci_sites").select("code, nom, region, lot_id").eq("actif", true).order("code").range(0, 999),
    supabase.from("chantierci_lots").select("id, nom, entreprise:chantierci_entreprises(nom)").order("id"),
    supabase.from("chantierci_lots_moe").select("id, nom, regions").order("id"),
  ]);
  const regions = [...new Set((sites ?? []).map((s) => s.region))].sort((a, b) => a.localeCompare(b, "fr"));

  return (
    <div className="mx-auto max-w-5xl p-4 lg:p-6">
      <h1 className="text-2xl font-bold">Export</h1>
      <p className="mb-4 text-sm text-texte-2">
        Rapport de synthèse des formulaires collectés, à enregistrer en PDF. Choisissez les sources, le périmètre et la
        période, puis générez l&apos;aperçu.
      </p>
      <FormulaireExport
        initial={searchParams.perimetre ? lireParametres(searchParams) : null}
        sites={sites ?? []}
        lots={(lots ?? []).map((l) => ({ id: l.id, nom: l.nom, entreprise: l.entreprise?.nom ?? "" }))}
        lotsMoe={lotsMoe ?? []}
        regions={regions}
      />
    </div>
  );
}
