"use client";

/**
 * Tableau de suivi des chantiers (CDC §5.3) :
 *  - une ligne par établissement (vue de synthèse = dernière visite par
 *    défaut), bouton "voir toutes les visites" par ligne (expand inline)
 *  - colonnes configurables (show/hide, persistées en localStorage)
 *  - tri sur toutes les colonnes, filtres multi-select, recherche textuelle
 *  - pagination CÔTÉ SERVEUR (20 lignes/page, .range + count exact)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Columns3,
  Loader2,
  Search,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/database.types";
import { BadgeStatut } from "@/components/BadgeStatut";
import {
  formatDate,
  formatXOF,
  LIBELLES_STATUTS_CHANTIER,
} from "@/lib/constants";
import { exporterExcel, exporterTableauPDF } from "@/lib/exports/tableaux";
import { horodatage } from "@/lib/exports/telecharger";
import { BoutonExport } from "./BoutonExport";
import { FiltreMultiple } from "./FiltreMultiple";

type Ligne = Tables<"chantierci_v_etablissements_suivi">;
type Visite = Tables<"chantierci_visites">;

const PAGE_TAILLE = 20;
const CLE_COLONNES = "chantierci-colonnes-suivi";

type Format = "texte" | "argent" | "pct" | "date" | "statut";

interface Colonne {
  cle: keyof Ligne;
  libelle: string;
  format: Format;
  defaut: boolean;
}

const COLONNES: Colonne[] = [
  { cle: "nom", libelle: "Établissement", format: "texte", defaut: true },
  { cle: "lot_nom", libelle: "Lot", format: "texte", defaut: true },
  { cle: "lot_region", libelle: "Région", format: "texte", defaut: false },
  { cle: "province", libelle: "Province", format: "texte", defaut: false },
  { cle: "departement", libelle: "Département", format: "texte", defaut: true },
  { cle: "village", libelle: "Village", format: "texte", defaut: false },
  { cle: "statut", libelle: "Statut", format: "statut", defaut: true },
  { cle: "nom_directeur", libelle: "Directeur", format: "texte", defaut: false },
  { cle: "telephone", libelle: "Téléphone", format: "texte", defaut: false },
  { cle: "nom_entreprise", libelle: "Entreprise", format: "texte", defaut: true },
  { cle: "numero_marche", libelle: "N° marché", format: "texte", defaut: false },
  { cle: "montant_marche", libelle: "Montant marché", format: "argent", defaut: true },
  { cle: "montant_paye", libelle: "Montant payé", format: "argent", defaut: false },
  { cle: "avancement_financier_pct", libelle: "Av. financier", format: "pct", defaut: true },
  { cle: "reste_a_payer", libelle: "Reste à payer", format: "argent", defaut: false },
  { cle: "date_demarrage", libelle: "Démarrage", format: "date", defaut: false },
  { cle: "date_fin_estimative", libelle: "Fin estimée", format: "date", defaut: false },
  { cle: "derniere_visite_date", libelle: "Dernière visite", format: "date", defaut: true },
  { cle: "dernier_avancement_reel_pct", libelle: "Av. physique", format: "pct", defaut: true },
  { cle: "nb_visites", libelle: "Nb visites", format: "texte", defaut: false },
];

/** Valeur brute pour Excel (nombres conservés) / texte formaté pour PDF. */
function valeurBrute(ligne: Ligne, c: Colonne): string | number | null {
  const v = ligne[c.cle];
  if (v === null || v === undefined) return null;
  if (c.format === "statut")
    return ligne.statut ? LIBELLES_STATUTS_CHANTIER[ligne.statut] : null;
  if (c.format === "date") return formatDate(v as string);
  return v as string | number;
}

function valeurTexte(ligne: Ligne, c: Colonne): string {
  const v = ligne[c.cle];
  if (v === null || v === undefined) return "—";
  if (c.format === "statut")
    return ligne.statut ? LIBELLES_STATUTS_CHANTIER[ligne.statut] : "—";
  if (c.format === "argent") return formatXOF(v as number);
  if (c.format === "pct") return `${v} %`;
  if (c.format === "date") return formatDate(v as string);
  return String(v);
}

