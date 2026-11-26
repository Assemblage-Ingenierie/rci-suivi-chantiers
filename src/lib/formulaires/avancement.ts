/**
 * Calcul de l'avancement — miroir de chantierci_private.avancement_site (SQL),
 * utilisé pour l'affichage en direct pendant la saisie. La valeur de
 * référence reste celle calculée par la base (vue chantierci_v_visites).
 */
import type { Parametres, PosteDef, ValeursPostes } from "./types";
import type { TypeLatrines } from "@/lib/constants";

export function ouvrageLatrines(type: TypeLatrines): string {
  return `latrines_${type}`;
}

/** Postes applicables d'un ouvrage pour un site (sans électricité si le site n'en a pas). */
export function postesApplicables(postes: PosteDef[], ouvrage: string, electricite: boolean): PosteDef[] {
  return postes
    .filter((p) => p.ouvrage === ouvrage && (electricite || p.code !== "electricite"))
    .sort((a, b) => a.ordre - b.ordre);
}

export function avancementOuvrage(valeurs: Record<string, number> | undefined, postes: PosteDef[]): number | null {
  if (!valeurs || Object.keys(valeurs).length === 0) return null;
  const total = postes.reduce((s, p) => s + p.poids, 0);
  if (total === 0) return null;
  const somme = postes.reduce((s, p) => s + p.poids * Math.min(Math.max(valeurs[p.code] ?? 0, 0), 100), 0);
  return somme / total;
}

export function avancementSite(
  valeurs: ValeursPostes,
  postes: PosteDef[],
  site: { electricite: boolean; type_latrines: TypeLatrines },
  parametres: Parametres
): number | null {
  const classe = avancementOuvrage(valeurs.classe, postesApplicables(postes, "classe", site.electricite));
  const latrines = avancementOuvrage(
    valeurs.latrines,
    postesApplicables(postes, ouvrageLatrines(site.type_latrines), site.electricite)
  );
  if (classe === null && latrines === null) return null;
  const pc = parametres.part_classe ?? 80;
  const pl = parametres.part_latrines ?? 20;
  if (pc + pl === 0) return null;
  return Math.round(((pc * (classe ?? 0) + pl * (latrines ?? 0)) / (pc + pl)) * 10) / 10;
}

export function formatPourcent(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `${Number.isInteger(v) ? v : v.toFixed(1).replace(".", ",")} %`;
}
