/**
 * ALERTES — règles explicites, appliquées aux derniers formulaires de chaque
 * site (vue chantierci_v_etat_sites). Chaque règle a une famille, une source,
 * un niveau et une description affichée telle quelle à l'utilisateur
 * (encadré « Comment sont calculées les alertes ») : ce qui est décrit est
 * exactement ce qui est calculé.
 *
 * - Seuls les formulaires de moins de `fraicheur_alertes_jours` jours sont
 *   pris en compte (sauf le planning, qui compare toujours le dernier
 *   avancement MOE au planning théorique).
 * - Les tensions signalées par le CSTC et les formulaires manquants (onglet
 *   Suivi) ne font pas partie des alertes.
 * - Tri : nombre d'alertes critiques, puis nombre d'alertes à surveiller.
 */
import { DEFINITIONS } from "@/lib/formulaires/definitions";
import type { Parametres, Question, SourceFormulaire, StatutChantier } from "@/lib/formulaires/types";
import { LIBELLES_STATUTS } from "@/lib/formulaires/statuts";
import { dateCourte, joursDepuis, pct, type EtatSite } from "@/lib/tableau-de-bord/calculs";

export type FamilleAlerte = "presence" | "securite" | "qualite" | "planning" | "ecart";
export type NiveauAlerte = "critique" | "surveiller";
export type SourceAlerte = SourceFormulaire | "planning";

export const FAMILLES: { cle: FamilleAlerte; libelle: string; court: string; description: string }[] = [
  { cle: "presence", libelle: "Présence et moyens", court: "Présence, moyens", description: "Chantier arrêté, ouvriers ou entreprise absents, manque de moyens" },
  { cle: "securite", libelle: "Sécurité", court: "Sécurité", description: "Sécurité des enfants et des ouvriers sur le chantier" },
  { cle: "qualite", libelle: "Qualité des ouvrages", court: "Qualité", description: "Non-conformités, malfaçons, problèmes sur le bâtiment" },
  { cle: "planning", libelle: "Retard sur le planning", court: "Planning", description: "Avancement réel comparé à l'avancement théorique" },
  { cle: "ecart", libelle: "Écart entre sources", court: "Écart sources", description: "MOE, UG et CSTC ne disent pas la même chose" },
];

export type Alerte = {
  famille: FamilleAlerte;
  niveau: NiveauAlerte;
  regle: string;
  texte: string;
  source: SourceAlerte;
  /** Date du formulaire à l'origine de l'alerte. */
  date: string | null;
};

/** Colonnes de la vue nécessaires au calcul des alertes. */
export type DonneesAlertes = Pick<
  EtatSite,
  | "moe_statut"
  | "moe_date"
  | "moe_avancement"
  | "moe_arrete_depuis"
  | "moe_reponses"
  | "ug_statut"
  | "ug_date"
  | "ug_avancement"
  | "ug_avancement_moe_compare"
  | "ecart_ug_moe"
  | "ug_reponses"
  | "cstc_statut"
  | "cstc_date"
  | "cstc_reponses"
  | "date_debut"
>;

export type ParametresAlertes = {
  fraicheurJours: number;
  delaiMois: number;
  seuilRetardOrange: number;
  seuilRetardRouge: number;
  seuilEcart: number;
  retardMoeOrange: number;
  retardMoeRouge: number;
};

export function parametresAlertes(p: Parametres): ParametresAlertes {
  return {
    fraicheurJours: p.fraicheur_alertes_jours ?? 30,
    delaiMois: p.delai_travaux_mois ?? 5,
    seuilRetardOrange: p.seuil_retard_orange ?? 10,
    seuilRetardRouge: p.seuil_retard_rouge ?? 20,
    seuilEcart: p.seuil_ecart_ug_moe ?? 5,
    retardMoeOrange: 2,
    retardMoeRouge: 4,
  };
}

