"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  Landmark,
  LayoutDashboard,
  School,
  Settings,
  Table2,
  X,
  type LucideIcon,
} from "lucide-react";
import { BoutonDeconnexion } from "@/components/BoutonDeconnexion";
import type { RoleUtilisateur } from "@/lib/constants";
import { LIBELLES_ROLES } from "@/lib/constants";

type ItemNav = { href: string; libelle: string; icone: LucideIcon };

function itemsParRole(role: RoleUtilisateur): ItemNav[] {
  if (role === "coges") {
    return [{ href: "/coges", libelle: "Mes établissements", icone: School }];
  }
  const items: ItemNav[] = [
    { href: "/tableau-de-bord", libelle: "Tableau de bord", icone: LayoutDashboard },
    { href: "/suivi", libelle: "Tableau de suivi", icone: Table2 },
    { href: "/marches", libelle: "Marchés", icone: Landmark },
  ];
  if (role === "admin") {
    items.push(
      { href: "/coges", libelle: "Établissements", icone: School },
      { href: "/administration", libelle: "Administration", icone: Settings }
    );
  }
  return items;
}

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
  const items = itemsParRole(role);

  return (
    <aside
      className={[
        "fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col bg-sidebar text-white",
        "transition-transform duration-300",
        mobileOuverte ? "translate-x-0" : "-translate-x-full",
        "lg:static lg:translate-x-0",
      ].join(" ")}
    >
      {/* En-tête */}
      <div className="flex items-start justify-between px-5 py-6">
        <div>
          <span className="block text-lg font-bold leading-tight text-assemblage">
            Assemblage
          </span>
          <span className="block text-xs font-medium text-white/70">
            ingénierie
          </span>
          <span className="mt-2 block text-[11px] uppercase tracking-wider text-white/40">
            Suivi chantiers — MEN CI
          </span>
        </div>
        {/* Bouton fermeture visible uniquement sur mobile */}
        <button
          onClick={surFermetureMobile}
          className="mt-1 rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Fermer le menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {items.map(({ href, libelle, icone: Icone }) => {
          const actif = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={surFermetureMobile}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                actif
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icone className={`h-5 w-5 ${actif ? "text-assemblage" : ""}`} />
              <span className="flex-1">{libelle}</span>
              {actif && <ChevronRight className="h-4 w-4 text-white/50" />}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 border-t border-white/10 px-4 py-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{nomComplet}</p>
          <p className="truncate text-xs text-white/50">
            {LIBELLES_ROLES[role]}
          </p>
        </div>
        <BoutonDeconnexion variante="icone" />
      </div>
    </aside>
  );
}
