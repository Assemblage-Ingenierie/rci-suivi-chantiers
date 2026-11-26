import { CloudOff } from "lucide-react";
import { MARQUE } from "@/theme/marque";

export const metadata = { title: `Hors ligne — ${MARQUE.titreNavigateur}` };

/** Page de repli servie par le Service Worker quand une page n'est pas en cache
 * et que le réseau est indisponible. Statique => pré-cachable. */
export default function PageHorsLigne() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <CloudOff className="mb-4 h-12 w-12 text-texte-3" />
      <h1 className="mb-2 text-xl font-bold">Vous êtes hors ligne</h1>
      <p className="max-w-sm text-sm text-texte-2">
        Cette page n&apos;est pas disponible sans connexion. Vos formulaires enregistrés hors ligne
        seront envoyés automatiquement au retour du réseau.
      </p>
    </div>
  );
}