// --- Lecture des réponses ----------------------------------------------------------------
type Reponses = Record<string, unknown>;
const rep = (j: unknown): Reponses => (j && typeof j === "object" && !Array.isArray(j) ? (j as Reponses) : {});
const liste = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function question(source: SourceFormulaire, id: string): Question | undefined {
  for (const s of DEFINITIONS[source].sections) for (const q of s.questions) if (q.id === id) return q;
  return undefined;
}
/** Libellés d'options (choix) ou d'éléments (oui/non, qualité) d'une question. */
function libelle(source: SourceFormulaire, id: string, valeur: string): string {
  const q = question(source, id);
  if (!q) return valeur;
  const options = q.type === "choix" ? q.options : q.type === "oui_non" || q.type === "qualite" ? q.elements : [];
  return options.find((o) => o.valeur === valeur)?.libelle ?? valeur;
}
const libelles = (source: SourceFormulaire, id: string, valeurs: string[]) => valeurs.map((v) => libelle(source, id, v));

// --- Contexte d'un site --------------------------------------------------------------------
type Contexte = {
  s: DonneesAlertes;
  p: ParametresAlertes;
  aujourdhui: Date;
  /** Réponses des derniers formulaires récents (null si absent ou trop ancien). */
  moe: Reponses | null;
  cstc: Reponses | null;
  ug: Reponses | null;
};

type Detection = { niveau: NiveauAlerte; texte: string } | null;

type Regle = {
  id: string;
  famille: FamilleAlerte;
  source: SourceAlerte;
  /** Niveau(x) possible(s), pour l'encadré explicatif. */
  niveaux: string;
  description: (p: ParametresAlertes) => string;
  detecter: (c: Contexte) => Detection;
};

const surveiller = (texte: string): Detection => ({ niveau: "surveiller", texte });
const critique = (texte: string): Detection => ({ niveau: "critique", texte });

const PROBLEMES_MOYENS = ["effectif", "approvisionnement", "paiement", "acces", "intemperies"];
const DIFFICULTES_UG_MOYENS = ["materiaux_manquants", "acces"];
const AUTRES_SECURITE_MOE = ["panneau", "epi", "stockage"];

type Groupe = "actif" | "arret" | "fini" | "pas";
const groupe = (st: StatutChantier | null): Groupe | null =>
  st === "en_cours" ? "actif" : st === "arrete" ? "arret" : st === "termine" || st === "receptionne" ? "fini" : st === "non_demarre" ? "pas" : null;

/** Avancement théorique (%) : linéaire sur le délai depuis la date de début. */
export function avancementTheorique(dateDebut: string | null, delaiMois: number, aujourdhui = new Date()): number | null {
  if (!dateDebut) return null;
  const jours = joursDepuis(dateDebut, aujourdhui);
  if (jours === null || jours < 0) return null;
  return Math.min(100, (100 * jours) / (delaiMois * 30.44));
}

