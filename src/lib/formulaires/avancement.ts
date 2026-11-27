/**
 * Calcul de l'avancement — miroir de chantierci_private.avancement_site (SQL).
 * La valeur de référence reste celle calculée et enregistrée par la base.
 *
 * Avancement d'un site = Σ (montant DQE du poste × % réalisé) / Σ montants,
 * sur les postes de la salle de classe ET des latrines de son type (montants
 * du DQE CONSTRUCTION PATEB V130326). Le poste électricité compte aussi pour
 * un site sans électricité, à son montant « sans électricité ».
 */
import type { CorpsEtat, PosteDef, ValeursPostes } from "./types";
import type { TypeLatrines } from "@/lib/constants";

export function ouvrageLatrines(type: TypeLatrines): string {
  return `latrines_${type}`;
}

/** Montant d'un poste pour un site (variante sans électricité le cas échéant). */
export const poidsPoste = (p: PosteDef, electricite: boolean) =>
  !electricite && p.poids_sans_electricite !== null && p.poids_sans_electricite !== undefined
    ? p.poids_sans_electricite
    : p.poids;

/** Postes d'un ouvrage pour un site, avec leur montant pour ce site. */
export function postesApplicables(postes: PosteDef[], ouvrage: string, electricite: boolean): PosteDef[] {
  return postes
    .filter((p) => p.ouvrage === ouvrage)
    .map((p) => ({ ...p, poids: poidsPoste(p, electricite) }))
    .sort((a, b) => a.ordre - b.ordre);
}

export function avancementOuvrage(valeurs: Record<string, number> | undefined, postes: PosteDef[]): number | null {
  if (!valeurs || Object.keys(valeurs).length === 0) return null;
  const total = postes.reduce((s, p) => s + p.poids, 0);
  if (total === 0) return null;
  const somme = postes.reduce((s, p) => s + p.poids * Math.min(Math.max(valeurs[p.code] ?? 0, 0), 100), 0);
  return somme / total;
}

const borne = (v: unknown) => Math.min(Math.max(typeof v === "number" ? v : Number(v) || 0, 0), 100);

type SiteCalcul = { electricite: boolean; type_latrines: TypeLatrines };

/** Postes de la salle de classe et des latrines du site, avec la valeur saisie de chacun. */
function postesDuSite(postes: PosteDef[], site: SiteCalcul, valeurs: ValeursPostes | null | undefined) {
  return [
    ...postesApplicables(postes, "classe", site.electricite).map((p) => ({ p, v: valeurs?.classe?.[p.code] })),
    ...postesApplicables(postes, ouvrageLatrines(site.type_latrines), site.electricite).map((p) => ({
      p,
      v: valeurs?.latrines?.[p.code],
    })),
  ];
}

/** Avancement d'un site (classe + latrines réunies), arrondi au dixième ; null si rien n'est saisi. */
export function avancementSite(valeurs: ValeursPostes, postes: PosteDef[], site: SiteCalcul): number | null {
  if (Object.keys(valeurs?.classe ?? {}).length === 0 && Object.keys(valeurs?.latrines ?? {}).length === 0) return null;
  const lignes = postesDuSite(postes, site, valeurs);
  const total = lignes.reduce((s, l) => s + l.p.poids, 0);
  if (total === 0) return null;
  return Math.round((lignes.reduce((s, l) => s + l.p.poids * borne(l.v), 0) / total) * 10) / 10;
}

/** Montant DQE d'un site (salle de classe + latrines de son type, FCFA HT). */
export function montantSite(postes: PosteDef[], site: SiteCalcul): number {
  return postesDuSite(postes, site, null).reduce((s, l) => s + l.p.poids, 0);
}

/** Segment du diagramme par corps d'état : montant DQE et montant réalisé (FCFA). */
export type SegmentCorpsEtat = { code: string; libelle: string; montant: number; realise: number };

/**
 * Avancement par corps d'état d'un ensemble de sites (un site sans rapport
 * compte 0 %) : pour chaque corps d'état, montant DQE des postes concernés
 * et montant réalisé. Σ réalisé / Σ montant = avancement pondéré du périmètre.
 */
export function corpsEtatSites(
  sites: (SiteCalcul & { postes: unknown })[],
  postes: PosteDef[],
  corps: CorpsEtat[]
): SegmentCorpsEtat[] {
  const parCode = new Map(corps.map((c) => [c.code, { code: c.code, libelle: c.libelle, ordre: c.ordre, montant: 0, realise: 0 }]));
  for (const s of sites) {
    for (const { p, v } of postesDuSite(postes, s, s.postes as ValeursPostes | null)) {
      const seg = p.corps_etat ? parCode.get(p.corps_etat) : undefined;
      if (!seg) continue;
      seg.montant += p.poids;
      seg.realise += (p.poids * borne(v)) / 100;
    }
  }
  return [...parCode.values()]
    .filter((s) => s.montant > 0)
    .sort((a, b) => a.ordre - b.ordre)
    .map(({ code, libelle, montant, realise }) => ({ code, libelle, montant, realise }));
}

export function formatPourcent(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `${Number.isInteger(v) ? v : v.toFixed(1).replace(".", ",")} %`;
}
