import type { Enums } from "@/lib/database.types";

export type RoleUtilisateur = Enums<"chantierci_role">;
export type StatutCompte = Enums<"chantierci_statut_compte">;
export type TypeLatrines = Enums<"chantierci_type_latrines">;

export const LIBELLES_ROLES: Record<RoleUtilisateur, string> = {
  cstc: "CSTC",
  moe_controleur: "MOE — Contrôleur des travaux",
  moe_chef: "MOE — Chef de mission",
  ug: "Unité de gestion (UG)",
  admin: "Administrateur",
};

/** Famille de profil : pilote la couleur d'accent (src/theme/theme.css). */
export type FamilleProfil = "cstc" | "moe" | "ug" | "admin";

export function familleProfil(role: RoleUtilisateur): FamilleProfil {
  if (role === "moe_controleur" || role === "moe_chef") return "moe";
  return role;
}

/** Profils de terrain : interface mobile, sans barre latérale. */
export function estProfilTerrain(role: RoleUtilisateur): boolean {
  return familleProfil(role) === "cstc" || familleProfil(role) === "moe";
}

export const LIBELLES_LATRINES: Record<TypeLatrines, string> = {
  seches: "Latrines sèches",
  a_eau: "Latrines à eau",
};

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(new Date(date));
}
