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

/**
 * Colonnes de la vue lues par chaque page. Jamais « * » : les réponses
 * complètes des formulaires (≈ 330 Ko pour 387 sites) ne sont lues que là où
 * elles servent, et ne sont pas envoyées telles quelles au navigateur.
 */
export const COLONNES_SITES = {
  suivi: "id, code, nom, localite, lot_id, lot_moe_id, moe_statut",
  difficultes:
    "id, code, nom, localite, lot_id, lot_moe_id, moe_statut, moe_date, moe_avancement, moe_arrete_depuis, moe_reponses, ug_date, ug_avancement, ug_avancement_moe_compare, ecart_ug_moe, discordance, ug_reponses, cstc_date, cstc_reponses",
  tableau:
    "id, code, nom, departement, localite, lot_id, lot_moe_id, electricite, type_latrines, latitude, longitude, origine_position, moe_statut, moe_date, moe_avancement, moe_postes, moe_arrete_depuis, moe_reponses, ug_date, ug_avancement, ug_avancement_moe_compare, ecart_ug_moe, discordance, ug_reponses, cstc_date, cstc_reponses",
} as const;

/** Site tel qu'envoyé à l'onglet Suivi. */
export type SiteSuivi = Pick<EtatSite, "id" | "code" | "nom" | "localite" | "lot_id" | "lot_moe_id" | "moe_statut">;

/** Site tel qu'envoyé au tableau de bord (sans les réponses des formulaires). */
export type SiteTableau = Pick<
  EtatSite,
  | "id"
  | "code"
  | "nom"
  | "departement"
  | "localite"
  | "lot_id"
  | "lot_moe_id"
  | "electricite"
  | "type_latrines"
  | "latitude"
  | "longitude"
  | "origine_position"
  | "moe_statut"
  | "moe_date"
  | "moe_avancement"
  | "moe_postes"
  | "ecart_ug_moe"
  | "discordance"
> & {
  /** Au moins une difficulté sérieuse (gravité ≥ 2), calculé côté serveur. */
  a_suivre: boolean;
};
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

export const avancementMoe = (s: Pick<EtatSite, "moe_avancement">) => (s.moe_avancement === null ? 0 : Number(s.moe_avancement));

export const TERMINES: StatutChantier[] = ["termine", "receptionne"];

export function syntheseLots(
  sites: Pick<EtatSite, "lot_id" | "moe_avancement" | "moe_statut">[],
  lots: LotRef[]
): SyntheseLot[] {
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
  sites: Pick<EtatSite, "electricite" | "type_latrines" | "moe_postes">[],
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
