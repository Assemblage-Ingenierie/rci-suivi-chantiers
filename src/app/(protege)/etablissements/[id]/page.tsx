import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { getUtilisateurEtProfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BadgeStatut } from "@/components/BadgeStatut";
import { Commentaires } from "@/components/men/Commentaires";
import {
  BoutonsExportVisite,
  ExportsVisitesBatch,
} from "@/components/men/ExportsVisites";
import {
  formatDate,
  formatXOF,
  LIBELLES_RAISONS_ARRET,
} from "@/lib/constants";

export const metadata = { title: "Fiche établissement — Suivi chantiers MEN CI" };

const CORPS_ETAT = [
  ["pct_excavation", "Excavation"],
  ["pct_fondation", "Fondation"],
  ["pct_verticaux", "Verticaux"],
  ["pct_charpente", "Charpente"],
  ["pct_couverture", "Couverture"],
  ["pct_finition", "Finition"],
] as const;

/**
 * Fiche établissement en lecture (rôles régional / national / admin) :
 * synthèse + marché + paiements + historique des visites avec photos
 * (URLs signées, bucket privé). Les COGES ont leur propre fiche offline.
 */
export default async function PageFicheEtablissement({
  params,
}: {
  params: { id: string };
}) {
  const { user, profil } = await getUtilisateurEtProfil();
  if (!user || !profil) redirect("/");
  if (profil.role === "coges") redirect(`/coges?id=${params.id}`);

  const supabase = createClient();

  const { data: etablissement } = await supabase
    .from("chantierci_v_etablissements_suivi")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!etablissement) notFound();

  const [{ data: visites }, { data: paiements }] = await Promise.all([
    supabase
      .from("chantierci_visites")
      .select("*")
      .eq("etablissement_id", params.id)
      .order("date_visite", { ascending: false })
      .range(0, 99),
    etablissement.marche_id
      ? supabase
          .from("chantierci_paiements")
          .select("*")
          .eq("marche_id", etablissement.marche_id)
          .order("date_paiement", { ascending: false })
          .range(0, 99)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  // Photos des visites affichées : URLs signées (bucket privé), 1 h.
  const { data: photos } = await supabase
    .from("chantierci_photos_visites")
    .select("id, visite_id, storage_path")
    .in("visite_id", (visites ?? []).map((v) => v.id))
    .range(0, 199);
  const photosParVisite = new Map<string, string[]>();
  for (const photo of photos ?? []) {
    const { data: signee } = await supabase.storage
      .from("chantierci-photos-visites")
      .createSignedUrl(photo.storage_path, 3600);
    if (signee?.signedUrl) {
      const liste = photosParVisite.get(photo.visite_id) ?? [];
      liste.push(signee.signedUrl);
      photosParVisite.set(photo.visite_id, liste);
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 lg:p-8">
      <Link
        href="/suivi"
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Tableau de suivi
      </Link>

      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold leading-tight">
            {etablissement.nom}
          </h1>
          <p className="text-sm text-gray-500">
            {etablissement.province} · {etablissement.departement}
            {etablissement.village ? ` · ${etablissement.village}` : ""} ·{" "}
            {etablissement.lot_nom}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {profil.role === "admin" && (
            <Link
              href={`/etablissements/${params.id}/modifier`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-assemblage hover:text-assemblage"
            >
              <Pencil className="h-3.5 w-3.5" /> Modifier
            </Link>
          )}
          <BadgeStatut statut={etablissement.statut} />
        </div>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        {/* Infos générales */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Informations générales
          </h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Directeur</dt>
            <dd className="font-medium">{etablissement.nom_directeur ?? "—"}</dd>
            <dt className="text-gray-500">Téléphone</dt>
            <dd className="font-medium">{etablissement.telephone ?? "—"}</dd>
            <dt className="text-gray-500">Email</dt>
            <dd className="break-all font-medium">{etablissement.email ?? "—"}</dd>
            <dt className="text-gray-500">Coordonnées GPS</dt>
            <dd className="font-medium">
              {etablissement.latitude !== null
                ? `${etablissement.latitude}, ${etablissement.longitude}`
                : "—"}
            </dd>
            <dt className="text-gray-500">Visites</dt>
            <dd className="font-medium">{etablissement.nb_visites}</dd>
          </dl>
        </div>

        {/* Marché */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Marché de travaux
          </h2>
          {etablissement.numero_marche ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-gray-500">Entreprise</dt>
              <dd className="font-medium">{etablissement.nom_entreprise}</dd>
              <dt className="text-gray-500">N° marché</dt>
              <dd className="font-medium">{etablissement.numero_marche}</dd>
              <dt className="text-gray-500">Montant</dt>
              <dd className="font-medium">{formatXOF(etablissement.montant_marche)}</dd>
              <dt className="text-gray-500">Payé</dt>
              <dd className="font-medium">
                {formatXOF(etablissement.montant_paye)}
                {etablissement.avancement_financier_pct !== null &&
                  ` (${etablissement.avancement_financier_pct} %)`}
              </dd>
              <dt className="text-gray-500">Reste à payer</dt>
              <dd className="font-medium">{formatXOF(etablissement.reste_a_payer)}</dd>
              <dt className="text-gray-500">Période</dt>
              <dd className="font-medium">
                {formatDate(etablissement.date_demarrage)} →{" "}
                {formatDate(etablissement.date_fin_estimative)}
              </dd>
            </dl>
          ) : (
            <p className="text-sm text-gray-500">Aucun marché enregistré.</p>
          )}
        </div>
      </div>

      {/* Paiements */}
      <div className="mb-4 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Paiements ({(paiements ?? []).length})
        </h2>
        {(paiements ?? []).length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sidebar text-left text-xs uppercase tracking-wide text-white">
                <th className="rounded-l px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Libellé</th>
                <th className="rounded-r px-3 py-2 text-right font-medium">Montant</th>
              </tr>
            </thead>
            <tbody>
              {(paiements ?? []).map((p, i) => (
                <tr key={p.id} className={i % 2 === 1 ? "bg-gray-50" : ""}>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(p.date_paiement)}</td>
                  <td className="px-3 py-2">{p.libelle}</td>
                  <td className="px-3 py-2 text-right font-medium whitespace-nowrap">
                    {formatXOF(p.montant)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">Aucun paiement enregistré.</p>
        )}
      </div>

      {/* Commentaires régionaux (CDC §5.4) */}
      <div className="mb-4">
        <Commentaires
          etablissementId={params.id}
          peutCommenter={profil.role === "regional" || profil.role === "admin"}
          userId={user.id}
          nomComplet={profil.nom_complet}
        />
      </div>

      {/* Historique des visites + exports (CDC §5.5) */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Historique des visites ({(visites ?? []).length})
        </h2>
        <ExportsVisitesBatch
          etablissement={{
            nom: etablissement.nom ?? "—",
            lot: etablissement.lot_nom,
            localisation: [etablissement.departement, etablissement.village]
              .filter(Boolean)
              .join(" — "),
            province: etablissement.province,
          }}
          visites={visites ?? []}
        />
      </div>
      <ul className="space-y-3">
        {(visites ?? []).map((v) => (
          <li key={v.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-semibold">{formatDate(v.date_visite)}</p>
              <div className="flex items-center gap-2">
                <BoutonsExportVisite
                  etablissement={{
                    nom: etablissement.nom ?? "—",
                    lot: etablissement.lot_nom,
                    localisation: [
                      etablissement.departement,
                      etablissement.village,
                    ]
                      .filter(Boolean)
                      .join(" — "),
                    province: etablissement.province,
                  }}
                  visite={v}
                />
                <BadgeStatut statut={v.statut_chantier} />
              </div>
            </div>
            <p className="mb-2 text-sm text-gray-500">
              {v.nom_visiteur}
              {v.avancement_reel_pct !== null && (
                <>
                  {" — avancement global "}
                  <span className="font-semibold text-gray-800">
                    {v.avancement_reel_pct} %
                  </span>
                </>
              )}
            </p>
            <div className="grid grid-cols-3 gap-1 text-xs text-gray-600 sm:grid-cols-6">
              {CORPS_ETAT.map(([cle, libelle]) => (
                <div key={cle} className="rounded bg-gray-50 px-1.5 py-1 text-center">
                  <span className="block text-[10px] uppercase text-gray-400">
                    {libelle}
                  </span>
                  <span className="font-semibold">
                    {v[cle] !== null ? `${v[cle]}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
            {v.raisons_arret && v.raisons_arret.length > 0 && (
              <p className="mt-2 text-sm text-orange-700">
                Arrêt :{" "}
                {v.raisons_arret.map((r) => LIBELLES_RAISONS_ARRET[r] ?? r).join(", ")}
                {v.raison_arret_autre ? ` — ${v.raison_arret_autre}` : ""}
              </p>
            )}
            {v.commentaire && (
              <p className="mt-2 text-sm italic text-gray-600">« {v.commentaire} »</p>
            )}
            {(photosParVisite.get(v.id) ?? []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(photosParVisite.get(v.id) ?? []).map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    <img
                      src={url}
                      alt="Photo de visite"
                      className="h-20 w-28 rounded-lg object-cover transition hover:opacity-80"
                    />
                  </a>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      {(visites ?? []).length === 0 && (
        <p className="rounded-xl bg-white p-4 text-center text-sm text-gray-500 shadow-sm">
          Aucune visite enregistrée.
        </p>
      )}
    </div>
  );
}
