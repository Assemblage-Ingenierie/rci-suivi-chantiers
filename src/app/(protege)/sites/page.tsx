import { exigerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MARQUE } from "@/theme/marque";
import { TableauSites, type LigneSite } from "./TableauSites";

export const metadata = { title: `Sites — ${MARQUE.titreNavigateur}` };

/**
 * Référentiel des 387 sites (issu du DAO). Consultable par l'UG et l'admin ;
 * modifiable uniquement par l'admin (édition : étape 3 de la refonte).
 */
export default async function PageSites() {
  const profil = await exigerRole(["ug", "admin"]);
  const supabase = createClient();
  const [{ data: sites }, { data: lots }] = await Promise.all([
    supabase
      .from("chantierci_sites")
      .select("id, code, nom, region, departement, localite, zone, electricite, type_latrines, lot_id, lot_moe_id, a_verifier")
      .order("code")
      .range(0, 999),
    supabase.from("chantierci_lots").select("id, nom").order("id"),
  ]);

  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-2xl font-bold">Sites</h1>
      <p className="mb-6 text-sm text-texte-2">
        Liste consolidée à partir du DAO (tableau d&apos;allotissement).{" "}
        Cliquez sur un site pour voir ses formulaires
        {profil.role === "admin" ? " et en saisir (CSTC, MOE ou UG)." : " et saisir une fiche UG."}{" "}
        {profil.role === "admin"
          ? "L'édition de la liste arrive à l'étape 3."
          : "Seul l'administrateur peut modifier cette liste."}
      </p>
      <TableauSites sites={(sites ?? []) as LigneSite[]} lots={lots ?? []} />
    </div>
  );
}
