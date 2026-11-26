import { LIBELLES_STATUTS, TEINTE_STATUT } from "@/lib/formulaires/statuts";
import type { StatutChantier } from "@/lib/formulaires/types";

export function BadgeStatut({ statut }: { statut: StatutChantier }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${TEINTE_STATUT[statut]}`}>
      {LIBELLES_STATUTS[statut]}
    </span>
  );
}
