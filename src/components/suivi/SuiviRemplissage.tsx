"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { BadgeStatut } from "@/components/BadgeStatut";
import { joursDepuis, pct, type EtatSite } from "@/lib/tableau-de-bord/calculs";
import {
  attendu,
  dernier,
  dernierStatut,
  enRetard,
  jourMois,
  lundiSemaine,
  manquant,
  NB_SEMAINES,
  serie,
  SOURCES_SUIVI,
  suivi,
  synthese,
  type LigneRemplissage,
  type ReglesSource,
} from "@/lib/suivi/remplissage";
import { LIBELLES_STATUTS } from "@/lib/formulaires/statuts";
import type { StatutChantier } from "@/lib/formulaires/types";
import { ReglesRemplissage } from "./ReglesRemplissage";
import type { SourceFormulaire } from "@/lib/formulaires/types";

type LotMoe = { id: number; nom: string; regions: string[] };
type Lot = { id: number; nom: string };

const libelleStatut = (st: string | null) => (st ? LIBELLES_STATUTS[st as StatutChantier] ?? st : "aucun formulaire");

/** Pastilles des 8 dernières semaines pour un type de formulaire. */
function Frise({ ligne, regles, dateRef }: { ligne: LigneRemplissage | undefined; regles: ReglesSource; dateRef: string }) {
  const valeurs = serie(ligne, regles.cle);
  const derniere = valeurs.length - 1;
  return (
    <span className="flex gap-[3px]">
      {valeurs.map((n, i) => {
        const manque = manquant(ligne, regles, i);
        const att = attendu(ligne, regles, i);
        const titre = `${regles.libelle}, semaine du ${jourMois(lundiSemaine(dateRef, i))}${i === derniere ? " (en cours)" : ""} : ${
          n ? `${n} formulaire${n > 1 ? "s" : ""}` : manque ? "aucun formulaire — manquant" : "aucun formulaire"
        }${!n && !manque && i < derniere ? (att === false ? " — non attendu (dernier formulaire : pas « en cours »)" : "") : ""}`;
        return (
          <span
            key={i}
            title={titre}
            className={`h-3.5 w-3 rounded-[3px] ${n ? "" : manque ? "bg-danger-clair ring-1 ring-inset ring-danger" : "ring-1 ring-inset ring-bordure"}`}
            style={n ? { background: regles.couleur } : undefined}
          />
        );
      })}
    </span>
  );
}

function Delai({ ligne, regles }: { ligne: LigneRemplissage | undefined; regles: ReglesSource }) {
  const date = dernier(ligne, regles.cle);
  const j = joursDepuis(date);
  const retard = enRetard(ligne, regles);
  const statut = dernierStatut(ligne, regles.cle);
  return (
    <span
      className={`w-14 text-right text-xs tabular-nums ${retard ? "font-semibold text-danger" : "text-texte-3"}`}
      title={date ? `Dernier formulaire ${regles.libelle} le ${date} : « ${libelleStatut(statut)} »` : `Aucun formulaire ${regles.libelle}`}
    >
      {j === null ? "jamais" : j === 0 ? "auj." : `${j} j`}
      {statut && statut !== "en_cours" && <span className="ml-0.5 text-texte-3" aria-hidden>*</span>}
    </span>
  );
}

function MiniTaux({ valeur, couleur }: { valeur: number | null; couleur: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-graphe-piste">
        <span className="block h-full" style={{ width: `${(valeur ?? 0) * 100}%`, background: couleur }} />
      </span>
      <span className="w-9 text-right text-xs font-semibold tabular-nums">{valeur === null ? "—" : pct(valeur * 100)}</span>
    </span>
  );
}

