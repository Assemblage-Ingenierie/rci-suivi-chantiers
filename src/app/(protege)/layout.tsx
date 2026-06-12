import { redirect } from "next/navigation";
import { getUtilisateurEtProfil } from "@/lib/auth";
import { LayoutShell } from "@/components/LayoutShell";
import { FournisseurOffline } from "@/components/offline/FournisseurOffline";

export default async function LayoutProtege({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, profil } = await getUtilisateurEtProfil();
  if (!user) redirect("/connexion");
  if (!profil) redirect("/");
  if (profil.statut_compte !== "actif") redirect("/en-attente");

  return (
    <>
      <LayoutShell nomComplet={profil.nom_complet} role={profil.role}>
        {children}
      </LayoutShell>
      <FournisseurOffline role={profil.role} />
    </>
  );
}
