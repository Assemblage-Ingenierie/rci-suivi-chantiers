"use client";

import { useState } from "react";
import { CloudOff, Loader2, RefreshCw } from "lucide-react";
import { useEnLigne, useFileAttente } from "@/lib/offline/hooks";
import { synchroniser } from "@/lib/offline/sync";

/**
 * Barre fixe affichée dès qu'au moins une entrée attend d'être synchronisée
 * (CDC §2.2) : badge compteur + bouton "Synchroniser maintenant", visible sur
 * tous les navigateurs (mécanisme de base, y compris Safari iOS).
 */
export function BadgeSynchronisation() {
  const enLigne = useEnLigne();
  const nombre = useFileAttente();
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (nombre === 0 && !message) return null;

  async function lancerSync() {
    setEnCours(true);
    setMessage(null);
    try {
      const resultat = await synchroniser();
      if (resultat.erreurs.length > 0) {
        setMessage(
          `${resultat.visites + resultat.photos} envoyée(s), ${resultat.erreurs.length} en échec — réessayez.`
        );
      } else if (resultat.visites + resultat.photos > 0) {
        setMessage("Synchronisation terminée ✓");
        setTimeout(() => setMessage(null), 4000);
      }
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-amber-200 bg-amber-50 px-4 py-3 sm:left-60">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        {nombre > 0 && (
          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-assemblage px-2 text-sm font-bold text-white">
            {nombre}
          </span>
        )}
        <p className="min-w-0 flex-1 text-sm text-amber-900">
          {message ??
            (nombre > 0
              ? `${nombre} saisie(s) en attente de synchronisation`
              : "")}
        </p>
        {nombre > 0 &&
          (enLigne ? (
            <button
              onClick={lancerSync}
              disabled={enCours}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-assemblage px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {enCours ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Synchroniser maintenant
            </button>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-amber-800">
              <CloudOff className="h-4 w-4" />
              Hors ligne
            </span>
          ))}
      </div>
    </div>
  );
}
