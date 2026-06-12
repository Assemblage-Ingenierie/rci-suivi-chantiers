"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";

/** Filtre multi-select générique (lot, région, statut, entreprise…). */
export function FiltreMultiple({
  libelle,
  options,
  selection,
  surChangement,
}: {
  libelle: string;
  options: { valeur: string; affichage?: string }[];
  selection: string[];
  surChangement: (valeurs: string[]) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const surClicExterieur = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOuvert(false);
    };
    document.addEventListener("mousedown", surClicExterieur);
    return () => document.removeEventListener("mousedown", surClicExterieur);
  }, [ouvert]);

  function basculer(valeur: string) {
    surChangement(
      selection.includes(valeur)
        ? selection.filter((v) => v !== valeur)
        : [...selection, valeur]
    );
  }

  const actif = selection.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
          actif
            ? "border-assemblage bg-red-50 text-assemblage"
            : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
        }`}
      >
        {libelle}
        {actif && (
          <span className="rounded-full bg-assemblage px-1.5 text-xs font-bold text-white">
            {selection.length}
          </span>
        )}
        <ChevronDown className="h-4 w-4" />
      </button>

      {ouvert && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-72 w-60 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {actif && (
            <button
              type="button"
              onClick={() => surChangement([])}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-assemblage hover:bg-gray-50"
            >
              <X className="h-4 w-4" /> Tout effacer
            </button>
          )}
          {options.map(({ valeur, affichage }) => (
            <button
              key={valeur}
              type="button"
              onClick={() => basculer(valeur)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  selection.includes(valeur)
                    ? "border-assemblage bg-assemblage text-white"
                    : "border-gray-300"
                }`}
              >
                {selection.includes(valeur) && <Check className="h-3 w-3" />}
              </span>
              <span className="truncate">{affichage ?? valeur}</span>
            </button>
          ))}
          {options.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-500">Aucune option</p>
          )}
        </div>
      )}
    </div>
  );
}
