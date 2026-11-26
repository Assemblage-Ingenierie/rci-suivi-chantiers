import { notFound, redirect } from "next/navigation";
import { exigerRole } from "@/lib/auth";
import { estProfilTerrain } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { chargerPhotos, chargerReferentielCalcul, chargerSite } from "@/lib/formulaires/chargement";
import { peutModifier } from "@/lib/formulaires/droits";
import type { Reponses, ValeursPostes } from "@/lib/formulaires/types";
import { FormulaireVisite } from "@/components/formulaires/FormulaireVisite";
import { MARQUE } from "@/theme/marque";

export const metadata = { title: `Modifier une visite — ${MARQUE.titreNavigateur}` };

/** Modification d'un formulaire (droits : voir lib/formulaires/droits.ts et la RLS). */
export default async function PageModifierVisite({ params }: { params: { id: string } }) {
  const profil = await exigerRole(["cstc", "moe_controleur", "moe_chef", "ug", "admin"]);
  const supabase = createClient();
  const { data: visite } = await supabase.from("chantierci_v_visites").select("*").eq("id", params.id).maybeSingle();
  if (!visite) notFound();

  const [site, { postes, parametres }, photos, { count }] = await Promise.all([
    chargerSite(supabase, visite.site_code),
    chargerReferentielCalcul(supabase),
    chargerPhotos(supabase, visite.id),
    supabase
      .from("chantierci_visites")
      .select("id", { count: "exact", head: true })
      .eq("site_id", visite.site_id)
      .eq("source", visite.source)
      .lte("created_at", visite.created_at),
  ]);
  if (!site) notFound();
  if (!peutModifier(profil, visite, parametres.delai_correction_cstc_jours ?? 3)) redirect(`/visite/${visite.id}`);

  return (
    <FormulaireVisite
      bureau={!estProfilTerrain(profil.role)}
      source={visite.source}
      site={{
        id: site.id,
        code: site.code,
        nom: site.nom,
        lot_id: site.lot_id,
        lot_nom: site.lot?.nom ?? "",
        entreprise: site.lot?.entreprise_titulaire ?? "",
        localite: site.localite,
        electricite: site.electricite,
        type_latrines: site.type_latrines,
      }}
      postes={postes}
      numeroVisite={count ?? 1}
      precedent={null}
      initial={{
        id: visite.id,
        date_visite: visite.date_visite,
        statut: visite.statut,
        postes: (visite.postes ?? {}) as ValeursPostes,
        reponses: (visite.reponses ?? {}) as Reponses,
        commentaire: visite.commentaire,
        auteur_nom: visite.auteur_nom,
      }}
      photosExistantes={photos}
      auteurNom={profil.nom_complet}
    />
  );
}
