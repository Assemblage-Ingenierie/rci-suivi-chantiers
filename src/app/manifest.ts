import type { MetadataRoute } from "next";
import { MARQUE } from "@/theme/marque";

/** Manifeste : nom et icône de l'application installée sur l'écran d'accueil du téléphone. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: MARQUE.titreNavigateur,
    short_name: MARQUE.sigle,
    description: MARQUE.description,
    start_url: "/",
    display: "standalone",
    background_color: "#F4F6F9",
    theme_color: "#0B3352",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
