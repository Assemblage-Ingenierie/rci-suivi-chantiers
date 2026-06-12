import Link from "next/link";
import { FormulaireConnexion } from "./FormulaireConnexion";

export const metadata = { title: "Connexion — Suivi chantiers MEN CI" };

export default function PageConnexion() {
  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold">Connexion</h2>
      <FormulaireConnexion />
      <p className="mt-6 text-center text-sm text-gray-600">
        Pas encore de compte ?{" "}
        <Link
          href="/inscription"
          className="font-medium text-assemblage hover:underline"
        >
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
