"use client";

import imageCompression from "browser-image-compression";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

import { BUCKET_PHOTOS_SERVEUR } from "./constantes";
import { lireExif } from "./exif";

/** Photo prise sur place (appareil photo) ou choisie dans la galerie du téléphone. */
export type OriginePhoto = "camera" | "galerie";

export const BUCKET_PHOTOS = BUCKET_PHOTOS_SERVEUR;

/** Photo prise pendant la saisie, pas encore envoyée. */
export type PhotoLocale = {
  id: string;
  blob: Blob;
  apercu: string;
  latitude: number | null;
  longitude: number | null;
  prise_le: string;
  legende: string;
};

/** Photo déjà enregistrée. */
export type PhotoExistante = {
  id: string;
  chemin: string;
  url: string | null;
  legende: string;
  latitude: number | null;
  longitude: number | null;
  prise_le: string | null;
};

function position(): Promise<GeolocationPosition | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 60_000,
    })
  );
}

/** Compresse la photo (< 500 Ko, 1600 px) et relève la position GPS. */
export async function preparerPhoto(fichier: File, origine: OriginePhoto = "camera"): Promise<PhotoLocale> {
  const compression = imageCompression(fichier, {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: "image/jpeg",
  });
  if (origine === "galerie") {
    // Photo déjà prise : sa position et sa date sont celles enregistrées dans
    // la photo (EXIF), pas celles du téléphone au moment de l'envoi.
    const [blob, exif] = await Promise.all([compression, lireExif(fichier)]);
    return {
      id: crypto.randomUUID(),
      blob,
      apercu: URL.createObjectURL(blob),
      latitude: exif?.latitude ?? null,
      longitude: exif?.longitude ?? null,
      prise_le: exif?.date ?? new Date(fichier.lastModified || Date.now()).toISOString(),
      legende: "",
    };
  }
  const [blob, pos] = await Promise.all([compression, position()]);
  return {
    id: crypto.randomUUID(),
    blob,
    apercu: URL.createObjectURL(blob),
    latitude: pos?.coords.latitude ?? null,
    longitude: pos?.coords.longitude ?? null,
    prise_le: new Date().toISOString(),
    legende: "",
  };
}

/** Envoie les nouvelles photos d'une visite (fichier + ligne en base). */
export async function envoyerPhotos(
  supabase: SupabaseClient<Database>,
  visiteId: string,
  photos: PhotoLocale[]
): Promise<string[]> {
  const erreurs: string[] = [];
  for (const p of photos) {
    const chemin = `${visiteId}/${p.id}.jpg`;
    const { error: e1 } = await supabase.storage
      .from(BUCKET_PHOTOS)
      .upload(chemin, p.blob, { contentType: "image/jpeg", upsert: false });
    if (e1) {
      erreurs.push(`Photo non envoyée : ${e1.message}`);
      continue;
    }
    const { error: e2 } = await supabase.from("chantierci_photos").insert({
      id: p.id,
      visite_id: visiteId,
      chemin,
      legende: p.legende,
      latitude: p.latitude,
      longitude: p.longitude,
      prise_le: p.prise_le,
    });
    if (e2) erreurs.push(`Photo non enregistrée : ${e2.message}`);
  }
  return erreurs;
}

export async function supprimerPhoto(supabase: SupabaseClient<Database>, photo: PhotoExistante) {
  await supabase.storage.from(BUCKET_PHOTOS).remove([photo.chemin]);
  await supabase.from("chantierci_photos").delete().eq("id", photo.id);
}
