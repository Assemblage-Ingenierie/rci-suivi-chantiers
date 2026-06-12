import { COULEURS_STATUTS_CHANTIER, type StatutChantier } from "./constants";

/** Centre approximatif de la Côte d'Ivoire (vue d'ensemble). */
export const CENTRE_CI: [number, number] = [7.54, -5.55];
export const ZOOM_CI = 7;

/**
 * Mode "Avancement réel" (CDC §5.3) : dégradé noir (0 %) → rouge → orange →
 * vert (100 %). Interpolation linéaire entre paliers.
 */
const PALIERS: { pct: number; rgb: [number, number, number] }[] = [
  { pct: 0, rgb: [17, 17, 17] }, // noir
  { pct: 33, rgb: [232, 32, 26] }, // rouge Assemblage
  { pct: 66, rgb: [249, 115, 22] }, // orange
  { pct: 100, rgb: [34, 197, 94] }, // vert
];

export function couleurAvancement(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return "#9CA3AF"; // gris : pas de visite
  const p = Math.max(0, Math.min(100, pct));
  for (let i = 1; i < PALIERS.length; i++) {
    if (p <= PALIERS[i].pct) {
      const a = PALIERS[i - 1];
      const b = PALIERS[i];
      const t = (p - a.pct) / (b.pct - a.pct);
      const rgb = a.rgb.map((c, k) => Math.round(c + (b.rgb[k] - c) * t));
      return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    }
  }
  return "rgb(34, 197, 94)";
}

export function couleurStatut(statut: StatutChantier | null | undefined): string {
  return statut ? COULEURS_STATUTS_CHANTIER[statut] : "#9CA3AF";
}
