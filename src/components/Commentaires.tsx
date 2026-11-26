"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type Commentaire = {
  id: string;
  texte: string;
  auteur_id: string | null;
  auteur_nom: string;
  created_at: string;
  donnees_test: boolean;
};

/** Commentaires de suivi d'un site (UG et admin) : lecture, ajout, suppression. */
export function Commentaires({
  siteId,
  commentaires,
  utilisateurId,
  admin,
}: {
  siteId: string;
  commentaires: Commentaire[];
  utilisateurId: string;
  admin: boolean;
}) {
  const router = useRouter();
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function publier(e: React.FormEvent) {
    e.preventDefault();
    if (!texte.trim()) return;
    setEnvoi(true);
    setErreur(null);
    const { error } = await createClient().from("chantierci_commentaires").insert({ site_id: siteId, texte: texte.trim() });
    setEnvoi(false);
    if (error) return setErreur("Commentaire non enregistré : " + error.message);
    setTexte("");
    router.refresh();
  }

  async function supprimer(id: string) {
    if (!window.confirm("Supprimer ce commentaire ?")) return;
    const { error } = await createClient().from("chantierci_commentaires").delete().eq("id", id);
    if (error) return setErreur("Suppression impossible : " + error.message);
    router.refresh();
  }

  return (
    <section id="commentaires" className="carte p-4">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <MessageSquare className="h-5 w-5" /> Commentaires
        <span className="text-sm font-normal text-texte-3">visibles par l&apos;UG et l&apos;administration</span>
      </h2>
      <form onSubmit={publier} className="mb-3 space-y-2">
        <textarea
          className="champ min-h-[80px]"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          maxLength={4000}
          placeholder="Ajouter un commentaire sur ce site…"
          aria-label="Nouveau commentaire"
        />
        <div className="flex justify-end">
          <button type="submit" className="bouton-principal !w-auto" disabled={envoi || !texte.trim()}>
            {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Publier
          </button>
        </div>
        {erreur && <p className="message-erreur">{erreur}</p>}
      </form>
      {!commentaires.length ? (
        <p className="text-sm text-texte-2">Aucun commentaire.</p>
      ) : (
        <ul className="divide-y divide-bordure">
          {commentaires.map((c) => (
            <li key={c.id} className="flex gap-2 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="text-texte-3">
                  <span className="font-semibold text-texte-2">{c.auteur_nom || "—"}</span> ·{" "}
                  {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(c.created_at))}
                  {c.donnees_test && " · test"}
                </p>
                <p className="whitespace-pre-line">{c.texte}</p>
              </div>
              {(admin || c.auteur_id === utilisateurId) && (
                <button
                  type="button"
                  onClick={() => supprimer(c.id)}
                  className="self-start rounded-champ p-1 text-texte-3 hover:bg-surface-2 hover:text-danger"
                  aria-label="Supprimer le commentaire"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
