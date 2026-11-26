import type { RoleUtilisateur } from "@/lib/constants";

/**
 * Rôles qu'un utilisateur peut demander à l'inscription par email (importable
 * côté client). Les CSTC sont créés par l'admin ; le rôle admin est attribué
 * manuellement.
 */
export const ROLES_DEMANDABLES: RoleUtilisateur[] = ["moe_controleur", "moe_chef", "ug"];
