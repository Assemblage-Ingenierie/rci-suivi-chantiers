/**
 * Fiches de visite PDF + Word (.docx) avec photos — CDC §5.5.
 *  - unitaire : 1 visite → 1 PDF ou 1 .docx
 *  - batch    : N visites → PDF multi-pages ou ZIP de .docx
 * Contrainte impérative : pas de WidthType.PERCENTAGE en docx → largeurs DXA.
 * Bibliothèques chargées dynamiquement.
 */
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/database.types";
import {
  formatDate,
  LIBELLES_RAISONS_ARRET,
  LIBELLES_STATUTS_CHANTIER,
} from "@/lib/constants";
import { nomFichierSur, telechargerBlob } from "./telecharger";

type Visite = Tables<"chantierci_visites">;

export interface InfosEtablissement {
  nom: string;
  lot?: string | null;
  localisation?: string | null; // "Département — Village"
  province?: string | null;
}

export interface PhotoChargee {
  dataUrl: string;
  octets: Uint8Array;
  largeur: number;
  hauteur: number;
}

export interface FicheVisite {
  etablissement: InfosEtablissement;
  visite: Visite;
  photos: PhotoChargee[];
}

const CORPS_ETAT: { cle: keyof Visite; libelle: string }[] = [
  { cle: "pct_excavation", libelle: "Excavation" },
  { cle: "pct_fondation", libelle: "Fondation" },
  { cle: "pct_verticaux", libelle: "Éléments verticaux" },
  { cle: "pct_charpente", libelle: "Charpente" },
  { cle: "pct_couverture", libelle: "Couverture" },
  { cle: "pct_finition", libelle: "Finition" },
];

function texteRaisons(visite: Visite): string | null {
  if (!visite.raisons_arret || visite.raisons_arret.length === 0) return null;
  const raisons = visite.raisons_arret
    .map((r) => LIBELLES_RAISONS_ARRET[r] ?? r)
    .join(", ");
  return visite.raison_arret_autre
    ? `${raisons} — ${visite.raison_arret_autre}`
    : raisons;
}

// ---------------------------------------------------------------------------
// Photos : récupération (URLs signées) + normalisation JPEG ≤ 800 px
// ---------------------------------------------------------------------------

