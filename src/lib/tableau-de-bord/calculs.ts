/**
 * Agrégats du tableau de bord (cahier § 5), calculés à partir de la vue
 * chantierci_v_etat_sites (une ligne par site) :
 *   - site   = avancement du dernier rapport MOE (calculé par la base, postes
 *              pondérés par les montants du DQE) ;
 *   - lot    = moyenne des sites du lot pondérée par leur montant DQE (un site
 *              sans rapport MOE compte 0 %) ;
 *   - global = Σ (poids du lot × avancement du lot) / Σ poids (poids d'un lot
 *              = montant DQE de ses sites par défaut).
 */
import type { Database } from "@/lib/database.types";
import type { StatutChantier } from "@/lib/formulaires/types";

export type EtatSite = Database["public"]["Views"]["chantierci_v_etat_sites"]["Row"];

/**
 * Colonnes de la vue lues par chaque page. Jamais « * » : les réponses
 * complètes des formulaires (≈ 330 Ko pour 387 sites) ne sont lues que là où
 * elles servent, et ne sont pas envoyées telles quelles au navigateur.
 */
export const COLONNES_SITES = {
  suivi: "id, code, nom, localite, lot_id, lot_moe_id, moe_statut",
  tableau:
    "id, code, nom, departement, localite, lot_id, lot_moe_id, electricite, type_latrines, latitude, longitude, origine_position, moe_statut, moe_date, moe_avancement, moe_postes, moe_arrete_depuis, moe_reponses, ug_statut, ug_date, ug_avancement, ug_avancement_moe_compare, ecart_ug_moe, discordance, ug_reponses, cstc_statut, cstc_date, cstc_reponses, montant, date_debut",
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
  | "montant"
> & {
  /** Au moins une alerte critique (calculé côté serveur, voir lib/alertes). */
  a_suivre: boolean;
};
export type LotRef = { id: number; nom: string; poids: number };

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

export const avancementMoe = (s: Pick<EtatSite, "moe_avancement">) => (s.moe_avancement === null ? 0 : Number(s.moe_avancement));

export const TERMINES: StatutChantier[] = ["termine", "receptionne"];

/** Montant DQE d'un site (1 si inconnu : base non migrée → moyenne simple). */
const montantDe = (s: { montant?: number | null }) => (s.montant ? Number(s.montant) : 1);

/** Avancement d'un ensemble de sites, pondéré par leur montant DQE (null si aucun site). */
export function avancementPondere(sites: Pick<EtatSite, "moe_avancement" | "montant">[]): number | null {
  const total = sites.reduce((a, s) => a + montantDe(s), 0);
  return total ? sites.reduce((a, s) => a + montantDe(s) * avancementMoe(s), 0) / total : null;
}

export function syntheseLots(
  sites: Pick<EtatSite, "lot_id" | "moe_avancement" | "moe_statut" | "montant">[],
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
        moe: avancementPondere(duLot) ?? 0,
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
