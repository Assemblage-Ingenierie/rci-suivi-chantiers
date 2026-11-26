import Link from "next/link";
import { MARQUE } from "@/theme/marque";
import { FormulaireConnexion } from "./FormulaireConnexion";

export const metadata = { title: `Connexion — ${MARQUE.titreNavigateur}` };

export default function PageConnexion() {
  return (
    <div>
      <h1 className="mb-5 text-xl font-bold">Connexion</h1>
      <FormulaireConnexion />
      <p className="mt-6 text-center text-sm text-texte-2">
        MOE ou UG sans compte ?{" "}
        <Link href="/inscription" className="font-semibold text-accent hover:underline">
          Demander un accès
        </Link>
      </p>
    </div>
  );
}
