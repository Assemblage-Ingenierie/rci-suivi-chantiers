/**
 * Pré-chargement des données du lot dans IndexedDB (CDC §2.2) : exécuté à
 * l'ouverture de session quand le réseau est disponible, pour que la liste
 * des établissements et l'historique des visites restent consultables hors
 * ligne. La RLS limite automatiquement aux lots de l'utilisateur.
 */
import { createClient } from "@/lib/supabase/client";
import {
  remplacerEtablissementsLocaux,
  remplacerVisitesLocales,
  setMeta,
  type EtablissementSuivi,
  type Visite,
} from "./db";

const TAILLE_LOT = 100;

export async function prechargerDonneesLot(): Promise<{
  etablissements: number;
  visites: number;
}> {
  const supabase = createClient();

  // Établissements (vue de synthèse), par pages — jamais de SELECT sans LIMIT.
  const etablissements: EtablissementSuivi[] = [];
  for (let depuis = 0; ; depuis += TAILLE_LOT) {
    const { data, error } = await supabase
      .from("chantierci_v_etablissements_suivi")
      .select("*")
      .order("nom")
      .range(depuis, depuis + TAILLE_LOT - 1);
    if (error) throw error;
    etablissements.push(...(data ?? []));
    if (!data || data.length < TAILLE_LOT) break;
  }

  // Historique des visites du périmètre (RLS), par pages.
  const visites: Visite[] = [];
  for (let depuis = 0; ; depuis += TAILLE_LOT) {
    const { data, error } = await supabase
      .from("chantierci_visites")
      .select("*")
      .order("date_visite", { ascending: false })
      .range(depuis, depuis + TAILLE_LOT - 1);
    if (error) throw error;
    visites.push(...(data ?? []));
    if (!data || data.length < TAILLE_LOT) break;
  }

  await remplacerEtablissementsLocaux(etablissements);
  await remplacerVisitesLocales(visites);
  await setMeta("derniere_synchro", new Date().toISOString());

  return { etablissements: etablissements.length, visites: visites.length };
}
