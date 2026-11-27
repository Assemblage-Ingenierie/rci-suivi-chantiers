import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ClipboardPlus, FlaskConical } from "lucide-react";
import { exigerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { familleProfil } from "@/lib/constants";
import { chargerSite } from "@/lib/formulaires/chargement";
import { DEFINITIONS } from "@/lib/formulaires/definitions";
import { sourcesSaisissables } from "@/lib/formulaires/droits";
import { formatPourcent } from "@/lib/formulaires/avancement";
import { LIBELLES_SOURCES } from "@/lib/formulaires/statuts";
import type { SourceFormulaire } from "@/lib/formulaires/types";
import { BandeauSite, EtiquettesSite } from "@/components/FicheSite";
import { BadgeStatut } from "@/components/BadgeStatut";
import { Commentaires, type Commentaire } from "@/components/Commentaires";
import { MARQUE } from "@/theme/marque";

export async function generateMetadata({ params }: { params: { code: string } }) {
  return { title: `Site ${params.code} — ${MARQUE.titreNavigateur}` };
}

const SOURCES: SourceFormulaire[] = ["cstc", "moe", "ug"];

/** Fiche d'un site : saisie des formulaires autorisés + historique visible (RLS). */
export default async function PageSite({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { source?: string };
}) {
  const profil = await exigerRole(["cstc", "moe_controleur", "moe_chef", "ug", "admin"]);
  const supabase = createClient();
  const site = await chargerSite(supabase, params.code);
  if (!site) notFound();

  const filtre = SOURCES.includes(searchParams.source as SourceFormulaire)
    ? (searchParams.source as SourceFormulaire)
    : null;
  let requete = supabase
    .from("chantierci_v_visites")
    .select("id, source, date_visite, statut, avancement, auteur_nom, donnees_test, created_at")
    .eq("site_id", site.id)
    .order("date_visite", { ascending: false })
    .order("created_at", { ascending: false })
    .range(0, 99);
  if (filtre) requete = requete.eq("source", filtre);
  const commente = profil.role === "admin" || profil.role === "ug";
  const [{ data: visites }, { data: commentaires }] = await Promise.all([
    requete,
    commente
      ? supabase
          .from("chantierci_commentaires")
          .select("id, texte, auteur_id, auteur_nom, created_at, donnees_test")
          .eq("site_id", site.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Commentaire[] }),
  ]);

  const saisissables = sourcesSaisissables(profil.role);
  const sourcesVisibles: SourceFormulaire[] =
    profil.role === "admin" || profil.role === "ug" ? SOURCES : saisissables;

  return (
    <div className="lg:p-8">
      <div className="lg:mx-auto lg:max-w-3xl">
        <BandeauSite
          site={site}
          contexte={profil.role === "cstc" ? "Suivi communautaire · CSTC" : `Site ${site.code} · Lot MOE ${site.lot_moe_id}`}
        />
        <div className="space-y-4 p-4 lg:px-0">
          <section className="carte p-4">
            <dl className="mb-3 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-texte-2">Code</dt>
              <dd className="font-semibold">{site.code}</dd>
              <dt className="text-texte-2">Localité</dt>
              <dd>{site.localite || "—"}</dd>
              <dt className="text-texte-2">Département · Région</dt>
              <dd>
                {site.departement} · {site.region}
              </dd>
              <dt className="text-texte-2">Entreprise</dt>
              <dd>{site.lot?.entreprise?.nom || "—"}</dd>
            </dl>
            <EtiquettesSite site={site} />
          </section>

          <section className="space-y-2">
            {saisissables.map((s) => (
              <div key={s} data-profil={familleProfil(s === "moe" ? "moe_controleur" : s)}>
                <Link href={`/site/${site.code}/nouveau/${s}`} className="bouton-principal w-full">
                  <ClipboardPlus className="h-5 w-5" />
                  {saisissables.length > 1 ? `Nouveau formulaire ${LIBELLES_SOURCES[s]}` : `Nouveau : ${DEFINITIONS[s].titre}`}
                </Link>
              </div>
            ))}
          </section>

          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">
                {profil.role === "cstc" ? "Mes formulaires envoyés" : "Historique des visites"}
              </h2>
              {sourcesVisibles.length > 1 && (
                <nav className="flex gap-1 text-sm">
                  {[null, ...sourcesVisibles].map((s) => (
                    <Link
                      key={s ?? "tous"}
                      href={s ? `?source=${s}` : "?"}
                      className={`rounded-full px-3 py-1 ring-1 ${
                        filtre === s ? "bg-accent text-sur-accent ring-accent" : "bg-surface ring-bordure hover:bg-surface-2"
                      }`}
                    >
                      {s ? LIBELLES_SOURCES[s] : "Tous"}
                    </Link>
                  ))}
                </nav>
              )}
            </div>
            {!visites?.length ? (
              <p className="carte p-4 text-sm text-texte-2">Aucun formulaire pour l&apos;instant.</p>
            ) : (
              <ul className="carte divide-y divide-bordure">
                {visites.map((v) => (
                  <li key={v.id}>
                    <Link href={`/visite/${v.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                      <span className="w-12 shrink-0 rounded-champ bg-surface-2 py-1 text-center text-xs font-bold ring-1 ring-bordure">
                        {LIBELLES_SOURCES[v.source]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">
                            {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(v.date_visite))}
                          </span>
                          <BadgeStatut statut={v.statut} />
                          {v.donnees_test && (
                            <span className="inline-flex items-center gap-1 text-xs text-texte-3" title="Donnée fictive de test">
                              <FlaskConical className="h-3.5 w-3.5" /> test
                            </span>
                          )}
                        </p>
                        <p className="truncate text-sm text-texte-2">{v.auteur_nom || "—"}</p>
                      </div>
                      {v.avancement !== null && (
                        <span className="text-lg font-bold tabular-nums">{formatPourcent(Math.round(v.avancement))}</span>
                      )}
                      <ChevronRight className="h-5 w-5 shrink-0 text-texte-3" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {commente && (
            <Commentaires
              siteId={site.id}
              commentaires={(commentaires ?? []) as Commentaire[]}
              utilisateurId={profil.id}
              admin={profil.role === "admin"}
            />
          )}
        </div>
      </div>
    </div>
  );
}
