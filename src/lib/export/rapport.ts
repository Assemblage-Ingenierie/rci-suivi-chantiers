/**
 * Rapport d'export (onglet Export) : paramètres, puis calculs purs à partir
 * des sites du périmètre et de leurs formulaires sur la période.
 *
 * - Avancement d'un site à une date = avancement du dernier rapport MOE reçu
 *   à cette date (0 % sans rapport) ; périmètre = moyenne pondérée par le
 *   montant DQE des sites (même règle que le tableau de bord).
 * - Effectif moyen = moyenne, par site, des « ouvriers présents » des rapports
 *   MOE de la période, puis moyenne des sites ayant au moins un rapport.
 * - Les tensions signalées par le CSTC ne figurent pas dans le rapport.
 */
import type { SourceFormulaire, StatutChantier } from "@/lib/formulaires/types";

export type PerimetreType = "tout" | "lot_moe" | "region" | "lot" | "site";

export const PERIMETRES: { cle: PerimetreType; libelle: string }[] = [
  { cle: "tout", libelle: "Tout le programme" },
  { cle: "lot_moe", libelle: "Lot MOE" },
  { cle: "region", libelle: "Région" },
  { cle: "lot", libelle: "Lot de travaux" },
  { cle: "site", libelle: "Site" },
];

export const SOURCES_EXPORT: { cle: SourceFormulaire; libelle: string; detail: string }[] = [
  { cle: "moe", libelle: "MOE", detail: "Rapports de visite de la maîtrise d'œuvre" },
  { cle: "cstc", libelle: "CSTC", detail: "Signalements des comités de suivi" },
  { cle: "ug", libelle: "UG", detail: "Fiches de visite de l'unité de gestion" },
];

export type ParametresExport = {
  sources: SourceFormulaire[];
  perimetre: PerimetreType;
  valeurs: string[];
  du: string;
  au: string;
};

const dateIso = (d: Date) => d.toISOString().slice(0, 10);
const estDate = (v: string | undefined) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function parametresParDefaut(aujourdhui = new Date()): ParametresExport {
  const du = new Date(aujourdhui);
  du.setDate(du.getDate() - 28);
  return { sources: ["moe", "cstc", "ug"], perimetre: "tout", valeurs: [], du: dateIso(du), au: dateIso(aujourdhui) };
}

/** Paramètres lus dans l'adresse du rapport (valeurs invalides ignorées). */
export function lireParametres(sp: Record<string, string | undefined>): ParametresExport {
  const defaut = parametresParDefaut();
  const sources = (sp.sources ?? "")
    .split(",")
    .filter((s): s is SourceFormulaire => s === "moe" || s === "cstc" || s === "ug");
  const perimetre = PERIMETRES.some((p) => p.cle === sp.perimetre) ? (sp.perimetre as PerimetreType) : "tout";
  let du = estDate(sp.du) ? sp.du! : defaut.du;
  let au = estDate(sp.au) ? sp.au! : defaut.au;
  if (du > au) [du, au] = [au, du];
  return {
    sources: sources.length ? sources : defaut.sources,
    perimetre,
    valeurs: perimetre === "tout" ? [] : (sp.valeurs ?? "").split(",").map((v) => v.trim()).filter(Boolean),
    du,
    au,
  };
}

export function urlRapport(p: ParametresExport): string {
  const q = new URLSearchParams({ sources: p.sources.join(","), perimetre: p.perimetre, du: p.du, au: p.au });
  if (p.valeurs.length) q.set("valeurs", p.valeurs.join(","));
  return `/export/rapport?${q}`;
}

// --- Données -----------------------------------------------------------------------------------
export type SiteRapport = {
  id: string;
  code: string;
  nom: string;
  region: string;
  departement: string;
  lot_id: number;
  lot_nom: string;
  entreprise: string;
  lot_moe_id: number;
  electricite: boolean;
  type_latrines: "a_eau" | "seches";
  montant: number;
};
/** Rapport MOE (jusqu'à la fin de la période) : statut, avancement et postes. */
export type RapportMoe = {
  site_id: string;
  date_visite: string;
  created_at: string;
  statut: StatutChantier;
  avancement: number | null;
  postes: unknown;
};
/** Formulaire de la période (toutes sources retenues). */
export type FormulairePeriode = {
  site_id: string;
  source: SourceFormulaire;
  date_visite: string;
  statut: StatutChantier;
  avancement: number | null;
  reponses: unknown;
};

/** Le site appartient-il au périmètre choisi ? */
export function dansPerimetre(s: SiteRapport, p: ParametresExport): boolean {
  switch (p.perimetre) {
    case "tout":
      return true;
    case "lot_moe":
      return p.valeurs.includes(String(s.lot_moe_id));
    case "region":
      return p.valeurs.includes(s.region);
    case "lot":
      return p.valeurs.includes(String(s.lot_id));
    case "site":
      return p.valeurs.includes(s.code);
  }
}

