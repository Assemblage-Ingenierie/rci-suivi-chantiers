"use client";

/**
 * Import en masse des établissements par CSV (CDC §5.6).
 * Format attendu (en-têtes, séparateur ; ou ,) :
 *   nom;nom_directeur;telephone;email;latitude;longitude;province;
 *   departement;village;lot;statut
 * `lot` = nom exact d'un lot existant. `statut` parmi non_demarre/en_cours/
 * arrete/receptionne (défaut : non_demarre). Aperçu + validation avant insert.
 */
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileUp, Loader2, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Tables, TablesInsert } from "@/lib/database.types";
import { Constants } from "@/lib/database.types";

type Lot = Tables<"chantierci_lots">;
type EtablissementInsert = TablesInsert<"chantierci_etablissements">;

const COLONNES_ATTENDUES = [
  "nom",
  "nom_directeur",
  "telephone",
  "email",
  "latitude",
  "longitude",
  "province",
  "departement",
  "village",
  "lot",
  "statut",
];

const STATUTS_VALIDES = Constants.public.Enums.chantierci_statut_chantier;

/** Parseur CSV minimal : gère les guillemets et le séparateur ; ou ,. */
function parserCSV(texte: string): string[][] {
  const separateur = (texte.split("\n")[0].match(/;/g) ?? []).length >=
    (texte.split("\n")[0].match(/,/g) ?? []).length
    ? ";"
    : ",";
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let champ = "";
  let entreGuillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (entreGuillemets) {
      if (c === '"' && texte[i + 1] === '"') {
        champ += '"';
        i++;
      } else if (c === '"') entreGuillemets = false;
      else champ += c;
    } else if (c === '"') entreGuillemets = true;
    else if (c === separateur) {
      ligne.push(champ);
      champ = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texte[i + 1] === "\n") i++;
      ligne.push(champ);
      champ = "";
      if (ligne.some((v) => v.trim() !== "")) lignes.push(ligne);
      ligne = [];
    } else champ += c;
  }
  ligne.push(champ);
  if (ligne.some((v) => v.trim() !== "")) lignes.push(ligne);
  return lignes;
}

interface LigneValidee {
  numero: number;
  etablissement: EtablissementInsert | null;
  erreurs: string[];
}

