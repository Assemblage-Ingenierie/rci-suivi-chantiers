import { exigerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { GaleriePhotos, type PhotoGalerie, type SiteGalerie } from "@/components/photos/GaleriePhotos";
import { MARQUE } from "@/theme/marque";
import type { SourceFormulaire } from "@/lib/formulaires/types";

export const metadata = { title: `Photos — ${MARQUE.titreNavigateur}` };

const estDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Photos des formulaires (UG, admin) : une ligne par site, ses photos de la
 * période par ordre chronologique. Seules les informations des photos sont
 * chargées ici ; les images le sont par le navigateur, ligne par ligne.
 */
export default async function PagePhotos({ searchParams }: { searchParams: { du?: string; au?: string } }) {
  await exigerRole(["ug", "admin"]);
  const aujourdhui = new Date();
  const debutParDefaut = new Date(aujourdhui);
  debutParDefaut.setDate(debutParDefaut.getDate() - 90);
  let du = estDate(searchParams.du) ? searchParams.du! : iso(debutParDefaut);
  let au = estDate(searchParams.au) ? searchParams.au! : iso(aujourdhui);
  if (du > au) [du, au] = [au, du];

  const supabase = createClient();
  const [{ data: sites }, { data: lots }] = await Promise.all([
    supabase
      .from("chantierci_sites")
      .select("id, code, nom, region, departement, localite, lot_id, lot_moe_id, a_verifier")
      .eq("actif", true)
      .order("code")
      .range(0, 999),
    supabase.from("chantierci_lots").select("id, nom, entreprise:chantierci_entreprises(nom)").order("id"),
  ]);

  // Photos de la période (date de la visite), par pages de 1 000.
  const photos: PhotoGalerie[] = [];
  for (let de = 0; ; de += 1000) {
    const { data } = await supabase
      .from("chantierci_photos")
      .select("id, chemin, legende, latitude, longitude, prise_le, visite:chantierci_visites!inner(id, site_id, source, date_visite)")
      .gte("visite.date_visite", du)
      .lte("visite.date_visite", au)
      .order("created_at")
      .range(de, de + 999);
    for (const p of data ?? []) {
      const v = p.visite as unknown as { id: string; site_id: string; source: SourceFormulaire; date_visite: string } | null;
      if (!v) continue;
      photos.push({
        id: p.id,
        chemin: p.chemin,
        legende: p.legende,
        latitude: p.latitude,
        longitude: p.longitude,
        prise_le: p.prise_le,
        site_id: v.site_id,
        visite_id: v.id,
        source: v.source,
        date: v.date_visite,
      });
    }
    if (!data || data.length < 1000) break;
  }

  const entreprise = new Map((lots ?? []).map((l) => [l.id, l.entreprise?.nom ?? ""]));
  const sitesGalerie: SiteGalerie[] = (sites ?? []).map((s) => ({ ...s, entreprise: entreprise.get(s.lot_id) ?? "" }));

  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-2xl font-bold">Photos</h1>
      <p className="mb-6 text-sm text-texte-2">
        Photos des formulaires MOE, CSTC et UG, une ligne par site, de la plus ancienne à la plus récente. Cliquez sur une
        photo pour l&apos;agrandir.
      </p>
      <GaleriePhotos
        sites={sitesGalerie}
        lots={(lots ?? []).map((l) => ({ id: l.id, nom: l.nom }))}
        photos={photos}
        periode={{ du, au }}
      />
    </div>
  );
}
