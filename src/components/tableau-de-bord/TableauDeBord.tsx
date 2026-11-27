"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { SegmentCorpsEtat } from "@/lib/formulaires/avancement";
import { BarreCorpsEtat, LegendeCorpsEtat } from "@/components/BarreCorpsEtat";
import {
  avancementGlobal,
  pct,
  syntheseLots,
  TERMINES,
  type SiteTableau,
  type LotRef,
} from "@/lib/tableau-de-bord/calculs";
import { couleurStatut, ORDRE_STATUTS } from "@/lib/tableau-de-bord/couleurs";
import { achevementEstime, CourbeEvolution, rythme, type PointEvolution } from "./CourbeEvolution";
import { LigneEffectif } from "./Barres";
import { Remplissage } from "./Remplissage";
import type { SyntheseRemplissage } from "@/lib/suivi/remplissage";

/** Remplissage des formulaires, déjà synthétisé côté serveur pour chaque périmètre (« tous » ou n° de lot MOE). */
export type RemplissageTableau = {
  dateRef: string;
  parPerimetre: Record<string, { syntheses: SyntheseRemplissage[]; nbSuivis: number }>;
};

const CarteSites = dynamic(() => import("./CarteSites"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[340px] items-center justify-center rounded-carte bg-surface-2 text-sm text-texte-2">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement de la carte…
    </div>
  ),
});

export type LotMoeRef = { id: number; nom: string; regions: string[] };

/** Écart (points) sous la moyenne à partir duquel un lot est signalé. */
const RETARD_LOT_POINTS = 10;

function Bloc({ titre, source = true, aide, droite, children }: {
  titre: string;
  source?: boolean;
  aide?: React.ReactNode;
  droite?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="carte flex flex-col p-4">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-base font-bold">
          {titre}
          {source && <span className="ml-2 text-xs font-normal text-texte-3">Source : MOE</span>}
        </h2>
        {droite}
      </div>
      {aide && <p className="mb-3 text-xs text-texte-2">{aide}</p>}
      {children}
    </section>
  );
}

function Indicateur({ titre, valeur, ton, children, href }: {
  titre: string;
  valeur: React.ReactNode;
  ton?: string;
  children?: React.ReactNode;
  href?: string;
}) {
  const corps = (
    <>
      <p className="text-sm text-texte-2">{titre}</p>
      <p className={`text-3xl font-bold leading-tight tabular-nums ${ton ?? ""}`}>{valeur}</p>
      <div className="mt-1 text-xs text-texte-2">{children}</div>
    </>
  );
  return href ? (
    <Link href={href} className="carte group block p-4 transition hover:ring-2 hover:ring-accent/40">
      {corps}
    </Link>
  ) : (
    <div className="carte p-4">{corps}</div>
  );
}