export function SuiviRemplissage({
  sites,
  lots,
  lotsMoe,
  remplissage,
  initial,
}: {
  sites: EtatSite[];
  lots: Lot[];
  lotsMoe: LotMoe[];
  remplissage: LigneRemplissage[];
  initial: { lotMoe: number | null; source: SourceFormulaire | null; retard: boolean };
}) {
  // null = tous les lots MOE (arrivée depuis un lien « sites en retard » du tableau de bord).
  const [lotMoe, setLotMoe] = useState<number | null>(initial.lotMoe ?? (initial.retard ? null : lotsMoe[0]?.id ?? 1));
  const [lot, setLot] = useState<number | null>(null);
  const [retardSeul, setRetardSeul] = useState(initial.retard);
  const [sourceRetard, setSourceRetard] = useState<SourceFormulaire | null>(initial.source);
  const [tousSites, setTousSites] = useState(false);
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    const p = new URLSearchParams();
    if (lotMoe) p.set("lot_moe", String(lotMoe));
    if (retardSeul) p.set("retard", "1");
    if (retardSeul && sourceRetard) p.set("source", sourceRetard);
    window.history.replaceState(null, "", `${window.location.pathname}${p.size ? `?${p}` : ""}`);
  }, [lotMoe, retardSeul, sourceRetard]);

  const parSite = useMemo(() => new Map(remplissage.map((l) => [l.site_id, l])), [remplissage]);
  const dateRef = remplissage[0]?.date_ref ?? new Date().toISOString().slice(0, 10);

  // Comparaison des lots MOE (sites suivis : au moins un acteur a déclaré « en cours »).
  const comparaison = useMemo(
    () =>
      lotsMoe.map((m) => {
        const suivis = sites.filter((s) => s.lot_moe_id === m.id && suivi(parSite.get(s.id))).map((s) => s.id);
        return { lot: m, nb: suivis.length, syntheses: synthese(suivis, parSite) };
      }),
    [lotsMoe, sites, parSite]
  );

  const sourcesRetard = sourceRetard ? SOURCES_SUIVI.filter((r) => r.cle === sourceRetard) : SOURCES_SUIVI;
  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return sites
      .filter((s) => (!lotMoe || s.lot_moe_id === lotMoe) && (!lot || s.lot_id === lot))
      .filter((s) => tousSites || suivi(parSite.get(s.id)))
      .filter((s) => !q || `${s.code} ${s.nom} ${s.localite}`.toLowerCase().includes(q))
      .filter((s) => !retardSeul || sourcesRetard.some((r) => enRetard(parSite.get(s.id), r)));
  }, [sites, lotMoe, lot, tousSites, recherche, retardSeul, sourcesRetard, parSite]);

  const groupes = useMemo(() => {
    const m = new Map<number, EtatSite[]>();
    for (const s of visibles) m.set(s.lot_id, [...(m.get(s.lot_id) ?? []), s]);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [visibles]);

  const lotsDuMoe = lots.filter((l) => sites.some((s) => s.lot_id === l.id && (!lotMoe || s.lot_moe_id === lotMoe)));

  return (
    <div className="space-y-4">
      {/* Lots MOE : comparaison et choix */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="tablist" aria-label="Lot MOE">
        {comparaison.map(({ lot: m, nb, syntheses }) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={lotMoe === m.id}
            onClick={() => {
              setLotMoe(m.id);
              setLot(null);
            }}
            className={`carte p-3 text-left transition ${lotMoe === m.id ? "ring-2 ring-accent" : "hover:ring-2 hover:ring-bordure-forte"}`}
          >
            <p className="font-bold">Lot MOE {m.id}</p>
            <p className="mb-2 truncate text-xs text-texte-2" title={m.regions.join(", ")}>
              {m.regions.join(", ")} · {nb} sites suivis
            </p>
            <div className="space-y-1">
              {syntheses.map((s) => (
                <div key={s.source.cle} className="flex items-center justify-between gap-2 text-xs">
                  <span className="w-10 font-semibold">{s.source.libelle}</span>
                  <MiniTaux valeur={s.taux} couleur={s.source.couleur} />
                  <span className={`w-16 text-right ${s.retards ? "text-danger" : "text-texte-3"}`}>
                    {s.retards} en retard
                  </span>
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div className="carte flex flex-wrap items-center gap-x-4 gap-y-2 p-3 text-sm">
        <select className="champ !w-auto !py-1.5" value={lot ?? ""} onChange={(e) => setLot(e.target.value ? Number(e.target.value) : null)} aria-label="Lot de travaux">
          <option value="">{lotMoe ? `Tous les lots du MOE ${lotMoe}` : "Tous les lots de travaux"}</option>
          {lotsDuMoe.map((l) => (
            <option key={l.id} value={l.id}>
              {l.id}. {l.nom}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-texte-3" />
          <input className="champ !w-56 !py-1.5 !pl-8" placeholder="Site, code, localité…" value={recherche} onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher un site" />
        </div>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={retardSeul} onChange={(e) => setRetardSeul(e.target.checked)} />
          En retard seulement
        </label>
        {retardSeul && (
          <select className="champ !w-auto !py-1.5" value={sourceRetard ?? ""} onChange={(e) => setSourceRetard((e.target.value || null) as SourceFormulaire | null)} aria-label="Type de formulaire en retard">
            <option value="">MOE, CSTC ou UG</option>
            {SOURCES_SUIVI.map((r) => (
              <option key={r.cle} value={r.cle}>
                {r.libelle}
              </option>
            ))}
          </select>
        )}
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={tousSites} onChange={(e) => setTousSites(e.target.checked)} />
          Inclure les sites sans formulaire attendu
        </label>
        <button
          type="button"
          onClick={() => {
            setLotMoe(null);
            setLot(null);
          }}
          className={`ml-auto rounded-full px-3 py-1 ring-1 ${lotMoe === null ? "bg-accent text-sur-accent ring-accent" : "ring-bordure hover:bg-surface-2"}`}
        >
          Tous les lots MOE
        </button>
      </div>

      <ReglesRemplissage />

      {/* Légende */}
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-texte-2">
        <span>Pastilles : {NB_SEMAINES} dernières semaines, de la plus ancienne à la semaine en cours (à droite).</span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3.5 w-3 rounded-[3px] bg-texte-3" /> formulaire reçu
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3.5 w-3 rounded-[3px] bg-danger-clair ring-1 ring-inset ring-danger" /> manquant (attendu)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3.5 w-3 rounded-[3px] ring-1 ring-inset ring-bordure" /> non attendu ou semaine en cours
        </span>
        <span>Délai : jours depuis le dernier formulaire, en rouge si en retard ; * : le dernier formulaire n&apos;indique pas « en cours ».</span>
      </p>

      {/* Tableau par site */}
      <div className="carte overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-bordure text-left text-xs text-texte-2">
              <th className="px-3 py-2 font-medium">Site</th>
              <th className="py-2 font-medium">Statut MOE</th>
              {SOURCES_SUIVI.map((r) => (
                <th key={r.cle} className="py-2 pl-4 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.couleur }} />
                    {r.libelle} <span className="font-normal text-texte-3">· {r.rythme}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!groupes.length && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-texte-2">
                  Aucun site ne correspond à ces critères.
                </td>
              </tr>
            )}
            {groupes.map(([lotId, sitesLot]) => {
              const s = synthese(sitesLot.map((x) => x.id), parSite);
              return (
                <Fragment key={lotId}>
                  <tr className="border-b border-bordure bg-surface-2">
                    <td colSpan={2} className="px-3 py-1.5 font-semibold">
                      Lot {lotId} · {lots.find((l) => l.id === lotId)?.nom}
                      <span className="ml-2 text-xs font-normal text-texte-3">
                        {sitesLot.length} site{sitesLot.length > 1 ? "s" : ""}
                      </span>
                    </td>
                    {s.map((x) => (
                      <td key={x.source.cle} className="py-1.5 pl-4">
                        <MiniTaux valeur={x.taux} couleur={x.source.couleur} />
                      </td>
                    ))}
                  </tr>
                  {sitesLot.map((site) => {
                    const l = parSite.get(site.id);
                    return (
                      <tr key={site.id} className="border-b border-bordure last:border-0 hover:bg-surface-2/60">
                        <td className="max-w-[260px] px-3 py-1.5">
                          <Link href={`/site/${site.code}`} className="block truncate hover:underline" title={`${site.nom} — ${site.localite}`}>
                            <span className="text-texte-3">{site.code}</span> {site.nom}
                          </Link>
                        </td>
                        <td className="py-1.5">
                          {site.moe_statut ? <BadgeStatut statut={site.moe_statut} /> : <span className="text-xs text-texte-3">aucun rapport</span>}
                        </td>
                        {SOURCES_SUIVI.map((r) => (
                          <td key={r.cle} className="py-1.5 pl-4">
                            <span className="flex items-center gap-2">
                              <Frise ligne={l} regles={r} dateRef={dateRef} />
                              <Delai ligne={l} regles={r} />
                            </span>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
