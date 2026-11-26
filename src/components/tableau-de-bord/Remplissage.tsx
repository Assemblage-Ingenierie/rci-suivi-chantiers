import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { pct } from "@/lib/tableau-de-bord/calculs";
import { jourMois, lundiSemaine, NB_SEMAINES, PREMIERE_SEMAINE_COURBE, type SyntheseRemplissage } from "@/lib/suivi/remplissage";
import { ReglesRemplissage } from "@/components/suivi/ReglesRemplissage";

const L = 560;
const H = 200;
const M = { haut: 12, droite: 16, bas: 26, gauche: 40 };

/** Courbes : part des formulaires attendus effectivement reçus, semaine par semaine. */
function Courbes({ syntheses, dateRef }: { syntheses: SyntheseRemplissage[]; dateRef: string }) {
  const n = NB_SEMAINES - 1 - PREMIERE_SEMAINE_COURBE; // semaines complètes tracées
  const semaine = (i: number) => jourMois(lundiSemaine(dateRef, i + PREMIERE_SEMAINE_COURBE));
  const x = (i: number) => M.gauche + ((L - M.gauche - M.droite) * i) / (n - 1);
  const y = (v: number) => M.haut + (H - M.haut - M.bas) * (1 - v);
  /** Tracé interrompu là où rien n'était attendu. */
  const trace = (valeurs: (number | null)[]) => {
    let d = "";
    let leve = true;
    valeurs.forEach((v, i) => {
      if (v === null) {
        leve = true;
        return;
      }
      d += `${leve ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      leve = false;
    });
    return d;
  };
  return (
    <svg viewBox={`0 0 ${L} ${H}`} className="w-full" role="img" aria-label="Remplissage des formulaires par semaine">
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}>
          <line x1={M.gauche} x2={L - M.droite} y1={y(v)} y2={y(v)} className="stroke-bordure" />
          <text x={M.gauche - 6} y={y(v) + 4} textAnchor="end" fontSize={11} className="fill-texte-3">
            {v * 100} %
          </text>
        </g>
      ))}
      {Array.from({ length: n }, (_, i) => (
        <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} className="fill-texte-3">
          {semaine(i)}
        </text>
      ))}
      {syntheses.map((s) => (
        <g key={s.source.cle}>
          <path d={trace(s.parSemaine)} fill="none" stroke={s.source.couleur} strokeWidth={2.5} strokeLinejoin="round" />
          {s.parSemaine.map((v, i) =>
            v === null ? null : (
              <circle key={i} cx={x(i)} cy={y(v)} r={3} fill={s.source.couleur}>
                <title>{`${s.source.libelle}, semaine du ${semaine(i)} : ${pct(v * 100)} des formulaires attendus reçus`}</title>
              </circle>
            )
          )}
        </g>
      ))}
    </svg>
  );
}

export function Remplissage({
  syntheses,
  dateRef,
  nbSuivis,
  lotMoe,
}: {
  syntheses: SyntheseRemplissage[];
  dateRef: string;
  nbSuivis: number;
  lotMoe: number | null;
}) {
  const lien = (extra = "") => `/suivi${lotMoe ? `?lot_moe=${lotMoe}${extra ? `&${extra}` : ""}` : extra ? `?${extra}` : ""}`;
  return (
    <div className="space-y-3">
      <div className="grid gap-4 lg:grid-cols-[3fr,2fr]">
        <div>
          <Courbes syntheses={syntheses} dateRef={dateRef} />
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-texte-2">
            {syntheses.map((s) => (
              <span key={s.source.cle} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-5 rounded-full" style={{ background: s.source.couleur }} />
                {s.source.libelle} · {s.source.rythme}
              </span>
            ))}
          </p>
        </div>
        <div className="space-y-3">
          {syntheses.map((s) => (
            <div key={s.source.cle}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm">
                  <strong>{s.source.libelle}</strong>{" "}
                  <span className="text-xs text-texte-3">
                    · {s.concernes} site{s.concernes > 1 ? "s" : ""} déclaré{s.concernes > 1 ? "s" : ""} « en cours »
                  </span>
                </span>
                <span className="text-xl font-bold tabular-nums" style={{ color: s.source.couleur }}>
                  {s.taux === null ? "—" : pct(s.taux * 100)}
                </span>
              </div>
              <span className="mt-1 block h-2 overflow-hidden rounded-full bg-graphe-piste">
                <span className="block h-full rounded-full" style={{ width: `${(s.taux ?? 0) * 100}%`, background: s.source.couleur }} />
              </span>
              <p className="mt-1 text-xs text-texte-2">
                {s.retards ? (
                  <Link href={lien(`source=${s.source.cle}&retard=1`)} className="font-semibold text-alerte hover:underline">
                    {s.retards} site{s.retards > 1 ? "s" : ""} sans {s.source.libelle} depuis plus de {s.source.retardJours} jours
                  </Link>
                ) : (
                  <span className="text-succes">Aucun site en retard</span>
                )}
              </p>
            </div>
          ))}
          <Link href={lien()} className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
            Suivi détaillé par site ({nbSuivis} sites suivis) <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <ReglesRemplissage replie />
    </div>
  );
}