export const REGLES: Regle[] = [
  // --- Présence et moyens ---
  {
    id: "arret",
    famille: "presence",
    source: "moe",
    niveaux: "Critique",
    description: () => "Le dernier rapport MOE indique « Arrêté ».",
    detecter: ({ s, moe }) =>
      moe && s.moe_statut === "arrete"
        ? critique(s.moe_arrete_depuis ? `Arrêté depuis le ${dateCourte(s.moe_arrete_depuis)}` : "Chantier arrêté")
        : null,
  },
  {
    id: "zero_ouvrier",
    famille: "presence",
    source: "moe",
    niveaux: "Critique",
    description: () => "Chantier « en cours » selon la MOE, mais 0 ouvrier présent lors de sa visite.",
    detecter: ({ s, moe }) => (moe && s.moe_statut === "en_cours" && moe.ouvriers === 0 ? critique("Aucun ouvrier (MOE)") : null),
  },
  {
    id: "ouvriers_absents_cstc",
    famille: "presence",
    source: "cstc",
    niveaux: "À surveiller",
    description: () => "Le CSTC n'a vu aucun ouvrier lors de son dernier passage.",
    detecter: ({ cstc }) => (cstc?.ouvriers_presents === "non" ? surveiller("Pas d'ouvriers (CSTC)") : null),
  },
  {
    id: "entreprise_absente_ug",
    famille: "presence",
    source: "ug",
    niveaux: "À surveiller",
    description: () => "L'UG signale l'entreprise absente.",
    detecter: ({ ug }) => (liste(ug?.difficultes).includes("entreprise_absente") ? surveiller("Entreprise absente (UG)") : null),
  },
  {
    id: "chef_absent",
    famille: "presence",
    source: "moe",
    niveaux: "À surveiller",
    description: () => "Chef de chantier absent lors de la visite MOE.",
    detecter: ({ moe }) => (moe?.chef_chantier === "non" ? surveiller("Chef de chantier absent") : null),
  },
  {
    id: "moyens_moe",
    famille: "presence",
    source: "moe",
    niveaux: "À surveiller",
    description: () => "La MOE signale un problème d'effectif, d'approvisionnement, de paiement de l'entreprise, d'accès ou d'intempéries.",
    detecter: ({ moe }) => {
      const p = liste(moe?.problemes).filter((x) => PROBLEMES_MOYENS.includes(x));
      return p.length ? surveiller(libelles("moe", "problemes", p).join(", ")) : null;
    },
  },
  {
    id: "moyens_ug",
    famille: "presence",
    source: "ug",
    niveaux: "À surveiller",
    description: () => "L'UG signale des matériaux manquants ou un problème d'accès.",
    detecter: ({ ug }) => {
      const d = liste(ug?.difficultes).filter((x) => DIFFICULTES_UG_MOYENS.includes(x));
      return d.length ? surveiller(libelles("ug", "difficultes", d).join(", ")) : null;
    },
  },
  // --- Sécurité ---
  {
    id: "danger_enfants",
    famille: "securite",
    source: "cstc",
    niveaux: "Critique",
    description: () => "Le CSTC voit des trous, matériaux ou ferrailles dangereux à portée des enfants.",
    detecter: ({ cstc }) => (rep(cstc?.securite).dangers === "oui" ? critique("Dangers à portée des enfants") : null),
  },
  {
    id: "zone_non_balisee",
    famille: "securite",
    source: "moe",
    niveaux: "Critique",
    description: () => "La MOE constate que la zone de chantier n'est pas balisée ni séparée des élèves.",
    detecter: ({ moe }) => (rep(moe?.securite).zone_balisee === "non" ? critique("Zone non balisée") : null),
  },
  {
    id: "cour_non_separee",
    famille: "securite",
    source: "cstc",
    niveaux: "À surveiller",
    description: () => "Le CSTC constate que le chantier n'est pas séparé de la cour des élèves.",
    detecter: ({ cstc }) => (rep(cstc?.securite).separe_cour === "non" ? surveiller("Chantier non séparé de la cour") : null),
  },
  {
    id: "epi_cstc",
    famille: "securite",
    source: "cstc",
    niveaux: "À surveiller",
    description: () => "Le CSTC voit des ouvriers sans casque ni chaussures.",
    detecter: ({ cstc }) => (rep(cstc?.securite).epi === "non" ? surveiller("Ouvriers sans protections (CSTC)") : null),
  },
  {
    id: "regles_securite_moe",
    famille: "securite",
    source: "moe",
    niveaux: "À surveiller",
    description: () =>
      "La MOE relève une règle non respectée : panneau de chantier, port des protections ou stockage sécurisé.",
    detecter: ({ moe }) => {
      const sec = rep(moe?.securite);
      const manques = AUTRES_SECURITE_MOE.filter((k) => sec[k] === "non");
      return manques.length ? surveiller(libelles("moe", "securite", manques).join(", ")) : null;
    },
  },
  {
    id: "stockage_ug",
    famille: "securite",
    source: "ug",
    niveaux: "À surveiller",
    description: () => "L'UG signale un stockage non protégé.",
    detecter: ({ ug }) => (liste(ug?.difficultes).includes("stockage_non_protege") ? surveiller("Stockage non protégé (UG)") : null),
  },
  // --- Qualité ---
  {
    id: "non_conformites",
    famille: "qualite",
    source: "moe",
    niveaux: "Critique dès 2 éléments, sinon à surveiller",
    description: () =>
      "La MOE juge un ou plusieurs éléments non conformes au CCTP (implantation, béton, ferraillage, maçonnerie, charpente, latrines).",
    detecter: ({ moe }) => {
      const q = rep(moe?.qualite);
      const nc = Object.keys(q).filter((k) => q[k] === "non_conforme");
      if (!nc.length) return null;
      const texte = `Non conforme : ${libelles("moe", "qualite", nc).join(", ")}`;
      return nc.length >= 2 ? critique(texte) : surveiller(texte);
    },
  },
  {
    id: "malfacon_moe",
    famille: "qualite",
    source: "moe",
    niveaux: "À surveiller",
    description: () => "La MOE signale une malfaçon.",
    detecter: ({ moe }) => (liste(moe?.problemes).includes("malfacon") ? surveiller("Malfaçon (MOE)") : null),
  },
  {
    id: "malfacon_ug",
    famille: "qualite",
    source: "ug",
    niveaux: "À surveiller",
    description: () => "L'UG signale une malfaçon.",
    detecter: ({ ug }) => (liste(ug?.difficultes).includes("malfacon") ? surveiller("Malfaçon (UG)") : null),
  },
  {
    id: "batiment_cstc",
    famille: "qualite",
    source: "cstc",
    niveaux: "À surveiller",
    description: () => "Le CSTC voit un problème sur le bâtiment : fissure, toit abîmé ou fuite, eau stagnante, autre.",
    detecter: ({ cstc }) => {
      const p = liste(cstc?.problemes_batiment).filter((x) => x !== "aucun");
      return p.length ? surveiller(libelles("cstc", "problemes_batiment", p).join(", ")) : null;
    },
  },
  // --- Planning ---
  {
    id: "retard_planning",
    famille: "planning",
    source: "planning",
    niveaux: "Critique / à surveiller selon le retard",
    description: (p) =>
      `Site dont la date de début est connue : avancement théorique linéaire sur ${p.delaiMois} mois, comparé au dernier avancement MOE. Critique à ${p.seuilRetardRouge} points de retard ou plus, à surveiller dès ${p.seuilRetardOrange} points.`,
    detecter: ({ s, p, aujourdhui }) => {
      const theo = avancementTheorique(s.date_debut, p.delaiMois, aujourdhui);
      if (theo === null) return null;
      const reel = s.moe_avancement === null ? 0 : Number(s.moe_avancement);
      const retard = theo - reel;
      const texte = `Théorique ${pct(theo)} / réel ${pct(reel)} (−${Math.round(retard)} pts)`;
      return retard >= p.seuilRetardRouge ? critique(texte) : retard >= p.seuilRetardOrange ? surveiller(texte) : null;
    },
  },
  {
    id: "retard_estime_moe",
    famille: "planning",
    source: "moe",
    niveaux: "Critique / à surveiller selon le retard",
    description: (p) =>
      `En attendant la date de début du site : retard estimé par la MOE dans son rapport. Critique à ${p.retardMoeRouge} semaines ou plus, à surveiller dès ${p.retardMoeOrange} semaines.`,
    detecter: ({ s, p, moe }) => {
      if (s.date_debut || !moe || typeof moe.retard_semaines !== "number") return null;
      const r = moe.retard_semaines;
      const texte = `Retard estimé par la MOE : ${r} sem.`;
      return r >= p.retardMoeRouge ? critique(texte) : r >= p.retardMoeOrange ? surveiller(texte) : null;
    },
  },
  // --- Écart entre sources ---
  {
    id: "ecart_avancement",
    famille: "ecart",
    source: "ug",
    niveaux: "Critique au-delà du triple du seuil, sinon à surveiller",
    description: (p) =>
      `Avancement de la dernière fiche UG éloigné de plus de ${p.seuilEcart} points du rapport MOE le plus proche (à 7 jours près). Critique au-delà de ${3 * p.seuilEcart} points.`,
    detecter: ({ s, ug, p }) => {
      if (!ug || s.ecart_ug_moe === null || s.ug_avancement === null || s.ug_avancement_moe_compare === null) return null;
      const e = Number(s.ecart_ug_moe);
      if (Math.abs(e) <= p.seuilEcart) return null;
      const texte = `UG ${pct(Number(s.ug_avancement))} / MOE ${pct(Number(s.ug_avancement_moe_compare))} (${e > 0 ? "+" : ""}${String(e).replace(".", ",")} pts)`;
      return Math.abs(e) > 3 * p.seuilEcart ? critique(texte) : surveiller(texte);
    },
  },
  {
    id: "statuts_divergents",
    famille: "ecart",
    source: "cstc",
    niveaux: "À surveiller",
    description: () =>
      "Le statut déclaré par le CSTC ou l'UG (en cours, arrêté, terminé, non démarré) diffère de celui du dernier rapport MOE.",
    detecter: ({ s, moe, cstc, ug }) => {
      if (!moe) return null;
      const ref = groupe(s.moe_statut);
      const autres = [
        cstc ? { qui: "CSTC", st: s.cstc_statut } : null,
        ug ? { qui: "UG", st: s.ug_statut } : null,
      ].filter((x): x is { qui: string; st: StatutChantier | null } => !!x && groupe(x.st) !== null && groupe(x.st) !== ref);
      if (!ref || !autres.length) return null;
      const lib = (st: StatutChantier | null) => (st ? LIBELLES_STATUTS[st] : "—");
      return surveiller(
        `MOE « ${lib(s.moe_statut)} », ${autres.map((a) => `${a.qui} « ${lib(a.st)} »`).join(", ")}`
      );
    },
  },
];

