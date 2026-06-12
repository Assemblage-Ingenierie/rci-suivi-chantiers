"use client";

import { useCallback, useEffect, useState } from "react";
import {
  EVENEMENT_DONNEES,
  EVENEMENT_FILE,
  listerEtablissementsLocaux,
  listerFileVisites,
  type EtablissementSuivi,
  type Visite,
} from "@/lib/offline/db";
import { ListeEtablissements } from "./ListeEtablissements";
import { FicheEtablissement } from "./FicheEtablissement";
import { FormulaireVisite } from "./FormulaireVisite";

export type Vue =
  | { type: "liste" }
  | { type: "fiche"; id: string }
  | { type: "visite"; id: string }
  | { type: "edition_visite"; id: string; visiteId: string; enAttente: boolean };

function vueDepuisURL(): Vue {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) return { type: "liste" };
  const vue = params.get("vue");
  if (vue === "visite") return { type: "visite", id };
  if (vue === "edition_visite") {
    const visiteId = params.get("vid") ?? "";
    const enAttente = params.get("ea") === "1";
    return { type: "edition_visite", id, visiteId, enAttente };
  }
  return { type: "fiche", id };
}

function urlPourVue(vue: Vue): string {
  if (vue.type === "liste") return "/coges";
  if (vue.type === "fiche") return `/coges?id=${vue.id}`;
  if (vue.type === "visite") return `/coges?id=${vue.id}&vue=visite`;
  return `/coges?id=${vue.id}&vue=edition_visite&vid=${vue.visiteId}&ea=${vue.enAttente ? "1" : "0"}`;
}

export function AppCoges({
  userId,
  nomComplet,
}: {
  userId: string;
  nomComplet: string;
}) {
  const [vue, setVue] = useState<Vue>({ type: "liste" });
  const [etablissements, setEtablissements] = useState<EtablissementSuivi[] | null>(null);
  const [idsAvecAttente, setIdsAvecAttente] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [visiteAEditer, setVisiteAEditer] = useState<Visite | null>(null);

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
          surEditionVisite={(visite, enAttente) => {
            setMessage(null);
            setVisiteAEditer(visite);
            naviguer({ type: "edition_visite", id: vue.id, visiteId: visite.id, enAttente });
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

      {vue.type === "edition_visite" && etablissementCourant && (
        <FormulaireVisite
          etablissement={etablissementCourant}
          userId={userId}
          nomComplet={nomComplet}
          visiteAEditer={visiteAEditer ?? undefined}
          enAttenteEdition={vue.enAttente}
          surAnnulation={() => naviguer({ type: "fiche", id: vue.id })}
          surEnregistrement={(mode) => {
            setVisiteAEditer(null);
            setMessage(
              mode === "direct"
                ? "Visite mise à jour ✓"
                : "Modification enregistrée hors ligne."
            );
            naviguer({ type: "fiche", id: vue.id });
          }}
        />
      )}
    </div>
  );
}
