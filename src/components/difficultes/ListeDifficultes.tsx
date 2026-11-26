"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, MessageSquare, Search } from "lucide-react";
import { BadgeStatut } from "@/components/BadgeStatut";
import { avancementMoe, dateCourte, pct } from "@/lib/tableau-de-bord/calculs";
import {
  gravite,
  TYPES_DIFFICULTE,
  type Difficulte,
  type SiteDifficultes,
  type TypeDifficulte,
} from "@/lib/tableau-de-bord/difficultes";

export type DernierCommentaire = { site_id: string; texte: string; auteur_nom: string; created_at: string };
type LotMoe = { id: number; nom: string; regions: string[] };
type Lot = { id: number; nom: string };

const PAR_PAGE = 40;

const TEINTE: Record<number, string> = {
  3: "bg-danger-clair text-danger ring-danger/30",
  2: "bg-alerte-clair text-alerte ring-alerte/30",
  1: "bg-info-clair text-info ring-info/30",
};
const teinteType = (t: TypeDifficulte) => TEINTE[TYPES_DIFFICULTE.find((x) => x.cle === t)?.gravite ?? 1];
const libelleType = (t: TypeDifficulte) => TYPES_DIFFICULTE.find((x) => x.cle === t)?.libelle ?? t;

/** Onglet « Difficultés » : sites qui demandent une action, avec le détail de chaque difficulté. */
export function ListeDifficultes({
  sites,
  lots,
  lotsMoe,
  commentaires,
  initial,
}: {
  sites: SiteDifficultes[];
  lots: Lot[];
  lotsMoe: LotMoe[];
  commentaires: DernierCommentaire[];
  initial: { type: TypeDifficulte | null; lotMoe: number | null; lot: number | null };
}) {
  const [type, setType] = useState<TypeDifficulte | null>(initial.type);
  const [lotMoe, setLotMoe] = useState<number | null>(initial.lotMoe);
  const [lot, setLot] = useState<number | null>(initial.lot);
  const [recherche, setRecherche] = useState("");
  const [affiches, setAffiches] = useState(PAR_PAGE);

  // Filtres reflétés dans l'adresse (lien partageable, retour arrière).
  useEffect(() => {
    const p = new URLSearchParams();
    if (type) p.set("type", type);
    if (lotMoe) p.set("lot_moe", String(lotMoe));
    if (lot) p.set("lot", String(lot));
    window.history.replaceState(null, "", `${window.location.pathname}${p.size ? `?${p}` : ""}`);
    setAffiches(PAR_PAGE);
  }, [type, lotMoe, lot]);

  const dernierCommentaire = useMemo(() => {
    const m = new Map<string, DernierCommentaire>();
    for (const c of commentaires) if (!m.has(c.site_id)) m.set(c.site_id, c);
    return m;
  }, [commentaires]);

  // Sites du périmètre (lot MOE, lot, recherche) avec leurs difficultés.
  const perimetre = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return sites
      .filter((s) => (!lotMoe || s.lot_moe_id === lotMoe) && (!lot || s.lot_id === lot))
      .filter((s) => !q || `${s.code} ${s.nom} ${s.localite}`.toLowerCase().includes(q))
      .map((s) => ({ site: s, difficultes: s.difficultes }))
      .filter((x) => x.difficultes.length > 0);
  }, [sites, lotMoe, lot, recherche]);

  const parType = useMemo(
    () =>
      TYPES_DIFFICULTE.map((t) => ({
        ...t,
        nombre: perimetre.filter((x) => x.difficultes.some((d) => d.type === t.cle)).length,
      })),
    [perimetre]
  );
  const maxType = Math.max(1, ...parType.map((t) => t.nombre));

  const liste = useMemo(
    () =>
      perimetre
        .filter((x) => !type || x.difficultes.some((d) => d.type === type))
        .sort((a, b) => gravite(b.difficultes) - gravite(a.difficultes) || avancementMoe(a.site) - avancementMoe(b.site)),
    [perimetre, type]
  );
  const lotsDuPerimetre = lots.filter((l) => !lotMoe || sites.some((s) => s.lot_id === l.id && s.lot_moe_id === lotMoe));

  return (
    <div className="grid gap-4 xl:grid-cols-[300px,1fr]">
      {/* Filtres et répartition */}
      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <section className="carte space-y-3 p-4">
          <div>
            <p className="etiquette">Lot MOE</p>
            <div className="flex flex-wrap gap-1.5">
              {[null, ...lotsMoe.map((m) => m.id)].map((id) => (
                <button
                  key={id ?? "tous"}
                  type="button"
                  onClick={() => {
                    setLotMoe(id);
                    setLot(null);
                  }}
                  title={lotsMoe.find((m) => m.id === id)?.regions.join(", ")}
                  className={`rounded-full px-3 py-1 text-sm ring-1 ${
                    lotMoe === id ? "bg-accent text-sur-accent ring-accent" : "bg-surface ring-bordure hover:bg-surface-2"
                  }`}
                >
                  {id ? `MOE ${id}` : "Tous"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="etiquette" htmlFor="lot">
              Lot de travaux
            </label>
            <select id="lot" className="champ" value={lot ?? ""} onChange={(e) => setLot(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Tous les lots</option>
              {lotsDuPerimetre.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.id}. {l.nom}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texte-3" />
            <input
              className="champ !pl-9"
              placeholder="Site, code, localité…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              aria-label="Rechercher un site"
            />
          </div>
        </section>

        <section className="carte p-4">
          <p className="etiquette">Sites concernés par type</p>
          <div className="space-y-1">
            {parType.map((t) => (
              <button
                key={t.cle}
                type="button"
                onClick={() => setType(type === t.cle ? null : t.cle)}
                aria-pressed={type === t.cle}
                title={t.description}
                className={`block w-full rounded-champ px-2 py-1.5 text-left text-sm ${
                  type === t.cle ? "bg-selection ring-1 ring-selection-bordure" : "hover:bg-surface-2"
                }`}
              >
                <span className="flex justify-between gap-2">
                  <span className="truncate">{t.libelle}</span>
                  <span className="font-semibold tabular-nums">{t.nombre}</span>
                </span>
                <span className="mt-1 block h-1.5 rounded-full bg-graphe-piste">
                  <span
                    className={`block h-full rounded-full ${t.gravite === 3 ? "bg-danger" : t.gravite === 2 ? "bg-alerte" : "bg-info"}`}
                    style={{ width: `${(100 * t.nombre) / maxType}%` }}
                  />
                </span>
              </button>
            ))}
          </div>
          {type && (
            <button type="button" onClick={() => setType(null)} className="mt-2 text-sm font-semibold text-accent hover:underline">
              Tous les types
            </button>
          )}
        </section>
      </aside>

      {/* Liste des sites */}
      <section>
        <p className="mb-2 text-sm text-texte-2">
          <strong className="text-texte">{liste.length}</strong> site{liste.length > 1 ? "s" : ""}
          {type ? ` · ${libelleType(type).toLowerCase()}` : " avec au moins une difficulté"} · les plus graves en premier
        </p>
        {!liste.length ? (
          <p className="carte p-6 text-center text-sm text-texte-2">Aucun site ne correspond à ces critères.</p>
        ) : (
          <ul className="space-y-2">
            {liste.slice(0, affiches).map(({ site: s, difficultes }) => (
              <CarteSite key={s.id} site={s} difficultes={difficultes} commentaire={dernierCommentaire.get(s.id)} />
            ))}
          </ul>
        )}
        {liste.length > affiches && (
          <button type="button" className="bouton-secondaire mt-3 w-full" onClick={() => setAffiches((a) => a + PAR_PAGE)}>
            Afficher {Math.min(PAR_PAGE, liste.length - affiches)} sites de plus ({liste.length - affiches} restants)
          </button>
        )}
      </section>
    </div>
  );
}

function CarteSite({ site: s, difficultes, commentaire }: { site: SiteDifficultes; difficultes: Difficulte[]; commentaire?: DernierCommentaire }) {
  return (
    <li className="carte p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link href={`/site/${s.code}`} className="font-bold hover:underline">
          {s.nom}
        </Link>
        <span className="text-sm text-texte-3">
          {s.code} · lot {s.lot_id} · MOE {s.lot_moe_id} · {s.localite}
        </span>
        <span className="ml-auto flex items-center gap-3">
          {s.moe_statut ? <BadgeStatut statut={s.moe_statut} /> : <span className="text-xs text-texte-3">aucun rapport</span>}
          <span className="w-12 text-right text-sm font-semibold tabular-nums" title="Avancement (dernier rapport MOE)">
            {pct(avancementMoe(s))}
          </span>
          <Link href={`/site/${s.code}`} className="text-texte-3 hover:text-texte" aria-label={`Ouvrir la fiche de ${s.nom}`}>
            <ChevronRight className="h-5 w-5" />
          </Link>
        </span>
      </div>
      <ul className="mt-2 space-y-1">
        {difficultes.map((d) => (
          <li key={d.type} className="flex flex-wrap items-baseline gap-2 text-sm">
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${teinteType(d.type)}`}>
              {libelleType(d.type)}
            </span>
            <span className="text-texte-2">{d.texte}</span>
          </li>
        ))}
      </ul>
      {commentaire && (
        <p className="mt-2 flex gap-2 border-t border-bordure pt-2 text-sm text-texte-2">
          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-texte-3" />
          <span>
            <span className="text-texte-3">
              {commentaire.auteur_nom || "—"}, {dateCourte(commentaire.created_at.slice(0, 10))} :
            </span>{" "}
            {commentaire.texte}
          </span>
        </p>
      )}
    </li>
  );
}
