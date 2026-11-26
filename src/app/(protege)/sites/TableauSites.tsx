"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Search } from "lucide-react";
import { LIBELLES_LATRINES, type TypeLatrines } from "@/lib/constants";

export type LigneSite = {
  id: string;
  code: string;
  nom: string;
  region: string;
  departement: string;
  localite: string;
  zone: string;
  electricite: boolean;
  type_latrines: TypeLatrines;
  lot_id: number;
  lot_moe_id: number;
  a_verifier: string;
};

function sansAccents(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function TableauSites({ sites, lots }: { sites: LigneSite[]; lots: { id: number; nom: string }[] }) {
  const [recherche, setRecherche] = useState("");
  const [lot, setLot] = useState("");
  const [lotMoe, setLotMoe] = useState("");
  const [aVerifier, setAVerifier] = useState(false);

  const nomLot = useMemo(() => new Map(lots.map((l) => [l.id, l.nom])), [lots]);

  const filtres = useMemo(() => {
    const q = sansAccents(recherche.trim());
    return sites.filter(
      (s) =>
        (!lot || s.lot_id === Number(lot)) &&
        (!lotMoe || s.lot_moe_id === Number(lotMoe)) &&
        (!aVerifier || s.a_verifier) &&
        (!q || sansAccents(`${s.code} ${s.nom} ${s.localite} ${s.departement} ${s.region}`).includes(q))
    );
  }, [sites, recherche, lot, lotMoe, aVerifier]);

  const nbAVerifier = sites.filter((s) => s.a_verifier).length;

  return (
    <div className="space-y-4">
      <div className="carte flex flex-wrap items-end gap-3 p-4">
        <label className="min-w-[14rem] flex-1">
          <span className="etiquette">Recherche</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texte-3" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Nom, code, localité…"
              className="champ py-2 pl-9"
            />
          </span>
        </label>
        <label>
          <span className="etiquette">Lot de travaux</span>
          <select value={lot} onChange={(e) => setLot(e.target.value)} className="champ py-2">
            <option value="">Tous</option>
            {lots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.id} · {l.nom}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="etiquette">Lot MOE</span>
          <select value={lotMoe} onChange={(e) => setLotMoe(e.target.value)} className="champ py-2">
            <option value="">Tous</option>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                MOE {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2.5 text-sm">
          <input type="checkbox" checked={aVerifier} onChange={(e) => setAVerifier(e.target.checked)} />
          À vérifier ({nbAVerifier})
        </label>
      </div>

      <p className="text-sm text-texte-2">
        {filtres.length} site{filtres.length > 1 ? "s" : ""} sur {sites.length}
      </p>

      <div className="carte overflow-x-auto">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-bordure bg-surface-2 text-xs uppercase tracking-wide text-texte-2">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Établissement</th>
              <th className="px-3 py-2">Lot</th>
              <th className="px-3 py-2">MOE</th>
              <th className="px-3 py-2">Région · Département</th>
              <th className="px-3 py-2">Localité</th>
              <th className="px-3 py-2">Électricité</th>
              <th className="px-3 py-2">Latrines</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bordure">
            {filtres.map((s) => (
              <tr key={s.id} className="align-top hover:bg-surface-2">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{s.code}</td>
                <td className="px-3 py-2">
                  <Link href={`/site/${s.code}`} className="font-semibold text-accent hover:underline">
                    {s.nom}
                  </Link>
                  {s.a_verifier && (
                    <span className="mt-1 flex items-start gap-1 text-xs text-alerte">
                      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                      {s.a_verifier}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {s.lot_id} · {nomLot.get(s.lot_id)}
                </td>
                <td className="px-3 py-2">{s.lot_moe_id}</td>
                <td className="px-3 py-2">
                  {s.region} · {s.departement}
                </td>
                <td className="px-3 py-2">{s.localite || "—"}</td>
                <td className="px-3 py-2">{s.electricite ? "Oui" : "Non"}</td>
                <td className="whitespace-nowrap px-3 py-2">{LIBELLES_LATRINES[s.type_latrines]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
