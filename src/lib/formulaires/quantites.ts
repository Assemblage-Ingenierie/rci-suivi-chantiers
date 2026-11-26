/**
 * Contrôle des quantités (fiche UG) : quantités PRÉVUES par le DQE type du
 * DAO pour une salle de pré-primaire et un bloc de latrines 3 cabines.
 * Modifier ici si le DQE évolue.
 */
export type ElementQuantite = {
  id: string;
  libelle: string;
  unite: string;
  prevu: number;
  /** Uniquement pour un site électrifié. */
  siElectricite?: boolean;
};

export const QUANTITES_DQE: ElementQuantite[] = [
  { id: "dallage", libelle: "Dallage béton armé", unite: "m²", prevu: 78 },
  { id: "mur_agglos", libelle: "Murs en agglos creux de 15", unite: "m²", prevu: 136 },
  { id: "claustras", libelle: "Claustras", unite: "m²", prevu: 24 },
  { id: "enduits", libelle: "Enduits intérieurs et extérieurs", unite: "m²", prevu: 285 },
  { id: "couverture", libelle: "Couverture bac aluzinc", unite: "m²", prevu: 134 },
  { id: "faux_plafond", libelle: "Faux-plafond contreplaqué", unite: "m²", prevu: 116 },
  { id: "portes_2v", libelle: "Portes persiennées 2 vantaux (1,40 × 2,15)", unite: "u", prevu: 1 },
  { id: "portes_1v", libelle: "Portes persiennées 1 vantail (0,90 × 2,15)", unite: "u", prevu: 1 },
  { id: "persiennes", libelle: "Persiennes 1,10 × 1,62", unite: "u", prevu: 2 },
  { id: "tableau", libelle: "Tableau de classe", unite: "m²", prevu: 5.95 },
  { id: "placards", libelle: "Placards 2 battants", unite: "u", prevu: 2 },
  { id: "reglettes", libelle: "Réglettes fluo 1 × 36 W", unite: "u", prevu: 7, siElectricite: true },
  { id: "cabines", libelle: "Cabines de latrines", unite: "u", prevu: 3 },
];

export function quantitesDuSite(electricite: boolean): ElementQuantite[] {
  return QUANTITES_DQE.filter((q) => electricite || !q.siElectricite);
}

export function formatNombre(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n);
}
