import type { Enums } from "@/lib/database.types";

export type RoleUtilisateur = Enums<"chantierci_user_role">;
export type StatutCompte = Enums<"chantierci_statut_compte">;
export type StatutChantier = Enums<"chantierci_statut_chantier">;

export const LIBELLES_ROLES: Record<RoleUtilisateur, string> = {
  coges: "COGES",
  regional: "Responsable régional",
  national: "MEN — National",
  admin: "Administrateur",
};

export const LIBELLES_STATUTS_CHANTIER: Record<StatutChantier, string> = {
  non_demarre: "Non démarré",
  en_cours: "En cours",
  arrete: "Arrêté",
  receptionne: "Réceptionné",
};

/** Couleurs de statut (carte + badges), cf. CDC §5.3. */
export const COULEURS_STATUTS_CHANTIER: Record<StatutChantier, string> = {
  non_demarre: "#9CA3AF", // gris
  en_cours: "#3B82F6", // bleu
  arrete: "#F97316", // orange
  receptionne: "#22C55E", // vert
};

export const LIBELLES_RAISONS_ARRET: Record<string, string> = {
  manque_effectif: "Manque d'effectif",
  manque_materiau: "Manque de matériaux",
  probleme_paiement: "Problème de paiement",
  autre: "Autre",
};

/** Format XOF sans décimales. */
export function formatXOF(montant: number | null | undefined): string {
  if (montant === null || montant === undefined) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(montant);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(
    new Date(date)
  );
}
