import { redirect } from "next/navigation";
import { getUtilisateurEtProfil } from "@/lib/auth";
import { AppAdmin } from "@/components/admin/AppAdmin";

export const metadata = { title: "Administration — Suivi chantiers MEN CI" };

/** Interface admin (CDC §5.6) — rôle admin uniquement. */
export default async function PageAdministration() {
  const { user, profil } = await getUtilisateurEtProfil();
  if (!user || !profil) redirect("/");
  if (profil.role !== "admin") redirect("/");

  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-2xl font-bold">Administration</h1>
      <p className="mb-6 text-sm text-gray-500">
        Validation des comptes, attribution des lots, import des établissements
      </p>
      <AppAdmin adminId={user.id} />
    </div>
  );
}
