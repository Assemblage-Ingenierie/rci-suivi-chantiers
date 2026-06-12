"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import type { RoleUtilisateur } from "@/lib/constants";

/**
 * Enveloppe client du layout protégé.
 * Sur mobile : sidebar en overlay (z-50) avec backdrop, ouverte via hamburger.
 * Sur desktop (lg+) : sidebar statique 240 px, hamburger caché.
 */
export function LayoutShell({
  nomComplet,
  role,
  children,
}: {
  nomComplet: string;
  role: RoleUtilisateur;
  children: React.ReactNode;
}) {
  const [sidebarOuverte, setSidebarOuverte] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Backdrop mobile */}
      {sidebarOuverte && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOuverte(false)}
        />
      )}

      <Sidebar
        nomComplet={nomComplet}
        role={role}
        mobileOuverte={sidebarOuverte}
        surFermetureMobile={() => setSidebarOuverte(false)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        {/* Barre supérieure mobile avec hamburger */}
        <div className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-gray-200 bg-white px-4 lg:hidden">
          <button
            onClick={() => setSidebarOuverte(true)}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="ml-3 text-sm font-semibold text-gray-800">
            Suivi chantiers — MEN CI
          </span>
        </div>

        {/* Contenu de la page */}
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}
