import { exigerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chargerReferentielCalcul } from "@/lib/formulaires/chargement";
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
  const [{ data: sites }, { data: lots }, { data: etats }, { postes, corps }] = await Promise.all([
    supabase
      .from("chantierci_sites")
      .select("id, code, nom, region, departement, localite, zone, electricite, type_latrines, lot_id, lot_moe_id, a_verifier")
      .order("code")
      .range(0, 999),
    supabase.from("chantierci_lots").select("id, nom, entreprise:chantierci_entreprises(nom)").order("id"),
    supabase.from("chantierci_v_etat_sites").select("id, moe_avancement, moe_statut, moe_date, moe_postes").range(0, 999),
    chargerReferentielCalcul(supabase),
  ]);
  const etatParSite = new Map((etats ?? []).map((e) => [e.id, e]));
  const lignes: LigneSite[] = (sites ?? []).map((s) => {
    const e = etatParSite.get(s.id);
    return {
      ...s,
      avancement: e?.moe_avancement === null || e?.moe_avancement === undefined ? null : Number(e.moe_avancement),
      statut: e?.moe_statut ?? null,
      date_rapport: e?.moe_date ?? null,
      postes: e?.moe_postes ?? null,
    };
  });

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
      <TableauSites
        sites={lignes}
        postes={postes}
        corps={corps}
        lots={(lots ?? []).map((l) => ({ id: l.id, nom: l.nom, entreprise: l.entreprise?.nom ?? "" }))}
      />
    </div>
  );
}
