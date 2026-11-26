import Link from "next/link";
import { MARQUE } from "@/theme/marque";
import { FormulaireInscription } from "./FormulaireInscription";

export const metadata = { title: `Demande d'accès — ${MARQUE.titreNavigateur}` };

export default function PageInscription() {
  return (
    <div>
      <h1 className="mb-2 text-xl font-bold">Demande d&apos;accès</h1>
      <p className="mb-6 text-sm text-texte-2">
        Réservé à la maîtrise d&apos;œuvre (MOE) et à l&apos;unité de gestion (UG). Votre compte
        sera validé par un administrateur. Les CSTC reçoivent leur identifiant et leur code PIN
        directement de l&apos;équipe du projet.
      </p>
      <FormulaireInscription />
      <p className="mt-6 text-center text-sm text-texte-2">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="font-semibold text-accent hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
