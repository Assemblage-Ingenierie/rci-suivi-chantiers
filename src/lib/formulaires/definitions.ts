/**
 * CONTENU DES 3 FORMULAIRES — modifier ici pour ajouter, retirer ou reformuler
 * une question : les écrans de saisie et de consultation suivent.
 *
 * Les réponses sont enregistrées dans `reponses` (JSON) sous l'identifiant de
 * la question : ne pas renommer un identifiant déjà utilisé (les anciennes
 * réponses ne seraient plus affichées).
 */
import type { DefinitionFormulaire, Option, SourceFormulaire } from "./types";

const OUI_NON: Option[] = [
  { valeur: "oui", libelle: "Oui" },
  { valeur: "non", libelle: "Non" },
];

// ---------------------------------------------------------------------------
// CSTC — suivi communautaire : questions fermées, mots simples, pas de DQE
// ---------------------------------------------------------------------------
const CSTC: DefinitionFormulaire = {
  source: "cstc",
  titre: "Signalement CSTC",
  surTitre: "Suivi communautaire · CSTC",
  avecOnglets: false,
  sections: [
    {
      id: "etat",
      numero: 1,
      titre: "Aujourd'hui, le chantier est :",
      questions: [
        { type: "statut", id: "statut", libelle: "État du chantier", requis: true },
        {
          type: "choix",
          id: "ouvriers_presents",
          libelle: "Y avait-il des ouvriers aujourd'hui ?",
          options: OUI_NON,
          colonnes: 2,
          requis: true,
        },
      ],
    },
    {
      id: "securite",
      numero: 2,
      titre: "Sécurité du chantier",
      questions: [
        {
          type: "oui_non",
          id: "securite",
          libelle: "Sécurité",
          elements: [
            { valeur: "separe_cour", libelle: "Le chantier est séparé de la cour des élèves" },
            { valeur: "dangers", libelle: "Trous, matériaux ou ferrailles dangereux à portée des enfants" },
            { valeur: "epi", libelle: "Les ouvriers portent casques et chaussures" },
          ],
        },
      ],
    },
    {
      id: "batiment",
      numero: 3,
      titre: "Voyez-vous un problème grave sur le bâtiment ?",
      questions: [
        {
          type: "choix",
          id: "problemes_batiment",
          libelle: "Problèmes constatés",
          multiple: true,
          exclusive: "aucun",
          options: [
            { valeur: "aucun", libelle: "Aucun" },
            { valeur: "fissure", libelle: "Fissure" },
            { valeur: "toit", libelle: "Toit abîmé / fuite" },
            { valeur: "eau_stagnante", libelle: "Eau stagnante" },
            { valeur: "autre", libelle: "Autre" },
          ],
        },
        { type: "photos", id: "photos", libelle: "Photos" },
      ],
    },
    {
      id: "latrines",
      numero: 4,
      titre: "Les latrines (toilettes) :",
      questions: [
        {
          type: "choix",
          id: "latrines",
          libelle: "Avancement des latrines",
          options: [
            { valeur: "pas_commencees", libelle: "Pas commencées" },
            { valeur: "en_cours", libelle: "En construction" },
            { valeur: "terminees", libelle: "Terminées" },
          ],
          colonnes: 3,
        },
      ],
    },
    {
      id: "tensions",
      numero: 5,
      titre: "Y a-t-il des tensions autour du chantier ?",
      questions: [
        {
          type: "choix",
          id: "tensions",
          libelle: "Tensions",
          multiple: true,
          exclusive: "aucune",
          colonnes: 2,
          options: [
            { valeur: "aucune", libelle: "Non, tout va bien" },
            { valeur: "entreprise", libelle: "Avec l'entreprise" },
            { valeur: "village", libelle: "Dans le village" },
            { valeur: "foncier", libelle: "Terrain / foncier" },
          ],
        },
      ],
    },
    {
      id: "mobilier",
      numero: 6,
      titre: "Le mobilier (tables-bancs) est-il là ?",
      questions: [
        {
          type: "choix",
          id: "mobilier",
          libelle: "Mobilier",
          colonnes: 3,
          options: [
            { valeur: "oui_tout", libelle: "Oui, tout" },
            { valeur: "en_partie", libelle: "En partie" },
            { valeur: "pas_encore", libelle: "Pas encore" },
          ],
        },
      ],
    },
    {
      id: "autre",
      numero: 7,
      titre: "Autre chose à signaler ?",
      questions: [{ type: "commentaire", id: "commentaire", libelle: "Message", indication: "Facultatif" }],
    },
  ],
};