async function normaliserImage(blob: Blob): Promise<PhotoChargee> {
  const bitmap = await createImageBitmap(blob);
  const ratio = Math.min(1, 800 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  const octets = Uint8Array.from(atob(dataUrl.split(",")[1]), (c) =>
    c.charCodeAt(0)
  );
  return { dataUrl, octets, largeur: canvas.width, hauteur: canvas.height };
}

/** Photos d'une visite (bucket privé → URLs signées). [] si hors ligne. */
export async function chargerPhotosVisite(
  visiteId: string
): Promise<PhotoChargee[]> {
  try {
    const supabase = createClient();
    const { data: lignes } = await supabase
      .from("chantierci_photos_visites")
      .select("storage_path")
      .eq("visite_id", visiteId)
      .range(0, 19);
    const photos: PhotoChargee[] = [];
    for (const ligne of lignes ?? []) {
      const { data: signee } = await supabase.storage
        .from("chantierci-photos-visites")
        .createSignedUrl(ligne.storage_path, 600);
      if (!signee?.signedUrl) continue;
      const reponse = await fetch(signee.signedUrl);
      if (!reponse.ok) continue;
      photos.push(await normaliserImage(await reponse.blob()));
    }
    return photos;
  } catch {
    return []; // hors ligne : fiche sans photos
  }
}

// ---------------------------------------------------------------------------
// PDF (jsPDF) — une page (ou plus si photos) par visite
// ---------------------------------------------------------------------------

export async function exporterFichesPDF(
  fiches: FicheVisite[],
  nomFichier: string
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const LARGEUR = 210;
  const MARGE = 16;

  fiches.forEach((fiche, index) => {
    if (index > 0) doc.addPage();
    let y = dessinerEnTete(doc, fiche, MARGE, LARGEUR);
    y = dessinerCorps(doc, fiche, y, MARGE, LARGEUR);
    dessinerPhotos(doc, fiche, y, MARGE, LARGEUR);
  });

  telechargerBlob(doc.output("blob"), nomFichier);
}

type DocPDF = import("jspdf").jsPDF;

function dessinerEnTete(
  doc: DocPDF,
  fiche: FicheVisite,
  marge: number,
  largeur: number
): number {
  doc.setFillColor(28, 28, 46);
  doc.rect(0, 0, largeur, 26, "F");
  doc.setTextColor(232, 32, 26);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Fiche de visite de chantier", marge, 11);
  doc.setTextColor(255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Suivi des chantiers scolaires — Ministère de l'Éducation Nationale, Côte d'Ivoire",
    marge,
    17
  );
  doc.text(`AMO Assemblage Ingénierie`, marge, 22);

  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(fiche.etablissement.nom, marge, 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(90);
  const sousTitre = [
    fiche.etablissement.localisation,
    fiche.etablissement.province,
    fiche.etablissement.lot,
  ]
    .filter(Boolean)
    .join(" · ");
  if (sousTitre) doc.text(sousTitre, marge, 41.5);
  return 48;
}

function ligneInfo(
  doc: DocPDF,
  libelle: string,
  valeur: string,
  y: number,
  marge: number
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(20);
  doc.text(libelle, marge, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  const lignes = doc.splitTextToSize(valeur, 120);
  doc.text(lignes, marge + 58, y);
  return y + lignes.length * 4.8 + 1.6;
}

function dessinerCorps(
  doc: DocPDF,
  fiche: FicheVisite,
  y: number,
  marge: number,
  largeur: number
): number {
  const v = fiche.visite;
  y = ligneInfo(doc, "Date de la visite", formatDate(v.date_visite), y, marge);
  y = ligneInfo(doc, "Visiteur", v.nom_visiteur || "—", y, marge);
  y = ligneInfo(
    doc,
    "Statut du chantier",
    LIBELLES_STATUTS_CHANTIER[v.statut_chantier],
    y,
    marge
  );
  y = ligneInfo(
    doc,
    "Avancement global",
    v.avancement_reel_pct !== null ? `${v.avancement_reel_pct} %` : "—",
    y,
    marge
  );
  const raisons = texteRaisons(v);
  if (raisons) y = ligneInfo(doc, "Raisons de l'arrêt", raisons, y, marge);
  if (v.commentaire) y = ligneInfo(doc, "Commentaire", v.commentaire, y, marge);

  // Corps d'état : barres horizontales.
  y += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20);
  doc.text("Avancement par corps d'état", marge, y);
  y += 5;
  const largeurBarre = largeur - marge * 2 - 70;
  for (const { cle, libelle } of CORPS_ETAT) {
    const pct = (v[cle] as number | null) ?? 0;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60);
    doc.text(libelle, marge, y + 3.2);
    doc.setFillColor(235, 235, 235);
    doc.roundedRect(marge + 42, y, largeurBarre, 4.2, 1, 1, "F");
    if (pct > 0) {
      doc.setFillColor(232, 32, 26);
      doc.roundedRect(
        marge + 42,
        y,
        Math.max(2, (largeurBarre * Math.min(100, pct)) / 100),
        4.2,
        1,
        1,
        "F"
      );
    }
    doc.setTextColor(20);
    doc.setFont("helvetica", "bold");
    doc.text(`${pct} %`, marge + 44 + largeurBarre, y + 3.4);
    y += 7.2;
  }
  return y + 4;
}

function dessinerPhotos(
  doc: DocPDF,
  fiche: FicheVisite,
  y: number,
  marge: number,
  largeur: number
) {
  if (fiche.photos.length === 0) return;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20);
  doc.text(`Photos (${fiche.photos.length})`, marge, y);
  y += 4;

  const largeurPhoto = (largeur - marge * 2 - 6) / 2;
  let x = marge;
  let hauteurRangee = 0;
  for (const photo of fiche.photos) {
    const hauteur = (photo.hauteur / photo.largeur) * largeurPhoto;
    if (y + hauteur > 285) {
      doc.addPage();
      y = 16;
      x = marge;
      hauteurRangee = 0;
    }
    doc.addImage(photo.dataUrl, "JPEG", x, y, largeurPhoto, hauteur);
    hauteurRangee = Math.max(hauteurRangee, hauteur);
    if (x === marge) {
      x = marge + largeurPhoto + 6;
    } else {
      x = marge;
      y += hauteurRangee + 6;
      hauteurRangee = 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Word (.docx) — largeurs en DXA uniquement (jamais PERCENTAGE)
// ---------------------------------------------------------------------------

const LARGEUR_TABLE_DXA = 9026; // A4 − marges 1"
const COL_LIBELLE_DXA = 2800;
const COL_VALEUR_DXA = LARGEUR_TABLE_DXA - COL_LIBELLE_DXA;

export async function genererFicheDocxBlob(fiche: FicheVisite): Promise<Blob> {
  const {
    AlignmentType,
    Document,
    HeadingLevel,
    ImageRun,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = await import("docx");

  const v = fiche.visite;

  const rangee = (libelle: string, valeur: string) =>
    new TableRow({
      children: [
        new TableCell({
          width: { size: COL_LIBELLE_DXA, type: WidthType.DXA },
          children: [
            new Paragraph({
              children: [new TextRun({ text: libelle, bold: true })],
            }),
          ],
        }),
        new TableCell({
          width: { size: COL_VALEUR_DXA, type: WidthType.DXA },
          children: [new Paragraph(valeur)],
        }),
      ],
    });

  const rangees = [
    rangee("Date de la visite", formatDate(v.date_visite)),
    rangee("Visiteur", v.nom_visiteur || "—"),
    rangee("Statut du chantier", LIBELLES_STATUTS_CHANTIER[v.statut_chantier]),
    rangee(
      "Avancement global",
      v.avancement_reel_pct !== null ? `${v.avancement_reel_pct} %` : "—"
    ),
    ...CORPS_ETAT.map(({ cle, libelle }) =>
      rangee(
        libelle,
        v[cle] !== null ? `${v[cle]} %` : "—"
      )
    ),
  ];
  const raisons = texteRaisons(v);
  if (raisons) rangees.push(rangee("Raisons de l'arrêt", raisons));
  if (v.commentaire) rangees.push(rangee("Commentaire", v.commentaire));

  const enfants: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [
        new TextRun({
          text: "Fiche de visite de chantier",
          color: "E8201A",
          bold: true,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Suivi des chantiers scolaires — Ministère de l'Éducation Nationale, Côte d'Ivoire · AMO Assemblage Ingénierie",
          color: "666666",
          size: 18,
        }),
      ],
    }),
    new Paragraph({ text: "" }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: fiche.etablissement.nom, bold: true })],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: [
            fiche.etablissement.localisation,
            fiche.etablissement.province,
            fiche.etablissement.lot,
          ]
            .filter(Boolean)
            .join(" · "),
          color: "666666",
        }),
      ],
    }),
    new Paragraph({ text: "" }),
    new Table({
      width: { size: LARGEUR_TABLE_DXA, type: WidthType.DXA },
      rows: rangees,
    }),
  ];

  if (fiche.photos.length > 0) {
    enfants.push(
      new Paragraph({ text: "" }),
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [
          new TextRun({ text: `Photos (${fiche.photos.length})`, bold: true }),
        ],
      })
    );
    for (const photo of fiche.photos) {
      const largeurPx = 420;
      const hauteurPx = Math.round((photo.hauteur / photo.largeur) * largeurPx);
      enfants.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              type: "jpg",
              data: photo.octets,
              transformation: { width: largeurPx, height: hauteurPx },
            }),
          ],
        })
      );
    }
  }

  const document = new Document({
    sections: [{ children: enfants }],
  });
  return Packer.toBlob(document);
}

export async function exporterFicheDocx(fiche: FicheVisite, nomFichier: string) {
  telechargerBlob(await genererFicheDocxBlob(fiche), nomFichier);
}

/** Batch : ZIP de .docx (une fiche par visite). */
export async function exporterFichesZipDocx(
  fiches: FicheVisite[],
  nomFichier: string
) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const fiche of fiches) {
    const nom = `${nomFichierSur(
      `visite-${fiche.visite.date_visite}-${fiche.etablissement.nom}`
    )}.docx`;
    zip.file(nom, await genererFicheDocxBlob(fiche));
  }
  telechargerBlob(await zip.generateAsync({ type: "blob" }), nomFichier);
}
