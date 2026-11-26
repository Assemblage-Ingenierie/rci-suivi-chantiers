// Vérifie supabase/installation.sql dans la situation réelle : une base qui
// contient déjà le schéma v1 (archive-v1) avec ses données de test.
// Usage : npm run test:db
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { creerBaseSimulee } from "./supabase-simule.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const lire = (p) => readFileSync(path.join(repo, p), "utf8");
let echecs = 0;
const verifier = (nom, ok, detail = "") => {
  console.log(`${ok ? "OK  " : "ÉCHEC"}  ${nom}${detail ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
};

const db = await creerBaseSimulee();

// 1. Base dans l'état actuel du projet Supabase : schéma v1 complet + seed v1.
const v1 = "supabase/archive-v1/migrations";
for (const f of readdirSync(path.join(repo, v1)).sort()) await db.exec(lire(`${v1}/${f}`));
await db.exec(lire("supabase/archive-v1/seed/seed.sql"));
const avant = (await db.query("select count(*)::int n from public.chantierci_etablissements")).rows[0].n;
verifier("schéma v1 + données v1 chargés", avant > 0, `${avant} établissements v1`);

// 2. Rejouer un fichier v1 reproduit l'erreur signalée (preuve que ce n'est pas le nouveau script).
try {
  await db.exec(lire(`${v1}/20260612100900_evolutions.sql`));
  verifier("rejouer un fichier v1 échoue", false);
} catch (e) {
  verifier("rejouer un fichier v1 échoue comme sur Supabase", /already exists/.test(e.message), e.message.split("\n")[0]);
}

// 2 bis. Lancer les comptes de test AVANT l'installation donne un message clair.
try {
  await db.exec(lire("supabase/seed/comptes_test.sql"));
  verifier("comptes de test avant installation refusés", false);
} catch (e) {
  verifier("comptes de test avant installation : message clair",
    /pas installé/.test(e.message), e.message.split("\n")[0]);
}

// 3. Installation complète en une fois.
await db.exec(lire("supabase/installation.sql"));
const restes = (await db.query(`
  select count(*)::int n from pg_tables
  where schemaname = 'public' and tablename in
    ('chantierci_etablissements','chantierci_marches_travaux',
     'chantierci_paiements','chantierci_photos_visites')`)).rows[0].n;
verifier("tables v1 supprimées", restes === 0);
// chantierci_commentaires existe dans les deux versions : vérifier que c'est la nouvelle (par site).
const ancienneStructure = (await db.query(`
  select count(*)::int n from information_schema.columns
  where table_schema = 'public' and table_name = 'chantierci_commentaires' and column_name = 'etablissement_id'`)).rows[0].n;
verifier("commentaires : table v1 remplacée par celle de la refonte", ancienneStructure === 0);
verifier("comptes de test v1 supprimés",
  (await db.query("select count(*)::int n from auth.users where email like '%@chantierci.test'")).rows[0].n === 0);
const politiquesStorage = (await db.query(
  "select policyname, coalesce(qual, '') || coalesce(with_check, '') def from pg_policies where schemaname = 'storage'")).rows;
verifier("politiques Storage v1 remplacées par celles de la refonte",
  politiquesStorage.length === 3 && politiquesStorage.every((p) => !/etablissement|chantierci_visites v\s+where v\.etablissement/.test(p.def)),
  politiquesStorage.map((p) => p.policyname).join(", "));
verifier("bucket photos conservé",
  (await db.query("select count(*)::int n from storage.buckets where id = 'chantierci-photos-visites'")).rows[0].n === 1);
verifier("387 sites installés",
  (await db.query("select count(*)::int n from public.chantierci_sites")).rows[0].n === 387);

// 4. Le script est rejouable (purge puis réinstallation).
await db.exec(lire("supabase/installation.sql"));
verifier("installation rejouable",
  (await db.query("select count(*)::int n from public.chantierci_sites")).rows[0].n === 387);

// 5. Les comptes de test s'installent ensuite.
await db.exec(lire("supabase/seed/comptes_test.sql"));
verifier("comptes de test installés",
  (await db.query("select count(*)::int n from public.chantierci_profiles")).rows[0].n === 6);
await db.exec(lire("supabase/seed/comptes_test.sql"));
verifier("comptes de test rejouables",
  (await db.query("select count(*)::int n from public.chantierci_profiles")).rows[0].n === 6 &&
  (await db.query("select count(*)::int n from public.chantierci_affectations")).rows[0].n === 17);

console.log(echecs ? `\n${echecs} ÉCHEC(S)` : "\nInstallation : tous les tests passent.");
process.exit(echecs ? 1 : 0);
