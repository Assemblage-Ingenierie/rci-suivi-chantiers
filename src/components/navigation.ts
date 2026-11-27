import { CalendarCheck, FileDown, Images, LayoutDashboard, ListChecks, MapPinned, Settings, TriangleAlert, type LucideIcon } from "lucide-react";
import type { RoleUtilisateur } from "@/lib/constants";

export type ItemNav = { href: string; libelle: string; icone: LucideIcon };

/** Entrées de menu par rôle (les profils de terrain n'ont qu'une page d'accueil pour l'instant). */
export function itemsParRole(role: RoleUtilisateur): ItemNav[] {
  switch (role) {
    case "cstc":
      return [{ href: "/cstc", libelle: "Mon site", icone: MapPinned }];
    case "moe_controleur":
    case "moe_chef":
      return [{ href: "/moe", libelle: "Mes sites", icone: ListChecks }];
    case "ug":
      return [
        { href: "/tableau-de-bord", libelle: "Tableau de bord", icone: LayoutDashboard },
        { href: "/suivi", libelle: "Suivi", icone: CalendarCheck },
        { href: "/alertes", libelle: "Alertes", icone: TriangleAlert },
        { href: "/sites", libelle: "Sites", icone: MapPinned },
        { href: "/photos", libelle: "Photos", icone: Images },
        { href: "/export", libelle: "Export", icone: FileDown },
      ];
    case "admin":
      return [
        { href: "/tableau-de-bord", libelle: "Tableau de bord", icone: LayoutDashboard },
        { href: "/suivi", libelle: "Suivi", icone: CalendarCheck },
        { href: "/alertes", libelle: "Alertes", icone: TriangleAlert },
        { href: "/sites", libelle: "Sites", icone: MapPinned },
        { href: "/photos", libelle: "Photos", icone: Images },
        { href: "/export", libelle: "Export", icone: FileDown },
        { href: "/administration", libelle: "Administration", icone: Settings },
      ];
  }
}
