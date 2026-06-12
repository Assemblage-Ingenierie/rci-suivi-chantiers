import { CloudOff } from "lucide-react";

export const metadata = { title: "Hors ligne — Suivi chantiers MEN CI" };

/** Page de repli servie par le Service Worker quand une page demandée n'est
 * pas en cache et que le réseau est indisponible. Statique => pré-cachable. */
export default function PageHorsLigne() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <CloudOff className="mb-4 h-12 w-12 text-gray-400" />
      <h1 className="mb-2 text-xl font-semibold">Vous êtes hors ligne</h1>
      <p className="max-w-sm text-sm text-gray-600">
        Cette page n&apos;est pas disponible sans connexion. Vos établissements
        et vos saisies restent accessibles depuis la liste « Mes
        établissements » déjà ouverte ; vos visites enregistrées hors ligne
        seront synchronisées au retour du réseau.
      </p>
    </div>
  );
}
