"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, Loader2, X } from "lucide-react";
import type { EtablissementSuivi, VisiteInsert } from "@/lib/offline/db";
import { enregistrerVisite, type PhotoASauver } from "@/lib/offline/sync";
import {
  LIBELLES_RAISONS_ARRET,
  LIBELLES_STATUTS_CHANTIER,
  type StatutChantier,
} from "@/lib/constants";

const STATUTS: StatutChantier[] = [
  "non_demarre",
  "en_cours",
  "arrete",
  "receptionne",
];

const CORPS_ETAT = [
  { cle: "pct_excavation", libelle: "Excavation" },
  { cle: "pct_fondation", libelle: "Fondation" },
  { cle: "pct_verticaux", libelle: "Éléments verticaux" },
  { cle: "pct_charpente", libelle: "Charpente" },
  { cle: "pct_couverture", libelle: "Couverture" },
  { cle: "pct_finition", libelle: "Finition" },
] as const;

type ClesCorpsEtat = (typeof CORPS_ETAT)[number]["cle"];

const RAISONS = Object.keys(LIBELLES_RAISONS_ARRET);

interface PhotoChoisie {
  fichier: File;
  apercu: string;
}

export function FormulaireVisite({
  etablissement,
  userId,
  nomComplet,
  surAnnulation,
  surEnregistrement,
}: {
  etablissement: EtablissementSuivi;
  userId: string;
  nomComplet: string;
  surAnnulation: () => void;
  surEnregistrement: (mode: "direct" | "file_attente") => void;
}) {
  const aujourdHui = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [dateVisite, setDateVisite] = useState(aujourdHui);
  const [statut, setStatut] = useState<StatutChantier>(
    etablissement.statut ?? "en_cours"
  );
  const [avancement, setAvancement] = useState<number>(
    etablissement.dernier_avancement_reel_pct ?? 0
  );
  const [corpsEtat, setCorpsEtat] = useState<Record<ClesCorpsEtat, number>>({
    pct_excavation: 0,
    pct_fondation: 0,
    pct_verticaux: 0,
    pct_charpente: 0,
    pct_couverture: 0,
    pct_finition: 0,
  });
  const [raisons, setRaisons] = useState<string[]>([]);
  const [raisonAutre, setRaisonAutre] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [photos, setPhotos] = useState<PhotoChoisie[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [etape, setEtape] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const refInputPhotos = useRef<HTMLInputElement>(null);

  function ajouterPhotos(fichiers: FileList | null) {
    if (!fichiers) return;
    const nouvelles = Array.from(fichiers).map((fichier) => ({
      fichier,
      apercu: URL.createObjectURL(fichier),
    }));
    setPhotos((courantes) => [...courantes, ...nouvelles]);
    if (refInputPhotos.current) refInputPhotos.current.value = "";
  }

  function retirerPhoto(index: number) {
    setPhotos((courantes) => {
      URL.revokeObjectURL(courantes[index].apercu);
      return courantes.filter((_, i) => i !== index);
    });
  }

  function basculerRaison(raison: string) {
    setRaisons((courantes) =>
      courantes.includes(raison)
        ? courantes.filter((r) => r !== raison)
        : [...courantes, raison]
    );
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      // Compression côté client : cible < 500 Ko / photo (CDC §2.1).
      const photosCompressees: PhotoASauver[] = [];
      if (photos.length > 0) {
        const imageCompression = (await import("browser-image-compression"))
          .default;
        for (let i = 0; i < photos.length; i++) {
          setEtape(`Compression photo ${i + 1}/${photos.length}…`);
          const compressee = await imageCompression(photos[i].fichier, {
            maxSizeMB: 0.5,
            maxWidthOrHeight: 1600,
            useWebWorker: true,
            initialQuality: 0.8,
          });
          photosCompressees.push({
            blob: compressee,
            nom_fichier: photos[i].fichier.name,
          });
        }
      }

      setEtape("Enregistrement…");
      const visite: Omit<VisiteInsert, "id"> = {
        etablissement_id: etablissement.id!,
        date_visite: dateVisite,
        nom_visiteur: nomComplet,
        user_id: userId,
        statut_chantier: statut,
        avancement_reel_pct: avancement,
        ...corpsEtat,
        commentaire: commentaire.trim() || null,
        raisons_arret: statut === "arrete" && raisons.length > 0 ? raisons : null,
        raison_arret_autre:
          statut === "arrete" && raisons.includes("autre") && raisonAutre.trim()
            ? raisonAutre.trim()
            : null,
        sync_status: "synced",
      };

      const { mode } = await enregistrerVisite(visite, photosCompressees);
      photos.forEach((p) => URL.revokeObjectURL(p.apercu));
      surEnregistrement(mode);
    } catch (err) {
      setErreur(
        err instanceof Error
          ? `Enregistrement impossible : ${err.message}`
          : "Enregistrement impossible."
      );
    } finally {
      setEnCours(false);
      setEtape(null);
    }
  }

  const classChamp =
    "block w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base focus:border-assemblage focus:outline-none focus:ring-1 focus:ring-assemblage";

  return (
    <div>
      <button
        onClick={surAnnulation}
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> {etablissement.nom}
      </button>

      <h1 className="mb-1 text-xl font-bold">Nouvelle visite</h1>
      <p className="mb-4 text-sm text-gray-500">
        Fonctionne aussi hors connexion : la visite sera synchronisée au retour
        du réseau.
      </p>

      <form onSubmit={enregistrer} className="space-y-5">
        {/* Date */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <label htmlFor="dateVisite" className="mb-1 block text-sm font-medium">
            Date de la visite
          </label>
          <input
            id="dateVisite"
            type="date"
            required
            max={aujourdHui}
            value={dateVisite}
            onChange={(e) => setDateVisite(e.target.value)}
            className={classChamp}
          />
        </div>

        {/* Statut — gros boutons (saisie terrain) */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-medium">Statut du chantier</p>
          <div className="grid grid-cols-2 gap-2">
            {STATUTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatut(s)}
                className={`rounded-lg border px-3 py-3 text-sm font-semibold transition ${
                  statut === s
                    ? "border-assemblage bg-assemblage text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                }`}
              >
                {LIBELLES_STATUTS_CHANTIER[s]}
              </button>
            ))}
          </div>

          {statut === "arrete" && (
            <div className="mt-4 rounded-lg bg-orange-50 p-3">
              <p className="mb-2 text-sm font-medium text-orange-900">
                Raisons de l&apos;arrêt
              </p>
              <div className="space-y-2">
                {RAISONS.map((raison) => (
                  <label
                    key={raison}
                    className="flex items-center gap-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={raisons.includes(raison)}
                      onChange={() => basculerRaison(raison)}
                      className="h-5 w-5 rounded border-gray-300 text-assemblage focus:ring-assemblage"
                    />
                    {LIBELLES_RAISONS_ARRET[raison]}
                  </label>
                ))}
              </div>
              {raisons.includes("autre") && (
                <input
                  type="text"
                  value={raisonAutre}
                  onChange={(e) => setRaisonAutre(e.target.value)}
                  placeholder="Précisez la raison…"
                  className={`${classChamp} mt-2`}
                />
              )}
            </div>
          )}
        </div>

        {/* Avancements */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <label htmlFor="avancement" className="mb-1 block text-sm font-medium">
            Avancement réel global (% réalisé / DQE initiale)
          </label>
          <div className="flex items-center gap-3">
            <input
              id="avancement"
              type="range"
              min={0}
              max={100}
              step={1}
              value={avancement}
              onChange={(e) => setAvancement(Number(e.target.value))}
              className="h-2 flex-1 accent-assemblage"
            />
            <input
              type="number"
              min={0}
              max={100}
              required
              value={avancement}
              onChange={(e) =>
                setAvancement(
                  Math.max(0, Math.min(100, Number(e.target.value)))
                )
              }
              className="w-20 rounded-lg border border-gray-300 px-2 py-2 text-center text-base font-semibold"
            />
          </div>

          <p className="mb-2 mt-5 text-sm font-medium">
            Avancement par corps d&apos;état
          </p>
          <div className="space-y-3">
            {CORPS_ETAT.map(({ cle, libelle }) => (
              <div key={cle} className="flex items-center gap-3">
                <span className="w-36 shrink-0 text-sm text-gray-600">
                  {libelle}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={corpsEtat[cle]}
                  onChange={(e) =>
                    setCorpsEtat((c) => ({
                      ...c,
                      [cle]: Number(e.target.value),
                    }))
                  }
                  className="h-2 flex-1 accent-assemblage"
                />
                <span className="w-12 shrink-0 text-right text-sm font-semibold">
                  {corpsEtat[cle]} %
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Photos */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-medium">
            Photos{" "}
            <span className="font-normal text-gray-500">
              (compressées automatiquement, &lt; 500 Ko)
            </span>
          </p>
          <input
            ref={refInputPhotos}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => ajouterPhotos(e.target.files)}
            className="hidden"
            id="photos"
          />
          <label
            htmlFor="photos"
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-4 text-sm font-medium text-gray-600 transition hover:border-assemblage hover:text-assemblage"
          >
            <Camera className="h-5 w-5" /> Ajouter des photos
          </label>
          {photos.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((photo, i) => (
                <div key={photo.apercu} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.apercu}
                    alt={photo.fichier.name}
                    className="h-24 w-full rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => retirerPhoto(i)}
                    aria-label="Retirer la photo"
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-gray-900 p-1 text-white shadow"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Commentaire */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <label htmlFor="commentaire" className="mb-1 block text-sm font-medium">
            Commentaire
          </label>
          <textarea
            id="commentaire"
            rows={3}
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Observations, points de vigilance…"
            className={classChamp}
          />
        </div>

        {erreur && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {erreur}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={surAnnulation}
            disabled={enCours}
            className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={enCours}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-assemblage px-4 py-3 text-base font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {enCours && <Loader2 className="h-5 w-5 animate-spin" />}
            {etape ?? "Enregistrer la visite"}
          </button>
        </div>
      </form>
    </div>
  );
}
