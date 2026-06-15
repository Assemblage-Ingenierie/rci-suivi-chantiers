import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getUtilisateurEtProfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FormulaireEtablissement } from "@/components/admin/FormulaireEtablissement";

export const metadata = {
  title: "Nouvel établissement — Suivi chantiers MEN CI",
};

/** Création d'une fiche établissement (CDC §5.6) — admin uniquement. */
export default async function PageNouvelEtablissement() {
  const { profil } = await getUtilisateurEtProfil();
  if (!profil) redirect("/");
  if (profil.role !== "admin") redirect("/suivi");

  const supabase = createClient();
  const { data: lots } = await supabase
    .from("chantierci_lots")
    .select("*")
    .order("nom")
    .range(0, 99);

  return (
    <div className="mx-auto max-w-3xl p-4 lg:p-8">
      <Link
        href="/suivi"
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Tableau de suivi
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Nouvel établissement</h1>
      <FormulaireEtablissement lots={lots ?? []} />
    </div>
  );
}