// ---------------------------------------------------------------------------
// MOE — rapport de visite de la maîtrise d'œuvre (postes alignés sur le DQE)
// ---------------------------------------------------------------------------
const QUALITE_ELEMENTS: Option[] = [
  { valeur: "implantation", libelle: "Implantation et niveaux" },
  { valeur: "beton_fondation", libelle: "Béton de fondation" },
  { valeur: "ferraillage", libelle: "Ferraillage des chaînages" },
  { valeur: "maconnerie", libelle: "Maçonnerie (aplomb, joints)" },
  { valeur: "charpente", libelle: "Charpente, couverture" },
  { valeur: "latrines", libelle: "Latrines (fosses, ouvrages)" },
];

const MOE: DefinitionFormulaire = {
  source: "moe",
  titre: "Rapport de visite MOE",
  surTitre: "Rapport de visite · Maîtrise d'œuvre",
  avecOnglets: true,
  sections: [
    {
      id: "avancement",
      titre: "Avancement",
      questions: [
        { type: "date", id: "date_visite", libelle: "Date de la visite" },
        { type: "statut", id: "statut", libelle: "Statut du chantier", requis: true },
        { type: "postes", id: "postes", libelle: "Avancement par poste" },
        { type: "nombre", id: "retard_semaines", libelle: "Retard estimé (semaines)", min: 0, max: 52, pas: 1, alerteSiPositif: true },
      ],
    },
    {
      id: "qualite",
      titre: "Qualité",
      questions: [
        { type: "qualite", id: "qualite", libelle: "Qualité d'exécution", elements: QUALITE_ELEMENTS },
        {
          type: "texte",
          id: "qualite_observations",
          libelle: "Non-conformités au CCTP",
          indication: "Décrire chaque non-conformité et la reprise attendue",
          obligatoireSi: { question: "qualite", valeur: "non_conforme" },
        },
      ],
    },
    {
      id: "securite",
      titre: "Sécurité",
      questions: [
        {
          type: "oui_non",
          id: "securite",
          libelle: "Respect des règles de sécurité",
          elements: [
            { valeur: "panneau", libelle: "Panneau de chantier en place" },
            { valeur: "zone_balisee", libelle: "Zone de chantier balisée, séparée des élèves" },
            { valeur: "epi", libelle: "Port des EPI (casque, chaussures)" },
            { valeur: "stockage", libelle: "Stockage des matériaux sécurisé" },
          ],
        },
      ],
    },
    {
      id: "moyens",
      titre: "Moyens",
      questions: [
        { type: "nombre", id: "ouvriers", libelle: "Ouvriers présents", min: 0, max: 200, pas: 1 },
        { type: "nombre", id: "ouvriers_qualifies", libelle: "dont qualifiés (maçons, ferrailleurs)", min: 0, max: 200, pas: 1 },
        { type: "choix", id: "chef_chantier", libelle: "Chef de chantier présent", options: OUI_NON, colonnes: 2 },
      ],
    },
    {
      id: "problemes",
      titre: "Problèmes",
      questions: [
        {
          type: "choix",
          id: "problemes",
          libelle: "Problèmes rencontrés",
          multiple: true,
          exclusive: "aucun",
          options: [
            { valeur: "aucun", libelle: "Aucun" },
            { valeur: "effectif", libelle: "Effectif insuffisant" },
            { valeur: "approvisionnement", libelle: "Approvisionnement" },
            { valeur: "malfacon", libelle: "Malfaçon" },
            { valeur: "acces", libelle: "Accès au site" },
            { valeur: "intemperies", libelle: "Intempéries" },
            { valeur: "paiement", libelle: "Paiement entreprise" },
          ],
        },
        { type: "commentaire", id: "commentaire", libelle: "Commentaire" },
      ],
    },
    {
      id: "photos",
      titre: "Photos",
      questions: [{ type: "photos", id: "photos", libelle: "Photos géolocalisées" }],
    },
  ],
};

