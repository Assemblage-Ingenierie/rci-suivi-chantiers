/**
 * Enregistrement des visites (online direct ou file d'attente offline) et
 * vidage de la file vers Supabase.
 *
 * Idempotence : l'id de visite est généré côté client à la saisie. Si la
 * synchro est interrompue puis relancée, l'insert en doublon est détecté
 * (code Postgres 23505) et l'entrée est simplement retirée de la file.
 */
import { createClient } from "@/lib/supabase/client";
import {
  ajouterVisiteLocale,
  compterEnAttente,
  emettreChangementFile,
  getDB,
  mettreAJourVisiteEnFile,
  mettreEnFilePhoto,
  mettreEnFileVisite,
  type PhotoEnAttente,
  type VisiteInsert,
} from "./db";

export const BUCKET_PHOTOS = "chantierci-photos-visites";
const CODE_DOUBLON = "23505";

export interface PhotoASauver {
  blob: Blob;
  nom_fichier: string;
}

export interface ResultatSync {
  visites: number;
  photos: number;
  erreurs: string[];
}

function estErreurReseau(e: unknown): boolean {
  return e instanceof TypeError || (e instanceof Error && e.message.includes("fetch"));
}

/**
 * Enregistre une visite + ses photos. En ligne : envoi direct ; hors ligne
 * (ou en cas d'échec réseau) : mise en file d'attente locale.
 * Retourne le mode utilisé pour informer l'utilisateur.
 */
export async function enregistrerVisite(
  visite: Omit<VisiteInsert, "id">,
  photos: PhotoASauver[]
): Promise<{ mode: "direct" | "file_attente"; visiteId: string }> {
  const visiteId = crypto.randomUUID();
  const complete: VisiteInsert = { ...visite, id: visiteId, sync_status: "synced" };

  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      await envoyerVisite(complete);
      for (const photo of photos) {
        await envoyerPhoto({
          id: crypto.randomUUID(),
          visite_id: visiteId,
          nom_fichier: photo.nom_fichier,
          type_mime: photo.blob.type || "image/jpeg",
          blob: photo.blob,
          taille_ko: Math.round(photo.blob.size / 1024),
          creee_le: new Date().toISOString(),
        });
      }
      return { mode: "direct", visiteId };
    } catch (e) {
      if (!estErreurReseau(e)) throw e;
      // Réseau perdu en cours de route : bascule en file d'attente.
    }
  }

  await mettreEnFileVisite({
    id: visiteId,
    visite: complete,
    creee_le: new Date().toISOString(),
  });
  for (const photo of photos) {
    await mettreEnFilePhoto({
      id: crypto.randomUUID(),
      visite_id: visiteId,
      nom_fichier: photo.nom_fichier,
      type_mime: photo.blob.type || "image/jpeg",
      blob: photo.blob,
      taille_ko: Math.round(photo.blob.size / 1024),
      creee_le: new Date().toISOString(),
    });
  }
  await demanderBackgroundSync();
  return { mode: "file_attente", visiteId };
}

async function envoyerVisite(visite: VisiteInsert) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chantierci_visites")
    .insert(visite)
    .select()
    .single();
  if (error) {
    if (error.code === CODE_DOUBLON) return; // déjà synchronisée
    throw new Error(error.message);
  }
  if (data) await ajouterVisiteLocale(data);
}

async function envoyerPhoto(photo: PhotoEnAttente) {
  const supabase = createClient();
  // Convention RLS Storage : {visite_id}/{nom_fichier}
  const chemin = `${photo.visite_id}/${photo.id}_${photo.nom_fichier}`;
  const { error: erreurUpload } = await supabase.storage
    .from(BUCKET_PHOTOS)
    .upload(chemin, photo.blob, { contentType: photo.type_mime, upsert: true });
  if (erreurUpload && !erreurUpload.message.includes("already exists")) {
    throw new Error(erreurUpload.message);
  }
  const { error } = await supabase.from("chantierci_photos_visites").insert({
    visite_id: photo.visite_id,
    storage_path: chemin,
    taille_ko: photo.taille_ko,
    sync_status: "synced",
  });
  if (error && error.code !== CODE_DOUBLON) throw new Error(error.message);
}

let syncEnCours = false;

/**
 * Vide la file d'attente : visites d'abord, puis leurs photos.
 * Les entrées en erreur restent en file pour la prochaine tentative.
 */
export async function synchroniser(): Promise<ResultatSync> {
  const resultat: ResultatSync = { visites: 0, photos: 0, erreurs: [] };
  if (syncEnCours) return resultat;
  syncEnCours = true;
  try {
    const db = await getDB();

    const visitesEnAttente = await db.getAll("file_visites");
    for (const entree of visitesEnAttente) {
      try {
        await envoyerVisite(entree.visite);
        await db.delete("file_visites", entree.id);
        resultat.visites += 1;
        emettreChangementFile();
      } catch (e) {
        resultat.erreurs.push(
          `Visite ${entree.visite.date_visite} : ${e instanceof Error ? e.message : "erreur inconnue"}`
        );
      }
    }

    // Photos dont la visite est synchronisée (ou l'a toujours été).
    const visitesRestantes = new Set(
      (await db.getAll("file_visites")).map((v) => v.id)
    );
    const photosEnAttente = await db.getAll("file_photos");
    for (const photo of photosEnAttente) {
      if (visitesRestantes.has(photo.visite_id)) continue; // visite pas encore passée
      try {
        await envoyerPhoto(photo);
        await db.delete("file_photos", photo.id);
        resultat.photos += 1;
        emettreChangementFile();
      } catch (e) {
        resultat.erreurs.push(
          `Photo ${photo.nom_fichier} : ${e instanceof Error ? e.message : "erreur inconnue"}`
        );
      }
    }
  } finally {
    syncEnCours = false;
    emettreChangementFile();
  }
  return resultat;
}

/**
 * Background sync (bonus, Chrome Android) : demande au navigateur de
 * déclencher l'événement `sync` du Service Worker au retour du réseau.
 * Le SW notifie alors la page ouverte, qui appelle synchroniser().
 * Mécanisme de base (tous navigateurs, dont Safari iOS) : le bouton
 * "Synchroniser maintenant" + la synchro automatique sur l'événement online.
 */
export async function demanderBackgroundSync() {
  try {
    if ("serviceWorker" in navigator && "SyncManager" in window) {
      const enregistrement = await navigator.serviceWorker.ready;
      // @ts-expect-error — l'API Background Sync n'est pas dans lib.dom
      await enregistrement.sync.register("chantierci-sync");
    }
  } catch {
    // Non supporté ou refusé : le mécanisme manuel reste disponible.
  }
}

/**
 * Met à jour une visite existante.
 * - En attente (IndexedDB) : modifie l'entrée locale.
 * - Synchronisée : update Supabase + rafraîchit le cache local.
 */
export async function mettreAJourVisite(
  visiteId: string,
  champs: Partial<Omit<VisiteInsert, "id" | "etablissement_id" | "user_id" | "sync_status">>,
  enAttente: boolean
): Promise<void> {
  if (enAttente) {
    const db = await getDB();
    const entree = await db.get("file_visites", visiteId);
    if (!entree) return;
    await mettreAJourVisiteEnFile(visiteId, { ...entree.visite, ...champs });
    return;
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chantierci_visites")
    .update(champs)
    .eq("id", visiteId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  if (data) await ajouterVisiteLocale(data);
}

export { compterEnAttente };
