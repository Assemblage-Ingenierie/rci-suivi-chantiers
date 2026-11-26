/**
 * Agrégats du tableau de bord (cahier § 5), calculés à partir de la vue
 * chantierci_v_etat_sites (une ligne par site) :
 *   - site   = avancement du dernier rapport MOE (calculé par la base) ;
 *   - lot    = moyenne des sites du lot (un site sans rapport MOE compte 0 %) ;
 *   - global = Σ (poids du lot × avancement du lot) / Σ poids.
 */
import type { Database } from "@/lib/database.types";
import type { PosteDef, StatutChantier, ValeursPostes } from "@/lib/formulaires/types";
import { avancementOuvrage, ouvrageLatrines, postesApplicables } from "@/lib/formulaires/avancement";

export type EtatSite = Database["public"]["Views"]["chantierci_v_etat_sites"]["Row"];
export type LotRef = { id: number; nom: string; poids: number; entreprise_titulaire: string };

export type SyntheseLot = {
  id: number;
  nom: string;
  poids: number;
  sites: number;
  /** Avancement MOE du lot (moyenne des sites, 0 % pour un site sans rapport). */
  moe: number;
  arretes: number;
  termines: number;
};

const moyenne = (valeurs: number[]) => (valeurs.length ? valeurs.reduce((a, b) => a + b, 0) / valeurs.length : null);

export const avancementMoe = (s: EtatSite) => (s.moe_avancement === null ? 0 : Number(s.moe_avancement));

export const TERMINES: StatutChantier[] = ["termine", "receptionne"];

export function syntheseLots(sites: EtatSite[], lots: LotRef[]): SyntheseLot[] {
  return lots
    .map((lot) => {
      const duLot = sites.filter((s) => s.lot_id === lot.id);
      return {
        id: lot.id,
        nom: lot.nom,
        poids: Number(lot.poids),
        sites: duLot.length,
        moe: moyenne(duLot.map(avancementMoe)) ?? 0,
        arretes: duLot.filter((s) => s.moe_statut === "arrete").length,
        termines: duLot.filter((s) => s.moe_statut && TERMINES.includes(s.moe_statut)).length,
      };
    })
    .filter((l) => l.sites > 0);
}

/** Avancement global pondéré par le poids des lots (null si aucun poids). */
export function avancementGlobal(lots: SyntheseLot[]): number | null {
  const poids = lots.reduce((a, l) => a + l.poids, 0);
  if (poids <= 0) return null;
  return lots.reduce((a, l) => a + l.poids * l.moe, 0) / poids;
}

/**
 * Avancement moyen de chaque corps d'état de la salle de classe (postes du DQE
 * type) sur les sites, puis des latrines (ouvrage complet).
 */
export function avancementParCorpsEtat(
  sites: EtatSite[],
  postes: PosteDef[]
): { code: string; libelle: string; poids: number | null; valeur: number }[] {
  const lignes = postesApplicables(postes, "classe", true).map((p) => {
    const concernes = sites.filter((s) => p.code !== "electricite" || s.electricite);
    return {
      code: p.code,
      libelle: p.libelle,
      poids: p.poids,
      valeur:
        moyenne(concernes.map((s) => Number(((s.moe_postes as ValeursPostes | null)?.classe ?? {})[p.code] ?? 0))) ?? 0,
    };
  });
  const latrines =
    moyenne(
      sites.map(
        (s) =>
          avancementOuvrage(
            (s.moe_postes as ValeursPostes | null)?.latrines,
            postesApplicables(postes, ouvrageLatrines(s.type_latrines), s.electricite)
          ) ?? 0
      )
    ) ?? 0;
  return [...lignes, { code: "latrines", libelle: "Bloc latrines (ensemble)", poids: null, valeur: latrines }];
}

/** Nombre de jours entre une date (AAAA-MM-JJ) et aujourd'hui. */
export function joursDepuis(date: string | null, aujourdhui = new Date()): number | null {
  if (!date) return null;
  const d = new Date(`${date.slice(0, 10)}T00:00:00`);
  return Math.floor((aujourdhui.getTime() - d.getTime()) / 86_400_000);
}

export const pct = (v: number | null | undefined, decimales = 0) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : `${v.toFixed(decimales).replace(".", ",")} %`;

export const dateCourte = (d: string | null) =>
  d ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(`${d.slice(0, 10)}T00:00:00`)) : "—";

export const dateLongue = (d: string | null) =>
  d ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${d.slice(0, 10)}T00:00:00`)) : "—";
