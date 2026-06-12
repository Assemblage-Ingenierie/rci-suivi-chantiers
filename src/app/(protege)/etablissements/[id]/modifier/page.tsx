import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getUtilisateurEtProfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FormulaireEtablissement } from "@/components/admin/FormulaireEtablissement";

export const metadata = {
  title: "Modifier l'établissement — Suivi chantiers MEN CI",
};

/** Modification d'une fiche établissement (CDC §5.6) — admin uniquement. */
export default async function PageModifierEtablissement({
  params,
}: {
  params: { id: string };
}) {
  const { profil } = await getUtilisateurEtProfil();
  if (!profil) redirect("/");
  if (profil.role !== "admin") redirect(`/etablissements/${params.id}`);

  const supabase = createClient();
  const [{ data: etablissement }, { data: lots }] = await Promise.all([
    supabase
      .from("chantierci_etablissements")
      .select("*")
      .eq("id", params.id)
      .maybeSingle(),
    supabase.from("chantierci_lots").select("*").order("nom").range(0, 99),
  ]);
  if (!etablissement) notFound();

  return (
    <div className="mx-auto max-w-3xl p-4 lg:p-8">
      <Link
        href={`/etablissements/${params.id}`}
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Fiche établissement
      </Link>
      <h1 className="mb-6 text-2xl font-bold">
        Modifier — {etablissement.nom}
      </h1>
      <FormulaireEtablissement
        etablissement={etablissement}
        lots={lots ?? []}
      />
    </div>
  );
}
