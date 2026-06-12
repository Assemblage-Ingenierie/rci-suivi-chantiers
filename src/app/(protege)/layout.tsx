import { redirect } from "next/navigation";
import { getUtilisateurEtProfil } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { FournisseurOffline } from "@/components/offline/FournisseurOffline";

/**
 * Coquille des pages protégées : exige une session ET un compte actif.
 * (Le middleware gère déjà la redirection des non-connectés ; ici on contrôle
 * le statut du compte et on fournit la sidebar.)
 */
export default async function LayoutProtege({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, profil } = await getUtilisateurEtProfil();
  if (!user) redirect("/connexion");
  if (!profil) redirect("/"); // première connexion : la racine crée le profil
  if (profil.statut_compte !== "actif") redirect("/en-attente");

  return (
    <div className="flex min-h-screen">
      <Sidebar nomComplet={profil.nom_complet} role={profil.role} />
      <main className="min-w-0 flex-1">{children}</main>
      <FournisseurOffline role={profil.role} />
    </div>
  );
}
