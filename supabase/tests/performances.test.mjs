// Tests de la migration de performances (20261130100000) :
//   - mêmes résultats qu'avant pour la vue chantierci_v_etat_sites, la courbe
//     d'évolution et le remplissage, sur les données fictives complètes ;
//   - avancement enregistré dans chaque formulaire et tenu à jour.
// Usage : npm run test:db
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { creerBaseSimulee } from "./supabase-simule.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const lire = (p) => readFileSync(path.join(repo, p), "utf8");
const MIGRATION = "20261130100000_performances.sql";

const db = await creerBaseSimulee();
const migrations = readdirSync(path.join(repo, "supabase/migrations")).sort();
for (const f of migrations.filter((f) => f < MIGRATION)) await db.exec(lire(`supabase/migrations/${f}`));
await db.exec(lire("supabase/seed/comptes_test.sql"));
await db.exec(lire("supabase/seed/donnees_fictives.sql"));

const U = {
  admin: "33333333-3333-4333-8333-00000000000a",
  ug: "33333333-3333-4333-8333-00000000000b",
  chef: "33333333-3333-4333-8333-00000000000c",
  ctrl: "33333333-3333-4333-8333-00000000000d",
};
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
const chrono = async (f) => {
  const t0 = Date.now();
  const r = await f();
  return [r, Date.now() - t0];
};

// Résultats comparés avant / après la migration.
const REQUETES = {
  "vue des sites (UG)": [U.ug, "select * from public.chantierci_v_etat_sites order by id"],
  "vue des sites (contrôleur MOE)": [U.ctrl, "select * from public.chantierci_v_etat_sites order by id"],
  "évolution, tous lots MOE": [U.ug, "select * from public.chantierci_evolution_avancement()"],
  "évolution, lot MOE 2": [U.ug, "select * from public.chantierci_evolution_avancement(2)"],
  "évolution, lot MOE 3": [U.ug, "select * from public.chantierci_evolution_avancement(3)"],
  "évolution (chef de mission MOE 2)": [U.chef, "select * from public.chantierci_evolution_avancement()"],
  "remplissage 8 semaines (UG)": [U.ug, "select * from public.chantierci_remplissage(8) order by site_id"],
  "remplissage 12 semaines (UG)": [U.ug, "select * from public.chantierci_remplissage(12) order by site_id"],
  "remplissage (contrôleur MOE)": [U.ctrl, "select * from public.chantierci_remplissage(8) order by site_id"],
};
// Nombres comparés à la valeur (numeric renvoyé en texte ou en nombre selon le cas).
const normaliser = (rows) =>
  JSON.stringify(rows, (_, v) => (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v));

const avant = {};
const tempsAvant = {};
for (const [nom, [user, sql]] of Object.entries(REQUETES)) {
  const [r, ms] = await chrono(() => en(user, sql));
  avant[nom] = normaliser(r.rows);
  tempsAvant[nom] = ms;
}

await db.exec(lire(`supabase/migrations/${MIGRATION}`));

for (const [nom, [user, sql]] of Object.entries(REQUETES)) {
  const [r, ms] = await chrono(() => en(user, sql));
  const apres = normaliser(r.rows);
  verifier(`${nom} : résultats identiques`, apres === avant[nom], `${r.rows.length} lignes, ${tempsAvant[nom]} → ${ms} ms (PGlite)`);
}

// --- Avancement enregistré ------------------------------------------------------------
const ecarts = (
  await db.query(`
    select count(*)::int n from public.chantierci_visites v
    join public.chantierci_sites s on s.id = v.site_id
    where v.avancement is distinct from case when v.source in ('moe', 'ug')
      then chantierci_private.avancement_site(v.postes, s.electricite, s.type_latrines) end`)
).rows[0].n;
verifier("avancement enregistré pour tous les formulaires existants", ecarts === 0, `${ecarts} écart(s)`);

const site = (await db.query("select id, electricite from public.chantierci_sites where code = 'L19-01'")).rows[0];
const ins = await en(
  U.ctrl,
  `insert into public.chantierci_visites (site_id, source, date_visite, statut, postes, avancement)
   values ($1, 'moe', current_date, 'en_cours', '{"classe": {"terrassements": 100, "fondations": 50}}', 99)
   returning id, avancement::float av`,
  [site.id]
);
const v = ins.rows[0];
const attendu = (
  await db.query(
    `select chantierci_private.avancement_site('{"classe": {"terrassements": 100, "fondations": 50}}', s.electricite, s.type_latrines)::float a
     from public.chantierci_sites s where s.id = $1`,
    [site.id]
  )
).rows[0].a;
verifier("formulaire saisi : avancement calculé par la base (valeur du client ignorée)", v.av === attendu && v.av !== 99, `${v.av} %`);

const maj = await en(
  U.ctrl,
  `update public.chantierci_visites set postes = '{"classe": {"terrassements": 100, "fondations": 100}}', avancement = 0
   where id = $1 returning avancement::float av`,
  [v.id]
);
verifier("formulaire modifié : avancement recalculé", maj.rows[0].av > v.av, `${v.av} → ${maj.rows[0].av} %`);
const triche = await en(U.ctrl, "update public.chantierci_visites set avancement = 100 where id = $1 returning avancement::float av", [v.id]);
verifier("avancement non modifiable à la main", triche.rows[0]?.av === maj.rows[0].av, `${triche.rows[0]?.av} %`);

const avantSite = (
  await db.query("select count(*)::int n, max(updated_at) maj from public.chantierci_visites where site_id = $1", [site.id])
).rows[0];
await en(U.admin, "update public.chantierci_sites set electricite = not electricite where id = $1", [site.id]);
const ecartsSite = (
  await db.query(
    `select count(*)::int n from public.chantierci_visites v join public.chantierci_sites s on s.id = v.site_id
     where v.site_id = $1 and v.source in ('moe', 'ug')
       and v.avancement is distinct from chantierci_private.avancement_site(v.postes, s.electricite, s.type_latrines)`,
    [site.id]
  )
).rows[0].n;
const apresSite = (await db.query("select max(updated_at) maj from public.chantierci_visites where site_id = $1", [site.id])).rows[0];
verifier("électricité du site modifiée : avancement de ses formulaires recalculé", ecartsSite === 0, `${avantSite.n} formulaires`);
verifier("recalcul sans changer la date de modification des formulaires", String(apresSite.maj) === String(avantSite.maj));

// --- Base neuve : données fictives chargées après la migration ------------------------------
const neuve = await creerBaseSimulee();
for (const f of migrations) await neuve.exec(lire(`supabase/migrations/${f}`));
await neuve.exec(lire("supabase/seed/donnees_fictives.sql"));
const sansAvancement = (
  await neuve.query("select count(*)::int n from public.chantierci_visites where source in ('moe', 'ug') and avancement is null")
).rows[0].n;
verifier("base neuve : données fictives avec avancement enregistré", sansAvancement === 0);

console.log(echecs ? `\n${echecs} ÉCHEC(S)` : "\nPerformances : tous les tests passent.");
process.exit(echecs ? 1 : 0);
