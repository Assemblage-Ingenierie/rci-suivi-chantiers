import { redirect } from "next/navigation";
import { getUtilisateurEtProfil } from "@/lib/auth";
import { AppCoges } from "@/components/coges/AppCoges";

export const metadata = { title: "Mes établissements — Suivi chantiers MEN CI" };

/**
 * Interface COGES (CDC §5.2) : coquille serveur (garde de rôle) + application
 * cliente alimentée par IndexedDB — liste, fiche et formulaire de visite
 * fonctionnent hors ligne (vues internes sans navigation serveur).
 */
export default async function PageCoges() {
  const { user, profil } = await getUtilisateurEtProfil();
  if (!user || !profil) redirect("/");
  if (profil.role !== "coges" && profil.role !== "admin")
    redirect("/tableau-de-bord");

  return <AppCoges userId={user.id} nomComplet={profil.nom_complet} />;
}
