/**
 * Droits sur les formulaires, côté écran (afficher ou non un bouton).
 * Miroir des fonctions SQL peut_saisir / peut_modifier_visite : la base reste
 * la vraie barrière (RLS).
 */
import type { RoleUtilisateur } from "@/lib/constants";
import type { SourceFormulaire } from "./types";

export function sourcesSaisissables(role: RoleUtilisateur): SourceFormulaire[] {
  switch (role) {
    case "admin":
      return ["cstc", "moe", "ug"];
    case "ug":
      return ["ug"];
    case "cstc":
      return ["cstc"];
    case "moe_controleur":
    case "moe_chef":
      return ["moe"];
  }
}

export function peutModifier(
  profil: { id: string; role: RoleUtilisateur; lot_moe_id: number | null },
  visite: { source: SourceFormulaire; auteur_id: string | null; created_at: string; lot_moe_id: number },
  delaiCstcJours: number
): boolean {
  switch (profil.role) {
    case "admin":
      return true;
    case "cstc":
      return (
        visite.source === "cstc" &&
        visite.auteur_id === profil.id &&
        Date.now() <= new Date(visite.created_at).getTime() + delaiCstcJours * 86_400_000
      );
    case "moe_controleur":
      return visite.source === "moe" && visite.auteur_id === profil.id;
    case "moe_chef":
      return visite.source === "moe" && visite.lot_moe_id === profil.lot_moe_id;
    case "ug":
      return visite.source === "ug" && visite.auteur_id === profil.id;
  }
}
