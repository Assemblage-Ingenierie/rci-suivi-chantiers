// Tests de la migration 20261201100000_entreprises_positions.sql :
// entreprises titulaires des lots (droits, une entreprise pour plusieurs lots)
// et positions GPS des sites issues de la cartographie.
// Usage : npm run test:db
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { creerBaseSimulee } from "./supabase-simule.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const lire = (p) => readFileSync(path.join(repo, p), "utf8");
const MIGRATION = "20261201100000_entreprises_positions.sql";

const db = await creerBaseSimulee();
for (const f of readdirSync(path.join(repo, "supabase/migrations")).sort()) await db.exec(lire(`supabase/migrations/${f}`));
await db.exec(lire("supabase/seed/comptes_test.sql"));

const U = { admin: "33333333-3333-4333-8333-00000000000a", ctrl: "33333333-3333-4333-8333-00000000000d" };
async function en(user, sql, params = []) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
let echecs = 0;
const verifier = (nom, ok, detail = "") => {
  console.log(`${ok ? "OK  " : "ÉCHEC"}  ${nom}${detail ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
};
const un = async (sql, params) => (await db.query(sql, params)).rows[0];

let r = await un(`select count(*)::int lots, count(entreprise_id)::int avec, count(distinct entreprise_id)::int entreprises
                  from public.chantierci_lots`);
verifier("chaque lot a une entreprise provisoire", r.lots === 33 && r.avec === 33 && r.entreprises === 33, JSON.stringify(r));
r = await un("select e.nom from public.chantierci_lots l join public.chantierci_entreprises e on e.id = l.entreprise_id where l.id = 19");
verifier("lot 19 → « Entreprise 19 »", r.nom === "Entreprise 19");
r = await un(`select count(*)::int n from information_schema.columns
              where table_name = 'chantierci_lots' and column_name = 'entreprise_titulaire'`);
verifier("ancienne colonne entreprise_titulaire supprimée", r.n === 0);

const vus = (await en(U.ctrl, "select count(*)::int n from public.chantierci_entreprises")).rows[0].n;
verifier("contrôleur MOE lit les entreprises", vus === 33);
try {
  const ins = await en(U.ctrl, "insert into public.chantierci_entreprises (nom) values ('Pirate') returning id");
  verifier("contrôleur MOE ne crée pas d'entreprise", ins.rows.length === 0);
} catch (e) {
  verifier("contrôleur MOE ne crée pas d'entreprise", true, "refusé : " + e.message.split(String.fromCharCode(10))[0]);
}
const nouvelle = (await en(U.admin, "insert into public.chantierci_entreprises (nom) values ('SOGEA TEST') returning id")).rows[0].id;
await en(U.admin, "update public.chantierci_lots set entreprise_id = $1 where id in (1, 2, 3)", [nouvelle]);
r = await un("select count(*)::int n from public.chantierci_lots where entreprise_id = $1", [nouvelle]);
verifier("admin : une même entreprise pour plusieurs lots", r.n === 3);

r = await un(`select count(*)::int n, count(*) filter (where latitude between 4 and 11 and longitude between -9 and -2)::int dans_rci
              from public.chantierci_sites where latitude is not null`);
// 375 par le nom exact + 5 dont le nom diffère sur la carte (migration 20261202100000).
verifier("380 sites positionnés d'après la cartographie, tous en Côte d'Ivoire", r.n === 380 && r.dans_rci === 380, JSON.stringify(r));
r = await un("select latitude, longitude from public.chantierci_sites where code = 'L01-01'");
verifier("position de L01-01 (EPP BOUKO)", Math.abs(r.latitude - 9.477183) < 1e-6 && Math.abs(r.longitude + 3.172831) < 1e-6);
r = await un("select count(*)::int n from public.chantierci_v_etat_sites where origine_position = 'site'");
verifier("carte : 380 sites à leur position réelle", r.n === 380);

// Rejouable, sans écraser une position corrigée ni l'entreprise choisie.
await db.query("update public.chantierci_sites set latitude = 6, longitude = -5 where code = 'L01-01'");
await db.exec(lire(`supabase/migrations/${MIGRATION}`));
r = await un("select latitude from public.chantierci_sites where code = 'L01-01'");
const lots = await un("select count(*)::int n from public.chantierci_lots where entreprise_id = $1", [nouvelle]);
verifier("migration rejouable sans écraser les corrections", r.latitude === 6 && lots.n === 3);

console.log(echecs ? `\n${echecs} ÉCHEC(S)` : "\nEntreprises et positions : tous les tests passent.");
process.exit(echecs ? 1 : 0);