export function ImportEtablissements() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [lignes, setLignes] = useState<LigneValidee[] | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const refFichier = useRef<HTMLInputElement>(null);

  useEffect(() => {
    createClient()
      .from("chantierci_lots")
      .select("*")
      .order("nom")
      .range(0, 99)
      .then(({ data }) => setLots(data ?? []));
  }, []);

  async function analyserFichier(fichier: File) {
    setResultat(null);
    setErreur(null);
    const texte = await fichier.text();
    const tableau = parserCSV(texte);
    if (tableau.length < 2) {
      setErreur("Fichier vide ou sans ligne de données.");
      setLignes(null);
      return;
    }
    const entetes = tableau[0].map((e) => e.trim().toLowerCase());
    if (!entetes.includes("nom")) {
      setErreur(
        `En-têtes invalides. Colonnes attendues : ${COLONNES_ATTENDUES.join(", ")}`
      );
      setLignes(null);
      return;
    }
    const index = (nom: string) => entetes.indexOf(nom);
    const lotsParNom = new Map(lots.map((l) => [l.nom.toLowerCase(), l.id]));

    const validees: LigneValidee[] = tableau.slice(1).map((valeurs, i) => {
      const champ = (nom: string) => {
        const idx = index(nom);
        return idx >= 0 ? (valeurs[idx] ?? "").trim() : "";
      };
      const erreurs: string[] = [];

      const nom = champ("nom");
      if (!nom) erreurs.push("nom manquant");

      const lotNom = champ("lot");
      let lotId: string | null = null;
      if (lotNom) {
        lotId = lotsParNom.get(lotNom.toLowerCase()) ?? null;
        if (!lotId) erreurs.push(`lot inconnu : « ${lotNom} »`);
      }

      const statutBrut = champ("statut") || "non_demarre";
      if (!(STATUTS_VALIDES as readonly string[]).includes(statutBrut))
        erreurs.push(`statut invalide : « ${statutBrut} »`);

      const nombre = (v: string) => {
        if (!v) return null;
        const n = Number(v.replace(",", "."));
        return Number.isFinite(n) ? n : NaN;
      };
      const latitude = nombre(champ("latitude"));
      const longitude = nombre(champ("longitude"));
      if (Number.isNaN(latitude)) erreurs.push("latitude invalide");
      if (Number.isNaN(longitude)) erreurs.push("longitude invalide");

      return {
        numero: i + 2,
        erreurs,
        etablissement:
          erreurs.length > 0
            ? null
            : {
                nom,
                nom_directeur: champ("nom_directeur") || null,
                telephone: champ("telephone") || null,
                email: champ("email") || null,
                latitude: latitude as number | null,
                longitude: longitude as number | null,
                province: champ("province") || null,
                departement: champ("departement") || null,
                village: champ("village") || null,
                lot_id: lotId,
                statut: statutBrut as EtablissementInsert["statut"],
              },
      };
    });
    setLignes(validees);
  }

  async function importer() {
    if (!lignes) return;
    const valides = lignes
      .filter((l) => l.etablissement)
      .map((l) => l.etablissement!) as EtablissementInsert[];
    if (valides.length === 0) return;
    setEnCours(true);
    setErreur(null);
    try {
      const supabase = createClient();
      let inseres = 0;
      for (let i = 0; i < valides.length; i += 100) {
        const { error } = await supabase
          .from("chantierci_etablissements")
          .insert(valides.slice(i, i + 100));
        if (error) throw new Error(error.message);
        inseres += Math.min(100, valides.length - i);
      }
      setResultat(`${inseres} établissement(s) importé(s) avec succès.`);
      setLignes(null);
      if (refFichier.current) refFichier.current.value = "";
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Import impossible");
    } finally {
      setEnCours(false);
    }
  }

  const valides = (lignes ?? []).filter((l) => l.etablissement).length;
  const invalides = (lignes ?? []).length - valides;

  return (
    <div className="max-w-3xl">
      <div className="mb-4 rounded-xl bg-white p-5 shadow-sm">
        <p className="mb-2 text-sm font-medium">Format attendu (CSV, séparateur « ; » ou « , »)</p>
        <code className="block overflow-x-auto rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
          {COLONNES_ATTENDUES.join(";")}
        </code>
        <p className="mt-2 text-xs text-gray-500">
          « lot » = nom exact d&apos;un lot existant (
          {lots.map((l) => l.nom).join(", ") || "aucun lot"}). « statut » parmi :{" "}
          {STATUTS_VALIDES.join(", ")} (défaut : non_demarre). Seule la colonne
          « nom » est obligatoire.
        </p>

        <input
          ref={refFichier}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          id="fichierCSV"
          onChange={(e) => e.target.files?.[0] && analyserFichier(e.target.files[0])}
        />
        <label
          htmlFor="fichierCSV"
          className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-4 text-sm font-medium text-gray-600 transition hover:border-assemblage hover:text-assemblage"
        >
          <FileUp className="h-5 w-5" /> Choisir un fichier CSV
        </label>
      </div>

      {erreur && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreur}
        </p>
      )}
      {resultat && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          <CheckCircle2 className="h-4 w-4" /> {resultat}
        </p>
      )}

      {lignes && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Aperçu : {valides} ligne(s) valide(s)
              {invalides > 0 && (
                <span className="text-red-600"> · {invalides} en erreur</span>
              )}
            </p>
            <button
              onClick={importer}
              disabled={enCours || valides === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-assemblage px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {enCours && <Loader2 className="h-4 w-4 animate-spin" />}
              Importer {valides} établissement(s)
            </button>
          </div>

          {invalides > 0 && (
            <ul className="mb-3 space-y-1">
              {lignes
                .filter((l) => l.erreurs.length > 0)
                .slice(0, 10)
                .map((l) => (
                  <li
                    key={l.numero}
                    className="flex items-center gap-2 text-xs text-red-700"
                  >
                    <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                    Ligne {l.numero} : {l.erreurs.join(", ")}
                  </li>
                ))}
            </ul>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-sidebar text-left uppercase tracking-wide text-white">
                  <th className="px-2 py-2 font-medium">Nom</th>
                  <th className="px-2 py-2 font-medium">Département</th>
                  <th className="px-2 py-2 font-medium">Lot</th>
                  <th className="px-2 py-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {lignes
                  .filter((l) => l.etablissement)
                  .slice(0, 10)
                  .map((l) => (
                    <tr key={l.numero} className="border-b border-gray-100">
                      <td className="px-2 py-1.5">{l.etablissement!.nom}</td>
                      <td className="px-2 py-1.5">
                        {l.etablissement!.departement ?? "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        {lots.find((x) => x.id === l.etablissement!.lot_id)?.nom ??
                          "—"}
                      </td>
                      <td className="px-2 py-1.5">{l.etablissement!.statut}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {valides > 10 && (
              <p className="mt-1 text-xs text-gray-400">
                … et {valides - 10} autre(s) ligne(s).
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
