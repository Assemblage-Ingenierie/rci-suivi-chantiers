"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { BoutonDeconnexion } from "@/components/BoutonDeconnexion";
import { Logo } from "@/components/Logo";
import { itemsParRole } from "@/components/navigation";
import { LIBELLES_ROLES, type RoleUtilisateur } from "@/lib/constants";

/** Barre latérale des profils de bureau (UG, admin), aux couleurs du profil. */
export function Sidebar({
  nomComplet,
  role,
  mobileOuverte = false,
  surFermetureMobile,
}: {
  nomComplet: string;
  role: RoleUtilisateur;
  mobileOuverte?: boolean;
  surFermetureMobile?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={[
        "fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col bg-menu text-white",
        "transition-transform duration-300",
        mobileOuverte ? "translate-x-0" : "-translate-x-full",
        "lg:static lg:translate-x-0",
      ].join(" ")}
    >
      <div className="relative px-4 pb-5 pt-4">
        {/* Logo PATEB sur fond blanc (couleurs du logo lisibles quelle que soit la couleur du profil). */}
        <div className="flex justify-center rounded-carte bg-white px-3 py-2.5 shadow-sm">
          <Logo largeur={168} />
        </div>
        <button
          onClick={surFermetureMobile}
          className="absolute right-1 top-1 rounded-champ p-1 opacity-70 hover:bg-black/10 hover:opacity-100 lg:hidden"
          aria-label="Fermer le menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {itemsParRole(role).map(({ href, libelle, icone: Icone }) => {
          const actif = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={surFermetureMobile}
              aria-current={actif ? "page" : undefined}
              className={`flex items-center gap-3 rounded-champ border-l-[3px] px-3 py-2.5 text-sm font-medium transition ${
                actif ? "border-menu-actif bg-white/15" : "border-transparent opacity-80 hover:bg-white/10 hover:opacity-100"
              }`}
            >
              <Icone className="h-5 w-5" />
              {libelle}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 border-t border-white/15 px-4 py-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{nomComplet}</p>
          <p className="truncate text-xs opacity-70">{LIBELLES_ROLES[role]}</p>
        </div>
        <BoutonDeconnexion variante="icone" />
      </div>
    </aside>
  );
}
