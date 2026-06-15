"use client";

/**
 * Archivage des visites depuis la fiche établissement (MEN/admin).
 * Archiver une visite la retire des historiques, agrégats et de la dernière
 * visite (le statut de l'établissement est recalculé côté base par trigger).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BadgeStatut } from "@/components/BadgeStatut";
import { formatDate } from "@/lib/constants";
import type { Tables } from "@/lib/database.types";

type Visite = Tables<"chantierci_visites">;

export function BoutonArchiveVisite({ visiteId }: { visiteId: string }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [confirme, setConfirme] = useState(false);

  async function archiver() {
    setEnCours(true);
    try {
      const supabase = createClient();
      await supabase.from("chantierci_visites").update({ archive: true }).eq("id", visiteId);
      router.refresh();
    } finally {
      setEnCours(false);
      setConfirme(false);
    }
  }

  if (confirme) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          onClick={archiver}
          disabled={enCours}
          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
        >
          {enCours && <Loader2 className="h-3 w-3 animate-spin" />} Confirmer
        </button>
        <button
          onClick={() => setConfirme(false)}
          className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium"
        >
          Annuler
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirme(true)}
      title="Archiver cette visite"
      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
    >
      <Archive className="h-3.5 w-3.5" /> Archiver
    </button>
  );
}

export function VisitesArchivees({ etablissementId }: { etablissementId: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [visites, setVisites] = useState<Visite[] | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  async function charger() {
    const supabase = createClient();
    const { data } = await supabase
      .from("chantierci_visites")
      .select("*")
      .eq("etablissement_id", etablissementId)
      .eq("archive", true)
      .order("date_visite", { ascending: false })
      .range(0, 99);
    setVisites(data ?? []);
  }

  function basculer() {
    if (!ouvert && visites === null) charger();
    setOuvert((o) => !o);
  }

  async function desarchiver(id: string) {
    setEnCours(id);
    try {
      const supabase = createClient();
      await supabase.from("chantierci_visites").update({ archive: false }).eq("id", id);
      await charger();
      router.refresh();
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div className="mt-4">
      <button
        onClick={basculer}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"
      >
        {ouvert ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        Visites archivées
        {visites !== null && <span className="text-gray-400">({visites.length})</span>}
      </button>

      {ouvert && (
        <ul className="mt-2 space-y-2">
          {visites === null && (
            <li className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </li>
          )}
          {visites?.length === 0 && (
            <li className="text-sm text-gray-500">Aucune visite archivée.</li>
          )}
          {(visites ?? []).map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <span className="flex items-center gap-2 text-sm">
                <span className="font-medium">{formatDate(v.date_visite)}</span>
                <span className="text-gray-500">{v.nom_visiteur}</span>
                <BadgeStatut statut={v.statut_chantier} />
              </span>
              <button
                onClick={() => desarchiver(v.id)}
                disabled={enCours === v.id}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:border-assemblage hover:text-assemblage disabled:opacity-60"
              >
                {enCours === v.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArchiveRestore className="h-3.5 w-3.5" />
                )}
                Désarchiver
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
