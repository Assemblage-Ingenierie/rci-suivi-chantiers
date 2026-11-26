import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { BUCKET_PHOTOS_SERVEUR } from "./constantes";
import type { Parametres, PosteDef } from "./types";

type Client = SupabaseClient<Database>;

/** Postes d'avancement et paramètres de calcul (lus en base, réglables par l'admin). */
export async function chargerReferentielCalcul(supabase: Client): Promise<{ postes: PosteDef[]; parametres: Parametres }> {
  const [{ data: postes }, { data: params }] = await Promise.all([
    supabase.from("chantierci_postes").select("ouvrage, code, libelle, poids, ordre").order("ordre"),
    supabase.from("chantierci_parametres").select("cle, valeur"),
  ]);
  return {
    postes: (postes ?? []).map((p) => ({ ...p, poids: Number(p.poids) })),
    parametres: Object.fromEntries((params ?? []).map((p) => [p.cle, Number(p.valeur)])),
  };
}

/** Site (visible par l'utilisateur, RLS) avec son lot. */
export async function chargerSite(supabase: Client, code: string) {
  const { data } = await supabase
    .from("chantierci_sites")
    .select(
      "id, code, nom, region, departement, localite, electricite, type_latrines, lot_id, lot_moe_id, lot:chantierci_lots(nom, entreprise_titulaire)"
    )
    .eq("code", code)
    .maybeSingle();
  return data;
}

/** URLs signées (1 h) des photos d'une visite. */
export async function chargerPhotos(supabase: Client, visiteId: string) {
  const { data: photos } = await supabase
    .from("chantierci_photos")
    .select("id, chemin, legende, latitude, longitude, prise_le")
    .eq("visite_id", visiteId)
    .order("created_at");
  if (!photos?.length) return [];
  const { data: urls } = await supabase.storage
    .from(BUCKET_PHOTOS_SERVEUR)
    .createSignedUrls(photos.map((p) => p.chemin), 3600);
  return photos.map((p) => ({ ...p, url: urls?.find((u) => u.path === p.chemin)?.signedUrl ?? null }));
}
