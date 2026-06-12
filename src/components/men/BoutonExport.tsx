"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, Loader2 } from "lucide-react";

/** Menu déroulant "Exporter" (Excel / PDF / …) avec état de chargement. */
export function BoutonExport({
  actions,
}: {
  actions: { libelle: string; action: () => Promise<void> }[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const surClic = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", surClic);
    return () => document.removeEventListener("mousedown", surClic);
  }, [ouvert]);

  async function executer(action: () => Promise<void>) {
    setOuvert(false);
    setErreur(null);
    setEnCours(true);
    try {
      await action();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Export impossible");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOuvert(!ouvert)}
        disabled={enCours}
        className="inline-flex items-center gap-1.5 rounded-lg bg-assemblage px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
      >
        {enCours ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Exporter
        <ChevronDown className="h-4 w-4" />
      </button>
      {ouvert && (
        <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {actions.map(({ libelle, action }) => (
            <button
              key={libelle}
              onClick={() => executer(action)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
            >
              {libelle}
            </button>
          ))}
        </div>
      )}
      {erreur && (
        <p className="absolute right-0 top-full mt-1 w-64 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 shadow">
          {erreur}
        </p>
      )}
    </div>
  );
}
