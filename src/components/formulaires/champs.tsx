"use client";

import { Minus, Plus } from "lucide-react";
import type { Option } from "@/lib/formulaires/types";

const BASE_CHOIX =
  "min-h-[3rem] rounded-carte border px-3 py-2.5 text-center text-[0.95rem] leading-tight transition active:scale-[0.98]";
const CHOIX_ACTIF = "border-2 border-selection-bordure bg-selection font-bold text-texte";
const CHOIX_INACTIF = "border-bordure-forte bg-surface text-texte hover:bg-surface-2";

const GRILLE: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
};

/** Grands boutons de choix (unique ou multiple), façon maquettes. */
export function ChoixBoutons({
  options,
  valeur,
  multiple = false,
  exclusive,
  colonnes,
  onChange,
  libelleAccessible,
}: {
  options: Option[];
  valeur: string | string[] | undefined;
  multiple?: boolean;
  exclusive?: string;
  colonnes?: 1 | 2 | 3 | 4;
  onChange: (v: string | string[]) => void;
  libelleAccessible: string;
}) {
  const selection = Array.isArray(valeur) ? valeur : valeur ? [valeur] : [];

  function basculer(v: string) {
    if (!multiple) return onChange(v);
    if (selection.includes(v)) return onChange(selection.filter((x) => x !== v));
    if (v === exclusive) return onChange([v]);
    return onChange([...selection.filter((x) => x !== exclusive), v]);
  }

  // Sans nombre de colonnes imposé : « puces » qui passent à la ligne.
  const conteneur = colonnes ? `grid gap-2 ${GRILLE[colonnes]}` : "flex flex-wrap gap-2";
  return (
    <div role={multiple ? "group" : "radiogroup"} aria-label={libelleAccessible} className={conteneur}>
      {options.map((o) => {
        const actif = selection.includes(o.valeur);
        return (
          <button
            key={o.valeur}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={actif}
            onClick={() => basculer(o.valeur)}
            className={`${BASE_CHOIX} ${colonnes ? "" : "rounded-full px-4"} ${actif ? CHOIX_ACTIF : CHOIX_INACTIF}`}
          >
            {o.libelle}
          </button>
        );
      })}
    </div>
  );
}

/** Liste de lignes « affirmation — Oui / Non ». */
export function OuiNonListe({
  elements,
  valeurs,
  onChange,
}: {
  elements: Option[];
  valeurs: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  return (
    <div className="divide-y divide-bordure">
      {elements.map((e) => (
        <div key={e.valeur} className="flex items-center gap-3 py-2.5">
          <span className="flex-1 text-[0.95rem]">{e.libelle}</span>
          <div className="grid w-40 shrink-0 grid-cols-2 gap-2">
            {["oui", "non"].map((v) => {
              const actif = valeurs[e.valeur] === v;
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={actif}
                  aria-label={`${e.libelle} : ${v === "oui" ? "Oui" : "Non"}`}
                  onClick={() => onChange({ ...valeurs, [e.valeur]: v })}
                  className={`${BASE_CHOIX} min-h-[2.75rem] ${actif ? CHOIX_ACTIF : CHOIX_INACTIF}`}
                >
                  {v === "oui" ? "Oui" : "Non"}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Qualité d'exécution : une ligne par élément, 4 appréciations. */
export function QualiteListe({
  elements,
  options,
  valeurs,
  onChange,
}: {
  elements: Option[];
  options: Option[];
  valeurs: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const teinte: Record<string, string> = {
    conforme: "border-2 border-succes bg-succes-clair font-bold text-succes",
    reserve: "border-2 border-alerte bg-alerte-clair font-bold text-alerte",
    non_conforme: "border-2 border-danger bg-danger-clair font-bold text-danger",
    non_visible: "border-2 border-selection-bordure bg-selection font-bold text-texte",
  };
  return (
    <div className="space-y-3">
      {elements.map((e) => (
        <div key={e.valeur}>
          <p className="mb-1.5 text-sm font-semibold">{e.libelle}</p>
          <div className="grid grid-cols-4 gap-1.5">
            {options.map((o) => {
              const actif = valeurs[e.valeur] === o.valeur;
              return (
                <button
                  key={o.valeur}
                  type="button"
                  role="radio"
                  aria-checked={actif}
                  aria-label={`${e.libelle} : ${o.libelle}`}
                  onClick={() => onChange({ ...valeurs, [e.valeur]: o.valeur })}
                  className={`rounded-champ border px-1 py-2 text-xs sm:text-sm ${actif ? teinte[o.valeur] : CHOIX_INACTIF}`}
                >
                  {o.libelle}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Compteur « − valeur + ». */
export function Compteur({
  valeur,
  onChange,
  min = 0,
  max = 100,
  pas = 1,
  suffixe = "",
  alerte = false,
  libelle,
}: {
  valeur: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  pas?: number;
  suffixe?: string;
  alerte?: boolean;
  libelle: string;
}) {
  const bouton =
    "flex h-11 w-11 items-center justify-center rounded-champ border border-bordure-forte bg-surface text-texte hover:bg-surface-2 disabled:opacity-40";
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        className={bouton}
        aria-label={`${libelle} : diminuer`}
        disabled={valeur <= min}
        onClick={() => onChange(Math.max(min, valeur - pas))}
      >
        <Minus className="h-4 w-4" />
      </button>
      <span
        aria-live="polite"
        className={`w-16 text-center tabular-nums ${valeur === 0 ? "text-texte-3" : "font-bold"} ${alerte && valeur > 0 ? "text-danger" : ""}`}
      >
        {valeur}
        {suffixe}
      </span>
      <button
        type="button"
        className={bouton}
        aria-label={`${libelle} : augmenter`}
        disabled={valeur >= max}
        onClick={() => onChange(Math.min(max, valeur + pas))}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
