/**
 * MARQUE — nom, sous-titres et logo de l'application, à un seul endroit.
 * Les couleurs sont dans src/theme/theme.css.
 *
 * Logo : déposer le fichier dans /public (ex. /public/logo.svg) et renseigner
 * `logo`. Laisser `null` pour afficher le sigle en texte.
 */
export const MARQUE = {
  sigle: "PATEB",
  nomApplication: "Suivi des chantiers",
  /** Ligne sous le nom sur les écrans de connexion. */
  sousTitre: "Salles de classe du pré-primaire — Côte d'Ivoire",
  /** Titre de l'onglet du navigateur. */
  titreNavigateur: "PATEB — Suivi des chantiers",
  description:
    "Suivi des travaux de construction des salles de classe du pré-primaire (PATEB, Côte d'Ivoire).",
  logo: {
    src: "/logo-pateb.png",
    largeur: 480,
    hauteur: 374,
    alt: "PATEB — Programme d'Appui à la Transformation de l'Éducation de Base",
  } as null | { src: string; largeur: number; hauteur: number; alt: string },
} as const;
