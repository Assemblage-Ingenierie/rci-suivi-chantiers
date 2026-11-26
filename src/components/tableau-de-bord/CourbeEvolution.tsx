import { dateCourte, pct } from "@/lib/tableau-de-bord/calculs";

export type PointEvolution = { date_ref: string; avancement: number | null };

const L = 640;
const H = 220;
const M = { haut: 14, droite: 56, bas: 26, gauche: 36 };

/** Rythme moyen (points par semaine) sur les `semaines` dernières semaines. */
export function rythme(serie: PointEvolution[], semaines = 4): number | null {
  const pts = serie.filter((p) => p.avancement !== null);
  if (pts.length < 2) return null;
  const fin = pts.at(-1)!;
  const debut = pts[Math.max(0, pts.length - 1 - semaines)];
  const jours = (new Date(fin.date_ref).getTime() - new Date(debut.date_ref).getTime()) / 86_400_000;
  if (jours <= 0) return null;
  return ((Number(fin.avancement) - Number(debut.avancement)) / jours) * 7;
}

/** Date estimée d'achèvement au rythme donné (null si rythme nul ou négatif). */
export function achevementEstime(actuel: number | null, pointsParSemaine: number | null): Date | null {
  if (actuel === null || !pointsParSemaine || pointsParSemaine <= 0.05) return null;
  const semaines = (100 - actuel) / pointsParSemaine;
  return new Date(Date.now() + semaines * 7 * 86_400_000);
}

/** Courbe de l'avancement global pondéré, semaine par semaine (source MOE). */
export function CourbeEvolution({ serie }: { serie: PointEvolution[] }) {
  const pts = serie.filter((p) => p.avancement !== null).map((p) => ({ ...p, avancement: Number(p.avancement) }));
  if (pts.length < 2) return <p className="text-sm text-texte-2">Pas encore assez de rapports MOE pour tracer l&apos;évolution.</p>;

  const lx = L - M.gauche - M.droite;
  const ly = H - M.haut - M.bas;
  const x = (i: number) => M.gauche + (lx * i) / (pts.length - 1);
  const y = (v: number) => M.haut + ly * (1 - v / 100);
  const ligne = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.avancement).toFixed(1)}`).join(" ");
  const aire = `${ligne} L${x(pts.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const pas = Math.max(1, Math.ceil(pts.length / 6)); // au plus ~6 dates en abscisse
  const dernier = pts.at(-1)!;

  return (
    <svg viewBox={`0 0 ${L} ${H}`} className="w-full" role="img" aria-label="Évolution de l'avancement global">
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={M.gauche} x2={L - M.droite} y1={y(v)} y2={y(v)} className="stroke-bordure" strokeWidth={1} />
          <text x={M.gauche - 6} y={y(v) + 4} textAnchor="end" fontSize={11} className="fill-texte-3">
            {v} %
          </text>
        </g>
      ))}
      <path d={aire} className="fill-graphe-rempli" opacity={0.12} />
      <path d={ligne} className="stroke-graphe-rempli" fill="none" strokeWidth={2.5} strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={p.date_ref}>
          <circle cx={x(i)} cy={y(p.avancement)} r={i === pts.length - 1 ? 4.5 : 2.5} className="fill-graphe-rempli">
            <title>{`${dateCourte(p.date_ref)} : ${pct(p.avancement, 1)}`}</title>
          </circle>
          {(i % pas === 0 || i === pts.length - 1) && (
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} className="fill-texte-3">
              {dateCourte(p.date_ref)}
            </text>
          )}
        </g>
      ))}
      <text x={x(pts.length - 1) + 8} y={y(dernier.avancement) + 4} fontSize={13} fontWeight={700} className="fill-graphe-rempli">
        {pct(dernier.avancement, 1)}
      </text>
    </svg>
  );
}
