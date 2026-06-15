"use client";

/**
 * Graphique « visites de chantiers par personnel dans le temps » (CDC §5.3).
 * Abscisse = temps (regroupable par jour / semaine / mois / trimestre),
 * ordonnée = nombre de visites, barres empilées par visiteur.
 * Rendu SVG sans dépendance externe.
 */
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Periode = "jour" | "semaine" | "mois" | "trimestre";

interface VisiteLite {
  date_visite: string;
  nom_visiteur: string;
}

const PERIODES: { cle: Periode; libelle: string }[] = [
  { cle: "jour", libelle: "Jour" },
  { cle: "semaine", libelle: "Semaine" },
  { cle: "mois", libelle: "Mois" },
  { cle: "trimestre", libelle: "Trimestre" },
];

// Palette de couleurs distinctes (assemblage en tête).
const COULEURS = [
  "#E8201A", "#2563EB", "#16A34A", "#F59E0B", "#7C3AED",
  "#0891B2", "#DB2777", "#65A30D", "#EA580C", "#475569",
];
const COULEUR_AUTRES = "#CBD5E1";

const MOIS_COURTS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

function isoSemaine(d: Date): { annee: number; semaine: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const jour = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - jour + 3);
  const premierJeudi = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const semaine =
    1 +
    Math.round(
      ((date.getTime() - premierJeudi.getTime()) / 86400000 -
        3 +
        ((premierJeudi.getUTCDay() + 6) % 7)) /
        7
    );
  return { annee: date.getUTCFullYear(), semaine };
}

/** Clé de tri (ISO) + libellé affiché pour une date selon la période. */
function bucket(dateStr: string, periode: Periode): { cle: string; label: string } {
  const d = new Date(dateStr);
  const an = d.getFullYear();
  const an2 = String(an).slice(2);
  if (periode === "jour") {
    return {
      cle: dateStr.slice(0, 10),
      label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
    };
  }
  if (periode === "semaine") {
    const { annee, semaine } = isoSemaine(d);
    return {
      cle: `${annee}-S${String(semaine).padStart(2, "0")}`,
      label: `S${semaine}`,
    };
  }
  if (periode === "mois") {
    return {
      cle: `${an}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${MOIS_COURTS[d.getMonth()]} ${an2}`,
    };
  }
  const t = Math.floor(d.getMonth() / 3) + 1;
  return { cle: `${an}-T${t}`, label: `T${t} ${an2}` };
}

const MAX_BUCKETS = 30;
const MAX_PERSONNEL = 8;

