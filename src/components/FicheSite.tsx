import { Droplets, MapPin, Zap, ZapOff } from "lucide-react";
import { LIBELLES_LATRINES, type TypeLatrines } from "@/lib/constants";

export type SiteResume = {
  code: string;
  nom: string;
  region: string;
  departement: string;
  localite: string;
  electricite: boolean;
  type_latrines: TypeLatrines;
  lot_id: number;
  lot_moe_id: number;
  lot?: { nom: string } | null;
};

/** Petites étiquettes descriptives d'un site (électricité, latrines). */
export function EtiquettesSite({ site }: { site: SiteResume }) {
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      <span className="inline-flex items-center gap-1 rounded-champ bg-surface-2 px-2 py-0.5 text-texte-2 ring-1 ring-bordure">
        {site.electricite ? <Zap className="h-3.5 w-3.5" /> : <ZapOff className="h-3.5 w-3.5" />}
        {site.electricite ? "Avec électricité" : "Sans électricité"}
      </span>
      <span className="inline-flex items-center gap-1 rounded-champ bg-surface-2 px-2 py-0.5 text-texte-2 ring-1 ring-bordure">
        <Droplets className="h-3.5 w-3.5" />
        {LIBELLES_LATRINES[site.type_latrines]}
      </span>
    </div>
  );
}

/** En-tête de site façon maquettes : bandeau à la couleur du profil. */
export function BandeauSite({ site, contexte }: { site: SiteResume; contexte: string }) {
  return (
    <div className="bg-accent px-4 pb-5 pt-4 text-sur-accent">
      <p className="text-sm opacity-80">{contexte}</p>
      <h1 className="mt-0.5 text-2xl font-bold">{site.nom}</h1>
      <p className="mt-1 flex items-center gap-1 text-sm opacity-90">
        <MapPin className="h-4 w-4" />
        Lot {site.lot_id}
        {site.lot?.nom ? ` · ${site.lot.nom}` : ""} · {site.localite || site.departement}
      </p>
    </div>
  );
}
