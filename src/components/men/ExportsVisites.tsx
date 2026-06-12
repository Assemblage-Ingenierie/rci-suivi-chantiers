"use client";

/**
 * Boutons d'export des fiches de visite (CDC §5.5) :
 *  - BoutonsExportVisite : 1 visite → PDF ou Word (photos incluses)
 *  - ExportsVisitesBatch : toutes les visites listées → PDF multi-pages ou
 *    ZIP de .docx
 */
import { useState } from "react";
import { FileDown, FileText, Loader2 } from "lucide-react";
import type { Tables } from "@/lib/database.types";
import {
  chargerPhotosVisite,
  exporterFichesPDF,
  exporterFicheDocx,
  exporterFichesZipDocx,
  type FicheVisite,
  type InfosEtablissement,
} from "@/lib/exports/fiche-visite";
import { horodatage, nomFichierSur } from "@/lib/exports/telecharger";

type Visite = Tables<"chantierci_visites">;

async function construireFiche(
  etablissement: InfosEtablissement,
  visite: Visite
): Promise<FicheVisite> {
  return {
    etablissement,
    visite,
    photos: await chargerPhotosVisite(visite.id),
  };
}

/** Export d'une visite (boutons compacts PDF / Word). */
export function BoutonsExportVisite({
  etablissement,
  visite,
}: {
  etablissement: InfosEtablissement;
  visite: Visite;
}) {
  const [enCours, setEnCours] = useState<"pdf" | "docx" | null>(null);

  async function exporter(format: "pdf" | "docx") {
    setEnCours(format);
    try {
      const fiche = await construireFiche(etablissement, visite);
      const base = nomFichierSur(
        `visite-${visite.date_visite}-${etablissement.nom}`
      );
      if (format === "pdf") await exporterFichesPDF([fiche], `${base}.pdf`);
      else await exporterFicheDocx(fiche, `${base}.docx`);
    } finally {
      setEnCours(null);
    }
  }

  const classe =
    "inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition hover:border-assemblage hover:text-assemblage disabled:opacity-50";

  return (
    <span className="inline-flex gap-1.5">
      <button
        onClick={() => exporter("pdf")}
        disabled={enCours !== null}
        title="Exporter cette visite en PDF"
        className={classe}
      >
        {enCours === "pdf" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileDown className="h-3.5 w-3.5" />
        )}
        PDF
      </button>
      <button
        onClick={() => exporter("docx")}
        disabled={enCours !== null}
        title="Exporter cette visite en Word"
        className={classe}
      >
        {enCours === "docx" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileText className="h-3.5 w-3.5" />
        )}
        Word
      </button>
    </span>
  );
}

/** Export en lot des visites d'un établissement. */
export function ExportsVisitesBatch({
  etablissement,
  visites,
}: {
  etablissement: InfosEtablissement;
  visites: Visite[];
}) {
  const [enCours, setEnCours] = useState<"pdf" | "zip" | null>(null);
  const [progression, setProgression] = useState("");

  async function exporter(format: "pdf" | "zip") {
    if (visites.length === 0) return;
    setEnCours(format);
    try {
      const fiches: FicheVisite[] = [];
      for (let i = 0; i < visites.length; i++) {
        setProgression(`${i + 1}/${visites.length}`);
        fiches.push(await construireFiche(etablissement, visites[i]));
      }
      const base = nomFichierSur(
        `visites-${etablissement.nom}-${horodatage()}`
      );
      if (format === "pdf") await exporterFichesPDF(fiches, `${base}.pdf`);
      else await exporterFichesZipDocx(fiches, `${base}.zip`);
    } finally {
      setEnCours(null);
      setProgression("");
    }
  }

  if (visites.length === 0) return null;

  const classe =
    "inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-assemblage hover:text-assemblage disabled:opacity-50";

  return (
    <span className="inline-flex gap-2">
      <button
        onClick={() => exporter("pdf")}
        disabled={enCours !== null}
        className={classe}
      >
        {enCours === "pdf" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        {enCours === "pdf" ? `PDF ${progression}` : "Tout en PDF"}
      </button>
      <button
        onClick={() => exporter("zip")}
        disabled={enCours !== null}
        className={classe}
      >
        {enCours === "zip" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        {enCours === "zip" ? `Word ${progression}` : "Tout en Word (ZIP)"}
      </button>
    </span>
  );
}
