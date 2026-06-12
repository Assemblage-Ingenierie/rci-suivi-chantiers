"use client";

import { useEffect } from "react";
import { prechargerDonneesLot } from "@/lib/offline/preload";
import { synchroniser } from "@/lib/offline/sync";
import { BadgeSynchronisation } from "./BadgeSynchronisation";
import type { RoleUtilisateur } from "@/lib/constants";

/**
 * Initialisation du mode offline (monté dans le layout protégé) :
 *  - enregistre le Service Worker (/sw.js)
 *  - pour les COGES : pré-charge le lot dans IndexedDB à l'ouverture de
 *    session, synchronise automatiquement au retour du réseau, et réagit au
 *    message Background Sync du SW (bonus Chrome Android)
 *  - affiche le badge + bouton "Synchroniser maintenant"
 */
export function FournisseurOffline({ role }: { role: RoleUtilisateur }) {
  const offlineActif = role === "coges" || role === "admin";

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW indisponible (vieux navigateur) : l'app reste utilisable en ligne.
      });
    }
  }, []);

  useEffect(() => {
    if (!offlineActif) return;

    // Pré-chargement du lot à l'ouverture (si réseau disponible).
    if (navigator.onLine) {
      prechargerDonneesLot().catch(() => {
        // Réseau instable : on retentera à la prochaine session / reconnexion.
      });
    }

    // Synchro automatique dès que la connexion revient (tous navigateurs).
    const surReconnexion = () => {
      synchroniser()
        .then(() => prechargerDonneesLot())
        .catch(() => {});
    };
    window.addEventListener("online", surReconnexion);

    // Bonus Background Sync : le SW nous notifie au retour du réseau.
    const surMessageSW = (evt: MessageEvent) => {
      if (evt.data?.type === "chantierci-sync") {
        synchroniser().catch(() => {});
      }
    };
    navigator.serviceWorker?.addEventListener("message", surMessageSW);

    // Poignée de debug (tests E2E en développement uniquement).
    if (process.env.NODE_ENV === "development") {
      void Promise.all([
        import("@/lib/offline/db"),
        import("@/lib/supabase/client"),
      ]).then(([db, sb]) => {
        (window as unknown as Record<string, unknown>).__coffline = {
          precharger: prechargerDonneesLot,
          synchroniser,
          db,
          supabase: sb.createClient(),
        };
      });
    }

    return () => {
      window.removeEventListener("online", surReconnexion);
      navigator.serviceWorker?.removeEventListener("message", surMessageSW);
    };
  }, [offlineActif]);

  if (!offlineActif) return null;
  return <BadgeSynchronisation />;
}
