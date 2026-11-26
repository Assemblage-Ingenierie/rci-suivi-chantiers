import { redirect } from "next/navigation";
import { exigerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EnPreparation } from "@/components/EnPreparation";
import { MARQUE } from "@/theme/marque";

export const metadata = { title: `Mon site — ${MARQUE.titreNavigateur}` };

/** Accueil CSTC : ouvre directement la fiche de son site (la RLS ne renvoie que son affectation). */
export default async function PageCstc() {
  await exigerRole(["cstc"]);
  const { data: site } = await createClient().from("chantierci_sites").select("code").limit(1).maybeSingle();
  if (site) redirect(`/site/${site.code}`);

  return (
    <div className="p-4">
      <EnPreparation titre="Aucun site ne vous est encore attribué">
        Contactez l&apos;équipe du projet pour qu&apos;elle vous rattache à votre école.
      </EnPreparation>
    </div>
  );
}
