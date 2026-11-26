import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { exigerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EtiquettesSite, type SiteResume } from "@/components/FicheSite";
import { EnPreparation } from "@/components/EnPreparation";
import { MARQUE } from "@/theme/marque";

export const metadata = { title: `Mes sites — ${MARQUE.titreNavigateur}` };

/**
 * Accueil MOE : sites du périmètre, groupés par lot de travaux.
 * Contrôleur = ses affectations ; chef de mission = tout son lot MOE (RLS).
 */
export default async function PageMoe() {
  const profil = await exigerRole(["moe_controleur", "moe_chef"]);
  const supabase = createClient();
  const { data } = await supabase
    .from("chantierci_sites")
    .select("code, nom, region, departement, localite, electricite, type_latrines, lot_id, lot_moe_id, lot:chantierci_lots(nom)")
    .order("code")
    .range(0, 499);
  const sites: SiteResume[] = data ?? [];

  const parLot = new Map<number, SiteResume[]>();
  for (const s of sites) parLot.set(s.lot_id, [...(parLot.get(s.lot_id) ?? []), s]);

  const chef = profil.role === "moe_chef";
  return (
    <div>
      <div className="bg-accent px-4 pb-5 pt-4 text-sur-accent">
        <p className="text-sm opacity-80">
          Maîtrise d&apos;œuvre · {chef ? "Chef de mission" : "Contrôleur des travaux"}
          {profil.lot_moe_id ? ` · Lot MOE ${profil.lot_moe_id}` : ""}
        </p>
        <h1 className="mt-0.5 text-2xl font-bold">{chef ? "Sites de mon lot" : "Mes sites"}</h1>
        <p className="mt-1 text-sm opacity-90">
          {sites.length} site{sites.length > 1 ? "s" : ""} · {parLot.size} lot{parLot.size > 1 ? "s" : ""} de travaux
        </p>
      </div>

      <div className="space-y-5 p-4">
        {sites.length === 0 && (
          <EnPreparation titre="Aucun site ne vous est encore attribué">
            L&apos;administrateur doit vous affecter vos sites.
          </EnPreparation>
        )}

        {[...parLot.entries()].map(([lot, liste]) => (
          <section key={lot}>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-texte-2">
              Lot {lot} · {liste[0].lot?.nom} <span className="font-normal">({liste.length})</span>
            </h2>
            <ul className="carte divide-y divide-bordure">
              {liste.map((s) => (
                <li key={s.code}>
                  <Link href={`/site/${s.code}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{s.nom}</p>
                    <p className="mb-1.5 text-sm text-texte-2">
                      {s.code} · {s.localite || s.departement}
                    </p>
                    <EtiquettesSite site={s} />
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-texte-3" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

      </div>
    </div>
  );
}
