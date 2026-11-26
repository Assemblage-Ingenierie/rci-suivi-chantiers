import { exigerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LIBELLES_ROLES, type RoleUtilisateur } from "@/lib/constants";
import { EnPreparation } from "@/components/EnPreparation";
import { MARQUE } from "@/theme/marque";

export const metadata = { title: `Administration — ${MARQUE.titreNavigateur}` };

/** Administration. Étape 1 : vue des comptes ; gestion complète à l'étape 3. */
export default async function PageAdministration() {
  await exigerRole(["admin"]);
  const supabase = createClient();
  const { data: profils } = await supabase
    .from("chantierci_profiles")
    .select("id, nom_complet, email, identifiant, role, statut_compte, lot_moe_id")
    .order("created_at", { ascending: false })
    .range(0, 499);
  const liste = profils ?? [];
  const enAttente = liste.filter((p) => p.statut_compte === "en_attente");

  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-2xl font-bold">Administration</h1>
      <p className="mb-6 text-sm text-texte-2">
        {liste.length} compte{liste.length > 1 ? "s" : ""} · {enAttente.length} en attente de validation
      </p>

      <div className="carte mb-6 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-bordure bg-surface-2 text-xs uppercase tracking-wide text-texte-2">
            <tr>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Connexion</th>
              <th className="px-3 py-2">Rôle</th>
              <th className="px-3 py-2">Lot MOE</th>
              <th className="px-3 py-2">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bordure">
            {liste.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2 font-semibold">{p.nom_complet || "—"}</td>
                <td className="px-3 py-2">{p.identifiant ?? p.email}</td>
                <td className="px-3 py-2">{LIBELLES_ROLES[p.role as RoleUtilisateur]}</td>
                <td className="px-3 py-2">{p.lot_moe_id ?? "—"}</td>
                <td className="px-3 py-2">
                  <span
                    className={`whitespace-nowrap rounded-champ px-2 py-0.5 text-xs font-semibold ${
                      p.statut_compte === "actif"
                        ? "bg-succes-clair text-succes"
                        : p.statut_compte === "en_attente"
                          ? "bg-alerte-clair text-alerte"
                          : "bg-danger-clair text-danger"
                    }`}
                  >
                    {p.statut_compte === "actif" ? "Actif" : p.statut_compte === "en_attente" ? "En attente" : "Suspendu"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EnPreparation titre="Gestion des comptes, des affectations et des poids : étape 3 de la refonte">
        Validation des demandes d&apos;accès, création des comptes CSTC (identifiant + PIN),
        affectation des sites, édition de la liste des sites, poids des lots et des corps d&apos;état.
      </EnPreparation>
    </div>
  );
}