const dateSource = (s: DonneesAlertes, source: SourceAlerte): string | null =>
  source === "moe" ? s.moe_date : source === "cstc" ? s.cstc_date : source === "ug" ? s.ug_date : s.date_debut;

/** Alertes d'un site, de la plus grave à la moins grave. */
export function alertesSite(s: DonneesAlertes, p: ParametresAlertes, aujourdhui = new Date()): Alerte[] {
  const recent = (date: string | null) => {
    const j = joursDepuis(date, aujourdhui);
    return j !== null && j <= p.fraicheurJours;
  };
  const c: Contexte = {
    s,
    p,
    aujourdhui,
    moe: recent(s.moe_date) ? rep(s.moe_reponses) : null,
    cstc: recent(s.cstc_date) ? rep(s.cstc_reponses) : null,
    ug: recent(s.ug_date) ? rep(s.ug_reponses) : null,
  };
  const alertes: Alerte[] = [];
  for (const r of REGLES) {
    const d = r.detecter(c);
    if (!d) continue;
    // Statuts divergents : la date utile est celle de la source qui diverge.
    const source: SourceAlerte = r.id === "statuts_divergents" && !d.texte.includes("CSTC") ? "ug" : r.source;
    alertes.push({ famille: r.famille, niveau: d.niveau, regle: r.id, texte: d.texte, source, date: dateSource(s, source) });
  }
  return alertes.sort((a, b) => (a.niveau === b.niveau ? 0 : a.niveau === "critique" ? -1 : 1));
}

export const nbCritiques = (a: Alerte[]) => a.filter((x) => x.niveau === "critique").length;
export const nbSurveiller = (a: Alerte[]) => a.filter((x) => x.niveau === "surveiller").length;

/** Tri des sites : critiques, puis à surveiller (décroissant). */
export const comparerAlertes = (a: Alerte[], b: Alerte[]) => nbCritiques(b) - nbCritiques(a) || nbSurveiller(b) - nbSurveiller(a);

export const LIBELLE_SOURCE: Record<SourceAlerte, string> = { moe: "MOE", cstc: "CSTC", ug: "UG", planning: "Planning" };

/** Colonnes de la vue lues pour les alertes (en plus de l'identité du site). */
export const COLONNES_ALERTES =
  "id, code, nom, localite, lot_id, lot_moe_id, moe_statut, moe_date, moe_avancement, moe_arrete_depuis, moe_reponses, ug_statut, ug_date, ug_avancement, ug_avancement_moe_compare, ecart_ug_moe, ug_reponses, cstc_statut, cstc_date, cstc_reponses, date_debut";