/** Regroupement de la synthèse (un tableau par lot MOE, région ou lot). */
export function groupeDe(s: SiteRapport, p: ParametresExport): { cle: string; libelle: string; ordre: string } {
  switch (p.perimetre) {
    case "region":
      return { cle: s.region, libelle: s.region, ordre: s.region };
    case "lot":
    case "site":
      return { cle: `lot${s.lot_id}`, libelle: `Lot ${s.lot_id} · ${s.lot_nom}`, ordre: String(s.lot_id).padStart(3, "0") };
    default:
      return { cle: `moe${s.lot_moe_id}`, libelle: `Lot MOE ${s.lot_moe_id}`, ordre: String(s.lot_moe_id) };
  }
}

// --- Calculs ---------------------------------------------------------------------------------------
type Reponses = Record<string, unknown>;
export const rep = (j: unknown): Reponses => (j && typeof j === "object" && !Array.isArray(j) ? (j as Reponses) : {});
export const liste = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Rapports MOE par site, du plus ancien au plus récent. */
export function rapportsParSite(rapports: RapportMoe[]): Map<string, RapportMoe[]> {
  const m = new Map<string, RapportMoe[]>();
  for (const r of rapports) m.set(r.site_id, [...(m.get(r.site_id) ?? []), r]);
  for (const l of m.values()) l.sort((a, b) => a.date_visite.localeCompare(b.date_visite) || a.created_at.localeCompare(b.created_at));
  return m;
}

/** Dernier rapport MOE reçu au plus tard à cette date. */
export function dernierA(rapports: RapportMoe[] | undefined, date: string): RapportMoe | null {
  if (!rapports) return null;
  let dernier: RapportMoe | null = null;
  for (const r of rapports) if (r.date_visite <= date) dernier = r;
  return dernier;
}

export const avancementA = (rapports: RapportMoe[] | undefined, date: string) => Number(dernierA(rapports, date)?.avancement ?? 0);

/** Avancement d'un ensemble de sites à une date, pondéré par leur montant DQE. */
export function avancementPerimetre(sites: SiteRapport[], parSite: Map<string, RapportMoe[]>, date: string): number | null {
  const total = sites.reduce((a, s) => a + s.montant, 0);
  if (!total) return null;
  return sites.reduce((a, s) => a + s.montant * avancementA(parSite.get(s.id), date), 0) / total;
}

/** Dates de la courbe : chaque semaine depuis le début de la période, et la fin. */
export function datesCourbe(du: string, au: string): string[] {
  const dates: string[] = [];
  const d = new Date(`${du}T00:00:00Z`);
  while (dateIso(d) < au) {
    dates.push(dateIso(d));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  dates.push(au);
  return dates;
}

const moyenne = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

/** Effectif moyen d'un ensemble de rapports MOE (null si aucun effectif saisi). */
export function effectifs(formulaires: FormulairePeriode[]): { ouvriers: number | null; qualifies: number | null; rapports: number } {
  const avec = formulaires.filter((f) => typeof rep(f.reponses).ouvriers === "number");
  return {
    ouvriers: moyenne(avec.map((f) => rep(f.reponses).ouvriers as number)),
    qualifies: moyenne(
      avec.filter((f) => typeof rep(f.reponses).ouvriers_qualifies === "number").map((f) => rep(f.reponses).ouvriers_qualifies as number)
    ),
    rapports: avec.length,
  };
}

/** Effectif moyen d'un périmètre : moyenne des moyennes par site. */
export function effectifMoyenSites(siteIds: string[], moeParSite: Map<string, FormulairePeriode[]>) {
  const parSite = siteIds.map((id) => effectifs(moeParSite.get(id) ?? [])).filter((e) => e.ouvriers !== null);
  return {
    ouvriers: moyenne(parSite.map((e) => e.ouvriers!)),
    qualifies: moyenne(parSite.filter((e) => e.qualifies !== null).map((e) => e.qualifies!)),
    sites: parSite.length,
  };
}

/** Comptage par réponse : nombre de formulaires et de sites concernés. */
export function compter(
  formulaires: FormulairePeriode[],
  valeurs: (f: FormulairePeriode) => string[]
): Map<string, { formulaires: number; sites: Set<string> }> {
  const m = new Map<string, { formulaires: number; sites: Set<string> }>();
  for (const f of formulaires) {
    for (const v of new Set(valeurs(f))) {
      const e = m.get(v) ?? { formulaires: 0, sites: new Set<string>() };
      e.formulaires++;
      e.sites.add(f.site_id);
      m.set(v, e);
    }
  }
  return m;
}
