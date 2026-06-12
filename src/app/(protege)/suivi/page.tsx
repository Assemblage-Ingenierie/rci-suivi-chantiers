import { redirect } from "next/navigation";
import { getUtilisateurEtProfil } from "@/lib/auth";
import { TableauSuivi } from "@/components/men/TableauSuivi";

export const metadata = {
  title: "Tableau de suivi — Suivi chantiers MEN CI",
};

/** Tableau de suivi des chantiers (CDC §5.3) — pagination serveur 20/page. */
export default async function PageSuivi() {
  const { profil } = await getUtilisateurEtProfil();
  if (!profil) redirect("/");
  if (profil.role === "coges") redirect("/coges");

  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-2xl font-bold">Tableau de suivi des chantiers</h1>
      <p className="mb-6 text-sm text-gray-500">
        Une ligne par établissement (dernière visite) — dépliez pour voir
        toutes les visites
      </p>
      <TableauSuivi />
    </div>
  );
}
