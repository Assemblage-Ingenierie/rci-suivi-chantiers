import { Hammer } from "lucide-react";

/** Encart signalant une fonctionnalité prévue dans une prochaine étape de la refonte. */
export function EnPreparation({ titre, children }: { titre: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-carte border border-dashed border-bordure-forte bg-surface-2 p-4">
      <Hammer className="mt-0.5 h-5 w-5 shrink-0 text-texte-3" />
      <div>
        <p className="font-semibold">{titre}</p>
        {children && <div className="mt-1 text-sm text-texte-2">{children}</div>}
      </div>
    </div>
  );
}
