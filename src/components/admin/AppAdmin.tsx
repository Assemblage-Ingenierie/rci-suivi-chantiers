"use client";

/** Interface Admin (CDC §5.6) : trois onglets — comptes, lots, import CSV. */
import { useState } from "react";
import { Map, UserCheck, Upload } from "lucide-react";
import { GestionComptes } from "./GestionComptes";
import { GestionLots } from "./GestionLots";
import { ImportEtablissements } from "./ImportEtablissements";

const ONGLETS = [
  { cle: "comptes", libelle: "Comptes utilisateurs", icone: UserCheck },
  { cle: "lots", libelle: "Lots", icone: Map },
  { cle: "import", libelle: "Import CSV", icone: Upload },
] as const;

type Onglet = (typeof ONGLETS)[number]["cle"];

export function AppAdmin({ adminId }: { adminId: string }) {
  const [onglet, setOnglet] = useState<Onglet>("comptes");

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-1 rounded-lg bg-white p-1 shadow-sm">
        {ONGLETS.map(({ cle, libelle, icone: Icone }) => (
          <button
            key={cle}
            onClick={() => setOnglet(cle)}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition ${
              onglet === cle
                ? "bg-assemblage text-white"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <Icone className="h-4 w-4" />
            {libelle}
          </button>
        ))}
      </div>

      {onglet === "comptes" && <GestionComptes adminId={adminId} />}
      {onglet === "lots" && <GestionLots />}
      {onglet === "import" && <ImportEtablissements />}
    </div>
  );
}
