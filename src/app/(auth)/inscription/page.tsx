import Link from "next/link";
import { FormulaireInscription } from "./FormulaireInscription";

export const metadata = { title: "Créer un compte — Suivi chantiers MEN CI" };

export default function PageInscription() {
  return (
    <div>
      <h2 className="mb-2 text-xl font-semibold">Créer un compte</h2>
      <p className="mb-6 text-sm text-gray-600">
        Votre compte devra être validé par un administrateur avant d&apos;accéder
        aux données.
      </p>
      <FormulaireInscription />
      <p className="mt-6 text-center text-sm text-gray-600">
        Déjà un compte ?{" "}
        <Link
          href="/connexion"
          className="font-medium text-assemblage hover:underline"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}
