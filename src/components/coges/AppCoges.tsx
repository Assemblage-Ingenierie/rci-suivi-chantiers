"use client";

/**
 * Application COGES (mobile-first, 100 % offline) : une seule page Next
 * (/coges) avec trois vues internes pilotées par les paramètres d'URL
 * (?id=…&vue=…) via history.pushState — aucune navigation serveur, donc tout
 * le parcours (liste → fiche → formulaire) fonctionne hors ligne dès que la
 * page est en cache, y compris pour les fiches jamais ouvertes.
 *
 * Les données viennent d'IndexedDB (pré-chargées par FournisseurOffline) et
 * se rafraîchissent sur les événements EVENEMENT_DONNEES / EVENEMENT_FILE.
 */
import { useCallback, useEffect, useState } from "react";
import {
  EVENEMENT_DONNEES,
  EVENEMENT_FILE,
  listerEtablissementsLocaux,
  listerFileVisites,
  type EtablissementSuivi,
} from "@/lib/offline/db";
import { ListeEtablissements } from "./ListeEtablissements";
import { FicheEtablissement } from "./FicheEtablissement";
import { FormulaireVisite } from "./FormulaireVisite";

export type Vue =
  | { type: "liste" }
  | { type: "fiche"; id: string }
  | { type: "visite"; id: string };

function vueDepuisURL(): Vue {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (id && params.get("vue") === "visite") return { type: "visite", id };
  if (id) return { type: "fiche", id };
  return { type: "liste" };
}

function urlPourVue(vue: Vue): string {
  if (vue.type === "liste") return "/coges";
  if (vue.type === "fiche") return `/coges?id=${vue.id}`;
  return `/coges?id=${vue.id}&vue=visite`;
}

export function AppCoges({
  userId,
  nomComplet,
}: {
  userId: string;
  nomComplet: string;
}) {
  const [vue, setVue] = useState<Vue>({ type: "liste" });
  const [etablissements, setEtablissements] = useState<
    EtablissementSuivi[] | null
  >(null);
  const [idsAvecAttente, setIdsAvecAttente] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  // Synchronisation vue <-> URL (pushState, pas de navigation serveur).
  useEffect(() => {
    setVue(vueDepuisURL());
    const surRetour = () => setVue(vueDepuisURL());
    window.addEventListener("popstate", surRetour);
    return () => window.removeEventListener("popstate", surRetour);
  }, []);

  const naviguer = useCallback((cible: Vue) => {
    window.history.pushState(null, "", urlPourVue(cible));
    setVue(cible);
    window.scrollTo(0, 0);
  }, []);

  // Chargement des données locales + rafraîchissement sur événements.
  const recharger = useCallback(() => {
    listerEtablissementsLocaux().then(setEtablissements);
    listerFileVisites().then((file) =>
      setIdsAvecAttente(new Set(file.map((e) => e.visite.etablissement_id)))
    );
  }, []);

  useEffect(() => {
    recharger();
    window.addEventListener(EVENEMENT_DONNEES, recharger);
    window.addEventListener(EVENEMENT_FILE, recharger);
    return () => {
      window.removeEventListener(EVENEMENT_DONNEES, recharger);
      window.removeEventListener(EVENEMENT_FILE, recharger);
    };
  }, [recharger]);

  const etablissementCourant =
    vue.type !== "liste"
      ? (etablissements ?? []).find((e) => e.id === vue.id) ?? null
      : null;

  return (
    <div className="mx-auto max-w-3xl p-4 pb-24 lg:p-8 lg:pb-24">
      {message && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          {message}
        </div>
      )}

      {vue.type === "liste" && (
        <ListeEtablissements
          etablissements={etablissements}
          idsAvecAttente={idsAvecAttente}
          surOuverture={(id) => {
            setMessage(null);
            naviguer({ type: "fiche", id });
          }}
        />
      )}

      {vue.type === "fiche" && (
        <FicheEtablissement
          etablissement={etablissementCourant}
          chargementEnCours={etablissements === null}
          surRetour={() => {
            setMessage(null);
            naviguer({ type: "liste" });
          }}
          surNouvelleVisite={() => {
            setMessage(null);
            naviguer({ type: "visite", id: vue.id });
          }}
        />
      )}

      {vue.type === "visite" && etablissementCourant && (
        <FormulaireVisite
          etablissement={etablissementCourant}
          userId={userId}
          nomComplet={nomComplet}
          surAnnulation={() => naviguer({ type: "fiche", id: vue.id })}
          surEnregistrement={(mode) => {
            setMessage(
              mode === "direct"
                ? "Visite enregistrée et synchronisée ✓"
                : "Visite enregistrée hors ligne — elle sera synchronisée au retour du réseau."
            );
            naviguer({ type: "fiche", id: vue.id });
          }}
        />
      )}
    </div>
  );
}
