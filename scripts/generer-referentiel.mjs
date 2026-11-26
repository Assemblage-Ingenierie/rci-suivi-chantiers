// Génère la migration SQL du référentiel (lots MOE, lots de travaux, sites)
// à partir de docs/refonte/sites_reference.csv.
//
//   node scripts/generer-referentiel.mjs
//
// Relançable : la migration produite vide puis recharge le référentiel.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(racine, "docs/refonte/sites_reference.csv");
const SORTIE = path.join(racine, "supabase/migrations/20261124100400_donnees_referentiel.sql");

const LOTS_MOE = [
  [1, "Lot MOE 1", ["Bounkani", "Gontougo", "Indénié-Djuablin"]],
  [2, "Lot MOE 2", ["Hambol", "Béré", "Worodougou"]],
  [3, "Lot MOE 3", ["Cavally", "Nawa"]],
  [4, "Lot MOE 4", ["Tchologo", "Bagoué", "Bafing", "Kabadougou", "Folon", "Gbôklé"]],
];

// Noms des lots de travaux (orthographe harmonisée).
const NOMS_LOTS = {
  1: "Bounkani 1", 2: "Bounkani 2", 3: "Gontougo 1", 4: "Gontougo 2",
  5: "Hambol 1", 6: "Hambol 2", 7: "Hambol 3", 8: "Hambol 4",
  9: "Tchologo 1", 10: "Tchologo 2", 11: "Tchologo 3", 12: "Tchologo 4",
  13: "Kabadougou et Folon", 14: "Bagoué 1", 15: "Bagoué 2",
  16: "Bafing et Béré 1", 17: "Béré 2", 18: "Worodougou 1", 19: "Worodougou 2",
  20: "Indénié-Djuablin 1", 21: "Indénié-Djuablin 2", 22: "Indénié-Djuablin 3",
  23: "Indénié-Djuablin 4", 24: "Indénié-Djuablin 5",
  25: "Nawa 1", 26: "Nawa 2", 27: "Nawa 3", 28: "Nawa 4",
  29: "Cavally 1", 30: "Cavally 2", 31: "Cavally 3", 32: "Cavally 4", 33: "Gbôklé",
};

const q = (v) => (v === null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) => `array[${a.map(q).join(", ")}]::text[]`;

const lignes = readFileSync(SOURCE, "utf8").replace(/^﻿/, "").trim().split(/\r?\n/);
const entetes = lignes[0].split(";");
const sites = lignes.slice(1).map((l) => {
  const v = l.split(";");
  return Object.fromEntries(entetes.map((h, i) => [h, (v[i] ?? "").trim()]));
});

const nbParLot = {};
for (const s of sites) nbParLot[s.lot_travaux] = (nbParLot[s.lot_travaux] ?? 0) + 1;

const valeursSites = sites.map((s) => {
  const nom = s.etablissement || `(site à identifier — lot ${s.lot_travaux})`;
  const latrines = s.latrines.startsWith("à") || s.latrines.startsWith("a ") ? "a_eau" : "seches";
  return `  (${[
    q(s.code_site), s.lot_travaux, s.lot_moe, q(nom), q(s.region), q(s.departement),
    q(s.localite), q(s.zone), s.electricite === "oui" ? "true" : "false",
    q(latrines), q(s.a_verifier),
  ].join(", ")})`;
});

const sql = `-- ============================================================================
-- Refonte PATEB — 4/4 — Données du référentiel (FICHIER GÉNÉRÉ)
--
-- Source : docs/refonte/sites_reference.csv (DAO travaux PATEB, ${sites.length} sites)
-- Généré par : node scripts/generer-referentiel.mjs — ne pas modifier à la main.
-- Poids des lots par défaut = nombre de sites du lot.
-- Rejouable : met à jour par identifiant / code sans rien supprimer (les
-- affectations et les poids déjà modifiés par l'admin sont conservés).
-- ============================================================================

insert into public.chantierci_lots_moe (id, nom, regions) values
${LOTS_MOE.map(([id, nom, regions]) => `  (${id}, ${q(nom)}, ${arr(regions)})`).join(",\n")}
on conflict (id) do update set nom = excluded.nom, regions = excluded.regions;

insert into public.chantierci_lots (id, nom, poids) values
${Object.entries(NOMS_LOTS).map(([id, nom]) => `  (${id}, ${q(nom)}, ${nbParLot[id] ?? 0})`).join(",\n")}
on conflict (id) do update set nom = excluded.nom;

insert into public.chantierci_sites
  (code, lot_id, lot_moe_id, nom, region, departement, localite, zone, electricite, type_latrines, a_verifier)
values
${valeursSites.join(",\n")}
on conflict (code) do update set
  lot_id = excluded.lot_id, lot_moe_id = excluded.lot_moe_id, nom = excluded.nom,
  region = excluded.region, departement = excluded.departement, localite = excluded.localite,
  zone = excluded.zone, electricite = excluded.electricite,
  type_latrines = excluded.type_latrines, a_verifier = excluded.a_verifier;
`;

writeFileSync(SORTIE, sql, "utf8");
console.log(`${sites.length} sites, ${Object.keys(NOMS_LOTS).length} lots -> ${path.relative(racine, SORTIE)}`);