export function TableauDeBord({
  sites,
  lots,
  lotsMoe,
  corpsParLot,
  evolutionInitiale,
  remplissage,
}: {
  sites: SiteTableau[];
  lots: LotRef[];
  lotsMoe: LotMoeRef[];
  /** Avancement par corps d'état de chaque lot (calculé côté serveur). */
  corpsParLot: Record<number, SegmentCorpsEtat[]>;
  evolutionInitiale: PointEvolution[];
  remplissage: RemplissageTableau | null;
}) {
  const [lotMoe, setLotMoe] = useState<number | null>(null);
  const [tri, setTri] = useState<"numero" | "avancement">("numero");
  const [evolutions, setEvolutions] = useState<Record<string, PointEvolution[]>>({ tous: evolutionInitiale });

  const cle = lotMoe ? String(lotMoe) : "tous";
  useEffect(() => {
    if (evolutions[cle]) return;
    createClient()
      .rpc("chantierci_evolution_avancement", { p_lot_moe: lotMoe })
      .then(({ data }) => setEvolutions((e) => ({ ...e, [cle]: (data ?? []) as PointEvolution[] })));
  }, [cle, lotMoe, evolutions]);
  const evolution = evolutions[cle];

  const filtres = useMemo(() => (lotMoe ? sites.filter((s) => s.lot_moe_id === lotMoe) : sites), [sites, lotMoe]);
  const synthese = useMemo(() => syntheseLots(filtres, lots), [filtres, lots]);
  const global = useMemo(() => avancementGlobal(synthese), [synthese]);
  // Corps d'état du périmètre = somme des lots qu'il contient (montants et réalisé s'additionnent).
  const corpsEtat = useMemo(() => {
    const lotsPerimetre = new Set(filtres.map((s) => s.lot_id));
    const somme = new Map<string, SegmentCorpsEtat>();
    for (const [lot, segments] of Object.entries(corpsParLot)) {
      if (!lotsPerimetre.has(Number(lot))) continue;
      for (const seg of segments) {
        const e = somme.get(seg.code) ?? { ...seg, montant: 0, realise: 0 };
        e.montant += seg.montant;
        e.realise += seg.realise;
        somme.set(seg.code, e);
      }
    }
    return [...somme.values()];
  }, [filtres, corpsParLot]);
  const remplissagePerimetre = remplissage?.parPerimetre[cle] ?? null;
  // Sites à suivre : au moins une difficulté sérieuse (calculé côté serveur, voir aSuivre()).
  const aSuivre = useMemo(() => filtres.filter((s) => s.a_suivre).length, [filtres]);

  const n = filtres.length;
  const compte = (cle: string) =>
    filtres.filter((s) => (cle === "aucun" ? !s.moe_statut : s.moe_statut === cle)).length;
  const arretes = compte("arrete");
  const termines = filtres.filter((s) => s.moe_statut && TERMINES.includes(s.moe_statut)).length;
  const receptionnes = compte("receptionne");
  const r = evolution ? rythme(evolution) : null;
  const fin = achevementEstime(global, r);
  const lotsTries = tri === "numero" ? synthese : [...synthese].sort((a, b) => a.moe - b.moe);
  const suffixeFiltre = lotMoe ? `&lot_moe=${lotMoe}` : "";

  return (
    <div className="space-y-4">
      {/* Filtre */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-texte-2">Périmètre :</span>
        {[null, ...lotsMoe.map((m) => m.id)].map((id) => {
          const m = lotsMoe.find((x) => x.id === id);
          return (
            <button
              key={id ?? "tous"}
              type="button"
              onClick={() => setLotMoe(id)}
              title={m ? `${m.nom} — ${m.regions.join(", ")}` : "Les 387 sites"}
              className={`rounded-full px-3 py-1 text-sm ring-1 ${
                lotMoe === id ? "bg-accent text-sur-accent ring-accent" : "bg-surface ring-bordure hover:bg-surface-2"
              }`}
            >
              {m ? `Lot MOE ${m.id}` : "Tout le programme"}
            </button>
          );
        })}
        {lotMoe && <span className="text-sm text-texte-2">{lotsMoe.find((m) => m.id === lotMoe)?.regions.join(", ")}</span>}
      </div>

      {/* 1. Chiffres clés */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicateur titre="Avancement global" valeur={pct(global, 1)}>
          <span className="mb-1 block h-1.5 overflow-hidden rounded-full bg-graphe-piste">
            <span className="block h-full bg-graphe-rempli" style={{ width: `${global ?? 0}%` }} />
          </span>
          {r !== null ? `${r >= 0 ? "+" : ""}${r.toFixed(1).replace(".", ",")} pt par semaine (4 dernières sem.)` : "Source : MOE"}
        </Indicateur>
        <Indicateur titre="Chantiers terminés" valeur={<>{termines}<span className="text-lg font-normal text-texte-3"> / {n}</span></>} ton="text-succes">
          dont {receptionnes} réceptionné{receptionnes > 1 ? "s" : ""}
        </Indicateur>
        <Indicateur
          titre="Chantiers arrêtés"
          valeur={arretes}
          ton={arretes ? "text-danger" : undefined}
          href={arretes ? `/alertes?famille=presence${suffixeFiltre}` : undefined}
        >
          {pct(n ? (100 * arretes) / n : null)} des sites
          {arretes > 0 && <span className="ml-1 inline-flex items-center gap-0.5 font-semibold text-accent">voir <ArrowRight className="h-3 w-3" /></span>}
        </Indicateur>
        <Indicateur
          titre="Sites à suivre"
          valeur={aSuivre}
          ton={aSuivre ? "text-alerte" : undefined}
          href={`/alertes${lotMoe ? `?lot_moe=${lotMoe}` : ""}`}
        >
          au moins une alerte critique (arrêt, sécurité, qualité, retard, écart)
          <span className="ml-1 inline-flex items-center gap-0.5 font-semibold text-accent">détail <ArrowRight className="h-3 w-3" /></span>
        </Indicateur>
      </div>

      {/* 2. Tendance et état */}
      <div className="grid gap-4 xl:grid-cols-[3fr,2fr]">
        <Bloc
          titre="Évolution de l'avancement global"
          aide="Avancement pondéré par lot, à la fin de chaque semaine, d'après le dernier rapport MOE connu de chaque site."
        >
          {evolution ? <CourbeEvolution serie={evolution} /> : <p className="py-16 text-center text-sm text-texte-2"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Calcul…</p>}
          {r !== null && (
            <p className="mt-1 text-sm">
              Rythme sur 4 semaines : <strong>{`${r >= 0 ? "+" : ""}${r.toFixed(1).replace(".", ",")} pt / semaine`}</strong>
              {fin && (
                <>
                  {" "}· à ce rythme, fin des travaux vers{" "}
                  <strong>{new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(fin)}</strong>
                  <span className="text-texte-3"> (estimation)</span>
                </>
              )}
            </p>
          )}
        </Bloc>
        <Bloc titre="État des chantiers" aide={`Statut du dernier rapport MOE, sur ${n} sites.`}>
          <div className="space-y-0.5">
            {ORDRE_STATUTS.map((s) => (
              <LigneEffectif
                key={s.cle}
                libelle={s.libelle}
                couleur={couleurStatut(s.cle === "aucun" ? null : s.cle)}
                nombre={compte(s.cle)}
                total={n}
                href={s.cle === "arrete" ? `/alertes?famille=presence${suffixeFiltre}` : s.cle === "aucun" ? `/suivi${lotMoe ? `?lot_moe=${lotMoe}` : ""}` : undefined}
              />
            ))}
          </div>
        </Bloc>
      </div>

      {/* 3. Remplissage des formulaires */}
      {remplissage && remplissagePerimetre && (
        <Bloc
          titre="Remplissage des formulaires"
          source={false}
          aide="Part des formulaires attendus effectivement reçus, par acteur. Un formulaire n'est attendu que si l'acteur a déclaré le chantier « en cours » dans son dernier formulaire (voir l'encadré)."
        >
          <Remplissage
            syntheses={remplissagePerimetre.syntheses}
            dateRef={remplissage.dateRef}
            nbSuivis={remplissagePerimetre.nbSuivis}
            lotMoe={lotMoe}
          />
        </Bloc>
      )}

      {/* 4. Lots */}
      <Bloc
        titre="Avancement par lot de travaux"
        aide={
          <>
            Chaque barre est découpée par corps d&apos;état : largeur = part du montant DQE, partie remplie = avancement
            (détail au survol). Moyenne des sites pondérée par leur montant. Le trait vertical marque l&apos;avancement
            global ({pct(global)}) ; en orange, les lots à plus de {RETARD_LOT_POINTS} points en dessous.
          </>
        }
        droite={
          <div className="flex rounded-full bg-surface-2 p-0.5 text-xs ring-1 ring-bordure" role="radiogroup" aria-label="Ordre des lots">
            {(["numero", "avancement"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={tri === t}
                onClick={() => setTri(t)}
                className={`rounded-full px-3 py-1 ${tri === t ? "bg-accent text-sur-accent" : "text-texte-2"}`}
              >
                {t === "numero" ? "Par numéro" : "Les moins avancés d'abord"}
              </button>
            ))}
          </div>
        }
      >
        <div className="gap-x-10 xl:columns-2">
          {lotsTries.map((l) => {
            const enRetard = global !== null && l.moe < global - RETARD_LOT_POINTS;
            return (
              <div key={l.id} className="break-inside-avoid">
                <div
                  className="flex items-center gap-2 py-[3px] text-sm"
                  title={`Lot ${l.id} – ${l.nom} : ${l.sites} sites, ${pct(l.moe, 1)}, ${l.arretes} arrêté(s), ${l.termines} terminé(s)`}
                >
                  <span className={`w-44 shrink-0 truncate ${enRetard ? "font-semibold text-alerte" : ""}`}>
                    <span className="inline-block w-6 text-right tabular-nums text-texte-3">{l.id}</span> {l.nom}
                  </span>
                  <BarreCorpsEtat segments={corpsParLot[l.id] ?? []} repere={global} ton={enRetard ? "alerte" : "normal"} className="flex-1" />
                  <span className="w-16 shrink-0 text-xs">
                    {l.arretes ? (
                      <span className="font-semibold text-danger">{l.arretes} arrêté{l.arretes > 1 ? "s" : ""}</span>
                    ) : (
                      ""
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Bloc>

      {/* 5. Corps d'état et carte */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Bloc
          titre="Avancement par corps d'état"
          aide="Salle de classe et latrines réunies, pondérées par les montants du DQE : largeur = part du montant, partie remplie = avancement (un site sans rapport MOE compte 0 %)."
        >
          <BarreCorpsEtat segments={corpsEtat} hauteur="h-6" className="mb-3" />
          <LegendeCorpsEtat segments={corpsEtat} />
        </Bloc>
        <Bloc titre="Carte des sites">
          <CarteSites sites={filtres} />
        </Bloc>
      </div>
    </div>
  );
}
