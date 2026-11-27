"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Info, Search } from "lucide-react";
import { dateCourte, pct } from "@/lib/tableau-de-bord/calculs";
import {
  comparerAlertes,
  FAMILLES,
  LIBELLE_SOURCE,
  nbCritiques,
  nbSurveiller,
  type Alerte,
  type FamilleAlerte,
  type SourceAlerte,
} from "@/lib/alertes/regles";

export type SiteAlertes = {
  id: string;
  code: string;
  nom: string;
  localite: string;
  lot_id: number;
  lot_moe_id: number;
  avancement: number | null;
  alertes: Alerte[];
};
export type RegleAffichee = { id: string; famille: FamilleAlerte; source: SourceAlerte; niveaux: string; description: string };
type LotMoe = { id: number; nom: string; regions: string[] };
type Lot = { id: number; nom: string; entreprise: string };

const PAR_PAGE = 50;
const TEINTE = {
  critique: "bg-danger-clair text-danger ring-danger/30",
  surveiller: "bg-alerte-clair text-alerte ring-alerte/30",
};

/** Onglet « Alertes » : un site par ligne, une colonne par famille d'alertes. */
export function ListeAlertes({
  sites,
  lots,
  lotsMoe,
  regles,
  fraicheurJours,
  initial,
}: {
  sites: SiteAlertes[];
  lots: Lot[];
  lotsMoe: LotMoe[];
  regles: RegleAffichee[];
  fraicheurJours: number;
  initial: { famille: FamilleAlerte | null; lotMoe: number | null; lot: number | null };
}) {
  const [famille, setFamille] = useState<FamilleAlerte | null>(initial.famille);
  const [lotMoe, setLotMoe] = useState<number | null>(initial.lotMoe);
  const [lot, setLot] = useState<number | null>(initial.lot);
  const [critiquesSeules, setCritiquesSeules] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [affiches, setAffiches] = useState(PAR_PAGE);

  useEffect(() => {
    const p = new URLSearchParams();
    if (famille) p.set("famille", famille);
    if (lotMoe) p.set("lot_moe", String(lotMoe));
    if (lot) p.set("lot", String(lot));
    window.history.replaceState(null, "", `${window.location.pathname}${p.size ? `?${p}` : ""}`);
    setAffiches(PAR_PAGE);
  }, [famille, lotMoe, lot, critiquesSeules]);

  const lotParId = useMemo(() => new Map(lots.map((l) => [l.id, l])), [lots]);

  // Périmètre (lot MOE, lot, recherche) : base des compteurs par famille.
  const perimetre = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return sites.filter(
      (s) =>
        (!lotMoe || s.lot_moe_id === lotMoe) &&
        (!lot || s.lot_id === lot) &&
        (!q || `${s.code} ${s.nom} ${s.localite} ${lotParId.get(s.lot_id)?.entreprise ?? ""}`.toLowerCase().includes(q))
    );
  }, [sites, lotMoe, lot, recherche, lotParId]);

  const parFamille = useMemo(
    () =>
      FAMILLES.map((f) => {
        const concernes = perimetre.map((s) => s.alertes.filter((a) => a.famille === f.cle)).filter((a) => a.length);
        return {
          ...f,
          critiques: concernes.filter((a) => a.some((x) => x.niveau === "critique")).length,
          surveiller: concernes.filter((a) => !a.some((x) => x.niveau === "critique")).length,
        };
      }),
    [perimetre]
  );

  const liste = useMemo(
    () =>
      perimetre
        .filter((s) => s.alertes.length > 0)
        .filter((s) => !famille || s.alertes.some((a) => a.famille === famille))
        .filter((s) => !critiquesSeules || nbCritiques(s.alertes) > 0)
        .sort((a, b) => comparerAlertes(a.alertes, b.alertes) || (a.avancement ?? 0) - (b.avancement ?? 0)),
    [perimetre, famille, critiquesSeules]
  );
  const avecCritique = perimetre.filter((s) => nbCritiques(s.alertes) > 0).length;
  const avecAlerte = perimetre.filter((s) => s.alertes.length > 0).length;
  const lotsDuPerimetre = lots.filter((l) => !lotMoe || sites.some((s) => s.lot_id === l.id && s.lot_moe_id === lotMoe));

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="carte flex flex-wrap items-end gap-3 p-3">
        <div>
          <p className="etiquette">Lot MOE</p>
          <div className="flex flex-wrap gap-1.5">
            {[null, ...lotsMoe.map((m) => m.id)].map((id) => (
              <button
                key={id ?? "tous"}
                type="button"
                onClick={() => {
                  setLotMoe(id);
                  setLot(null);
                }}
                title={lotsMoe.find((m) => m.id === id)?.regions.join(", ")}
                className={`rounded-full px-3 py-1 text-sm ring-1 ${
                  lotMoe === id ? "bg-accent text-sur-accent ring-accent" : "bg-surface ring-bordure hover:bg-surface-2"
                }`}
              >
                {id ? `MOE ${id}` : "Tous"}
              </button>
            ))}
          </div>
        </div>
        <label>
          <span className="etiquette">Lot de travaux</span>
          <select value={lot ?? ""} onChange={(e) => setLot(e.target.value ? Number(e.target.value) : null)} className="champ py-1.5">
            <option value="">Tous les lots</option>
            {lotsDuPerimetre.map((l) => (
              <option key={l.id} value={l.id}>
                {l.id}. {l.nom}
                {l.entreprise ? ` — ${l.entreprise}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[14rem] flex-1">
          <span className="etiquette">Recherche</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texte-3" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Site, code, localité, entreprise…"
              className="champ py-1.5 pl-9"
            />
          </span>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={critiquesSeules} onChange={(e) => setCritiquesSeules(e.target.checked)} />
          Alertes critiques seulement
        </label>
      </div>

      {/* Compteurs par famille (clic = filtre) */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {parFamille.map((f) => (
          <button
            key={f.cle}
            type="button"
            onClick={() => setFamille(famille === f.cle ? null : f.cle)}
            title={f.description}
            className={`carte p-3 text-left transition hover:ring-2 hover:ring-accent/40 ${famille === f.cle ? "ring-2 ring-accent" : ""}`}
          >
            <span className="block text-sm font-semibold">{f.libelle}</span>
            <span className="mt-1 flex items-baseline gap-3 text-sm">
              <span className="font-bold tabular-nums text-danger">{f.critiques}</span>
              <span className="text-xs text-texte-2">critique{f.critiques > 1 ? "s" : ""}</span>
              <span className="font-bold tabular-nums text-alerte">{f.surveiller}</span>
              <span className="text-xs text-texte-2">à surveiller</span>
            </span>
          </button>
        ))}
      </div>

      <ReglesAlertes regles={regles} fraicheurJours={fraicheurJours} />

      <p className="text-sm text-texte-2">
        <strong className="text-texte">{avecAlerte}</strong> site{avecAlerte > 1 ? "s" : ""} en alerte sur {perimetre.length}, dont{" "}
        <strong className="text-danger">{avecCritique}</strong> avec au moins une alerte critique
        {famille ? ` · filtre : ${FAMILLES.find((f) => f.cle === famille)?.libelle}` : ""}
        {famille && (
          <button type="button" onClick={() => setFamille(null)} className="ml-2 text-accent hover:underline">
            retirer le filtre
          </button>
        )}
      </p>

      {/* Tableau : un site par ligne, une colonne par famille */}
      <div className="carte overflow-x-auto">
        <table className="w-full min-w-[68rem] table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[17rem]" />
            {FAMILLES.map((f) => (
              <col key={f.cle} />
            ))}
            <col className="w-[5.5rem]" />
          </colgroup>
          <thead className="border-b border-bordure bg-surface-2 text-xs text-texte-2">
            <tr>
              <th className="px-3 py-2 font-semibold">Site</th>
              {FAMILLES.map((f) => (
                <th key={f.cle} className={`px-2 py-2 font-semibold ${famille === f.cle ? "text-accent" : ""}`} title={f.description}>
                  {f.court}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-semibold" title="Alertes critiques · à surveiller">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bordure">
            {liste.slice(0, affiches).map((s) => {
              const l = lotParId.get(s.lot_id);
              return (
                <tr key={s.id} className="align-top hover:bg-surface-2/60">
                  <td className="px-3 py-2">
                    <Link href={`/site/${s.code}`} className="font-semibold text-accent hover:underline">
                      {s.nom}
                    </Link>
                    <span className="block text-xs text-texte-2">
                      {s.code} · lot {s.lot_id}
                      {l?.entreprise ? ` · ${l.entreprise}` : ""} · {s.avancement === null ? "aucun rapport" : pct(s.avancement)}
                    </span>
                  </td>
                  {FAMILLES.map((f) => (
                    <td key={f.cle} className="px-2 py-2">
                      {s.alertes
                        .filter((a) => a.famille === f.cle)
                        .map((a, i) => (
                          <span
                            key={i}
                            className={`mb-1 mr-1 inline-block rounded px-1.5 py-0.5 text-xs ring-1 ${TEINTE[a.niveau]}`}
                            title={`${a.niveau === "critique" ? "Critique" : "À surveiller"} · ${LIBELLE_SOURCE[a.source]}${
                              a.date ? ` du ${dateCourte(a.date)}` : ""
                            }`}
                          >
                            {a.texte}
                            <span className="opacity-70">
                              {" "}
                              · {LIBELLE_SOURCE[a.source]}
                              {a.date && a.source !== "planning" ? ` ${dateCourte(a.date)}` : ""}
                            </span>
                          </span>
                        ))}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right font-semibold tabular-nums">
                    <span className="text-danger">{nbCritiques(s.alertes)}</span>
                    <span className="text-texte-3"> · </span>
                    <span className="text-alerte">{nbSurveiller(s.alertes)}</span>
                  </td>
                </tr>
              );
            })}
            {liste.length === 0 && (
              <tr>
                <td colSpan={FAMILLES.length + 2} className="px-3 py-6 text-center text-texte-2">
                  Aucun site en alerte dans ce périmètre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {liste.length > affiches && (
        <button type="button" onClick={() => setAffiches((n) => n + PAR_PAGE)} className="bouton-secondaire w-full">
          Afficher {Math.min(PAR_PAGE, liste.length - affiches)} sites de plus ({liste.length - affiches} restants)
        </button>
      )}
    </div>
  );
}

/** Encadré : toutes les règles appliquées, par famille, telles que calculées. */
function ReglesAlertes({ regles, fraicheurJours }: { regles: RegleAffichee[]; fraicheurJours: number }) {
  return (
    <details className="group rounded-carte border border-info/30 bg-info-clair p-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-info">
        <Info className="h-4 w-4 shrink-0" />
        Comment sont calculées les alertes
        <span className="ml-auto text-xs font-normal group-open:hidden">afficher</span>
      </summary>
      <div className="mt-3 space-y-3 text-texte">
        <ul className="list-disc space-y-1 pl-4">
          <li>
            Chaque alerte vient du <strong>dernier formulaire</strong> d&apos;un acteur (MOE, CSTC ou UG), s&apos;il date de{" "}
            <strong>moins de {fraicheurJours} jours</strong>. Un formulaire plus ancien n&apos;est plus pris en compte.
          </li>
          <li>
            <span className="rounded bg-danger-clair px-1 text-danger">Rouge</span> = critique,{" "}
            <span className="rounded bg-alerte-clair px-1 text-alerte">orange</span> = à surveiller. Chaque étiquette indique sa
            source et la date du formulaire.
          </li>
          <li>Ordre des sites : nombre d&apos;alertes critiques, puis nombre d&apos;alertes à surveiller.</li>
          <li>
            Ne sont pas des alertes : les tensions signalées par le CSTC et les formulaires manquants (voir l&apos;onglet Suivi).
          </li>
        </ul>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {FAMILLES.map((f) => (
            <div key={f.cle}>
              <p className="mb-1 font-semibold">{f.libelle}</p>
              <ul className="space-y-1">
                {regles
                  .filter((r) => r.famille === f.cle)
                  .map((r) => (
                    <li key={r.id} className="text-xs leading-snug">
                      <span className="font-semibold">{LIBELLE_SOURCE[r.source]}</span> · {r.description}{" "}
                      <span className="text-texte-2">({r.niveaux})</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
