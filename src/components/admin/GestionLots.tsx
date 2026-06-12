"use client";

/** Gestion des lots (CDC §5.6) : création, renommage, changement de région. */
import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/database.types";

type Lot = Tables<"chantierci_lots">;

export function GestionLots() {
  const [lots, setLots] = useState<(Lot & { nb_etablissements: number })[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const [nouveauNom, setNouveauNom] = useState("");
  const [nouvelleRegion, setNouvelleRegion] = useState("");

  const [editionId, setEditionId] = useState<string | null>(null);
  const [editionNom, setEditionNom] = useState("");
  const [editionRegion, setEditionRegion] = useState("");

  const charger = useCallback(async () => {
    const supabase = createClient();
    const [{ data: lotsData }, { data: etabs }] = await Promise.all([
      supabase.from("chantierci_lots").select("*").order("nom").range(0, 99),
      supabase
        .from("chantierci_etablissements")
        .select("lot_id")
        .range(0, 999),
    ]);
    const compte = new Map<string, number>();
    for (const e of etabs ?? []) {
      if (e.lot_id) compte.set(e.lot_id, (compte.get(e.lot_id) ?? 0) + 1);
    }
    setLots(
      (lotsData ?? []).map((l) => ({
        ...l,
        nb_etablissements: compte.get(l.id) ?? 0,
      }))
    );
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  async function executer(action: () => Promise<void>) {
    setErreur(null);
    setEnCours(true);
    try {
      await action();
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Opération impossible");
    } finally {
      setEnCours(false);
    }
  }

  function creer(e: React.FormEvent) {
    e.preventDefault();
    executer(async () => {
      const supabase = createClient();
      const { error } = await supabase.from("chantierci_lots").insert({
        nom: nouveauNom.trim(),
        region: nouvelleRegion.trim(),
      });
      if (error) throw new Error(error.message);
      setNouveauNom("");
      setNouvelleRegion("");
    });
  }

  function enregistrer(id: string) {
    executer(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("chantierci_lots")
        .update({ nom: editionNom.trim(), region: editionRegion.trim() })
        .eq("id", id);
      if (error) throw new Error(error.message);
      setEditionId(null);
    });
  }

  function supprimer(lot: Lot & { nb_etablissements: number }) {
    if (lot.nb_etablissements > 0) {
      setErreur(
        `Impossible de supprimer « ${lot.nom} » : ${lot.nb_etablissements} établissement(s) y sont rattachés.`
      );
      return;
    }
    if (!window.confirm(`Supprimer le lot « ${lot.nom} » ?`)) return;
    executer(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("chantierci_lots")
        .delete()
        .eq("id", lot.id);
      if (error) throw new Error(error.message);
    });
  }

  if (lots === null) {
    return (
      <p className="flex items-center gap-2 py-8 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
      </p>
    );
  }

  return (
    <div className="max-w-2xl">
      {erreur && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreur}
        </p>
      )}

      {/* Création */}
      <form
        onSubmit={creer}
        className="mb-4 flex flex-wrap items-end gap-2 rounded-xl bg-white p-4 shadow-sm"
      >
        <div className="min-w-40 flex-1">
          <label htmlFor="nouveauNom" className="mb-1 block text-xs font-medium">
            Nom du lot
          </label>
          <input
            id="nouveauNom"
            type="text"
            required
            value={nouveauNom}
            onChange={(e) => setNouveauNom(e.target.value)}
            placeholder="Lot Centre"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="min-w-40 flex-1">
          <label htmlFor="nouvelleRegion" className="mb-1 block text-xs font-medium">
            Région
          </label>
          <input
            id="nouvelleRegion"
            type="text"
            required
            value={nouvelleRegion}
            onChange={(e) => setNouvelleRegion(e.target.value)}
            placeholder="Centre"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={enCours}
          className="inline-flex items-center gap-1.5 rounded-lg bg-assemblage px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> Créer
        </button>
      </form>

      {/* Liste */}
      <ul className="space-y-2">
        {lots.map((lot) => (
          <li
            key={lot.id}
            className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm"
          >
            {editionId === lot.id ? (
              <>
                <input
                  value={editionNom}
                  onChange={(e) => setEditionNom(e.target.value)}
                  className="w-36 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
                <input
                  value={editionRegion}
                  onChange={(e) => setEditionRegion(e.target.value)}
                  className="w-32 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
                <button
                  onClick={() => enregistrer(lot.id)}
                  disabled={enCours}
                  className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                >
                  <Save className="h-4 w-4" /> Enregistrer
                </button>
                <button
                  onClick={() => setEditionId(null)}
                  className="rounded-lg border border-gray-300 p-1.5 text-gray-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{lot.nom}</p>
                  <p className="text-sm text-gray-500">
                    Région {lot.region} · {lot.nb_etablissements} établissement(s)
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditionId(lot.id);
                    setEditionNom(lot.nom);
                    setEditionRegion(lot.region);
                  }}
                  title="Modifier"
                  className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:border-assemblage hover:text-assemblage"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => supprimer(lot)}
                  title="Supprimer"
                  className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:border-red-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
