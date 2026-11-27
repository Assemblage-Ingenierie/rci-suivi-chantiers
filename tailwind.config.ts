import type { Config } from "tailwindcss";

/**
 * Les couleurs sont des NOMS D'USAGE qui pointent vers les variables de
 * src/theme/theme.css : ne jamais ajouter ici de valeur en dur.
 */
const v = (nom: string) => `rgb(var(--c-${nom}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        fond: v("fond"),
        surface: { DEFAULT: v("surface"), 2: v("surface-2") },
        texte: { DEFAULT: v("texte"), 2: v("texte-2"), 3: v("texte-3") },
        bordure: { DEFAULT: v("bordure"), forte: v("bordure-forte") },
        selection: { DEFAULT: v("selection"), bordure: v("selection-bordure") },
        accent: { DEFAULT: v("accent"), fonce: v("accent-fonce"), clair: v("accent-clair") },
        "sur-accent": v("sur-accent"),
        succes: { DEFAULT: v("succes"), clair: v("succes-clair") },
        alerte: { DEFAULT: v("alerte"), clair: v("alerte-clair") },
        danger: { DEFAULT: v("danger"), clair: v("danger-clair") },
        info: { DEFAULT: v("info"), clair: v("info-clair") },
        graphe: { piste: v("graphe-piste"), rempli: v("graphe-rempli"), repere: v("graphe-repere") },
        pateb: { bleu: v("pateb-bleu"), orange: v("pateb-orange"), vert: v("pateb-vert"), rouge: v("pateb-rouge") },
        menu: { DEFAULT: v("menu"), actif: v("menu-actif") },
        source: { moe: v("source-moe"), cstc: v("source-cstc"), ug: v("source-ug") },
      },
      borderRadius: {
        carte: "var(--rayon)",
        champ: "var(--rayon-petit)",
      },
      fontFamily: {
        sans: ["var(--police)", "system-ui", "sans-serif"],
        titre: ["var(--police-titre)", "var(--police)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
