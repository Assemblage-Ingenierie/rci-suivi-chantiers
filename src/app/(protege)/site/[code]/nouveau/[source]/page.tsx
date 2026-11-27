import { notFound, redirect } from "next/navigation";
import { exigerRole } from "@/lib/auth";
import { estProfilTerrain } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { chargerReferentielCalcul, chargerSite } from "@/lib/formulaires/chargement";
import { DEFINITIONS } from "@/lib/formulaires/definitions";
import { sourcesSaisissables } from "@/lib/formulaires/droits";
import type { SourceFormulaire, ValeursPostes } from "@/lib/formulaires/types";
import { FormulaireVisite } from "@/components/formulaires/FormulaireVisite";
import { MARQUE } from "@/theme/marque";

export async function generateMetadata({ params }: { params: { source: string } }) {
  const def = DEFINITIONS[params.source as SourceFormulaire];
  return { title: `${def?.titre ?? "Formulaire"} — ${MARQUE.titreNavigateur}` };
}

/** Saisie d'un nouveau formulaire (CSTC, MOE ou UG) sur un site. */
export default async function PageNouveauFormulaire({ params }: { params: { code: string; source: string } }) {
  const profil = await exigerRole(["cstc", "moe_controleur", "moe_chef", "ug", "admin"]);
  const source = params.source as SourceFormulaire;
  if (!DEFINITIONS[source]) notFound();
  if (!sourcesSaisissables(profil.role).includes(source)) redirect(`/site/${params.code}`);

  const supabase = createClient();
  const site = await chargerSite(supabase, params.code);
  if (!site) notFound();

  const [{ postes }, { data: derniere }, { count }] = await Promise.all([
    chargerReferentielCalcul(supabase),
    supabase
      .from("chantierci_visites")
      .select("postes")
      .eq("site_id", site.id)
      .eq("source", source)
      .order("date_visite", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("chantierci_visites")
      .select("id", { count: "exact", head: true })
      .eq("site_id", site.id)
      .eq("source", source),
  ]);

  return (
    <FormulaireVisite
      bureau={!estProfilTerrain(profil.role)}
      source={source}
      site={{
        id: site.id,
        code: site.code,
        nom: site.nom,
        lot_id: site.lot_id,
        lot_nom: site.lot?.nom ?? "",
        entreprise: site.lot?.entreprise?.nom ?? "",
        localite: site.localite,
        electricite: site.electricite,
        type_latrines: site.type_latrines,
      }}
      postes={postes}
      numeroVisite={(count ?? 0) + 1}
      precedent={derniere ? { postes: (derniere.postes ?? {}) as ValeursPostes } : null}
      auteurNom={profil.nom_complet || profil.email || ""}
    />
  );
}
