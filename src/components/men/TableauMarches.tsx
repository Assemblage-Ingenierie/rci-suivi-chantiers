"use client";

/**
 * Vue "Marchés de travaux" (CDC §5.3) :
 *  - tableau de tous les marchés, pagination CÔTÉ SERVEUR (20/page)
 *  - colonnes : établissement, entreprise, n° marché, montant, dates,
 *    montant payé, avancement financier (%), reste à payer
 *  - filtres multi-select : lot, province, entreprise, statut chantier
 *  - recherche : nom établissement, n° de marché
 *  - "Voir les paiements" par ligne (expand inline)
 *  - "Ajouter un paiement" : rôles national / admin uniquement (RLS en
 *    dernier rempart côté base)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
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

type Marche = Tables<"chantierci_v_marches_financier">;
type Paiement = Tables<"chantierci_paiements">;

const PAGE_TAILLE = 20;

const COLONNES: {
  cle: keyof Marche;
  libelle: string;
  format?: "argent" | "pct" | "date" | "statut";
}[] = [
  { cle: "etablissement_nom", libelle: "Établissement" },
  { cle: "nom_entreprise", libelle: "Entreprise" },
  { cle: "numero_marche", libelle: "N° marché" },
  { cle: "montant_marche", libelle: "Montant", format: "argent" },
  { cle: "date_demarrage", libelle: "Démarrage", format: "date" },
  { cle: "date_fin_estimative", libelle: "Fin estimée", format: "date" },
  { cle: "montant_paye", libelle: "Payé", format: "argent" },
  { cle: "avancement_financier_pct", libelle: "Av. financier", format: "pct" },
  { cle: "reste_a_payer", libelle: "Reste à payer", format: "argent" },
];

const COLONNES_EXPORT = [
  ...COLONNES,
  { cle: "statut_etablissement" as keyof Marche, libelle: "Statut", format: "statut" as const },
];

function valeurBrute(m: Marche, c: (typeof COLONNES_EXPORT)[number]): string | number | null {
  const v = m[c.cle];
  if (v === null || v === undefined) return null;
  if (c.format === "statut")
    return m.statut_etablissement
      ? LIBELLES_STATUTS_CHANTIER[m.statut_etablissement]
      : null;
  if (c.format === "date") return formatDate(v as string);
  return v as string | number;
}

function valeurTexte(m: Marche, c: (typeof COLONNES_EXPORT)[number]): string {
  const v = m[c.cle];
  if (v === null || v === undefined) return "—";
  if (c.format === "statut")
    return m.statut_etablissement
      ? LIBELLES_STATUTS_CHANTIER[m.statut_etablissement]
      : "—";
  if (c.format === "argent") return formatXOF(v as number);
  if (c.format === "pct") return `${v} %`;
  if (c.format === "date") return formatDate(v as string);
  return String(v);
}

export function TableauMarches({
  peutSaisirPaiement,
  userId,
}: {
  peutSaisirPaiement: boolean;
  userId: string;
}) {
  const [lignes, setLignes] = useState<Marche[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [recherche, setRecherche] = useState("");
  const [rechercheActive, setRechercheActive] = useState("");
  const rechercheDebounce = useRef<ReturnType<typeof setTimeout>>();

  const [tri, setTri] = useState<{ cle: keyof Marche; asc: boolean }>({
    cle: "etablissement_nom",
    asc: true,
  });

  const [lots, setLots] = useState<Tables<"chantierci_lots">[]>([]);
  const [facettes, setFacettes] = useState<{
    provinces: string[];
    entreprises: string[];
  }>({ provinces: [], entreprises: [] });

  const [filtres, setFiltres] = useState({
    lots: [] as string[], // ids de lots
    provinces: [] as string[],
    entreprises: [] as string[],
    statuts: [] as string[],
  });

  const [marcheOuvert, setMarcheOuvert] = useState<string | null>(null);
  const [paiements, setPaiements] = useState<Paiement[] | null>(null);

  // Facettes (petites requêtes ciblées).
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [{ data: lotsData }, { data: facettesData }] = await Promise.all([
        supabase.from("chantierci_lots").select("*").order("nom").range(0, 99),
        supabase
          .from("chantierci_v_marches_financier")
          .select("province, nom_entreprise")
          .range(0, 999),
      ]);
      setLots(lotsData ?? []);
      const distinct = (cle: "province" | "nom_entreprise") =>
        Array.from(
          new Set(
            (facettesData ?? []).map((d) => d[cle]).filter(Boolean) as string[]
          )
        ).sort();
      setFacettes({
        provinces: distinct("province"),
        entreprises: distinct("nom_entreprise"),
      });
    })();
  }, []);

  useEffect(() => {
    clearTimeout(rechercheDebounce.current);
    rechercheDebounce.current = setTimeout(() => {
      setRechercheActive(recherche.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(rechercheDebounce.current);
  }, [recherche]);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const supabase = createClient();
      let q = supabase
        .from("chantierci_v_marches_financier")
        .select("*", { count: "exact" });

      if (filtres.lots.length) q = q.in("lot_id", filtres.lots);
      if (filtres.provinces.length) q = q.in("province", filtres.provinces);
      if (filtres.entreprises.length)
        q = q.in("nom_entreprise", filtres.entreprises);
      if (filtres.statuts.length)
        q = q.in(
          "statut_etablissement",
          filtres.statuts as Marche["statut_etablissement"][]
        );
      if (rechercheActive) {
        const t = rechercheActive.replaceAll(",", " ").replaceAll("%", "");
        q = q.or(`etablissement_nom.ilike.%${t}%,numero_marche.ilike.%${t}%`);
      }

      const { data, count, error } = await q
        .order(tri.cle as string, { ascending: tri.asc })
        .range(page * PAGE_TAILLE, page * PAGE_TAILLE + PAGE_TAILLE - 1);
      if (error) throw new Error(error.message);
      setLignes((data ?? []) as Marche[]);
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

  async function chargerPaiements(marcheId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("chantierci_paiements")
      .select("*")
      .eq("marche_id", marcheId)
      .order("date_paiement", { ascending: false })
      .range(0, 99);
    setPaiements(data ?? []);
  }

  function basculerPaiements(marcheId: string) {
    if (marcheOuvert === marcheId) {
      setMarcheOuvert(null);
      setPaiements(null);
      return;
    }
    setMarcheOuvert(marcheId);
    setPaiements(null);
    chargerPaiements(marcheId);
  }

  const majFiltre = (cle: keyof typeof filtres) => (valeurs: string[]) => {
    setPage(0);
    setFiltres((f) => ({ ...f, [cle]: valeurs }));
  };

  // Toutes les lignes du filtre actif (lots de 500, plafond 2000) — exports.
  const chargerToutFiltre = useCallback(async (): Promise<Marche[]> => {
    const supabase = createClient();
    const tout: Marche[] = [];
    for (let depuis = 0; depuis < 2000; depuis += 500) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase.from("chantierci_v_marches_financier").select("*");
      if (filtres.lots.length) q = q.in("lot_id", filtres.lots);
      if (filtres.provinces.length) q = q.in("province", filtres.provinces);
      if (filtres.entreprises.length)
        q = q.in("nom_entreprise", filtres.entreprises);
      if (filtres.statuts.length)
        q = q.in("statut_etablissement", filtres.statuts);
      if (rechercheActive) {
        const t = rechercheActive.replaceAll(",", " ").replaceAll("%", "");
        q = q.or(`etablissement_nom.ilike.%${t}%,numero_marche.ilike.%${t}%`);
      }
      const { data, error } = await q
        .order(tri.cle as string, { ascending: tri.asc })
        .range(depuis, depuis + 499);
      if (error) throw new Error(error.message);
      tout.push(...((data ?? []) as Marche[]));
      if (!data || data.length < 500) break;
    }
    return tout;
  }, [filtres, rechercheActive, tri]);

  const actionsExport = useMemo(
    () => [
      {
        libelle: "Excel (.xlsx)",
        action: async () => {
          const lignesExport = await chargerToutFiltre();
          await exporterExcel({
            nomFichier: `marches-travaux-${horodatage()}.xlsx`,
            nomFeuille: "Marchés de travaux",
            entetes: COLONNES_EXPORT.map((c) => c.libelle),
            lignes: lignesExport.map((m) =>
              COLONNES_EXPORT.map((c) => valeurBrute(m, c))
            ),
          });
        },
      },
      {
        libelle: "PDF",
        action: async () => {
          const lignesExport = await chargerToutFiltre();
          await exporterTableauPDF({
            nomFichier: `marches-travaux-${horodatage()}.pdf`,
            titre: "Marchés de travaux",
            entetes: COLONNES_EXPORT.map((c) => c.libelle),
            lignes: lignesExport.map((m) =>
              COLONNES_EXPORT.map((c) => valeurTexte(m, c))
            ),
          });
        },
      },
    ],
    [chargerToutFiltre]
  );

  function trierPar(cle: keyof Marche) {
    setPage(0);
    setTri((t) => ({ cle, asc: t.cle === cle ? !t.asc : true }));
  }

  const nbPages = Math.max(1, Math.ceil(total / PAGE_TAILLE));

  return (
    <div>
      {/* Filtres + recherche */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Établissement, n° de marché…"
            className="w-72 rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-assemblage focus:outline-none focus:ring-1 focus:ring-assemblage"
          />
        </div>
        <FiltreMultiple
          libelle="Lot"
          options={lots.map((l) => ({ valeur: l.id, affichage: l.nom }))}
          selection={filtres.lots}
          surChangement={majFiltre("lots")}
        />
        <FiltreMultiple
          libelle="Province"
          options={facettes.provinces.map((v) => ({ valeur: v }))}
          selection={filtres.provinces}
          surChangement={majFiltre("provinces")}
        />
        <FiltreMultiple
          libelle="Entreprise"
          options={facettes.entreprises.map((v) => ({ valeur: v }))}
          selection={filtres.entreprises}
          surChangement={majFiltre("entreprises")}
        />
        <FiltreMultiple
          libelle="Statut chantier"
          options={[
            { valeur: "non_demarre", affichage: "Non démarré" },
            { valeur: "en_cours", affichage: "En cours" },
            { valeur: "arrete", affichage: "Arrêté" },
            { valeur: "receptionne", affichage: "Réceptionné" },
          ]}
          selection={filtres.statuts}
          surChangement={majFiltre("statuts")}
        />
        <div className="ml-auto">
          <BoutonExport actions={actionsExport} />
        </div>
      </div>

      {erreur && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreur}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-sidebar text-left text-xs uppercase tracking-wide text-white">
              <th className="w-8 px-2 py-3" />
              {COLONNES.map((c) => (
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
              <th className="px-3 py-3 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {(lignes ?? []).map((m, i) => (
              <LigneMarche
                key={m.id}
                marche={m}
                impaire={i % 2 === 1}
                ouvert={marcheOuvert === m.id}
                paiements={marcheOuvert === m.id ? paiements : null}
                peutSaisirPaiement={peutSaisirPaiement}
                userId={userId}
                surBascule={() => m.id && basculerPaiements(m.id)}
                surPaiementAjoute={() => {
                  if (m.id) chargerPaiements(m.id);
                  charger();
                }}
              />
            ))}
            {!chargement && (lignes ?? []).length === 0 && (
              <tr>
                <td
                  colSpan={COLONNES.length + 2}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  Aucun marché ne correspond aux critères.
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

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <p>
          {total} marché(s) — page {page + 1} / {nbPages}
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

function LigneMarche({
  marche,
  impaire,
  ouvert,
  paiements,
  peutSaisirPaiement,
  userId,
  surBascule,
  surPaiementAjoute,
}: {
  marche: Marche;
  impaire: boolean;
  ouvert: boolean;
  paiements: Paiement[] | null;
  peutSaisirPaiement: boolean;
  userId: string;
  surBascule: () => void;
  surPaiementAjoute: () => void;
}) {
  return (
    <>
      <tr className={`border-b border-gray-100 ${impaire ? "bg-gray-50" : "bg-white"}`}>
        <td className="px-2 py-2.5">
          <button
            onClick={surBascule}
            title="Voir les paiements"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            {ouvert ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </td>
        <td className="px-3 py-2.5">
          {marche.etablissement_id ? (
            <Link
              href={`/etablissements/${marche.etablissement_id}`}
              className="font-medium hover:text-assemblage hover:underline"
            >
              {marche.etablissement_nom}
            </Link>
          ) : (
            marche.etablissement_nom
          )}
        </td>
        <td className="px-3 py-2.5">{marche.nom_entreprise}</td>
        <td className="px-3 py-2.5 whitespace-nowrap">{marche.numero_marche}</td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          {formatXOF(marche.montant_marche)}
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          {formatDate(marche.date_demarrage)}
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          {formatDate(marche.date_fin_estimative)}
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          {formatXOF(marche.montant_paye)}
        </td>
        <td className="px-3 py-2.5 font-semibold text-assemblage">
          {marche.avancement_financier_pct !== null
            ? `${marche.avancement_financier_pct} %`
            : "—"}
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          {formatXOF(marche.reste_a_payer)}
        </td>
        <td className="px-3 py-2.5">
          <BadgeStatut statut={marche.statut_etablissement} />
        </td>
      </tr>
      {ouvert && (
        <tr className="border-b border-gray-100 bg-red-50/40">
          <td colSpan={COLONNES.length + 2} className="px-6 py-4">
            <DetailPaiements
              marche={marche}
              paiements={paiements}
              peutSaisirPaiement={peutSaisirPaiement}
              userId={userId}
              surPaiementAjoute={surPaiementAjoute}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function FormulairePaiement({
  marcheId,
  userId,
  paiement,
  surAnnulation,
  surSauvegarde,
}: {
  marcheId: string;
  userId: string;
  paiement?: Paiement;
  surAnnulation: () => void;
  surSauvegarde: () => void;
}) {
  const [date, setDate] = useState(
    paiement?.date_paiement ?? new Date().toISOString().slice(0, 10)
  );
  const [montant, setMontant] = useState(paiement?.montant?.toString() ?? "");
  const [libelle, setLibelle] = useState(paiement?.libelle ?? "");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const modeEdition = !!paiement;

  async function sauvegarder(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      const supabase = createClient();
      if (modeEdition && paiement) {
        const { error } = await supabase
          .from("chantierci_paiements")
          .update({ date_paiement: date, montant: Number(montant), libelle: libelle.trim() })
          .eq("id", paiement.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("chantierci_paiements").insert({
          marche_id: marcheId,
          date_paiement: date,
          montant: Number(montant),
          libelle: libelle.trim(),
          saisi_par: userId,
        });
        if (error) throw new Error(error.message);
      }
      surSauvegarde();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form
      onSubmit={sauvegarder}
      className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
    >
      <div>
        <label className="mb-1 block text-xs font-medium">Date</label>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Montant (XOF)</label>
        <input
          type="number"
          required
          min={1}
          step={1}
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
          placeholder="15 000 000"
          className="w-40 rounded-lg border border-gray-300 px-2 py-2 text-sm"
        />
      </div>
      <div className="min-w-48 flex-1">
        <label className="mb-1 block text-xs font-medium">Libellé</label>
        <input
          type="text"
          required
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
          placeholder="Décompte n°2"
          className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={enCours}
        className="inline-flex items-center gap-1.5 rounded-lg bg-assemblage px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {enCours && <Loader2 className="h-4 w-4 animate-spin" />}
        {modeEdition ? "Mettre à jour" : "Enregistrer"}
      </button>
      <button
        type="button"
        onClick={surAnnulation}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium"
      >
        Annuler
      </button>
      {erreur && <p className="w-full text-sm text-red-700">{erreur}</p>}
    </form>
  );
}

function DetailPaiements({
  marche,
  paiements,
  peutSaisirPaiement,
  userId,
  surPaiementAjoute,
}: {
  marche: Marche;
  paiements: Paiement[] | null;
  peutSaisirPaiement: boolean;
  userId: string;
  surPaiementAjoute: () => void;
}) {
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [paiementEdite, setPaiementEdite] = useState<Paiement | null>(null);
  const [suppressionId, setSuppressionId] = useState<string | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  async function supprimer(id: string) {
    setSuppressionEnCours(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("chantierci_paiements").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setSuppressionId(null);
      surPaiementAjoute();
    } finally {
      setSuppressionEnCours(false);
    }
  }

  if (paiements === null) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement des paiements…
      </span>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">
          Paiements ({paiements.length}) — {marche.numero_marche}
        </p>
        {peutSaisirPaiement && !formulaireOuvert && !paiementEdite && (
          <button
            onClick={() => setFormulaireOuvert(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-assemblage px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
          >
            <Plus className="h-4 w-4" /> Ajouter un paiement
          </button>
        )}
      </div>

      {formulaireOuvert && marche.id && (
        <FormulairePaiement
          marcheId={marche.id}
          userId={userId}
          surAnnulation={() => setFormulaireOuvert(false)}
          surSauvegarde={() => {
            setFormulaireOuvert(false);
            surPaiementAjoute();
          }}
        />
      )}

      {paiementEdite && marche.id && (
        <FormulairePaiement
          marcheId={marche.id}
          userId={userId}
          paiement={paiementEdite}
          surAnnulation={() => setPaiementEdite(null)}
          surSauvegarde={() => {
            setPaiementEdite(null);
            surPaiementAjoute();
          }}
        />
      )}

      {/* Confirmation de suppression */}
      {suppressionId && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
          <span className="flex-1 text-red-800">Supprimer ce paiement définitivement ?</span>
          <button
            onClick={() => supprimer(suppressionId)}
            disabled={suppressionEnCours}
            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {suppressionEnCours && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Supprimer
          </button>
          <button
            onClick={() => setSuppressionId(null)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium"
          >
            Annuler
          </button>
        </div>
      )}

      {paiements.length > 0 ? (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left uppercase tracking-wide text-gray-500">
              <th className="py-1 pr-3 font-medium">Date</th>
              <th className="py-1 pr-3 font-medium">Libellé</th>
              <th className="py-1 pr-3 text-right font-medium">Montant</th>
              {peutSaisirPaiement && <th className="py-1 font-medium" />}
            </tr>
          </thead>
          <tbody>
            {paiements.map((p) => (
              <tr key={p.id} className="border-t border-red-100">
                <td className="py-1.5 pr-3 whitespace-nowrap">{formatDate(p.date_paiement)}</td>
                <td className="py-1.5 pr-3">{p.libelle}</td>
                <td className="py-1.5 pr-3 text-right font-semibold whitespace-nowrap">
                  {formatXOF(p.montant)}
                </td>
                {peutSaisirPaiement && (
                  <td className="py-1.5 pl-2 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setFormulaireOuvert(false);
                          setSuppressionId(null);
                          setPaiementEdite(p);
                        }}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        title="Modifier"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setPaiementEdite(null);
                          setFormulaireOuvert(false);
                          setSuppressionId(p.id ?? null);
                        }}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-gray-500">Aucun paiement enregistré.</p>
      )}
    </div>
  );
}
