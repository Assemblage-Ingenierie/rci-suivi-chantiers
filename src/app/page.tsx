import { redirect } from "next/navigation";
import {
  creerProfilSiAbsent,
  getUtilisateurEtProfil,
  routeParRole,
} from "@/lib/auth";

/**
 * Page d'accueil : aiguillage selon la session et le profil.
 * - pas de session            → /connexion (géré aussi par le middleware)
 * - profil absent             → création (première connexion) puis /en-attente
 * - compte en attente/suspendu → /en-attente
 * - compte actif              → /coges ou /tableau-de-bord selon le rôle
 */
export default async function Accueil() {
  const { user, profil: profilExistant } = await getUtilisateurEtProfil();
  if (!user) redirect("/connexion");

  const profil = profilExistant ?? (await creerProfilSiAbsent(user));

  if (!profil || profil.statut_compte !== "actif") redirect("/en-attente");

  redirect(routeParRole(profil.role));
}
