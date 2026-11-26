import { Info } from "lucide-react";
import { SOURCES_SUIVI } from "@/lib/suivi/remplissage";

/**
 * Encadré expliquant la fréquence prévue des formulaires et la règle de calcul
 * des formulaires manquants. `replie` : affiché fermé (tableau de bord).
 */
export function ReglesRemplissage({ replie = false }: { replie?: boolean }) {
  return (
    <details open={!replie} className="group rounded-carte border border-info/30 bg-info-clair p-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-info">
        <Info className="h-4 w-4 shrink-0" />
        Fréquence prévue et règle de calcul des formulaires manquants
        <span className="ml-auto text-xs font-normal group-open:hidden">afficher</span>
      </summary>
      <div className="mt-3 grid gap-4 text-texte lg:grid-cols-[minmax(0,1fr),minmax(0,1.4fr)]">
        <div>
          <p className="mb-1.5 font-semibold">Fréquence prévue</p>
          <ul className="space-y-1">
            {SOURCES_SUIVI.map((r) => (
              <li key={r.cle} className="flex items-baseline gap-2">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.couleur }} />
                <span>
                  <strong>{r.libelle}</strong> <span className="text-texte-2">({r.acteur})</span> : {r.rythme}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-texte-2">Semaines comptées du lundi au dimanche.</p>
        </div>
        <div>
          <p className="mb-1.5 font-semibold">Quand un formulaire est-il compté « manquant » ?</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              Uniquement si <strong>le même acteur</strong> a indiqué <strong>« en cours »</strong> dans son dernier
              formulaire, et qu&apos;aucun nouveau formulaire n&apos;arrive dans la semaine (dans les 2 semaines pour l&apos;UG).
            </li>
            <li>
              Si son dernier formulaire indique « non démarré », « arrêté », « terminé » ou « réceptionné », rien n&apos;est
              attendu de lui jusqu&apos;à son formulaire suivant. Un acteur qui n&apos;a encore rempli aucun formulaire pour
              un site n&apos;est pas compté en retard sur ce site.
            </li>
            <li>
              <strong>En retard</strong> : dernier formulaire « en cours » datant de plus de{" "}
              {SOURCES_SUIVI.map((r, i) => (
                <span key={r.cle}>
                  {i > 0 && (i === SOURCES_SUIVI.length - 1 ? " et " : ", ")}
                  {r.retardJours} jours ({r.libelle})
                </span>
              ))}
              .
            </li>
            <li>
              <strong>Taux</strong> : formulaires reçus / formulaires attendus sur les 4 dernières semaines complètes
              (semaines pour la MOE et le CSTC, quinzaines pour l&apos;UG).
            </li>
          </ul>
        </div>
      </div>
    </details>
  );
}
