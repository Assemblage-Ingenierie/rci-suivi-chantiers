import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import type { RoleUtilisateur } from "@/lib/constants";
import { ROLES_DEMANDABLES } from "@/lib/auth-roles";

export type Profil = Tables<"chantierci_profiles">;

/**
 * Utilisateur connecté + son profil (null si absent). Mis en cache pour la
 * durée d'une requête : le layout protégé et la page (exigerRole) partagent
 * ainsi un seul aller-retour vers Supabase au lieu de deux.
 */
export const getUtilisateurEtProfil = cache(async function getUtilisateurEtProfil(): Promise<{
  user: User | null;
  profil: Profil | null;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profil: null };

  const { data: profil } = await supabase
    .from("chantierci_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profil };
});

/**
 * Crée le profil à la première connexion d'un compte inscrit par email, à
 * partir des métadonnées saisies à l'inscription. La politique RLS impose
 * statut `en_attente`, aucun lot ni identifiant : l'admin valide ensuite.
 * (Les comptes CSTC sont créés par l'admin avec leur profil.)
 */
export async function creerProfilSiAbsent(user: User): Promise<Profil | null> {
  const supabase = createClient();
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;

  const roleSouhaite = ROLES_DEMANDABLES.includes(meta.role_souhaite as RoleUtilisateur)
    ? (meta.role_souhaite as RoleUtilisateur)
    : "moe_controleur";

  const { data: profil } = await supabase
    .from("chantierci_profiles")
    .insert({
      id: user.id,
      email: user.email ?? "",
      nom_complet: typeof meta.nom_complet === "string" ? meta.nom_complet : "",
      telephone: typeof meta.telephone === "string" ? meta.telephone : "",
      role: roleSouhaite,
      statut_compte: "en_attente",
    })
    .select()
    .maybeSingle();

  return profil;
}

/** Page d'accueil selon le rôle (compte actif). */
export function routeParRole(role: RoleUtilisateur): string {
  switch (role) {
    case "cstc":
      return "/cstc";
    case "moe_controleur":
    case "moe_chef":
      return "/moe";
    default:
      return "/tableau-de-bord";
  }
}

/**
 * Garde de page serveur : renvoie le profil actif si son rôle est autorisé,
 * sinon redirige vers sa page d'accueil. (Le layout protégé a déjà vérifié la
 * session et l'activation du compte ; la RLS reste la vraie barrière.)
 */
export async function exigerRole(roles: RoleUtilisateur[]): Promise<Profil> {
  const { user, profil } = await getUtilisateurEtProfil();
  if (!user) redirect("/connexion");
  if (!profil || profil.statut_compte !== "actif") redirect("/en-attente");
  if (!roles.includes(profil.role)) redirect(routeParRole(profil.role));
  return profil;
}
