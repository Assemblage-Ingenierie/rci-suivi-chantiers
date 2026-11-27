import { ImageIcon, MapPin } from "lucide-react";
import type { Json } from "@/lib/database.types";
import { LIBELLES_LATRINES, type TypeLatrines } from "@/lib/constants";
import { DEFINITIONS, QUALITE_LIBELLES } from "@/lib/formulaires/definitions";
import { LIBELLES_STATUTS, LIBELLES_STATUTS_CSTC } from "@/lib/formulaires/statuts";
import { ouvrageLatrines, postesApplicables } from "@/lib/formulaires/avancement";
import { formatNombre, quantitesDuSite } from "@/lib/formulaires/quantites";
import type { PosteDef, Question, Reponses, SourceFormulaire, StatutChantier, ValeursPostes } from "@/lib/formulaires/types";
import { BadgeStatut } from "@/components/BadgeStatut";

export type PhotoAffichee = {
  id: string;
  url: string | null;
  legende: string;
  latitude: number | null;
  longitude: number | null;
  prise_le: string | null;
};

const VIDE = <span className="text-texte-3">—</span>;

/** Formulaire enregistré, en lecture seule (mêmes sections que la saisie). */
export function AffichageVisite({
  source,
  visite,
  site,
  postes,
  photos,
}: {
  source: SourceFormulaire;
  visite: {
    statut: StatutChantier;
    date_visite: string;
    postes: Json;
    reponses: Json;
    commentaire: string;
  };
  site: { electricite: boolean; type_latrines: TypeLatrines };
  postes: PosteDef[];
  photos: PhotoAffichee[];
}) {
  const definition = DEFINITIONS[source];
  const reponses = (visite.reponses ?? {}) as Reponses;
  const valeursPostes = (visite.postes ?? {}) as ValeursPostes;

  function libelleOption(q: Extract<Question, { type: "choix" }>, v: string) {
    return q.options.find((o) => o.valeur === v)?.libelle ?? v;
  }

  function valeur(q: Question): React.ReactNode {
    const r = reponses[q.id];
    switch (q.type) {
      case "date":
        return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(visite.date_visite));
      case "statut":
        return (
          <span className="inline-flex flex-wrap items-center gap-2">
            <BadgeStatut statut={visite.statut} />
            {source === "cstc" && LIBELLES_STATUTS_CSTC[visite.statut] !== LIBELLES_STATUTS[visite.statut] && (
              <span className="text-sm text-texte-2">« {LIBELLES_STATUTS_CSTC[visite.statut]} »</span>
            )}
          </span>
        );
      case "choix": {
        const liste = Array.isArray(r) ? (r as string[]) : r ? [r as string] : [];
        if (!liste.length) return VIDE;
        return (
          <span className="flex flex-wrap gap-1.5">
            {liste.map((v) => (
              <span key={v} className="rounded-full bg-selection px-3 py-0.5 text-sm font-semibold ring-1 ring-selection-bordure/40">
                {libelleOption(q, v)}
              </span>
            ))}
          </span>
        );
      }
      case "oui_non":
      case "qualite": {
        const valeurs = (r ?? {}) as Record<string, string>;
        const options = q.type === "qualite" ? QUALITE_LIBELLES : [
          { valeur: "oui", libelle: "Oui" },
          { valeur: "non", libelle: "Non" },
        ];
        return (
          <dl className="divide-y divide-bordure">
            {q.elements.map((e) => (
              <div key={e.valeur} className="flex justify-between gap-3 py-1.5 text-[0.95rem]">
                <dt>{e.libelle}</dt>
                <dd className="font-semibold">
                  {valeurs[e.valeur] ? options.find((o) => o.valeur === valeurs[e.valeur])?.libelle : VIDE}
                </dd>
              </div>
            ))}
          </dl>
        );
      }
      case "nombre":
        return r === undefined || r === null ? VIDE : <span className="font-semibold">{String(r)}</span>;
      case "texte":
        return r ? <p className="whitespace-pre-line">{String(r)}</p> : VIDE;
      case "commentaire":
        return visite.commentaire ? <p className="whitespace-pre-line">{visite.commentaire}</p> : VIDE;
      case "postes":
        return <Postes />;
      case "quantites":
        return <Quantites valeurs={(r ?? {}) as Record<string, number | null>} />;
      case "photos":
        return <Photos />;
    }
  }

  function Postes() {
    const groupes = [
      { cle: "classe" as const, titre: "Salle de classe", defs: postesApplicables(postes, "classe", site.electricite) },
      {
        cle: "latrines" as const,
        titre: LIBELLES_LATRINES[site.type_latrines],
        defs: postesApplicables(postes, ouvrageLatrines(site.type_latrines), site.electricite),
      },
    ];
    return (
      <div className="space-y-3">
        {groupes.map((g) => {
          const v = valeursPostes[g.cle] ?? {};
          return (
            <div key={g.cle} className="overflow-hidden rounded-carte border border-accent/30">
              <p className="bg-accent-clair px-3 py-1.5 text-sm font-bold text-accent-fonce">{g.titre}</p>
              <dl className="divide-y divide-bordure px-3">
                {g.defs.map((p) => (
                  <div key={p.code} className="flex items-center gap-3 py-1.5 text-[0.95rem]">
                    <dt className="flex-1">{p.libelle}</dt>
                    <dd className="flex w-32 items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2 ring-1 ring-bordure">
                        <span className="block h-full bg-accent" style={{ width: `${v[p.code] ?? 0}%` }} />
                      </span>
                      <span className="w-10 text-right tabular-nums">{v[p.code] ?? 0} %</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>
    );
  }

  function Quantites({ valeurs }: { valeurs: Record<string, number | null> }) {
    return (
      <table className="w-full text-[0.95rem]">
        <thead className="text-left text-sm text-texte-2">
          <tr>
            <th className="py-1 font-medium">Élément</th>
            <th className="py-1 text-right font-medium">Prévu</th>
            <th className="py-1 text-right font-medium">Constaté</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-bordure">
          {quantitesDuSite(site.electricite).map((q) => {
            const v = valeurs[q.id];
            const renseigne = typeof v === "number";
            return (
              <tr key={q.id}>
                <td className="py-1.5">{q.libelle}</td>
                <td className="py-1.5 text-right text-texte-2">
                  {formatNombre(q.prevu)} {q.unite}
                </td>
                <td
                  className={`py-1.5 text-right font-semibold ${
                    !renseigne ? "" : v === q.prevu ? "text-succes" : "text-alerte"
                  }`}
                >
                  {renseigne ? (v === q.prevu ? "Conforme" : formatNombre(v)) : VIDE}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  function Photos() {
    if (!photos.length) return <p className="text-sm text-texte-3">Aucune photo.</p>;
    return (
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <a
            key={p.id}
            href={p.url ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="relative aspect-square overflow-hidden rounded-carte bg-surface-2 ring-1 ring-bordure"
          >
            {p.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.url} alt={p.legende || "Photo de visite"} className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="m-auto mt-8 h-8 w-8 text-texte-3" />
            )}
            <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-black/55 px-1.5 py-0.5 text-[11px] text-white">
              <MapPin className="h-3 w-3" />
              {p.latitude !== null ? "GPS ✓" : "sans GPS"}
            </span>
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {definition.sections.map((section) => (
        <section key={section.id} className="carte p-4">
          <h2 className="mb-3 flex items-center gap-3 text-lg font-bold">
            {section.numero && (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm text-sur-accent">
                {section.numero}
              </span>
            )}
            {section.titre}
          </h2>
          <div className="space-y-3">
            {section.questions.map((q) => (
              <div key={q.id}>
                {section.questions.length > 1 && q.type !== "postes" && q.type !== "photos" && (
                  <p className="mb-1 text-sm font-semibold text-texte-2">{q.libelle}</p>
                )}
                {valeur(q)}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
