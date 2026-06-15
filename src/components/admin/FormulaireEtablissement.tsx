"use client";

/** Création / modification d'une fiche établissement (CDC §5.6, admin). */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/database.types";

type Etablissement = Tables<"chantierci_etablissements">;
type Lot = Tables<"chantierci_lots">;

export function FormulaireEtablissement({
  etablissement,
  lots,
}: {
  etablissement?: Etablissement;
  lots: Lot[];
}) {
  const router = useRouter();
  const modeCreation = !etablissement;
  const [valeurs, setValeurs] = useState({
    nom: etablissement?.nom ?? "",
    nom_directeur: etablissement?.nom_directeur ?? "",
    telephone: etablissement?.telephone ?? "",
    email: etablissement?.email ?? "",
    latitude: etablissement?.latitude?.toString() ?? "",
    longitude: etablissement?.longitude?.toString() ?? "",
    province: etablissement?.province ?? "",
    departement: etablissement?.departement ?? "",
    village: etablissement?.village ?? "",
    lot_id: etablissement?.lot_id ?? "",
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
      const champs = {
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
      };
      const supabase = createClient();

      if (modeCreation) {
        const { data, error } = await supabase
          .from("chantierci_etablissements")
          .insert(champs)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        router.push(`/etablissements/${data.id}`);
      } else {
        const { error } = await supabase
          .from("chantierci_etablissements")
          .update(champs)
          .eq("id", etablissement!.id);
        if (error) throw new Error(error.message);
        router.push(`/etablissements/${etablissement!.id}`);
      }
      router.refresh();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Enregistrement impossible.");
      setEnCours(false);
    }
  }

  const classChamp =
    "block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-assemblage focus:outline-none focus:ring-1 focus:ring-assemblage";

  const champs: { cle: keyof typeof valeurs; libelle: string; requis?: boolean }[] = [
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

  const annuler = () =>
    router.push(modeCreation ? "/suivi" : `/etablissements/${etablissement!.id}`);

  return (
    <form onSubmit={enregistrer} className="rounded-xl bg-white p-5 shadow-sm">
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
      </div>

      <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
        Le statut du chantier (non démarré / en cours / arrêté / réceptionné) est
        déterminé automatiquement par la dernière visite enregistrée.
      </p>

      {erreur && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {erreur}
        </p>
      )}

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={annuler}
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
          {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {modeCreation ? "Créer l'établissement" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
