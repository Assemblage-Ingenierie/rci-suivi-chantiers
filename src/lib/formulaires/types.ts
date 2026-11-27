import type { Enums, Json } from "@/lib/database.types";

export type SourceFormulaire = Enums<"chantierci_source_formulaire">;
export type StatutChantier = Enums<"chantierci_statut_chantier">;

export type Option = { valeur: string; libelle: string };

/** Questions possibles d'un formulaire (rendu et affichage génériques). */
export type Question =
  | { type: "statut"; id: "statut"; libelle: string; requis?: boolean }
  | { type: "date"; id: "date_visite"; libelle: string }
  | {
      type: "choix";
      id: string;
      libelle: string;
      options: Option[];
      multiple?: boolean;
      /** Valeur qui désélectionne les autres (ex. « Aucun »). */
      exclusive?: string;
      colonnes?: 1 | 2 | 3 | 4;
      requis?: boolean;
    }
  | { type: "oui_non"; id: string; libelle: string; elements: Option[] }
  | { type: "qualite"; id: string; libelle: string; elements: Option[] }
  | { type: "nombre"; id: string; libelle: string; min?: number; max?: number; pas?: number; alerteSiPositif?: boolean }
  | {
      type: "texte";
      id: string;
      libelle: string;
      indication?: string;
      /** Affiché et obligatoire seulement si la question indiquée contient cette valeur (ex. un élément « non conforme »). */
      obligatoireSi?: { question: string; valeur: string };
    }
  | { type: "commentaire"; id: "commentaire"; libelle: string; indication?: string }
  | { type: "postes"; id: "postes"; libelle: string }
  | { type: "quantites"; id: "quantites"; libelle: string }
  | { type: "photos"; id: "photos"; libelle: string; minimum?: number };

export type Section = { id: string; titre: string; numero?: number; questions: Question[] };

export type DefinitionFormulaire = {
  source: SourceFormulaire;
  /** Titre court (bouton, historique). */
  titre: string;
  /** Sur-titre du bandeau (ex. « Fiche de visite technique · UG »). */
  surTitre: string;
  /** Sections affichées en onglets d'ancrage en haut du formulaire. */
  avecOnglets: boolean;
  sections: Section[];
};

/** Postes d'avancement : { classe: { code: 0-100 }, latrines: { code: 0-100 } }. */
export type ValeursPostes = { classe?: Record<string, number>; latrines?: Record<string, number> };

/** Réponses libres du formulaire, indexées par identifiant de question. */
export type Reponses = Record<string, Json>;

/** Poste d'avancement : poids = montant au DQE (FCFA HT). */
export type PosteDef = {
  ouvrage: string;
  code: string;
  libelle: string;
  poids: number;
  /** Montant pour un site sans électricité, s'il diffère (sinon poids). */
  poids_sans_electricite?: number | null;
  /** Corps d'état (lot du DQE) du poste. */
  corps_etat?: string | null;
  ordre: number;
};
/** Corps d'état (lot du DQE) : regroupe les postes de la salle de classe et des latrines. */
export type CorpsEtat = { code: string; libelle: string; ordre: number };
export type Parametres = Record<string, number>;
