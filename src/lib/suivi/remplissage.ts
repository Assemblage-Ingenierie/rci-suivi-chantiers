/**
 * Suivi du remplissage des formulaires (fonction SQL chantierci_remplissage) :
 * nombre de formulaires reçus par site, type et semaine calendaire, et statut
 * déclaré par chaque acteur dans son dernier formulaire.
 *
 * Rythme prévu (cahier) : MOE et CSTC une fois par semaine, UG une fois toutes
 * les deux semaines.
 *
 * RÈGLE (pour éviter les désaccords) : un formulaire n'est attendu — donc
 * compté « manquant » s'il n'arrive pas — que si LE MÊME ACTEUR a indiqué
 * « en cours » dans son dernier formulaire. Après « non démarré », « arrêté »,
 * « terminé » ou « réceptionné », rien n'est attendu de lui jusqu'à son
 * formulaire suivant ; un acteur qui n'a jamais rempli de formulaire pour un
 * site n'est pas compté en retard sur ce site.
 */
import type { SourceFormulaire } from "@/lib/formulaires/types";
import { joursDepuis } from "@/lib/tableau-de-bord/calculs";

export const NB_SEMAINES = 8;
/**
 * Première semaine tracée sur les courbes : la semaine 0 est exclue car, pour
 * l'UG, son attente dépend de la semaine précédente, hors de la fenêtre.
 */
export const PREMIERE_SEMAINE_COURBE = 1;

export type LigneRemplissage = {
  site_id: string;
  date_ref: string; // lundi de la semaine en cours
  moe: number[];
  cstc: number[];
  ug: number[];
  moe_dernier: string | null;
  cstc_dernier: string | null;
  ug_dernier: string | null;
  /** Statut déclaré dans le dernier formulaire reçu avant le lundi de chaque semaine. */
  moe_statuts: (string | null)[];
  cstc_statuts: (string | null)[];
  ug_statuts: (string | null)[];
  moe_dernier_statut: string | null;
  cstc_dernier_statut: string | null;
  ug_dernier_statut: string | null;
};

export type ReglesSource = {
  cle: SourceFormulaire;
  libelle: string;
  acteur: string;
  rythme: string;
  /** Période prévue entre deux formulaires, en semaines. */
  periode: 1 | 2;
  /** Au-delà de ce nombre de jours sans formulaire (après un « en cours »), le site est en retard. */
  retardJours: number;
  couleur: string;
};

export const SOURCES_SUIVI: ReglesSource[] = [
  { cle: "moe", libelle: "MOE", acteur: "Contrôleur de la maîtrise d'œuvre", rythme: "1 rapport par semaine", periode: 1, retardJours: 10, couleur: "rgb(var(--c-source-moe))" },
  { cle: "cstc", libelle: "CSTC", acteur: "Comité de suivi (CSTC)", rythme: "1 signalement par semaine", periode: 1, retardJours: 10, couleur: "rgb(var(--c-source-cstc))" },
  { cle: "ug", libelle: "UG", acteur: "Unité de gestion", rythme: "1 fiche toutes les 2 semaines", periode: 2, retardJours: 17, couleur: "rgb(var(--c-source-ug))" },
];

const EN_COURS = "en_cours";

export const serie = (l: LigneRemplissage | undefined, source: SourceFormulaire): number[] =>
  l?.[source] ?? new Array(NB_SEMAINES).fill(0);
const statuts = (l: LigneRemplissage | undefined, source: SourceFormulaire): (string | null)[] =>
  l?.[`${source}_statuts` as const] ?? new Array(NB_SEMAINES).fill(null);
export const dernier = (l: LigneRemplissage | undefined, source: SourceFormulaire) =>
  (l ? l[`${source}_dernier` as const] : null) as string | null;
export const dernierStatut = (l: LigneRemplissage | undefined, source: SourceFormulaire) =>
  (l ? l[`${source}_dernier_statut` as const] : null) as string | null;

/**
 * Un formulaire est-il attendu pour la semaine i ? Oui si l'acteur avait
 * déclaré « en cours » dans son dernier formulaire avant la période : la
 * semaine (MOE, CSTC) ou la quinzaine se terminant par la semaine i (UG).
 * null : impossible à dire (UG, première semaine de la fenêtre).
 */
export function attendu(l: LigneRemplissage | undefined, r: ReglesSource, i: number): boolean | null {
  const st = statuts(l, r.cle);
  if (r.periode === 1) return st[i] === EN_COURS;
  return i > 0 ? st[i - 1] === EN_COURS : null;
}

