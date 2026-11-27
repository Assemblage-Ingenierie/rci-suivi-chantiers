"use client";

import { Printer } from "lucide-react";

/** Ouvre l'impression du navigateur (destination « Enregistrer au format PDF »). */
export function BoutonImprimer() {
  return (
    <button type="button" onClick={() => window.print()} className="bouton-principal inline-flex items-center gap-1.5">
      <Printer className="h-4 w-4" /> Imprimer / enregistrer en PDF
    </button>
  );
}
