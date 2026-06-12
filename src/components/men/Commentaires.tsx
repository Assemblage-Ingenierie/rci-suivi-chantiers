"use client";

/**
 * Commentaires d'établissement (CDC §5.4) : saisis par les responsables
 * régionaux (sur leur région) et les admins, visibles MEN + admin + auteur.
 * La RLS applique ces règles côté base ; l'UI ne fait que refléter le rôle.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/database.types";
import { formatDate } from "@/lib/constants";

type Commentaire = Tables<"chantierci_commentaires">;

export function Commentaires({
  etablissementId,
  peutCommenter,
  userId,
  nomComplet,
}: {
  etablissementId: string;
  peutCommenter: boolean;
  userId: string;
  nomComplet: string;
}) {
  const [commentaires, setCommentaires] = useState<Commentaire[] | null>(null);
  const [contenu, setContenu] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("chantierci_commentaires")
      .select("*")
      .eq("etablissement_id", etablissementId)
      .order("created_at", { ascending: false })
      .range(0, 49);
    setCommentaires(data ?? []);
  }, [etablissementId]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    if (!contenu.trim()) return;
    setErreur(null);
    setEnCours(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("chantierci_commentaires").insert({
        etablissement_id: etablissementId,
        user_id: userId,
        auteur_nom: nomComplet,
        contenu: contenu.trim(),
      });
      if (error) throw new Error(error.message);
      setContenu("");
      await charger();
    } catch (err) {
      setErreur(
        err instanceof Error
          ? `Envoi impossible : ${err.message}`
          : "Envoi impossible."
      );
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
        <MessageSquare className="h-4 w-4 text-assemblage" />
        Commentaires{" "}
        {commentaires !== null && (
          <span className="font-normal">({commentaires.length})</span>
        )}
      </h2>

      {peutCommenter && (
        <form onSubmit={ajouter} className="mb-4">
          <textarea
            rows={2}
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            placeholder="Ajouter un commentaire (visible MEN + administration)…"
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-assemblage focus:outline-none focus:ring-1 focus:ring-assemblage"
          />
          {erreur && <p className="mt-1 text-sm text-red-700">{erreur}</p>}
          <button
            type="submit"
            disabled={enCours || !contenu.trim()}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-assemblage px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {enCours ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Publier
          </button>
        </form>
      )}

      {commentaires === null ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </p>
      ) : commentaires.length === 0 ? (
        <p className="text-sm text-gray-500">Aucun commentaire.</p>
      ) : (
        <ul className="space-y-3">
          {commentaires.map((c) => (
            <li key={c.id} className="rounded-lg bg-gray-50 px-3 py-2.5">
              <p className="text-sm">{c.contenu}</p>
              <p className="mt-1 text-xs text-gray-500">
                {c.auteur_nom || "—"} · {formatDate(c.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
