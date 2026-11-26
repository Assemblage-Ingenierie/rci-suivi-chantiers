"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { BoutonDeconnexion } from "@/components/BoutonDeconnexion";
import { estProfilTerrain, LIBELLES_ROLES, type RoleUtilisateur } from "@/lib/constants";
import { MARQUE } from "@/theme/marque";

/**
 * Enveloppe des pages connectées. Même design pour tous ; deux dispositions :
 * - terrain (CSTC, MOE) : en-tête coloré compact, pensé pour le téléphone ;
 * - bureau (UG, admin) : barre latérale (tiroir sur mobile).
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
  const [menuOuvert, setMenuOuvert] = useState(false);

  if (estProfilTerrain(role)) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 bg-accent text-sur-accent">
          <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
            <Link href="/" className="min-w-0 flex-1 leading-tight">
              <span className="block text-sm font-bold tracking-wide">{MARQUE.sigle}</span>
              <span className="block truncate text-xs opacity-80">
                {nomComplet || LIBELLES_ROLES[role]} · {LIBELLES_ROLES[role]}
              </span>
            </Link>
            <BoutonDeconnexion variante="icone" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {menuOuvert && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMenuOuvert(false)} />
      )}
      <Sidebar
        nomComplet={nomComplet}
        role={role}
        mobileOuverte={menuOuvert}
        surFermetureMobile={() => setMenuOuvert(false)}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-bordure bg-surface px-4 lg:hidden">
          <button
            onClick={() => setMenuOuvert(true)}
            className="rounded-champ p-2 text-texte-2 hover:bg-surface-2"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="ml-3 text-sm font-semibold">
            {MARQUE.sigle} — {MARQUE.nomApplication}
          </span>
        </div>
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}
