"use client";

/**
 * Dashboard MEN (CDC §5.3) : synthèse KPI (statuts + financier global) à
 * gauche, carte Leaflet à deux modes de couleur à droite, filtres lot/région
 * communs. Le jeu complet (~350 lignes max) est chargé par lots de 500 — il
 * est nécessaire en entier pour la carte ; les KPI sont calculés côté client
 * sur le sous-ensemble filtré.
 */
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { BarChart3, Loader2, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/database.types";
import {
  formatXOF,
  LIBELLES_STATUTS_CHANTIER,
  COULEURS_STATUTS_CHANTIER,
  type StatutChantier,
} from "@/lib/constants";
import { FiltreMultiple } from "./FiltreMultiple";
import type { ModeCarte, PointCarte } from "./CarteChantiers";

const CarteChantiers = dynamic(
  () => import("./CarteChantiers").then((m) => m.CarteChantiers),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    ),
  }
);

type Ligne = Tables<"chantierci_v_etablissements_suivi">;

const STATUTS: StatutChantier[] = [
  "non_demarre",
  "en_cours",
  "arrete",
  "receptionne",
];

const TAILLE_LOT = 500;

export function TableauDeBord() {
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtreLots, setFiltreLots] = useState<string[]>([]);
  const [filtreRegions, setFiltreRegions] = useState<string[]>([]);
  const [mode, setMode] = useState<ModeCarte>("statut");

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const tout: Ligne[] = [];
        for (let depuis = 0; ; depuis += TAILLE_LOT) {
          const { data, error } = await supabase
            .from("chantierci_v_etablissements_suivi")
            .select(
              "id, nom, latitude, longitude, statut, dernier_avancement_reel_pct, avancement_financier_pct, montant_marche, montant_paye, lot_nom, lot_region"
            )
            .order("nom")
            .range(depuis, depuis + TAILLE_LOT - 1);
          if (error) throw new Error(error.message);
          tout.push(...((data ?? []) as Ligne[]));
          if (!data || data.length < TAILLE_LOT) break;
        }
        setLignes(tout);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Chargement impossible");
      }
    })();
  }, []);

  const optionsLots = useMemo(
    () =>
      Array.from(new Set((lignes ?? []).map((l) => l.lot_nom).filter(Boolean)))
        .sort()
        .map((v) => ({ valeur: v as string })),
    [lignes]
  );
  const optionsRegions = useMemo(
    () =>
      Array.from(
        new Set((lignes ?? []).map((l) => l.lot_region).filter(Boolean))
      )
        .sort()
        .map((v) => ({ valeur: v as string })),
    [lignes]
  );

  const filtrees = useMemo(
    () =>
      (lignes ?? []).filter(
        (l) =>
          (filtreLots.length === 0 ||
            (l.lot_nom && filtreLots.includes(l.lot_nom))) &&
          (filtreRegions.length === 0 ||
            (l.lot_region && filtreRegions.includes(l.lot_region)))
      ),
    [lignes, filtreLots, filtreRegions]
  );

  const kpi = useMemo(() => {
    const parStatut = Object.fromEntries(STATUTS.map((s) => [s, 0])) as Record<
      StatutChantier,
      number
    >;
    let montantTotal = 0;
    let montantPaye = 0;
    for (const l of filtrees) {
      if (l.statut) parStatut[l.statut] += 1;
      montantTotal += l.montant_marche ?? 0;
      montantPaye += l.montant_paye ?? 0;
    }
    return {
      parStatut,
      montantTotal,
      montantPaye,
      pctFinancier:
        montantTotal > 0
          ? Math.round((montantPaye / montantTotal) * 1000) / 10
          : null,
    };
  }, [filtrees]);

  const points: PointCarte[] = useMemo(
    () =>
      filtrees
        .filter((l) => l.latitude !== null && l.longitude !== null && l.id)
        .map((l) => ({
          id: l.id as string,
          nom: l.nom ?? "—",
          latitude: l.latitude as number,
          longitude: l.longitude as number,
          statut: l.statut,
          avancement: l.dernier_avancement_reel_pct,
          financier: l.avancement_financier_pct,
        })),
    [filtrees]
  );

  if (erreur) {
    return (
      <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        {erreur}
      </p>
    );
  }

  return (
    <div>
      {/* Filtres communs KPI + carte */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FiltreMultiple
          libelle="Lot"
          options={optionsLots}
          selection={filtreLots}
          surChangement={setFiltreLots}
        />
        <FiltreMultiple
          libelle="Région"
          options={optionsRegions}
          selection={filtreRegions}
          surChangement={setFiltreRegions}
        />
        {lignes === null && (
          <span className="inline-flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </span>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {/* Synthèse KPI — tableau façon PEEB */}
        <div className="rounded-xl bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <BarChart3 className="h-4 w-4 text-assemblage" /> Synthèse du
            programme
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sidebar text-left text-xs uppercase tracking-wide text-white">
                <th className="rounded-l px-3 py-2 font-medium">Indicateur</th>
                <th className="rounded-r px-3 py-2 text-right font-medium">
                  Valeur
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2.5 font-medium">Établissements</td>
                <td className="px-3 py-2.5 text-right font-bold">
                  {filtrees.length}
                </td>
              </tr>
              {STATUTS.map((s) => (
                <tr key={s} className="border-b border-gray-100">
                  <td className="flex items-center gap-2 px-3 py-2.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: COULEURS_STATUTS_CHANTIER[s] }}
                    />
                    {LIBELLES_STATUTS_CHANTIER[s]}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold">
                    {kpi.parStatut[s]}
                  </td>
                </tr>
              ))}
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2.5 font-medium">
                  Montant total des marchés
                </td>
                <td className="px-3 py-2.5 text-right font-semibold">
                  {formatXOF(kpi.montantTotal)}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2.5 font-medium">Montant payé</td>
                <td className="px-3 py-2.5 text-right font-semibold">
                  {formatXOF(kpi.montantPaye)}
                </td>
              </tr>
              <tr className="bg-sidebar text-white">
                <td className="rounded-l px-3 py-2.5 font-semibold">
                  Avancement financier global
                </td>
                <td className="rounded-r px-3 py-2.5 text-right text-base font-bold text-assemblage">
                  {kpi.pctFinancier !== null ? `${kpi.pctFinancier} %` : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Carte */}
        <div className="rounded-xl bg-white p-5 shadow-sm xl:col-span-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <MapPin className="h-4 w-4 text-assemblage" /> Carte des
              chantiers
              <span className="rounded-full bg-assemblage px-2 py-0.5 text-xs font-bold text-white">
                {points.length}
              </span>
            </h2>
            <div className="flex rounded-lg border border-gray-300 p-0.5">
              {(
                [
                  ["statut", "Statut"],
                  ["avancement", "Avancement réel"],
                ] as [ModeCarte, string][]
              ).map(([m, libelle]) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    mode === m
                      ? "bg-assemblage text-white"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {libelle}
                </button>
              ))}
            </div>
          </div>
          <CarteChantiers points={points} mode={mode} />
          {/* Légende */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-600">
            {mode === "statut" ? (
              STATUTS.map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: COULEURS_STATUTS_CHANTIER[s] }}
                  />
                  {LIBELLES_STATUTS_CHANTIER[s]}
                </span>
              ))
            ) : (
              <>
                <span>0 %</span>
                <span
                  className="h-2.5 w-40 rounded-full"
                  style={{
                    background:
                      "linear-gradient(to right, #111111, #E8201A, #F97316, #22C55E)",
                  }}
                />
                <span>100 %</span>
                <span className="ml-2 inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                  Aucune visite
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
