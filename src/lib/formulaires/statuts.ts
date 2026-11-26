import type { SourceFormulaire, StatutChantier } from "./types";

/** Liste unique des statuts (cahier § 4). */
export const STATUTS: StatutChantier[] = ["non_demarre", "en_cours", "arrete", "termine", "receptionne"];

export const LIBELLES_STATUTS: Record<StatutChantier, string> = {
  non_demarre: "Non démarré",
  en_cours: "En cours",
  arrete: "Arrêté",
  termine: "Travaux terminés",
  receptionne: "Réceptionné",
};

/** Libellés en mots simples pour le CSTC (même statut en base). */
export const LIBELLES_STATUTS_CSTC: Partial<Record<StatutChantier, string>> = {
  non_demarre: "Pas encore commencé",
  en_cours: "Ouvriers au travail",
  arrete: "Arrêté / abandonné",
  termine: "Classe terminée",
};

/** Statuts proposés par formulaire (le CSTC ne prononce pas la réception). */
export function statutsProposes(source: SourceFormulaire): { valeur: StatutChantier; libelle: string }[] {
  if (source === "cstc") {
    return (Object.keys(LIBELLES_STATUTS_CSTC) as StatutChantier[]).map((s) => ({
      valeur: s,
      libelle: LIBELLES_STATUTS_CSTC[s]!,
    }));
  }
  return STATUTS.map((s) => ({ valeur: s, libelle: LIBELLES_STATUTS[s] }));
}

/** Teinte du badge de statut (noms d'usage du thème). */
export const TEINTE_STATUT: Record<StatutChantier, string> = {
  non_demarre: "bg-surface-2 text-texte-2 ring-bordure",
  en_cours: "bg-info-clair text-info ring-info/30",
  arrete: "bg-danger-clair text-danger ring-danger/30",
  termine: "bg-succes-clair text-succes ring-succes/30",
  receptionne: "bg-succes text-surface ring-succes",
};

export const LIBELLES_SOURCES: Record<SourceFormulaire, string> = {
  cstc: "CSTC",
  moe: "MOE",
  ug: "UG",
};
