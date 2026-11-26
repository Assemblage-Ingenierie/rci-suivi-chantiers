import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, FlaskConical, Pencil } from "lucide-react";
import { exigerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { familleProfil } from "@/lib/constants";
import { chargerPhotos, chargerReferentielCalcul, chargerSite } from "@/lib/formulaires/chargement";
import { DEFINITIONS } from "@/lib/formulaires/definitions";
import { peutModifier } from "@/lib/formulaires/droits";
import { AffichageVisite } from "@/components/formulaires/AffichageVisite";
import { MARQUE } from "@/theme/marque";

export const metadata = { title: `Visite — ${MARQUE.titreNavigateur}` };

/** Consultation d'un formulaire enregistré. */
export default async function PageVisite({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { enregistre?: string };
}) {
  const profil = await exigerRole(["cstc", "moe_controleur", "moe_chef", "ug", "admin"]);
  const supabase = createClient();
  const { data: visite } = await supabase.from("chantierci_v_visites").select("*").eq("id", params.id).maybeSingle();
  if (!visite) notFound();

  const [site, { postes, parametres }, photos] = await Promise.all([
    chargerSite(supabase, visite.site_code),
    chargerReferentielCalcul(supabase),
    chargerPhotos(supabase, visite.id),
  ]);
  if (!site) notFound();

  const definition = DEFINITIONS[visite.source];
  const modifiable = peutModifier(profil, visite, parametres.delai_correction_cstc_jours ?? 3);
  const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(visite.date_visite));

  return (
    <div data-profil={familleProfil(visite.source === "moe" ? "moe_controleur" : visite.source)} className="lg:p-8">
      <div className="lg:mx-auto lg:max-w-3xl">
        <header className="bg-accent px-4 pb-4 pt-4 text-sur-accent lg:rounded-t-carte">
          <Link href={`/site/${site.code}`} className="mb-2 inline-flex items-center gap-1 text-sm opacity-85 hover:opacity-100">
            <ArrowLeft className="h-4 w-4" /> {site.nom}
          </Link>
          <p className="text-sm opacity-85">{definition.surTitre}</p>
          <h1 className="mt-0.5 text-2xl font-bold">{site.nom}</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="rounded-champ bg-black/15 px-2.5 py-1">{date}</span>
            <span className="rounded-champ bg-black/15 px-2.5 py-1">{visite.auteur_nom || "—"}</span>
            {visite.donnees_test && (
              <span className="inline-flex items-center gap-1 rounded-champ bg-black/30 px-2.5 py-1">
                <FlaskConical className="h-4 w-4" /> Donnée fictive
              </span>
            )}
          </div>
        </header>

        <div className="space-y-4 p-4 lg:px-0">
          {searchParams.enregistre && (
            <p className="flex items-center gap-2 rounded-carte bg-succes-clair px-4 py-3 font-semibold text-succes" role="status">
              <CheckCircle2 className="h-5 w-5" /> Formulaire enregistré.
            </p>
          )}
          {modifiable && (
            <Link href={`/visite/${visite.id}/modifier`} className="bouton-secondaire w-full py-3">
              <Pencil className="h-4 w-4" />
              Modifier ce formulaire
              {profil.role === "cstc" && " (possible pendant 3 jours)"}
            </Link>
          )}
          <AffichageVisite source={visite.source} visite={visite} site={site} postes={postes} photos={photos} />
          {visite.modifie_par && (
            <p className="text-center text-xs text-texte-3">
              Modifié le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(visite.updated_at))}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
