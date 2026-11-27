import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { exigerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chargerReferentielCalcul } from "@/lib/formulaires/chargement";
import {
  dansPerimetre,
  lireParametres,
  type FormulairePeriode,
  type RapportMoe,
  type SiteRapport,
} from "@/lib/export/rapport";
import { RapportExport } from "@/components/export/RapportExport";
import { BoutonImprimer } from "@/components/export/BoutonImprimer";
import { MARQUE } from "@/theme/marque";

export const metadata = { title: `Rapport — ${MARQUE.titreNavigateur}` };

/** Lit toutes les lignes d'une requête, par pages de 1 000 (limite de l'API). */
async function paginer<T>(construire: (de: number, a: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const lignes: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await construire(de, de + 999);
    if (error) throw error;
    lignes.push(...(data ?? []));
    if (!data || data.length < 1000) return lignes;
  }
}

/** Par paquets de sites (adresse de requête raisonnable), ou sans filtre pour tout le programme. */
async function parSites<T>(ids: string[] | null, lire: (ids: string[] | null) => Promise<T[]>): Promise<T[]> {
  if (!ids) return lire(null);
  const lignes: T[] = [];
  for (let i = 0; i < ids.length; i += 120) lignes.push(...(await lire(ids.slice(i, i + 120))));
  return lignes;
}

/** Aperçu imprimable du rapport (Imprimer → Enregistrer au format PDF). */
export default async function PageRapport({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await exigerRole(["ug", "admin"]);
  const p = lireParametres(searchParams);
  const supabase = createClient();
  const [{ data: etats }, { data: lots }, { data: params }, referentiel] = await Promise.all([
    supabase
      .from("chantierci_v_etat_sites")
      .select("id, code, nom, region, departement, lot_id, lot_moe_id, electricite, type_latrines, montant")
      .order("code")
      .range(0, 999),
    supabase.from("chantierci_lots").select("id, nom, entreprise:chantierci_entreprises(nom)").order("id"),
    supabase.from("chantierci_parametres").select("cle, valeur"),
    chargerReferentielCalcul(supabase),
  ]);
  const lotParId = new Map((lots ?? []).map((l) => [l.id, l]));
  const tous: SiteRapport[] = (etats ?? []).map((s) => ({
    id: s.id,
    code: s.code,
    nom: s.nom,
    region: s.region,
    departement: s.departement,
    lot_id: s.lot_id,
    lot_nom: lotParId.get(s.lot_id)?.nom ?? "",
    entreprise: lotParId.get(s.lot_id)?.entreprise?.nom ?? "",
    lot_moe_id: s.lot_moe_id,
    electricite: s.electricite,
    type_latrines: s.type_latrines,
    montant: s.montant ? Number(s.montant) : 1,
  }));
  const sites = tous.filter((s) => dansPerimetre(s, p));
  const ids = p.perimetre === "tout" ? null : sites.map((s) => s.id);

  const [rapportsMoe, formulaires] = await Promise.all([
    p.sources.includes("moe")
      ? parSites(ids, (lot) =>
          paginer<RapportMoe>((de, a) => {
            let q = supabase
              .from("chantierci_visites")
              .select("site_id, date_visite, created_at, statut, avancement, postes")
              .eq("source", "moe")
              .lte("date_visite", p.au);
            if (lot) q = q.in("site_id", lot);
            return q.order("date_visite").order("created_at").range(de, a);
          })
        )
      : Promise.resolve([] as RapportMoe[]),
    parSites(ids, (lot) =>
      paginer<FormulairePeriode>((de, a) => {
        let q = supabase
          .from("chantierci_visites")
          .select("site_id, source, date_visite, statut, avancement, reponses")
          .in("source", p.sources)
          .gte("date_visite", p.du)
          .lte("date_visite", p.au);
        if (lot) q = q.in("site_id", lot);
        return q.order("date_visite").range(de, a);
      })
    ),
  ]);

  const seuilEcart = Number((params ?? []).find((x) => x.cle === "seuil_ecart_ug_moe")?.valeur ?? 5);

  return (
    <div className="mx-auto max-w-[1100px] p-4 lg:p-6 print:max-w-none print:p-0">
      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <Link href={`/export?${new URLSearchParams(Object.entries(searchParams).filter((e): e is [string, string] => !!e[1]))}`} className="bouton-secondaire inline-flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Modifier les paramètres
        </Link>
        <BoutonImprimer />
        <p className="text-xs text-texte-2">
          Dans la fenêtre d&apos;impression, choisissez « Enregistrer au format PDF » comme imprimante.
        </p>
      </div>
      <RapportExport
        parametres={p}
        sites={sites}
        rapportsMoe={rapportsMoe}
        formulaires={formulaires}
        postes={referentiel.postes}
        corps={referentiel.corps}
        seuilEcart={seuilEcart}
      />
    </div>
  );
}
