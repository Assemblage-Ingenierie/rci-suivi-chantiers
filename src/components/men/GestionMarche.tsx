"use client";

/**
 * Ajout / modification du marché d'un établissement (CDC §5.3) — national + admin.
 * Un même n° de marché peut être réutilisé sur plusieurs établissements
 * (montant propre à chaque établissement) ; la vue Marchés regroupe par n°.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export interface MarcheExistant {
  id: string;
  nom_entreprise: string | null;
  numero_marche: string | null;
  montant_marche: number | null;
  date_demarrage: string | null;
  date_fin_estimative: string | null;
}

export function GestionMarche({
  etablissementId,
  marche,
  surSauvegarde,
}: {
  etablissementId: string;
  marche: MarcheExistant | null;
  surSauvegarde?: () => void;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [valeurs, setValeurs] = useState({
    nom_entreprise: marche?.nom_entreprise ?? "",
    numero_marche: marche?.numero_marche ?? "",
    montant_marche: marche?.montant_marche?.toString() ?? "",
    date_demarrage: marche?.date_demarrage ?? "",
    date_fin_estimative: marche?.date_fin_estimative ?? "",
  });

  const maj = (cle: keyof typeof valeurs) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => setValeurs((v) => ({ ...v, [cle]: e.target.value }));

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      const champs = {
        nom_entreprise: valeurs.nom_entreprise.trim(),
        numero_marche: valeurs.numero_marche.trim(),
        montant_marche: Number(valeurs.montant_marche),
        date_demarrage: valeurs.date_demarrage || null,
        date_fin_estimative: valeurs.date_fin_estimative || null,
      };
      const supabase = createClient();
      if (marche) {
        const { error } = await supabase
          .from("chantierci_marches_travaux")
          .update(champs)
          .eq("id", marche.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("chantierci_marches_travaux")
          .insert({ ...champs, etablissement_id: etablissementId });
        if (error) throw new Error(error.message);
      }
      setOuvert(false);
      router.refresh();
      surSauvegarde?.();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setEnCours(false);
    }
  }

  const classChamp =
    "block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-assemblage focus:outline-none focus:ring-1 focus:ring-assemblage";

  if (!ouvert) {
    return (
      <button
        onClick={() => setOuvert(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-assemblage hover:text-assemblage"
      >
        {marche ? (
          <>
            <Pencil className="h-3.5 w-3.5" /> Modifier le marché
          </>
        ) : (
          <>
            <Plus className="h-3.5 w-3.5" /> Ajouter un marché
          </>
        )}
      </button>
    );
  }

  return (
    <form onSubmit={enregistrer} className="mt-3 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium">Entreprise</label>
          <input required value={valeurs.nom_entreprise} onChange={maj("nom_entreprise")} className={classChamp} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">N° de marché</label>
          <input required value={valeurs.numero_marche} onChange={maj("numero_marche")} className={classChamp} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Montant (XOF)</label>
          <input
            type="number"
            required
            min={0}
            step={1}
            value={valeurs.montant_marche}
            onChange={maj("montant_marche")}
            className={classChamp}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Date de démarrage</label>
          <input type="date" value={valeurs.date_demarrage} onChange={maj("date_demarrage")} className={classChamp} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Fin estimée</label>
          <input type="date" value={valeurs.date_fin_estimative} onChange={maj("date_fin_estimative")} className={classChamp} />
        </div>
      </div>
      {erreur && <p className="text-sm text-red-700">{erreur}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={enCours}
          className="inline-flex items-center gap-1.5 rounded-lg bg-assemblage px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {enCours && <Loader2 className="h-4 w-4 animate-spin" />}
          {marche ? "Mettre à jour" : "Créer le marché"}
        </button>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
