import Link from "next/link";
import { pct } from "@/lib/tableau-de-bord/calculs";

/**
 * Ligne de diagramme en barre horizontale : libellé, barre (0–100 %),
 * valeur. `repere` trace un trait vertical (ex. moyenne générale).
 */
export function LigneBarre({
  libelle,
  titre,
  valeur,
  repere,
  ton = "normal",
  suffixe,
  largeurLibelle = "w-40",
}: {
  libelle: React.ReactNode;
  titre?: string;
  valeur: number;
  repere?: number | null;
  ton?: "normal" | "alerte";
  suffixe?: React.ReactNode;
  largeurLibelle?: string;
}) {
  const v = Math.min(Math.max(valeur, 0), 100);
  return (
    <div className="flex items-center gap-2 py-[3px] text-sm" title={titre}>
      <span className={`${largeurLibelle} shrink-0 truncate`}>{libelle}</span>
      <span className="relative h-3.5 flex-1 rounded-sm bg-graphe-piste">
        <span
          className={`absolute inset-y-0 left-0 rounded-sm ${ton === "alerte" ? "bg-alerte" : "bg-graphe-rempli"}`}
          style={{ width: `${v}%` }}
        />
        {repere !== undefined && repere !== null && (
          <span
            className="absolute -inset-y-0.5 w-0.5 bg-graphe-repere"
            style={{ left: `calc(${Math.min(Math.max(repere, 0), 100)}% - 1px)` }}
            aria-hidden
          />
        )}
      </span>
      <span className={`w-11 shrink-0 text-right tabular-nums ${ton === "alerte" ? "font-semibold text-alerte" : ""}`}>
        {pct(valeur)}
      </span>
      {suffixe !== undefined && <span className="w-16 shrink-0 text-xs">{suffixe}</span>}
    </div>
  );
}

/** Répartition en nombre (barre proportionnelle au total). */
export function LigneEffectif({
  libelle,
  couleur,
  nombre,
  total,
  href,
}: {
  libelle: string;
  couleur: string;
  nombre: number;
  total: number;
  href?: string;
}) {
  const part = total ? (100 * nombre) / total : 0;
  const contenu = (
    <>
      <span className="flex w-36 shrink-0 items-center gap-2 truncate">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: couleur }} aria-hidden />
        {libelle}
      </span>
      <span className="relative h-3.5 flex-1 rounded-sm bg-graphe-piste">
        <span className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${part}%`, background: couleur }} />
      </span>
      <span className="w-10 shrink-0 text-right font-semibold tabular-nums">{nombre}</span>
      <span className="w-11 shrink-0 text-right text-xs tabular-nums text-texte-3">{pct(part)}</span>
    </>
  );
  return href && nombre > 0 ? (
    <Link href={href} className="-mx-1 flex items-center gap-2 rounded-champ px-1 py-1 text-sm hover:bg-surface-2">
      {contenu}
    </Link>
  ) : (
    <div className="flex items-center gap-2 py-1 text-sm">{contenu}</div>
  );
}
