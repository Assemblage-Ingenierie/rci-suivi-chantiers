import {
  COULEURS_STATUTS_CHANTIER,
  LIBELLES_STATUTS_CHANTIER,
  type StatutChantier,
} from "@/lib/constants";

export function BadgeStatut({
  statut,
}: {
  statut: StatutChantier | null | undefined;
}) {
  if (!statut) return <span className="text-sm text-gray-400">—</span>;
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold text-white"
      style={{ backgroundColor: COULEURS_STATUTS_CHANTIER[statut] }}
    >
      {LIBELLES_STATUTS_CHANTIER[statut]}
    </span>
  );
}