export function GraphiqueVisites() {
  const [visites, setVisites] = useState<VisiteLite[] | null>(null);
  const [periode, setPeriode] = useState<Periode>("mois");
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const tout: VisiteLite[] = [];
        for (let depuis = 0; depuis < 10000; depuis += 1000) {
          const { data, error } = await supabase
            .from("chantierci_visites")
            .select("date_visite, nom_visiteur")
            .eq("archive", false)
            .order("date_visite", { ascending: true })
            .range(depuis, depuis + 999);
          if (error) throw new Error(error.message);
          tout.push(...((data ?? []) as VisiteLite[]));
          if (!data || data.length < 1000) break;
        }
        setVisites(tout);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Chargement impossible");
      }
    })();
  }, []);

  const graphe = useMemo(() => {
    if (!visites) return null;

    // Top personnel par nombre total de visites.
    const totauxPersonnel = new Map<string, number>();
    for (const v of visites) {
      const n = v.nom_visiteur || "(inconnu)";
      totauxPersonnel.set(n, (totauxPersonnel.get(n) ?? 0) + 1);
    }
    const classement = [...totauxPersonnel.entries()].sort((a, b) => b[1] - a[1]);
    const top = classement.slice(0, MAX_PERSONNEL).map(([n]) => n);
    const aDavantage = classement.length > MAX_PERSONNEL;
    const series = aDavantage ? [...top, "Autres"] : top;
    const nomSerie = (n: string) => (top.includes(n) ? n : "Autres");

    // Buckets temporels.
    const buckets = new Map<string, { label: string; parSerie: Map<string, number> }>();
    for (const v of visites) {
      const { cle, label } = bucket(v.date_visite, periode);
      const b = buckets.get(cle) ?? { label, parSerie: new Map<string, number>() };
      const s = nomSerie(v.nom_visiteur || "(inconnu)");
      b.parSerie.set(s, (b.parSerie.get(s) ?? 0) + 1);
      buckets.set(cle, b);
    }

    const cles = [...buckets.keys()].sort().slice(-MAX_BUCKETS);
    const colonnes = cles.map((cle) => {
      const b = buckets.get(cle)!;
      const total = [...b.parSerie.values()].reduce((s, n) => s + n, 0);
      return { label: b.label, parSerie: b.parSerie, total };
    });
    const maxTotal = Math.max(1, ...colonnes.map((c) => c.total));

    return { series, colonnes, maxTotal, aDavantage };
  }, [visites, periode]);

  const couleurSerie = (serie: string, index: number) =>
    serie === "Autres" ? COULEUR_AUTRES : COULEURS[index % COULEURS.length];

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <BarChart3 className="h-4 w-4 text-assemblage" /> Visites de chantiers par
          personnel
        </h2>
        <div className="flex rounded-lg border border-gray-300 p-0.5">
          {PERIODES.map((p) => (
            <button
              key={p.cle}
              onClick={() => setPeriode(p.cle)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                periode === p.cle
                  ? "bg-assemblage text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {p.libelle}
            </button>
          ))}
        </div>
      </div>

      {erreur && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>
      )}

      {!graphe && !erreur && (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
        </div>
      )}

      {graphe && graphe.colonnes.length === 0 && (
        <p className="py-12 text-center text-sm text-gray-500">
          Aucune visite à afficher.
        </p>
      )}

      {graphe && graphe.colonnes.length > 0 && (
        <>
          <Graphe graphe={graphe} couleurSerie={couleurSerie} />
          {/* Légende */}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-600">
            {graphe.series.map((s, i) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: couleurSerie(s, i) }}
                />
                {s}
              </span>
            ))}
          </div>
          {graphe.aDavantage && (
            <p className="mt-1 text-xs text-gray-400">
              Les {MAX_PERSONNEL} visiteurs les plus actifs sont détaillés ; les
              autres sont regroupés.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Graphe({
  graphe,
  couleurSerie,
}: {
  graphe: {
    series: string[];
    colonnes: { label: string; parSerie: Map<string, number>; total: number }[];
    maxTotal: number;
  };
  couleurSerie: (serie: string, index: number) => string;
}) {
  const { series, colonnes, maxTotal } = graphe;
  const H = 280;
  const margeBas = 44;
  const margeGauche = 32;
  const margeHaut = 8;
  const hauteurUtile = H - margeBas - margeHaut;
  const largeurBarre = 34;
  const ecart = 16;
  const W = Math.max(
    560,
    margeGauche + colonnes.length * (largeurBarre + ecart) + ecart
  );

  // Lignes de repère horizontales (~4).
  const pas = Math.max(1, Math.ceil(maxTotal / 4));
  const reperes: number[] = [];
  for (let v = 0; v <= maxTotal; v += pas) reperes.push(v);

  const y = (valeur: number) => margeHaut + hauteurUtile * (1 - valeur / maxTotal);

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="min-w-full" role="img">
        {/* Repères + valeurs */}
        {reperes.map((r) => (
          <g key={r}>
            <line
              x1={margeGauche}
              x2={W}
              y1={y(r)}
              y2={y(r)}
              stroke="#E5E7EB"
              strokeWidth={1}
            />
            <text
              x={margeGauche - 6}
              y={y(r) + 3}
              textAnchor="end"
              className="fill-gray-400"
              fontSize={10}
            >
              {r}
            </text>
          </g>
        ))}

        {/* Barres empilées */}
        {colonnes.map((col, i) => {
          const x = margeGauche + ecart + i * (largeurBarre + ecart);
          let yCourant = y(0);
          return (
            <g key={i}>
              {series.map((s, idx) => {
                const valeur = col.parSerie.get(s) ?? 0;
                if (valeur === 0) return null;
                const hauteur = (hauteurUtile * valeur) / maxTotal;
                yCourant -= hauteur;
                return (
                  <rect
                    key={s}
                    x={x}
                    y={yCourant}
                    width={largeurBarre}
                    height={hauteur}
                    fill={couleurSerie(s, idx)}
                  >
                    <title>{`${col.label} — ${s} : ${valeur}`}</title>
                  </rect>
                );
              })}
              {/* Total au-dessus de la barre */}
              <text
                x={x + largeurBarre / 2}
                y={y(col.total) - 4}
                textAnchor="middle"
                className="fill-gray-600"
                fontSize={10}
                fontWeight={600}
              >
                {col.total}
              </text>
              {/* Label d'abscisse */}
              <text
                x={x + largeurBarre / 2}
                y={H - margeBas + 16}
                textAnchor="middle"
                className="fill-gray-500"
                fontSize={10}
              >
                {col.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
