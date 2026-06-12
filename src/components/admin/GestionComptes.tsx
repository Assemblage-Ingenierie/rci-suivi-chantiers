"use client";

/**
 * Validation des comptes (CDC §5.1 et §5.6) : un compte naît `en_attente`
 * sans aucun accès ; l'admin valide (rôle + lots + activation), suspend ou
 * réactive. Les colonnes role / statut_compte / lot_ids ne sont modifiables
 * que par un admin (trigger + RLS côté base).
 */
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Clock,
  Loader2,
  ShieldOff,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/database.types";
import {
  LIBELLES_ROLES,
  type RoleUtilisateur,
  type StatutCompte,
} from "@/lib/constants";

type Profil = Tables<"chantierci_profiles">;
type Lot = Tables<"chantierci_lots">;

const ROLES: RoleUtilisateur[] = ["coges", "regional", "national", "admin"];

const BADGES_STATUT: Record<StatutCompte, { libelle: string; classe: string }> = {
  en_attente: { libelle: "En attente", classe: "bg-amber-100 text-amber-800" },
  actif: { libelle: "Actif", classe: "bg-green-100 text-green-800" },
  suspendu: { libelle: "Suspendu", classe: "bg-red-100 text-red-800" },
};

export function GestionComptes({ adminId }: { adminId: string }) {
  const [profils, setProfils] = useState<Profil[] | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const supabase = createClient();
    const [{ data: profilsData }, { data: lotsData }] = await Promise.all([
      supabase
        .from("chantierci_profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .range(0, 499),
      supabase.from("chantierci_lots").select("*").order("nom").range(0, 99),
    ]);
    // Comptes en attente en premier.
    const ordre: StatutCompte[] = ["en_attente", "actif", "suspendu"];
    setProfils(
      (profilsData ?? []).sort(
        (a, b) => ordre.indexOf(a.statut_compte) - ordre.indexOf(b.statut_compte)
      )
    );
    setLots(lotsData ?? []);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  async function mettreAJour(id: string, champs: Partial<Profil>) {
    setEnCours(id);
    setErreur(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("chantierci_profiles")
        .update(champs)
        .eq("id", id);
      if (error) throw new Error(error.message);
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Mise à jour impossible");
    } finally {
      setEnCours(null);
    }
  }

  function basculerLot(profil: Profil, lotId: string) {
    const lotIds = profil.lot_ids.includes(lotId)
      ? profil.lot_ids.filter((id) => id !== lotId)
      : [...profil.lot_ids, lotId];
    mettreAJour(profil.id, { lot_ids: lotIds });
  }

  if (profils === null) {
    return (
      <p className="flex items-center gap-2 py-8 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
      </p>
    );
  }

  const enAttente = profils.filter((p) => p.statut_compte === "en_attente").length;

  return (
    <div>
      {enAttente > 0 && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          <Clock className="h-4 w-4" />
          {enAttente} compte(s) en attente de validation
        </p>
      )}
      {erreur && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreur}
        </p>
      )}

      <ul className="space-y-3">
        {profils.map((p) => {
          const soiMeme = p.id === adminId;
          const badge = BADGES_STATUT[p.statut_compte];
          const lotsVisibles = p.role === "coges" || p.role === "regional";
          return (
            <li
              key={p.id}
              className={`rounded-xl bg-white p-4 shadow-sm ${
                p.statut_compte === "en_attente" ? "ring-2 ring-amber-300" : ""
              }`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {p.nom_complet || "(sans nom)"}{" "}
                    {soiMeme && (
                      <span className="text-xs font-normal text-gray-400">
                        (vous)
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-gray-500">
                    {p.email || "—"} · {p.telephone || "—"}
                  </p>
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.classe}`}
                >
                  {badge.libelle}
                </span>

                <select
                  value={p.role}
                  disabled={soiMeme || enCours === p.id}
                  onChange={(e) =>
                    mettreAJour(p.id, { role: e.target.value as RoleUtilisateur })
                  }
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm disabled:opacity-50"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {LIBELLES_ROLES[r]}
                    </option>
                  ))}
                </select>

                {enCours === p.id ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                ) : (
                  !soiMeme && (
                    <div className="flex gap-2">
                      {p.statut_compte !== "actif" && (
                        <button
                          onClick={() =>
                            mettreAJour(p.id, { statut_compte: "actif" })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                        >
                          {p.statut_compte === "en_attente" ? (
                            <>
                              <Check className="h-4 w-4" /> Valider
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-4 w-4" /> Réactiver
                            </>
                          )}
                        </button>
                      )}
                      {p.statut_compte === "actif" && (
                        <button
                          onClick={() =>
                            mettreAJour(p.id, { statut_compte: "suspendu" })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          <ShieldOff className="h-4 w-4" /> Suspendre
                        </button>
                      )}
                    </div>
                  )
                )}
              </div>

              {/* Attribution des lots (COGES + régional) */}
              {lotsVisibles && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Lots attribués :
                  </span>
                  {lots.map((lot) => {
                    const attribue = p.lot_ids.includes(lot.id);
                    return (
                      <button
                        key={lot.id}
                        disabled={enCours === p.id}
                        onClick={() => basculerLot(p, lot.id)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                          attribue
                            ? "border-assemblage bg-assemblage text-white"
                            : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                        }`}
                      >
                        {lot.nom}
                      </button>
                    );
                  })}
                  {p.lot_ids.length === 0 && (
                    <span className="text-xs text-amber-700">
                      Aucun lot — l&apos;utilisateur ne verra aucune donnée.
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
