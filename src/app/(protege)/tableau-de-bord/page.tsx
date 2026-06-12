import { redirect } from "next/navigation";
import { getUtilisateurEtProfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TableauDeBord } from "@/components/men/TableauDeBord";

export const metadata = { title: "Tableau de bord — Suivi chantiers MEN CI" };

/**
 * Dashboard (CDC §5.3 et §5.4) : KPI + carte Leaflet, filtres lot/région.
 * Pour un responsable régional, la RLS restreint automatiquement toutes les
 * données à sa région — même dashboard, périmètre réduit.
 */
export default async function PageTableauDeBord() {
  const { profil } = await getUtilisateurEtProfil();
  if (!profil) redirect("/");
  if (profil.role === "coges") redirect("/coges");

  let sousTitre = "Vue d'ensemble du programme de construction";
  if (profil.role === "regional" && profil.lot_ids.length > 0) {
    const supabase = createClient();
    const { data: lots } = await supabase
      .from("chantierci_lots")
      .select("region")
      .in("id", profil.lot_ids)
      .range(0, 9);
    const regions = Array.from(
      new Set((lots ?? []).map((l) => l.region))
    ).join(", ");
    if (regions) sousTitre = `Périmètre régional : ${regions}`;
  }

  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>
      <p className="mb-6 text-sm text-gray-500">{sousTitre}</p>
      <TableauDeBord />
    </div>
  );
}
