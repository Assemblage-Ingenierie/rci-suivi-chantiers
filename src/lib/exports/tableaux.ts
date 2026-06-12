/**
 * Exports des tableaux (suivi des chantiers, marchés) — CDC §5.5.
 * Les composants fournissent les en-têtes + lignes déjà filtrées (filtre
 * actif) et limitées aux colonnes visibles (sélection de colonnes active).
 * Bibliothèques chargées dynamiquement (lourdes, utilisées à la demande).
 */
import { telechargerBlob } from "./telecharger";

export type ValeurCellule = string | number | null;

/** Export Excel (.xlsx) — valeurs brutes (les nombres restent des nombres). */
export async function exporterExcel(options: {
  nomFichier: string;
  nomFeuille: string;
  entetes: string[];
  lignes: ValeurCellule[][];
}) {
  const XLSX = await import("xlsx");
  const feuille = XLSX.utils.aoa_to_sheet([
    options.entetes,
    ...options.lignes,
  ]);
  // Largeurs de colonnes approximatives (selon le contenu).
  feuille["!cols"] = options.entetes.map((entete, i) => ({
    wch: Math.min(
      40,
      Math.max(
        entete.length + 2,
        ...options.lignes
          .slice(0, 50)
          .map((l) => String(l[i] ?? "").length + 2)
      )
    ),
  }));
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, options.nomFeuille);
  XLSX.writeFile(classeur, options.nomFichier);
}

/** Export PDF paysage avec en-tête sombre (style PEEB). */
export async function exporterTableauPDF(options: {
  nomFichier: string;
  titre: string;
  sousTitre?: string;
  entetes: string[];
  lignes: string[][];
}) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.setTextColor(232, 32, 26);
  doc.setFont("helvetica", "bold");
  doc.text(options.titre, 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.setFont("helvetica", "normal");
  doc.text(
    options.sousTitre ??
      `Suivi des chantiers scolaires — MEN Côte d'Ivoire · ${new Date().toLocaleDateString("fr-FR")}`,
    14,
    19
  );

  autoTable(doc, {
    head: [options.entetes],
    body: options.lignes,
    startY: 24,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [28, 28, 46], textColor: 255, fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 14, right: 14 },
  });

  telechargerBlob(doc.output("blob"), options.nomFichier);
}
