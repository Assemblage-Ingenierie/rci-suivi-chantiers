import type { StatutChantier } from "@/lib/formulaires/types";

/** Variable du thème (src/theme/theme.css) associée à chaque statut ; « aucun » = pas de rapport MOE. */
export const VARIABLE_STATUT: Record<StatutChantier | "aucun", string> = {
  aucun: "--c-statut-sans-rapport",
  non_demarre: "--c-statut-non-demarre",
  en_cours: "--c-statut-en-cours",
  arrete: "--c-statut-arrete",
  termine: "--c-statut-termine",
  receptionne: "--c-statut-receptionne",
};

/** Couleur CSS utilisable dans un attribut style. */
export const couleurStatut = (s: StatutChantier | null) => `rgb(var(${VARIABLE_STATUT[s ?? "aucun"]}))`;

/** Ordre d'affichage et libellés des répartitions par statut. */
export const ORDRE_STATUTS: { cle: StatutChantier | "aucun"; libelle: string }[] = [
  { cle: "en_cours", libelle: "En cours" },
  { cle: "arrete", libelle: "Arrêtés" },
  { cle: "termine", libelle: "Travaux terminés" },
  { cle: "receptionne", libelle: "Réceptionnés" },
  { cle: "non_demarre", libelle: "Non démarrés" },
  { cle: "aucun", libelle: "Sans rapport MOE" },
];