function Cellule({ ligne, colonne }: { ligne: Ligne; colonne: Colonne }) {
  const valeur = ligne[colonne.cle];
  if (colonne.format === "statut")
    return <BadgeStatut statut={ligne.statut} />;
  if (valeur === null || valeur === undefined)
    return <span className="text-gray-400">—</span>;
  if (colonne.format === "argent")
    return <span className="whitespace-nowrap">{formatXOF(valeur as number)}</span>;
  if (colonne.format === "pct") return <>{valeur as number} %</>;
  if (colonne.format === "date") return <>{formatDate(valeur as string)}</>;
  return <>{String(valeur)}</>;
}

interface Facettes {
  lots: string[];
  regions: string[];
  statuts: string[];
  entreprises: string[];
  provinces: string[];
  departements: string[];
}

export function TableauSuivi() {
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [recherche, setRecherche] = useState("");
  const rechercheDebounce = useRef<ReturnType<typeof setTimeout>>();
  const [rechercheActive, setRechercheActive] = useState("");

  const [tri, setTri] = useState<{ cle: keyof Ligne; asc: boolean }>({
    cle: "nom",
    asc: true,
  });

  const [filtres, setFiltres] = useState({
    lots: [] as string[],
    regions: [] as string[],
    statuts: [] as string[],
    entreprises: [] as string[],
    provinces: [] as string[],
    departements: [] as string[],
  });

  const [facettes, setFacettes] = useState<Facettes>({
    lots: [],
    regions: [],
    statuts: ["non_demarre", "en_cours", "arrete", "receptionne"],
    entreprises: [],
    provinces: [],
    departements: [],
  });

  const [visibles, setVisibles] = useState<Set<keyof Ligne>>(
    new Set(COLONNES.filter((c) => c.defaut).map((c) => c.cle))
  );
  const [menuColonnes, setMenuColonnes] = useState(false);
  const refMenuColonnes = useRef<HTMLDivElement>(null);

  const [ligneOuverte, setLigneOuverte] = useState<string | null>(null);
  const [visitesOuvertes, setVisitesOuvertes] = useState<Visite[] | null>(null);

  // Colonnes : restauration / persistance localStorage.
  useEffect(() => {
    try {
      const brut = localStorage.getItem(CLE_COLONNES);
      if (brut) setVisibles(new Set(JSON.parse(brut)));
    } catch {}
  }, []);
  const basculerColonne = (cle: keyof Ligne) => {
    setVisibles((courantes) => {
      const suivantes = new Set(courantes);
      if (suivantes.has(cle)) suivantes.delete(cle);
      else suivantes.add(cle);
      localStorage.setItem(CLE_COLONNES, JSON.stringify([...suivantes]));
      return suivantes;
    });
  };

  useEffect(() => {
    if (!menuColonnes) return;
    const surClic = (e: MouseEvent) => {
      if (!refMenuColonnes.current?.contains(e.target as Node))
        setMenuColonnes(false);
    };
    document.addEventListener("mousedown", surClic);
    return () => document.removeEventListener("mousedown", surClic);
  }, [menuColonnes]);

  // Facettes : petites requêtes sur les colonnes de filtre uniquement.
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("chantierci_v_etablissements_suivi")
        .select("lot_nom, lot_region, nom_entreprise, province, departement")
        .range(0, 999);
      const distinct = (cle: keyof NonNullable<typeof data>[number]) =>
        Array.from(
          new Set((data ?? []).map((d) => d[cle]).filter(Boolean) as string[])
        ).sort();
      setFacettes((f) => ({
        ...f,
        lots: distinct("lot_nom"),
        regions: distinct("lot_region"),
        entreprises: distinct("nom_entreprise"),
        provinces: distinct("province"),
        departements: distinct("departement"),
      }));
    })();
  }, []);

  // Recherche : debounce 300 ms puis retour page 0.
  useEffect(() => {
    clearTimeout(rechercheDebounce.current);
    rechercheDebounce.current = setTimeout(() => {
      setRechercheActive(recherche.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(rechercheDebounce.current);
  }, [recherche]);

  // Chargement de la page courante (pagination serveur).
  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const supabase = createClient();
      let q = supabase
        .from("chantierci_v_etablissements_suivi")
        .select("*", { count: "exact" });

      if (filtres.lots.length) q = q.in("lot_nom", filtres.lots);
      if (filtres.regions.length) q = q.in("lot_region", filtres.regions);
      if (filtres.statuts.length)
        q = q.in(
          "statut",
          filtres.statuts as Tables<"chantierci_v_etablissements_suivi">["statut"][]
        );
      if (filtres.entreprises.length)
        q = q.in("nom_entreprise", filtres.entreprises);
      if (filtres.provinces.length) q = q.in("province", filtres.provinces);
      if (filtres.departements.length)
        q = q.in("departement", filtres.departements);
      if (rechercheActive) {
        const t = rechercheActive.replaceAll(",", " ").replaceAll("%", "");
        q = q.or(
          `nom.ilike.%${t}%,nom_directeur.ilike.%${t}%,numero_marche.ilike.%${t}%`
        );
      }

      const { data, count, error } = await q
        .order(tri.cle as string, { ascending: tri.asc, nullsFirst: !tri.asc ? false : undefined })
        .range(page * PAGE_TAILLE, page * PAGE_TAILLE + PAGE_TAILLE - 1);

      if (error) throw new Error(error.message);
      setLignes((data ?? []) as Ligne[]);
      setTotal(count ?? 0);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setChargement(false);
    }
  }, [filtres, rechercheActive, tri, page]);

  useEffect(() => {
    charger();
  }, [charger]);

  function trierPar(cle: keyof Ligne) {
    setPage(0);
    setTri((t) => ({ cle, asc: t.cle === cle ? !t.asc : true }));
  }

  // Toutes les lignes du filtre actif (par lots de 500, plafond 2000) pour
  // les exports — mêmes critères que la pagination.
  const chargerToutFiltre = useCallback(async (): Promise<Ligne[]> => {
    const supabase = createClient();
    const tout: Ligne[] = [];
    for (let depuis = 0; depuis < 2000; depuis += 500) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase.from("chantierci_v_etablissements_suivi").select("*");
      if (filtres.lots.length) q = q.in("lot_nom", filtres.lots);
      if (filtres.regions.length) q = q.in("lot_region", filtres.regions);
      if (filtres.statuts.length) q = q.in("statut", filtres.statuts);
      if (filtres.entreprises.length)
        q = q.in("nom_entreprise", filtres.entreprises);
      if (filtres.provinces.length) q = q.in("province", filtres.provinces);
      if (filtres.departements.length)
        q = q.in("departement", filtres.departements);
      if (rechercheActive) {
        const t = rechercheActive.replaceAll(",", " ").replaceAll("%", "");
        q = q.or(
          `nom.ilike.%${t}%,nom_directeur.ilike.%${t}%,numero_marche.ilike.%${t}%`
        );
      }
      const { data, error } = await q
        .order(tri.cle as string, { ascending: tri.asc })
        .range(depuis, depuis + 499);
      if (error) throw new Error(error.message);
      tout.push(...((data ?? []) as Ligne[]));
      if (!data || data.length < 500) break;
    }
    return tout;
  }, [filtres, rechercheActive, tri]);

  const actionsExport = useMemo(() => {
    const colonnes = COLONNES.filter((c) => visibles.has(c.cle));
    return [
      {
        libelle: "Excel (.xlsx)",
        action: async () => {
          const lignesExport = await chargerToutFiltre();
          await exporterExcel({
            nomFichier: `suivi-chantiers-${horodatage()}.xlsx`,
            nomFeuille: "Suivi des chantiers",
            entetes: colonnes.map((c) => c.libelle),
            lignes: lignesExport.map((l) => colonnes.map((c) => valeurBrute(l, c))),
          });
        },
      },
      {
        libelle: "PDF",
        action: async () => {
          const lignesExport = await chargerToutFiltre();
          await exporterTableauPDF({
            nomFichier: `suivi-chantiers-${horodatage()}.pdf`,
            titre: "Tableau de suivi des chantiers",
            entetes: colonnes.map((c) => c.libelle),
            lignes: lignesExport.map((l) => colonnes.map((c) => valeurTexte(l, c))),
          });
        },
      },
    ];
  }, [visibles, chargerToutFiltre]);

  async function basculerVisites(etablissementId: string) {
    if (ligneOuverte === etablissementId) {
      setLigneOuverte(null);
      setVisitesOuvertes(null);
      return;
    }
    setLigneOuverte(etablissementId);
    setVisitesOuvertes(null);
    const supabase = createClient();
    const { data } = await supabase
      .from("chantierci_visites")
      .select("*")
      .eq("etablissement_id", etablissementId)
      .order("date_visite", { ascending: false })
      .range(0, 49);
    setVisitesOuvertes(data ?? []);
  }

  const colonnesAffichees = useMemo(
    () => COLONNES.filter((c) => visibles.has(c.cle)),
    [visibles]
  );
  const nbPages = Math.max(1, Math.ceil(total / PAGE_TAILLE));

  const majFiltre = (cle: keyof typeof filtres) => (valeurs: string[]) => {
    setPage(0);
    setFiltres((f) => ({ ...f, [cle]: valeurs }));
  };

  return (
    <div>
      {/* Barre filtres + recherche + colonnes */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Établissement, directeur, n° marché…"
            className="w-72 rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-assemblage focus:outline-none focus:ring-1 focus:ring-assemblage"
          />
        </div>
        <FiltreMultiple libelle="Lot" options={facettes.lots.map((v) => ({ valeur: v }))} selection={filtres.lots} surChangement={majFiltre("lots")} />
        <FiltreMultiple libelle="Région" options={facettes.regions.map((v) => ({ valeur: v }))} selection={filtres.regions} surChangement={majFiltre("regions")} />
        <FiltreMultiple
          libelle="Statut"
          options={[
            { valeur: "non_demarre", affichage: "Non démarré" },
            { valeur: "en_cours", affichage: "En cours" },
            { valeur: "arrete", affichage: "Arrêté" },
            { valeur: "receptionne", affichage: "Réceptionné" },
          ]}
          selection={filtres.statuts}
          surChangement={majFiltre("statuts")}
        />
        <FiltreMultiple libelle="Entreprise" options={facettes.entreprises.map((v) => ({ valeur: v }))} selection={filtres.entreprises} surChangement={majFiltre("entreprises")} />
        <FiltreMultiple libelle="Province" options={facettes.provinces.map((v) => ({ valeur: v }))} selection={filtres.provinces} surChangement={majFiltre("provinces")} />
        <FiltreMultiple libelle="Département" options={facettes.departements.map((v) => ({ valeur: v }))} selection={filtres.departements} surChangement={majFiltre("departements")} />

        <div className="ml-auto">
          <BoutonExport actions={actionsExport} />
        </div>
        <div ref={refMenuColonnes} className="relative">
          <button
            onClick={() => setMenuColonnes(!menuColonnes)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-400"
          >
            <Columns3 className="h-4 w-4" /> Colonnes
          </button>
          {menuColonnes && (
            <div className="absolute right-0 top-full z-20 mt-1 max-h-80 w-56 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {COLONNES.map((c) => (
                <label
                  key={c.cle}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={visibles.has(c.cle)}
                    onChange={() => basculerColonne(c.cle)}
                    className="h-4 w-4 rounded border-gray-300 text-assemblage focus:ring-assemblage"
                  />
                  {c.libelle}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {erreur && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreur}
        </p>
      )}

      {/* Tableau */}
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-sidebar text-left text-xs uppercase tracking-wide text-white">
              <th className="w-8 px-2 py-3" />
              {colonnesAffichees.map((c) => (
                <th key={c.cle} className="px-3 py-3 font-medium">
                  <button
                    onClick={() => trierPar(c.cle)}
                    className="inline-flex items-center gap-1 hover:text-gray-300"
                  >
                    {c.libelle}
                    {tri.cle === c.cle &&
                      (tri.asc ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      ))}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(lignes ?? []).map((ligne, i) => (
              <LigneTableau
                key={ligne.id}
                ligne={ligne}
                colonnes={colonnesAffichees}
                impaire={i % 2 === 1}
                ouverte={ligneOuverte === ligne.id}
                visites={ligneOuverte === ligne.id ? visitesOuvertes : null}
                surBascule={() => ligne.id && basculerVisites(ligne.id)}
              />
            ))}
            {!chargement && (lignes ?? []).length === 0 && (
              <tr>
                <td
                  colSpan={colonnesAffichees.length + 1}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  Aucun établissement ne correspond aux critères.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {chargement && (
          <div className="flex items-center justify-center gap-2 py-6 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
          </div>
        )}
      </div>

      {/* Pagination serveur */}
      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <p>
          {total} établissement(s) — page {page + 1} / {nbPages}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || chargement}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 font-medium disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Précédent
          </button>
          <button
            onClick={() => setPage((p) => Math.min(nbPages - 1, p + 1))}
            disabled={page >= nbPages - 1 || chargement}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 font-medium disabled:opacity-40"
          >
            Suivant <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function LigneTableau({
  ligne,
  colonnes,
  impaire,
  ouverte,
  visites,
  surBascule,
}: {
  ligne: Ligne;
  colonnes: Colonne[];
  impaire: boolean;
  ouverte: boolean;
  visites: Visite[] | null;
  surBascule: () => void;
}) {
  return (
    <>
      <tr className={`border-b border-gray-100 ${impaire ? "bg-gray-50" : "bg-white"}`}>
        <td className="px-2 py-2.5">
          <button
            onClick={surBascule}
            title="Voir toutes les visites"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            {ouverte ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </td>
        {colonnes.map((c, idx) => (
          <td key={c.cle} className="px-3 py-2.5">
            {idx === 0 && c.cle === "nom" && ligne.id ? (
              <Link
                href={`/etablissements/${ligne.id}`}
                className="font-medium text-gray-900 hover:text-assemblage hover:underline"
              >
                <Cellule ligne={ligne} colonne={c} />
              </Link>
            ) : (
              <Cellule ligne={ligne} colonne={c} />
            )}
          </td>
        ))}
      </tr>
      {ouverte && (
        <tr className="border-b border-gray-100 bg-red-50/40">
          <td colSpan={colonnes.length + 1} className="px-6 py-3">
            {visites === null ? (
              <span className="inline-flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement des
                visites…
              </span>
            ) : visites.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune visite enregistrée.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left uppercase tracking-wide text-gray-500">
                    <th className="py-1 pr-3 font-medium">Date</th>
                    <th className="py-1 pr-3 font-medium">Visiteur</th>
                    <th className="py-1 pr-3 font-medium">Statut</th>
                    <th className="py-1 pr-3 font-medium">Av. global</th>
                    <th className="py-1 pr-3 font-medium">Commentaire</th>
                  </tr>
                </thead>
                <tbody>
                  {visites.map((v) => (
                    <tr key={v.id} className="border-t border-red-100">
                      <td className="py-1.5 pr-3 whitespace-nowrap">
                        {formatDate(v.date_visite)}
                      </td>
                      <td className="py-1.5 pr-3">{v.nom_visiteur}</td>
                      <td className="py-1.5 pr-3">
                        <BadgeStatut statut={v.statut_chantier} />
                      </td>
                      <td className="py-1.5 pr-3 font-semibold">
                        {v.avancement_reel_pct !== null
                          ? `${v.avancement_reel_pct} %`
                          : "—"}
                      </td>
                      <td className="py-1.5 pr-3 italic text-gray-600">
                        {v.commentaire ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
