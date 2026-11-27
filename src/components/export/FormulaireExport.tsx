"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Search } from "lucide-react";
import type { SourceFormulaire } from "@/lib/formulaires/types";
import {
  parametresParDefaut,
  PERIMETRES,
  SOURCES_EXPORT,
  urlRapport,
  type ParametresExport,
  type PerimetreType,
} from "@/lib/export/rapport";

type Site = { code: string; nom: string; region: string; lot_id: number };
type Lot = { id: number; nom: string; entreprise: string };
type LotMoe = { id: number; nom: string; regions: string[] };

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Choix des paramètres du rapport ; « Générer » ouvre l'aperçu imprimable. */
export function FormulaireExport({
  initial,
  sites,
  lots,
  lotsMoe,
  regions,
}: {
  initial: ParametresExport | null;
  sites: Site[];
  lots: Lot[];
  lotsMoe: LotMoe[];
  regions: string[];
}) {
  const router = useRouter();
  const depart = initial ?? parametresParDefaut();
  const [sources, setSources] = useState<SourceFormulaire[]>(depart.sources);
  const [perimetre, setPerimetre] = useState<PerimetreType>(depart.perimetre);
  const [valeurs, setValeurs] = useState<string[]>(depart.valeurs);
  const [du, setDu] = useState(depart.du);
  const [au, setAu] = useState(depart.au);
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const options = useMemo((): { valeur: string; libelle: string; detail?: string }[] => {
    switch (perimetre) {
      case "lot_moe":
        return lotsMoe.map((m) => ({ valeur: String(m.id), libelle: `Lot MOE ${m.id}`, detail: m.regions.join(", ") }));
      case "region":
        return regions.map((r) => ({ valeur: r, libelle: r }));
      case "lot":
        return lots.map((l) => ({ valeur: String(l.id), libelle: `${l.id}. ${l.nom}`, detail: l.entreprise }));
      case "site": {
        const q = recherche.trim().toLowerCase();
        return sites
          .filter((s) => valeurs.includes(s.code) || !q || `${s.code} ${s.nom}`.toLowerCase().includes(q))
          .slice(0, 80)
          .map((s) => ({ valeur: s.code, libelle: `${s.code} · ${s.nom}`, detail: `lot ${s.lot_id}` }));
      }
      default:
        return [];
    }
  }, [perimetre, lotsMoe, regions, lots, sites, recherche, valeurs]);

  const basculer = <T,>(liste: T[], v: T) => (liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v]);

  function periode(jours: number | "mois" | "debut") {
    const fin = new Date();
    const debut = new Date(fin);
    if (jours === "mois") debut.setDate(1);
    else if (jours === "debut") debut.setFullYear(fin.getFullYear() - 1);
    else debut.setDate(debut.getDate() - jours);
    setDu(iso(debut));
    setAu(iso(fin));
  }

  function generer() {
    if (!sources.length) return setErreur("Choisissez au moins une source.");
    if (perimetre !== "tout" && !valeurs.length) return setErreur("Choisissez au moins une valeur du périmètre.");
    if (!du || !au || du > au) return setErreur("La période est invalide.");
    setErreur(null);
    router.push(urlRapport({ sources, perimetre, valeurs: perimetre === "tout" ? [] : valeurs, du, au }));
  }

  return (
    <div className="space-y-4">
      <section className="carte p-4">
        <h2 className="mb-2 font-semibold">1. Sources des données</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {SOURCES_EXPORT.map((s) => (
            <label
              key={s.cle}
              className={`flex cursor-pointer items-start gap-2 rounded-champ p-3 ring-1 ${
                sources.includes(s.cle) ? "bg-accent/5 ring-accent" : "ring-bordure"
              }`}
            >
              <input type="checkbox" className="mt-1" checked={sources.includes(s.cle)} onChange={() => setSources(basculer(sources, s.cle))} />
              <span>
                <span className="block font-semibold">{s.libelle}</span>
                <span className="block text-xs text-texte-2">{s.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="carte p-4">
        <h2 className="mb-2 font-semibold">2. Périmètre</h2>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PERIMETRES.map((p) => (
            <button
              key={p.cle}
              type="button"
              onClick={() => {
                setPerimetre(p.cle);
                setValeurs([]);
                setRecherche("");
              }}
              className={`rounded-full px-3 py-1 text-sm ring-1 ${
                perimetre === p.cle ? "bg-accent text-sur-accent ring-accent" : "bg-surface ring-bordure hover:bg-surface-2"
              }`}
            >
              {p.libelle}
            </button>
          ))}
        </div>
        {perimetre === "tout" ? (
          <p className="text-sm text-texte-2">Les {sites.length} sites, regroupés par lot MOE dans la synthèse.</p>
        ) : (
          <>
            {perimetre === "site" && (
              <label className="relative mb-2 block max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texte-3" />
                <input
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher un site (code ou nom)…"
                  className="champ py-1.5 pl-9"
                />
              </label>
            )}
            <div className="flex items-center gap-3 pb-2 text-xs">
              <span className="text-texte-2">
                {valeurs.length} sélectionné{valeurs.length > 1 ? "s" : ""}
              </span>
              {perimetre !== "site" && (
                <button type="button" className="text-accent hover:underline" onClick={() => setValeurs(options.map((o) => o.valeur))}>
                  tout cocher
                </button>
              )}
              {valeurs.length > 0 && (
                <button type="button" className="text-accent hover:underline" onClick={() => setValeurs([])}>
                  tout décocher
                </button>
              )}
            </div>
            <div className="grid max-h-80 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {options.map((o) => (
                <label key={o.valeur} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 text-sm hover:bg-surface-2">
                  <input type="checkbox" className="mt-0.5" checked={valeurs.includes(o.valeur)} onChange={() => setValeurs(basculer(valeurs, o.valeur))} />
                  <span>
                    {o.libelle}
                    {o.detail && <span className="block text-xs text-texte-3">{o.detail}</span>}
                  </span>
                </label>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="carte p-4">
        <h2 className="mb-2 font-semibold">3. Période</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label>
            <span className="etiquette">Du</span>
            <input type="date" value={du} max={au} onChange={(e) => setDu(e.target.value)} className="champ py-1.5" />
          </label>
          <label>
            <span className="etiquette">Au</span>
            <input type="date" value={au} min={du} onChange={(e) => setAu(e.target.value)} className="champ py-1.5" />
          </label>
          <div className="flex flex-wrap gap-1.5 pb-1 text-sm">
            {(
              [
                ["7 derniers jours", 7],
                ["4 dernières semaines", 28],
                ["Mois en cours", "mois"],
                ["3 derniers mois", 91],
                ["12 derniers mois", "debut"],
              ] as const
            ).map(([libelle, v]) => (
              <button key={libelle} type="button" onClick={() => periode(v)} className="rounded-full px-3 py-1 ring-1 ring-bordure hover:bg-surface-2">
                {libelle}
              </button>
            ))}
          </div>
        </div>
      </section>

      {erreur && <p className="text-sm font-semibold text-danger">{erreur}</p>}
      <button type="button" onClick={generer} className="bouton-principal inline-flex items-center gap-2">
        <FileText className="h-4 w-4" /> Générer l&apos;aperçu du rapport
      </button>
    </div>
  );
}
