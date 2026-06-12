"use client";

import { useState } from "react";
import { ChevronRight, Clock, Loader2, MapPin, Search } from "lucide-react";
import { BadgeStatut } from "@/components/BadgeStatut";
import { formatDate } from "@/lib/constants";
import type { EtablissementSuivi } from "@/lib/offline/db";

export function ListeEtablissements({
  etablissements,
  idsAvecAttente,
  surOuverture,
}: {
  etablissements: EtablissementSuivi[] | null;
  idsAvecAttente: Set<string>;
  surOuverture: (id: string) => void;
}) {
  const [recherche, setRecherche] = useState("");

  if (etablissements === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
      </div>
    );
  }

  if (etablissements.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 text-center shadow-sm">
        <p className="font-medium">Aucune donnée locale</p>
        <p className="mt-1 text-sm text-gray-600">
          Connectez-vous une première fois avec du réseau pour pré-charger les
          établissements de votre lot — ils resteront ensuite disponibles hors
          ligne.
        </p>
      </div>
    );
  }

  const terme = recherche.trim().toLowerCase();
  const filtres = terme
    ? etablissements.filter(
        (e) =>
          (e.nom ?? "").toLowerCase().includes(terme) ||
          (e.departement ?? "").toLowerCase().includes(terme) ||
          (e.village ?? "").toLowerCase().includes(terme)
      )
    : etablissements;

  return (
    <div>
      <h1 className="text-2xl font-bold">Mes établissements</h1>
      <p className="mb-4 text-sm text-gray-500">
        {etablissements.length} établissement(s) de votre lot — disponibles
        hors ligne
      </p>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un établissement…"
          className="block w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-3 text-base focus:border-assemblage focus:outline-none focus:ring-1 focus:ring-assemblage"
        />
      </div>

      <ul className="space-y-3">
        {filtres.map((e) => (
          <li key={e.id}>
            <button
              onClick={() => e.id && surOuverture(e.id)}
              className="flex w-full items-center gap-3 rounded-xl bg-white p-4 text-left shadow-sm transition hover:shadow"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold">
                  <span className="truncate">{e.nom}</span>
                  {e.id && idsAvecAttente.has(e.id) && (
                    <Clock
                      className="h-4 w-4 shrink-0 text-amber-500"
                      aria-label="Saisies en attente de synchronisation"
                    />
                  )}
                </p>
                <p className="flex items-center gap-1 truncate text-sm text-gray-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {e.departement}
                  {e.village ? ` — ${e.village}` : ""}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Dernière visite : {formatDate(e.derniere_visite_date)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <BadgeStatut statut={e.statut} />
                {e.dernier_avancement_reel_pct !== null && (
                  <span className="text-sm font-semibold text-gray-700">
                    {e.dernier_avancement_reel_pct}&nbsp;%
                  </span>
                )}
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" />
            </button>
          </li>
        ))}
      </ul>

      {filtres.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-500">
          Aucun établissement ne correspond à « {recherche} ».
        </p>
      )}
    </div>
  );
}
