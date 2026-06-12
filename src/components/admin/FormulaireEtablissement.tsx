"use client";

/** Modification directe d'une fiche établissement (CDC §5.6, admin). */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/database.types";
import {
  LIBELLES_STATUTS_CHANTIER,
  type StatutChantier,
} from "@/lib/constants";

type Etablissement = Tables<"chantierci_etablissements">;
type Lot = Tables<"chantierci_lots">;

const STATUTS: StatutChantier[] = [
  "non_demarre",
  "en_cours",
  "arrete",
  "receptionne",
];

export function FormulaireEtablissement({
  etablissement,
  lots,
}: {
  etablissement: Etablissement;
  lots: Lot[];
}) {
  const router = useRouter();
  const [valeurs, setValeurs] = useState({
    nom: etablissement.nom,
    nom_directeur: etablissement.nom_directeur ?? "",
    telephone: etablissement.telephone ?? "",
    email: etablissement.email ?? "",
    latitude: etablissement.latitude?.toString() ?? "",
    longitude: etablissement.longitude?.toString() ?? "",
    province: etablissement.province ?? "",
    departement: etablissement.departement ?? "",
    village: etablissement.village ?? "",
    lot_id: etablissement.lot_id ?? "",
    statut: etablissement.statut,
  });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const maj = (cle: keyof typeof valeurs) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setValeurs((v) => ({ ...v, [cle]: e.target.value }));

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      const nombre = (v: string) => {
        if (!v.trim()) return null;
        const n = Number(v.replace(",", "."));
        if (!Number.isFinite(n)) throw new Error("Coordonnées GPS invalides.");
        return n;
      };
      const supabase = createClient();
      const { error } = await supabase
        .from("chantierci_etablissements")
        .update({
          nom: valeurs.nom.trim(),
          nom_directeur: valeurs.nom_directeur.trim() || null,
          telephone: valeurs.telephone.trim() || null,
          email: valeurs.email.trim() || null,
          latitude: nombre(valeurs.latitude),
          longitude: nombre(valeurs.longitude),
          province: valeurs.province.trim() || null,
          departement: valeurs.departement.trim() || null,
          village: valeurs.village.trim() || null,
          lot_id: valeurs.lot_id || null,
          statut: valeurs.statut,
        })
        .eq("id", etablissement.id);
      if (error) throw new Error(error.message);
      router.push(`/etablissements/${etablissement.id}`);
      router.refresh();
    } catch (err) {
      setErreur(
        err instanceof Error ? err.message : "Enregistrement impossible."
      );
      setEnCours(false);
    }
  }

  const classChamp =
    "block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-assemblage focus:outline-none focus:ring-1 focus:ring-assemblage";

  const champs: {
    cle: keyof typeof valeurs;
    libelle: string;
    requis?: boolean;
  }[] = [
    { cle: "nom", libelle: "Nom de l'établissement", requis: true },
    { cle: "nom_directeur", libelle: "Directeur" },
    { cle: "telephone", libelle: "Téléphone" },
    { cle: "email", libelle: "Email" },
    { cle: "latitude", libelle: "Latitude" },
    { cle: "longitude", libelle: "Longitude" },
    { cle: "province", libelle: "Province" },
    { cle: "departement", libelle: "Département" },
    { cle: "village", libelle: "Village" },
  ];

  return (
    <form
      onSubmit={enregistrer}
      className="rounded-xl bg-white p-5 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {champs.map(({ cle, libelle, requis }) => (
          <div key={cle} className={cle === "nom" ? "sm:col-span-2" : ""}>
            <label htmlFor={cle} className="mb-1 block text-sm font-medium">
              {libelle}
            </label>
            <input
              id={cle}
              type="text"
              required={requis}
              value={valeurs[cle]}
              onChange={maj(cle)}
              className={classChamp}
            />
          </div>
        ))}
        <div>
          <label htmlFor="lot" className="mb-1 block text-sm font-medium">
            Lot
          </label>
          <select
            id="lot"
            value={valeurs.lot_id}
            onChange={maj("lot_id")}
            className={classChamp}
          >
            <option value="">— Aucun lot —</option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.nom} ({lot.region})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="statut" className="mb-1 block text-sm font-medium">
            Statut
          </label>
          <select
            id="statut"
            value={valeurs.statut}
            onChange={maj("statut")}
            className={classChamp}
          >
            {STATUTS.map((s) => (
              <option key={s} value={s}>
                {LIBELLES_STATUTS_CHANTIER[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {erreur && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {erreur}
        </p>
      )}

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={() => router.push(`/etablissements/${etablissement.id}`)}
          disabled={enCours}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={enCours}
          className="inline-flex items-center gap-2 rounded-lg bg-assemblage px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {enCours ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Enregistrer
        </button>
      </div>
    </form>
  );
}
