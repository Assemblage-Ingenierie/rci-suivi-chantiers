/**
 * Couche IndexedDB du mode offline (COGES) — base `chantierci-offline`.
 *
 * Stores :
 *  - etablissements : établissements du lot, pré-chargés (vue de synthèse)
 *  - visites        : historique des visites de ces établissements
 *  - file_visites   : visites saisies hors ligne, en attente d'envoi
 *  - file_photos    : photos associées, en attente d'envoi (Blob)
 *  - meta           : clés/valeurs (date de dernière synchro…)
 *
 * Les visites sont append-only : pas de conflit offline/online possible au
 * sens du CDC §2.2 (les fiches établissements ne sont pas éditables par les
 * COGES). L'id de la visite est généré CÔTÉ CLIENT (uuid) au moment de la
 * saisie : il devient l'id serveur à la synchro, ce qui rend l'envoi
 * idempotent (un doublon d'insert est détecté et ignoré).
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Tables, TablesInsert } from "@/lib/database.types";

export type EtablissementSuivi = Tables<"chantierci_v_etablissements_suivi">;
export type Visite = Tables<"chantierci_visites">;
export type VisiteInsert = TablesInsert<"chantierci_visites"> & { id: string };

export interface VisiteEnAttente {
  id: string; // uuid local = futur id serveur
  visite: VisiteInsert;
  creee_le: string;
}

export interface PhotoEnAttente {
  id: string; // uuid local
  visite_id: string;
  nom_fichier: string;
  type_mime: string;
  blob: Blob;
  taille_ko: number;
  creee_le: string;
}

interface SchemaOffline extends DBSchema {
  etablissements: { key: string; value: EtablissementSuivi };
  visites: {
    key: string;
    value: Visite;
    indexes: { par_etablissement: string };
  };
  file_visites: { key: string; value: VisiteEnAttente };
  file_photos: {
    key: string;
    value: PhotoEnAttente;
    indexes: { par_visite: string };
  };
  meta: { key: string; value: string };
}

/** Événement émis à chaque variation de la file d'attente (badge). */
export const EVENEMENT_FILE = "chantierci:file-attente";

/** Événement émis quand les données locales (établissements/visites) changent. */
export const EVENEMENT_DONNEES = "chantierci:donnees-locales";

export function emettreChangementFile() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENEMENT_FILE));
  }
}

export function emettreChangementDonnees() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENEMENT_DONNEES));
  }
}

let dbPromise: Promise<IDBPDatabase<SchemaOffline>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<SchemaOffline>("chantierci-offline", 1, {
      upgrade(db) {
        db.createObjectStore("etablissements", { keyPath: "id" });
        const visites = db.createObjectStore("visites", { keyPath: "id" });
        visites.createIndex("par_etablissement", "etablissement_id");
        db.createObjectStore("file_visites", { keyPath: "id" });
        const photos = db.createObjectStore("file_photos", { keyPath: "id" });
        photos.createIndex("par_visite", "visite_id");
        db.createObjectStore("meta");
      },
    });
  }
  return dbPromise;
}

// ---------------------------------------------------------------------------
// Lectures locales (consommées par l'interface COGES, étape 5)
// ---------------------------------------------------------------------------

export async function listerEtablissementsLocaux(): Promise<EtablissementSuivi[]> {
  const db = await getDB();
  const tous = await db.getAll("etablissements");
  return tous.sort((a, b) => (a.nom ?? "").localeCompare(b.nom ?? ""));
}

export async function getEtablissementLocal(id: string) {
  const db = await getDB();
  return db.get("etablissements", id);
}

export async function listerVisitesLocales(etablissementId: string) {
  const db = await getDB();
  const visites = await db.getAllFromIndex(
    "visites",
    "par_etablissement",
    etablissementId
  );
  return visites.sort((a, b) => b.date_visite.localeCompare(a.date_visite));
}

// ---------------------------------------------------------------------------
// Écritures locales (pré-chargement + file d'attente)
// ---------------------------------------------------------------------------

export async function remplacerEtablissementsLocaux(
  lignes: EtablissementSuivi[]
) {
  const db = await getDB();
  const tx = db.transaction("etablissements", "readwrite");
  await tx.store.clear();
  for (const ligne of lignes) {
    if (ligne.id) await tx.store.put(ligne);
  }
  await tx.done;
  emettreChangementDonnees();
}

export async function remplacerVisitesLocales(lignes: Visite[]) {
  const db = await getDB();
  const tx = db.transaction("visites", "readwrite");
  await tx.store.clear();
  for (const ligne of lignes) await tx.store.put(ligne);
  await tx.done;
  emettreChangementDonnees();
}

export async function ajouterVisiteLocale(visite: Visite) {
  const db = await getDB();
  await db.put("visites", visite);
  emettreChangementDonnees();
}

/** Visites en file d'attente (toutes, ou celles d'un établissement). */
export async function listerFileVisites(etablissementId?: string) {
  const db = await getDB();
  const toutes = await db.getAll("file_visites");
  return etablissementId
    ? toutes.filter((e) => e.visite.etablissement_id === etablissementId)
    : toutes;
}

export async function mettreEnFileVisite(entree: VisiteEnAttente) {
  const db = await getDB();
  await db.put("file_visites", entree);
  emettreChangementFile();
}

export async function mettreEnFilePhoto(entree: PhotoEnAttente) {
  const db = await getDB();
  await db.put("file_photos", entree);
  emettreChangementFile();
}

export async function compterEnAttente(): Promise<number> {
  const db = await getDB();
  const [v, p] = await Promise.all([
    db.count("file_visites"),
    db.count("file_photos"),
  ]);
  return v + p;
}

export async function setMeta(cle: string, valeur: string) {
  const db = await getDB();
  await db.put("meta", valeur, cle);
}

export async function getMeta(cle: string) {
  const db = await getDB();
  return db.get("meta", cle);
}
