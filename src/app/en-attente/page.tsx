import { redirect } from "next/navigation";
import { Clock, ShieldAlert } from "lucide-react";
import { getUtilisateurEtProfil, routeParRole } from "@/lib/auth";
import { BoutonDeconnexion } from "@/components/BoutonDeconnexion";
import { LogoAssemblage } from "@/components/LogoAssemblage";

export const metadata = { title: "Compte en attente — Suivi chantiers MEN CI" };

export default async function PageEnAttente() {
  const { user, profil } = await getUtilisateurEtProfil();
  if (!user) redirect("/connexion");
  if (profil && profil.statut_compte === "actif")
    redirect(routeParRole(profil.role));

  const suspendu = profil?.statut_compte === "suspendu";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="mb-6">
        <LogoAssemblage />
      </div>
      <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
        {suspendu ? (
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-assemblage" />
        ) : (
          <Clock className="mx-auto mb-4 h-12 w-12 text-amber-500" />
        )}
        <h1 className="mb-2 text-xl font-semibold">
          {suspendu ? "Compte suspendu" : "Compte en attente de validation"}
        </h1>
        <p className="mb-1 text-sm text-gray-600">
          {profil?.nom_complet || user.email}
        </p>
        <p className="mb-6 text-sm text-gray-600">
          {suspendu
            ? "Votre compte a été suspendu par un administrateur. Contactez l'équipe projet si vous pensez qu'il s'agit d'une erreur."
            : "Votre compte a bien été créé. Un administrateur doit le valider avant que vous puissiez accéder aux données. Vous serez notifié dès l'activation."}
        </p>
        <BoutonDeconnexion />
      </div>
    </div>
  );
}
