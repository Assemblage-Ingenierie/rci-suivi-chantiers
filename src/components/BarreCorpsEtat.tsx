import type { SegmentCorpsEtat } from "@/lib/formulaires/avancement";
import { pct } from "@/lib/tableau-de-bord/calculs";

/**
 * Avancement par corps d'état en une seule barre (salle de classe + latrines) :
 * chaque segment a la largeur du montant DQE du corps d'état, sa partie
 * remplie correspond à son avancement. La surface remplie totale est
 * l'avancement global du site (ou du périmètre). Détail au survol.
 */
export function BarreCorpsEtat({
  segments,
  hauteur = "h-3.5",
  repere,
  ton = "normal",
  avecValeur = true,
  className = "",
}: {
  segments: SegmentCorpsEtat[];
  hauteur?: string;
  /** Trait vertical (ex. avancement global de référence), en %. */
  repere?: number | null;
  ton?: "normal" | "alerte";
  avecValeur?: boolean;
  className?: string;
}) {
  const montant = segments.reduce((s, x) => s + x.montant, 0);
  const total = montant ? (100 * segments.reduce((s, x) => s + x.realise, 0)) / montant : 0;
  return (
    <span className={`flex min-w-0 items-center gap-2 ${className}`}>
      <span className={`relative flex ${hauteur} min-w-[6rem] flex-1 gap-px`} role="img" aria-label={`Avancement ${pct(total)}`}>
        {segments.map((s) => {
          const part = s.montant ? (100 * s.realise) / s.montant : 0;
          return (
            <span
              key={s.code}
              className="relative overflow-hidden rounded-[2px] bg-graphe-piste first:rounded-l-sm last:rounded-r-sm"
              style={{ flexGrow: s.montant, flexBasis: 0 }}
              title={`${s.libelle} : ${pct(part)} réalisé · ${pct((100 * s.montant) / montant)} du montant`}
            >
              <span
                className={`absolute inset-y-0 left-0 ${ton === "alerte" ? "bg-alerte" : "bg-graphe-rempli"}`}
                style={{ width: `${part}%` }}
              />
            </span>
          );
        })}
        {repere !== undefined && repere !== null && (
          <span
            className="pointer-events-none absolute -inset-y-0.5 w-0.5 bg-graphe-repere"
            style={{ left: `calc(${Math.min(Math.max(repere, 0), 100)}% - 1px)` }}
            aria-hidden
          />
        )}
      </span>
      {avecValeur && (
        <span className={`w-11 shrink-0 text-right text-xs font-semibold tabular-nums ${ton === "alerte" ? "text-alerte" : ""}`}>
          {pct(total)}
        </span>
      )}
    </span>
  );
}

/** Légende : chaque corps d'état, sa part du montant et son avancement. */
export function LegendeCorpsEtat({ segments }: { segments: SegmentCorpsEtat[] }) {
  const montant = segments.reduce((s, x) => s + x.montant, 0);
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-texte-3">
          <th className="py-1 font-normal">Corps d&apos;état</th>
          <th className="py-1 text-right font-normal">Part du montant</th>
          <th className="w-2/5 py-1 pl-3 font-normal">Avancement</th>
        </tr>
      </thead>
      <tbody>
        {segments.map((s) => {
          const part = s.montant ? (100 * s.realise) / s.montant : 0;
          return (
            <tr key={s.code} className="border-t border-bordure">
              <td className="py-1">{s.libelle}</td>
              <td className="py-1 text-right tabular-nums text-texte-2">{pct(montant ? (100 * s.montant) / montant : 0, 1)}</td>
              <td className="py-1 pl-3">
                <span className="flex items-center gap-2">
                  <span className="relative h-2.5 flex-1 overflow-hidden rounded-sm bg-graphe-piste">
                    <span className="absolute inset-y-0 left-0 bg-graphe-rempli" style={{ width: `${part}%` }} />
                  </span>
                  <span className="w-10 text-right text-xs tabular-nums">{pct(part)}</span>
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
