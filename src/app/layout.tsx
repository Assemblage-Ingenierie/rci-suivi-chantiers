import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from "next/font/google";
import { MARQUE } from "@/theme/marque";
import "./globals.css";

// Polices auto-hébergées par Next.js au build : aucun appel réseau à l'exécution.
// Texte : IBM Plex Sans ; titres et chiffres clés : IBM Plex Sans Condensed.
const police = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--police", display: "swap" });
const policeTitre = IBM_Plex_Sans_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--police-titre",
  display: "swap",
});

export const metadata: Metadata = {
  title: MARQUE.titreNavigateur,
  description: MARQUE.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${police.variable} ${policeTitre.variable}`}>
      <body>{children}</body>
    </html>
  );
}
