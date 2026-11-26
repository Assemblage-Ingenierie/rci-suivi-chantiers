/**
 * Difficultés d'un site, déduites de ses dernières visites (vue
 * chantierci_v_etat_sites). Utilisé par le tableau de bord (nombre de sites à
 * suivre) et par l'onglet « Difficultés » (détail par site).
 *
 * Pour ajouter un type : l'ajouter à TYPES_DIFFICULTE puis le détecter dans
 * difficultesSite().
 */
import { DEFINITIONS } from "@/lib/formulaires/definitions";
import type { Question, SourceFormulaire } from "@/lib/formulaires/types";
import { dateCourte, joursDepuis, pct, type EtatSite } from "./calculs";

export const DELAI_RAPPORT_MOE_JOURS = 10;
export const RETARD_SIGNALE_SEMAINES = 2;

export type TypeDifficulte = "arret" | "rapport" | "ecart" | "moe" | "qualite" | "ug" | "cstc";

export const TYPES_DIFFICULTE: { cle: TypeDifficulte; libelle: string; description: string; gravite: number }[] = [
  { cle: "arret", libelle: "Chantier arrêté", description: "Dernier rapport MOE : chantier arrêté", gravite: 3 },
  { cle: "moe", libelle: "Problèmes signalés par la MOE", description: "Effectif, approvisionnement, paiement… ou retard estimé d'au moins 2 semaines", gravite: 2 },
  { cle: "ecart", libelle: "Écart UG / MOE", description: "Dernière fiche UG éloignée du rapport MOE le plus proche", gravite: 2 },
  { cle: "rapport", libelle: "Rapport MOE manquant", description: `Aucun rapport MOE depuis plus de ${DELAI_RAPPORT_MOE_JOURS} jours`, gravite: 2 },
  { cle: "qualite", libelle: "Non-conformité", description: "Ouvrage jugé non conforme dans le dernier rapport MOE", gravite: 1 },
  { cle: "ug", libelle: "Difficultés relevées par l'UG", description: "Dernière fiche UG", gravite: 1 },
  { cle: "cstc", libelle: "Signalement CSTC", description: "Danger pour les enfants, problème sur le bâtiment ou tensions", gravite: 1 },
];

export type Difficulte = { type: TypeDifficulte; texte: string };

type Reponses = Record<string, unknown>;
const rep = (j: unknown): Reponses => (j && typeof j === "object" && !Array.isArray(j) ? (j as Reponses) : {});
const liste = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function question(source: SourceFormulaire, id: string): Question | undefined {
  for (const s of DEFINITIONS[source].sections) for (const q of s.questions) if (q.id === id) return q;
  return undefined;
}

/** Libellés des réponses à choix d'une question, hors réponse « rien à signaler ». */
function libelles(source: SourceFormulaire, id: string, valeurs: string[]): string[] {
  const q = question(source, id);
  const options = q && q.type === "choix" ? q.options : [];
  const neutre = q && q.type === "choix" ? q.exclusive : undefined;
  return valeurs.filter((v) => v !== neutre).map((v) => options.find((o) => o.valeur === v)?.libelle ?? v);
}

function elementsNonConformes(r: Reponses): string[] {
  const q = question("moe", "qualite");
  const valeurs = rep(r.qualite);
  if (!q || q.type !== "qualite") return [];
  return q.elements.filter((e) => valeurs[e.valeur] === "non_conforme").map((e) => e.libelle);
}

export function difficultesSite(s: EtatSite, aujourdhui = new Date()): Difficulte[] {
  const d: Difficulte[] = [];
  const moe = rep(s.moe_reponses);

  if (s.moe_statut === "arrete") {
    const j = joursDepuis(s.moe_arrete_depuis, aujourdhui);
    d.push({
      type: "arret",
      texte: s.moe_arrete_depuis
        ? `Arrêté depuis le ${dateCourte(s.moe_arrete_depuis)}${j !== null && j >= 7 ? ` (${Math.floor(j / 7)} sem.)` : ""}`
        : "Arrêté",
    });
  }

  const jours = joursDepuis(s.moe_date, aujourdhui);
  if (jours === null) d.push({ type: "rapport", texte: "Aucun rapport MOE" });
  else if (jours > DELAI_RAPPORT_MOE_JOURS) d.push({ type: "rapport", texte: `Dernier rapport MOE il y a ${jours} jours` });

  if (s.discordance && s.ecart_ug_moe !== null) {
    const e = Number(s.ecart_ug_moe);
    d.push({
      type: "ecart",
      texte: `UG ${pct(Number(s.ug_avancement))} / MOE ${pct(Number(s.ug_avancement_moe_compare))} (${e > 0 ? "+" : ""}${String(e).replace(".", ",")} pts)`,
    });
  }

  const problemes = libelles("moe", "problemes", liste(moe.problemes));
  const retard = typeof moe.retard_semaines === "number" ? moe.retard_semaines : 0;
  if (problemes.length || retard >= RETARD_SIGNALE_SEMAINES) {
    const morceaux = [...problemes];
    if (retard >= RETARD_SIGNALE_SEMAINES) morceaux.push(`retard estimé ${retard} sem.`);
    if (moe.suite === "mise_en_demeure") morceaux.push("mise en demeure proposée");
    d.push({ type: "moe", texte: morceaux.join(", ") });
  }

  const nonConformes = elementsNonConformes(moe);
  if (nonConformes.length) d.push({ type: "qualite", texte: nonConformes.join(", ") });

  const ug = libelles("ug", "difficultes", liste(rep(s.ug_reponses).difficultes));
  if (ug.length) d.push({ type: "ug", texte: `${ug.join(", ")} (${dateCourte(s.ug_date)})` });

  const cstc = rep(s.cstc_reponses);
  const signalements: string[] = [];
  if (rep(cstc.securite).dangers === "oui") signalements.push("danger pour les enfants");
  signalements.push(...libelles("cstc", "problemes_batiment", liste(cstc.problemes_batiment)).map((l) => l.toLowerCase()));
  const tensions = libelles("cstc", "tensions", liste(cstc.tensions));
  if (tensions.length) signalements.push(`tensions (${tensions.join(", ").toLowerCase()})`);
  if (signalements.length) d.push({ type: "cstc", texte: `${signalements.join(", ")} (${dateCourte(s.cstc_date)})` });

  return d;
}

/** Score de gravité d'un site (tri de la liste des difficultés). */
export const gravite = (d: Difficulte[]) =>
  d.reduce((a, x) => a + (TYPES_DIFFICULTE.find((t) => t.cle === x.type)?.gravite ?? 0), 0);
