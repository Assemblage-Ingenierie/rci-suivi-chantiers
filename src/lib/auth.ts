import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import type { RoleUtilisateur } from "@/lib/constants";

export type Profil = Tables<"chantierci_profiles">;

/** Rôles qu'un utilisateur peut demander à l'inscription (jamais admin). */
export const ROLES_DEMANDABLES: RoleUtilisateur[] = [
  "coges",
  "regional",
  "national",
];

/** Utilisateur connecté + son profil chantierci (null si absent). */
export async function getUtilisateurEtProfil(): Promise<{
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
}

/**
 * Crée le profil à la première session authentifiée s'il n'existe pas encore,
 * à partir des métadonnées saisies à l'inscription. Remplace le trigger sur
 * auth.users, impossible sur le projet Supabase partagé (cohabitation PEEB).
 * La politique RLS "chantierci_profiles_insert" force statut_compte =
 * 'en_attente' et lot_ids = '{}' : aucun privilège auto-attribuable.
 */
export async function creerProfilSiAbsent(user: User): Promise<Profil | null> {
  const supabase = createClient();
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;

  const roleSouhaite = ROLES_DEMANDABLES.includes(
    meta.role_souhaite as RoleUtilisateur
  )
    ? (meta.role_souhaite as RoleUtilisateur)
    : "coges";

  const { data: profil } = await supabase
    .from("chantierci_profiles")
    .insert({
      id: user.id,
      email: user.email ?? "",
      nom_complet: typeof meta.nom_complet === "string" ? meta.nom_complet : "",
      telephone: typeof meta.telephone === "string" ? meta.telephone : "",
      role: roleSouhaite,
      statut_compte: "en_attente",
      lot_ids: [],
    })
    .select()
    .maybeSingle();

  return profil;
}

/** Route d'accueil selon le rôle (compte actif). */
export function routeParRole(role: RoleUtilisateur): string {
  return role === "coges" ? "/coges" : "/tableau-de-bord";
}
