import type { Metadata, Viewport } from "next";
import { Source_Sans_3 } from "next/font/google";
import { MARQUE } from "@/theme/marque";
import "./globals.css";

// Police auto-hébergée par Next.js au build : aucun appel réseau à l'exécution.
const police = Source_Sans_3({ subsets: ["latin"], variable: "--police", display: "swap" });

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
    <html lang="fr" className={police.variable}>
      <body>{children}</body>
    </html>
  );
}
