import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { BUCKET_PHOTOS_SERVEUR } from "./constantes";
import type { CorpsEtat, Parametres, PosteDef } from "./types";

type Client = SupabaseClient<Database>;

/**
 * Postes d'avancement (montants du DQE), corps d'état et paramètres de calcul
 * (lus en base, réglables par l'admin).
 */
export async function chargerReferentielCalcul(
  supabase: Client
): Promise<{ postes: PosteDef[]; parametres: Parametres; corps: CorpsEtat[] }> {
  const [{ data: postes, error }, { data: params }, { data: corps }] = await Promise.all([
    supabase
      .from("chantierci_postes")
      .select("ouvrage, code, libelle, poids, poids_sans_electricite, corps_etat, ordre")
      .order("ordre"),
    supabase.from("chantierci_parametres").select("cle, valeur"),
    supabase.from("chantierci_corps_etat").select("code, libelle, ordre").order("ordre"),
  ]);
  // Base pas encore migrée (20261202100000) : colonnes d'avant la pondération DQE.
  const lignes: PosteDef[] = error
    ? ((await supabase.from("chantierci_postes").select("ouvrage, code, libelle, poids, ordre").order("ordre")).data ?? [])
    : (postes ?? []);
  return {
    postes: lignes.map((p) => ({
      ...p,
      poids: Number(p.poids),
      poids_sans_electricite:
        p.poids_sans_electricite === null || p.poids_sans_electricite === undefined ? null : Number(p.poids_sans_electricite),
    })),
    parametres: Object.fromEntries((params ?? []).map((p) => [p.cle, Number(p.valeur)])),
    corps: corps ?? [],
  };
}

/** Site (visible par l'utilisateur, RLS) avec son lot. */
export async function chargerSite(supabase: Client, code: string) {
  const { data } = await supabase
    .from("chantierci_sites")
    .select(
      "id, code, nom, region, departement, localite, electricite, type_latrines, lot_id, lot_moe_id, lot:chantierci_lots(nom, entreprise:chantierci_entreprises(nom))"
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