/** Formulaire reçu dans la semaine i (ou, pour l'UG, dans la quinzaine se terminant par la semaine i). */
export function recu(l: LigneRemplissage | undefined, r: ReglesSource, i: number): boolean {
  const v = serie(l, r.cle);
  return v[i] > 0 || (r.periode === 2 && i > 0 && v[i - 1] > 0);
}

/** Manquant = attendu et non reçu (semaines terminées seulement). */
export function manquant(l: LigneRemplissage | undefined, r: ReglesSource, i: number): boolean {
  return i < NB_SEMAINES - 1 && attendu(l, r, i) === true && !recu(l, r, i);
}

/**
 * Sur les 4 dernières semaines complètes : nombre de périodes où un formulaire
 * était attendu (semaines, ou quinzaines pour l'UG) et nombre de celles où il a été reçu.
 */
export function comptesSite(l: LigneRemplissage | undefined, r: ReglesSource): { attendus: number; recus: number } {
  const fin = NB_SEMAINES - 1; // semaine en cours, exclue
  const v = serie(l, r.cle);
  const st = statuts(l, r.cle);
  let attendus = 0;
  let recus = 0;
  if (r.periode === 1) {
    for (let i = fin - 4; i < fin; i++) {
      if (st[i] !== EN_COURS) continue;
      attendus++;
      if (v[i] > 0) recus++;
    }
  } else {
    for (const i of [fin - 4, fin - 2]) {
      if (st[i] !== EN_COURS) continue;
      attendus++;
      if (v[i] + v[i + 1] > 0) recus++;
    }
  }
  return { attendus, recus };
}

/** En retard : dernier formulaire « en cours » datant de plus que le délai prévu. */
export function enRetard(l: LigneRemplissage | undefined, r: ReglesSource, aujourdhui = new Date()): boolean {
  if (dernierStatut(l, r.cle) !== EN_COURS) return false;
  const j = joursDepuis(dernier(l, r.cle), aujourdhui);
  return j !== null && j > r.retardJours;
}

/** Site suivi : au moins un acteur a déclaré le chantier « en cours » dans son dernier formulaire. */
export const suivi = (l: LigneRemplissage | undefined) => SOURCES_SUIVI.some((r) => dernierStatut(l, r.cle) === EN_COURS);

export type SyntheseRemplissage = {
  source: ReglesSource;
  /** Formulaires reçus / attendus sur 4 semaines (0–1) ; null si rien n'était attendu. */
  taux: number | null;
  retards: number;
  /** Sites où l'acteur a déclaré « en cours » dans son dernier formulaire. */
  concernes: number;
  /** Part des formulaires attendus reçus, pour chaque semaine complète à partir de PREMIERE_SEMAINE_COURBE. */
  parSemaine: (number | null)[];
};

/** Synthèse par type de formulaire sur un ensemble de sites. */
export function synthese(siteIds: string[], lignes: Map<string, LigneRemplissage>): SyntheseRemplissage[] {
  return SOURCES_SUIVI.map((r) => {
    const ls = siteIds.map((id) => lignes.get(id));
    let attendus = 0;
    let recus = 0;
    for (const l of ls) {
      const c = comptesSite(l, r);
      attendus += c.attendus;
      recus += c.recus;
    }
    const parSemaine = Array.from({ length: NB_SEMAINES - 1 - PREMIERE_SEMAINE_COURBE }, (_, k) => {
      const i = k + PREMIERE_SEMAINE_COURBE;
      const concernes = ls.filter((l) => attendu(l, r, i) === true);
      return concernes.length ? concernes.filter((l) => recu(l, r, i)).length / concernes.length : null;
    });
    return {
      source: r,
      taux: attendus ? recus / attendus : null,
      retards: ls.filter((l) => enRetard(l, r)).length,
      concernes: ls.filter((l) => dernierStatut(l, r.cle) === EN_COURS).length,
      parSemaine,
    };
  });
}

/** Taux d'un site (reçus / attendus sur 4 semaines), null si rien n'était attendu. */
export function tauxSite(l: LigneRemplissage | undefined, r: ReglesSource): number | null {
  const c = comptesSite(l, r);
  return c.attendus ? c.recus / c.attendus : null;
}

/** Lundi de la semaine i (0 = la plus ancienne), à partir du lundi de la semaine en cours. */
export function lundiSemaine(dateRef: string, i: number, nb = NB_SEMAINES): Date {
  const d = new Date(`${dateRef.slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() - 7 * (nb - 1 - i));
  return d;
}

export const jourMois = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(d);
