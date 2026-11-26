import { redirect } from "next/navigation";
import { Clock, ShieldAlert } from "lucide-react";
import { getUtilisateurEtProfil, routeParRole } from "@/lib/auth";
import { BoutonDeconnexion } from "@/components/BoutonDeconnexion";
import { Logo } from "@/components/Logo";
import { MARQUE } from "@/theme/marque";

export const metadata = { title: `Compte en attente — ${MARQUE.titreNavigateur}` };

export default async function PageEnAttente() {
  const { user, profil } = await getUtilisateurEtProfil();
  if (!user) redirect("/connexion");
  if (profil && profil.statut_compte === "actif") redirect(routeParRole(profil.role));

  const suspendu = profil?.statut_compte === "suspendu";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="mb-6">
        <Logo />
      </div>
      <div className="carte w-full max-w-md p-8 text-center">
        {suspendu ? (
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-danger" />
        ) : (
          <Clock className="mx-auto mb-4 h-12 w-12 text-alerte" />
        )}
        <h1 className="mb-2 text-xl font-bold">
          {suspendu ? "Compte suspendu" : "Compte en attente de validation"}
        </h1>
        <p className="mb-1 text-sm text-texte-2">{profil?.nom_complet || user.email}</p>
        <p className="mb-6 text-sm text-texte-2">
          {suspendu
            ? "Votre compte a été suspendu par un administrateur. Contactez l'équipe du projet si vous pensez qu'il s'agit d'une erreur."
            : "Votre demande a bien été enregistrée. Un administrateur doit valider votre compte et vous attribuer vos sites avant que vous puissiez accéder aux données."}
        </p>
        <BoutonDeconnexion />
      </div>
    </div>
  );
}
