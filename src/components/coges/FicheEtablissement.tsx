"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Clock,
  Loader2,
  Pencil,
  Phone,
  Plus,
  User,
} from "lucide-react";
import { BadgeStatut } from "@/components/BadgeStatut";
import { BoutonsExportVisite } from "@/components/men/ExportsVisites";
import {
  EVENEMENT_DONNEES,
  EVENEMENT_FILE,
  listerFileVisites,
  listerVisitesLocales,
  type EtablissementSuivi,
  type Visite,
} from "@/lib/offline/db";
import {
  formatDate,
  formatXOF,
  LIBELLES_RAISONS_ARRET,
} from "@/lib/constants";

interface VisiteAffichee extends Visite {
  enAttente?: boolean;
}

const CORPS_ETAT: { cle: keyof Visite; libelle: string }[] = [
  { cle: "pct_excavation", libelle: "Excavation" },
  { cle: "pct_fondation", libelle: "Fondation" },
  { cle: "pct_verticaux", libelle: "Verticaux" },
  { cle: "pct_charpente", libelle: "Charpente" },
  { cle: "pct_couverture", libelle: "Couverture" },
  { cle: "pct_finition", libelle: "Finition" },
];

export function FicheEtablissement({
  etablissement,
  chargementEnCours,
  surRetour,
  surNouvelleVisite,
  surEditionVisite,
}: {
  etablissement: EtablissementSuivi | null;
  chargementEnCours: boolean;
  surRetour: () => void;
  surNouvelleVisite: () => void;
  surEditionVisite: (visite: Visite, enAttente: boolean) => void;
}) {
  const [visites, setVisites] = useState<VisiteAffichee[] | null>(null);

  useEffect(() => {
    if (!etablissement?.id) return;
    const id = etablissement.id;
    const charger = () => {
      Promise.all([listerVisitesLocales(id), listerFileVisites(id)]).then(
        ([synchronisees, enFile]) => {
          const idsEnFile = new Set(enFile.map((e) => e.id));
          const fusion: VisiteAffichee[] = [
            ...enFile.map((e) => ({ ...(e.visite as Visite), enAttente: true })),
            ...synchronisees.filter((v) => !idsEnFile.has(v.id)),
          ];
          fusion.sort((a, b) => b.date_visite.localeCompare(a.date_visite));
          setVisites(fusion);
        }
      );
    };
    charger();
    window.addEventListener(EVENEMENT_DONNEES, charger);
    window.addEventListener(EVENEMENT_FILE, charger);
    return () => {
      window.removeEventListener(EVENEMENT_DONNEES, charger);
      window.removeEventListener(EVENEMENT_FILE, charger);
    };
  }, [etablissement?.id]);

  if (chargementEnCours) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
      </div>
    );
  }

  if (!etablissement) {
    return (
      <div className="rounded-xl bg-white p-6 text-center shadow-sm">
        <p className="font-medium">Établissement introuvable en local</p>
        <button
          onClick={surRetour}
          className="mt-3 text-sm font-medium text-assemblage hover:underline"
        >
          ← Retour à la liste
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={surRetour}
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Mes établissements
      </button>

      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold leading-tight">{etablissement.nom}</h1>
          <p className="text-sm text-gray-500">
            {etablissement.departement}
            {etablissement.village ? ` — ${etablissement.village}` : ""} ·{" "}
            {etablissement.lot_nom}
          </p>
        </div>
        <BadgeStatut statut={etablissement.statut} />
      </div>

      {/* Infos générales */}
      <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Informations générales
        </h2>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 shrink-0 text-gray-400" />
            <dt className="text-gray-500">Directeur :</dt>
            <dd className="font-medium">{etablissement.nom_directeur ?? "—"}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0 text-gray-400" />
            <dt className="text-gray-500">Téléphone :</dt>
            <dd className="font-medium">
              {etablissement.telephone ? (
                <a href={`tel:${etablissement.telephone}`} className="text-assemblage">
                  {etablissement.telephone}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
            <dt className="text-gray-500">Province :</dt>
            <dd className="font-medium">{etablissement.province ?? "—"}</dd>
          </div>
        </dl>
      </div>

      {/* Marché de travaux */}
      <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
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
            <dt className="text-gray-500">Démarrage</dt>
            <dd className="font-medium">{formatDate(etablissement.date_demarrage)}</dd>
            <dt className="text-gray-500">Fin estimée</dt>
            <dd className="font-medium">{formatDate(etablissement.date_fin_estimative)}</dd>
          </dl>
        ) : (
          <p className="text-sm text-gray-500">Aucun marché enregistré.</p>
        )}
      </div>

      {/* Bouton nouvelle visite */}
      <button
        onClick={surNouvelleVisite}
        className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl bg-assemblage px-4 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-red-700"
      >
        <Plus className="h-5 w-5" /> Nouvelle visite
      </button>

      {/* Historique des visites */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Historique des visites{" "}
        {visites !== null && <span className="font-normal">({visites.length})</span>}
      </h2>
      <ul className="space-y-3">
        {(visites ?? []).map((v) => (
          <li key={v.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{formatDate(v.date_visite)}</p>
              <div className="flex flex-wrap items-center gap-2">
                {v.enAttente && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    <Clock className="h-3 w-3" /> En attente de synchro
                  </span>
                )}
                <button
                  onClick={() => surEditionVisite(v, v.enAttente ?? false)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
                >
                  <Pencil className="h-3.5 w-3.5" /> Modifier
                </button>
                <BoutonsExportVisite
                  etablissement={{
                    nom: etablissement.nom ?? "—",
                    lot: etablissement.lot_nom,
                    localisation: [etablissement.departement, etablissement.village]
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
                  <span className="font-semibold text-gray-800">{v.avancement_reel_pct} %</span>
                </>
              )}
            </p>
            <div className="grid grid-cols-3 gap-1 text-xs text-gray-600 sm:grid-cols-6">
              {CORPS_ETAT.map(({ cle, libelle }) => (
                <div key={cle} className="rounded bg-gray-50 px-1.5 py-1 text-center">
                  <span className="block text-[10px] uppercase text-gray-400">{libelle}</span>
                  <span className="font-semibold">
                    {(v[cle] as number | null) ?? "—"}
                    {v[cle] !== null && "%"}
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
          </li>
        ))}
      </ul>
      {visites !== null && visites.length === 0 && (
        <p className="rounded-xl bg-white p-4 text-center text-sm text-gray-500 shadow-sm">
          Aucune visite enregistrée pour cet établissement.
        </p>
      )}
    </div>
  );
}
