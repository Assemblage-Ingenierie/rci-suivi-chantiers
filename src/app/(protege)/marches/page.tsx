import { redirect } from "next/navigation";
import { getUtilisateurEtProfil } from "@/lib/auth";
import { TableauMarches } from "@/components/men/TableauMarches";

export const metadata = {
  title: "Marchés de travaux — Suivi chantiers MEN CI",
};

/** Vue Marchés (CDC §5.3) — saisie des paiements : national + admin. */
export default async function PageMarches() {
  const { user, profil } = await getUtilisateurEtProfil();
  if (!user || !profil) redirect("/");
  if (profil.role === "coges") redirect("/coges");

  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-2xl font-bold">Marchés de travaux</h1>
      <p className="mb-6 text-sm text-gray-500">
        Suivi financier des marchés — dépliez une ligne pour voir ou saisir les
        paiements
      </p>
      <TableauMarches
        peutSaisirPaiement={profil.role === "national" || profil.role === "admin"}
        userId={user.id}
      />
    </div>
  );
}
