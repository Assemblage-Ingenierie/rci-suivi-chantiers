import { redirect } from "next/navigation";
import { getUtilisateurEtProfil } from "@/lib/auth";
import { familleProfil } from "@/lib/constants";
import { LayoutShell } from "@/components/LayoutShell";

export default async function LayoutProtege({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, profil } = await getUtilisateurEtProfil();
  if (!user) redirect("/connexion");
  if (!profil) redirect("/");
  if (profil.statut_compte !== "actif") redirect("/en-attente");

  // data-profil choisit la couleur d'accent du profil (src/theme/theme.css).
  return (
    <div data-profil={familleProfil(profil.role)} className="min-h-screen bg-fond">
      <LayoutShell nomComplet={profil.nom_complet} role={profil.role}>
        {children}
      </LayoutShell>
    </div>
  );
}
