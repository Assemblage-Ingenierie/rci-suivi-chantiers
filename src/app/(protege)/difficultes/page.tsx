import { exigerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dateLongue, type EtatSite } from "@/lib/tableau-de-bord/calculs";
import { TYPES_DIFFICULTE, type TypeDifficulte } from "@/lib/tableau-de-bord/difficultes";
import { ListeDifficultes, type DernierCommentaire } from "@/components/difficultes/ListeDifficultes";
import { EnPreparation } from "@/components/EnPreparation";
import { MARQUE } from "@/theme/marque";

export const metadata = { title: `Difficultés — ${MARQUE.titreNavigateur}` };

const entier = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : null);

/** Détail des difficultés par site (UG, admin). */
export default async function PageDifficultes({
  searchParams,
}: {
  searchParams: { type?: string; lot_moe?: string; lot?: string };
}) {
  await exigerRole(["ug", "admin"]);
  const supabase = createClient();
  const [{ data: sites, error }, { data: lots }, { data: lotsMoe }, { data: commentaires }] = await Promise.all([
    supabase.from("chantierci_v_etat_sites").select("*").order("code").range(0, 999),
    supabase.from("chantierci_lots").select("id, nom").order("id"),
    supabase.from("chantierci_lots_moe").select("id, nom, regions").order("id"),
    supabase
      .from("chantierci_commentaires")
      .select("site_id, texte, auteur_nom, created_at")
      .order("created_at", { ascending: false })
      .range(0, 1999),
  ]);
  const type = TYPES_DIFFICULTE.some((t) => t.cle === searchParams.type) ? (searchParams.type as TypeDifficulte) : null;

  return (
    <div className="mx-auto max-w-[1400px] p-4 lg:p-6">
      <div className="mb-3">
        <h1 className="text-2xl font-bold">Difficultés par site</h1>
        <p className="text-sm text-texte-2">
          Situation au {dateLongue(new Date().toISOString().slice(0, 10))}, d&apos;après le dernier rapport MOE, la dernière
          fiche UG et le dernier signalement CSTC de chaque site.
        </p>
      </div>
      {error || (sites?.length && !("moe_reponses" in sites[0])) ? (
        <EnPreparation titre="L'onglet Difficultés n'est pas encore installé dans la base">
          Exécuter dans le SQL Editor de Supabase la migration{" "}
          <code>supabase/migrations/20261127100000_tableau_de_bord_v2.sql</code>.
        </EnPreparation>
      ) : (
        <ListeDifficultes
          sites={(sites ?? []) as EtatSite[]}
          lots={lots ?? []}
          lotsMoe={lotsMoe ?? []}
          commentaires={(commentaires ?? []) as DernierCommentaire[]}
          initial={{ type, lotMoe: entier(searchParams.lot_moe), lot: entier(searchParams.lot) }}
        />
      )}
    </div>
  );
}