// ---------------------------------------------------------------------------
// UG — fiche de visite technique de l'unité de gestion
// ---------------------------------------------------------------------------
/**
 * Suivi environnemental et social (E&S) de l'UG : chaque élément est formulé
 * pour que « Oui » soit la situation attendue ; un « Non » rend obligatoire la
 * description de l'écart.
 */
const ES_ELEMENTS: Option[] = [
  { valeur: "dechets", libelle: "Déchets de chantier collectés et évacués" },
  { valeur: "drainage", libelle: "Pas d'eau stagnante ni d'érosion autour du chantier" },
  { valeur: "nuisances", libelle: "Bruit et poussière limités pendant les heures de classe" },
  { valeur: "hygiene", libelle: "Eau potable et toilettes disponibles pour les ouvriers" },
  { valeur: "emploi_local", libelle: "Main-d'œuvre locale employée" },
  { valeur: "pas_enfants", libelle: "Aucun enfant au travail sur le chantier" },
  { valeur: "code_conduite", libelle: "Code de conduite des ouvriers (VBG, EAS/HS) signé et affiché" },
  { valeur: "mecanisme_plaintes", libelle: "Mécanisme de gestion des plaintes connu de la communauté" },
];

const UG: DefinitionFormulaire = {
  source: "ug",
  titre: "Fiche de visite UG",
  surTitre: "Fiche de visite technique · UG",
  avecOnglets: true,
  sections: [
    {
      id: "avancement",
      titre: "Avancement",
      questions: [
        { type: "date", id: "date_visite", libelle: "Date de la visite" },
        { type: "statut", id: "statut", libelle: "Statut du chantier", requis: true },
        { type: "postes", id: "postes", libelle: "Avancement par poste" },
      ],
    },
    {
      id: "difficultes",
      titre: "Difficultés",
      questions: [
        {
          type: "choix",
          id: "difficultes",
          libelle: "Difficultés à remonter",
          multiple: true,
          exclusive: "aucune",
          options: [
            { valeur: "aucune", libelle: "Aucune" },
            { valeur: "entreprise_absente", libelle: "Entreprise absente" },
            { valeur: "materiaux_manquants", libelle: "Matériaux manquants" },
            { valeur: "malfacon", libelle: "Malfaçon" },
            { valeur: "stockage_non_protege", libelle: "Stockage non protégé" },
            { valeur: "acces", libelle: "Accès au site" },
            { valeur: "autre", libelle: "Autre" },
          ],
        },
        { type: "commentaire", id: "commentaire", libelle: "Précisions" },
      ],
    },
    {
      id: "es",
      titre: "Environnement et social",
      questions: [
        { type: "oui_non", id: "es", libelle: "Mesures environnementales et sociales", elements: ES_ELEMENTS },
        {
          type: "choix",
          id: "plaintes",
          libelle: "Plaintes de la communauté reçues depuis la dernière visite",
          options: OUI_NON,
          colonnes: 2,
        },
        {
          type: "texte",
          id: "es_observations",
          libelle: "Écarts environnementaux et sociaux",
          indication: "Décrire chaque écart constaté et la mesure demandée à l'entreprise",
          obligatoireSi: { question: "es", valeur: "non" },
        },
      ],
    },
    {
      id: "photos",
      titre: "Photos",
      questions: [{ type: "photos", id: "photos", libelle: "Photos géolocalisées", minimum: 4 }],
    },
  ],
};

export const DEFINITIONS: Record<SourceFormulaire, DefinitionFormulaire> = { cstc: CSTC, moe: MOE, ug: UG };

/** Appréciation de la qualité d'un élément : conforme ou non au CCTP. */
export const QUALITE_OPTIONS: Option[] = [
  { valeur: "conforme", libelle: "Conforme au CCTP" },
  { valeur: "non_conforme", libelle: "Non conforme au CCTP" },
];
/** Libellés pour l'affichage, y compris les appréciations des anciens rapports. */
export const QUALITE_LIBELLES: Option[] = [
  ...QUALITE_OPTIONS,
  { valeur: "reserve", libelle: "Réserve" },
  { valeur: "non_visible", libelle: "Non visible" },
];
