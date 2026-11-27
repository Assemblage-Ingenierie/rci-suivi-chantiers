// Test du schéma refonte PATEB sur PGlite (Postgres WASM) avec un faux schéma auth.
// Usage : npm run test:db   (Postgres WASM, aucune base distante touchée)
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { creerBaseSimulee } from "./supabase-simule.mjs";

const repo = process.argv[2] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const db = await creerBaseSimulee();

const migrations = path.join(repo, "supabase/migrations");
for (const f of readdirSync(migrations).sort()) {
  await db.exec(readFileSync(path.join(migrations, f), "utf8"));
  console.log("migration OK  ", f);
}
// La purge doit aussi passer sur une base où le schéma v1 n'existe pas : déjà
// vérifié par le premier passage. Seed de test :
await db.exec(readFileSync(path.join(repo, "supabase/seed/comptes_test.sql"), "utf8"));
console.log("seed OK");

const U = {
  admin: "33333333-3333-4333-8333-00000000000a",
  ug: "33333333-3333-4333-8333-00000000000b",
  chef: "33333333-3333-4333-8333-00000000000c",
  ctrl: "33333333-3333-4333-8333-00000000000d",
  cstc: "33333333-3333-4333-8333-00000000000e",
  attente: "33333333-3333-4333-8333-00000000000f",
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
function verifier(nom, ok, detail = "") {
  console.log(`${ok ? "OK  " : "ÉCHEC"}  ${nom}${detail ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
}
async function doitEchouer(nom, user, sql) {
  try {
    const r = await en(user, sql);
    verifier(nom, (r.affectedRows ?? 0) === 0, `aucune erreur, ${r.affectedRows ?? 0} ligne(s) touchée(s)`);
  } catch (e) {
    verifier(nom, true, "refusé : " + e.message.split("\n")[0]);
  }
}
const compte = async (user, table) => Number((await en(user, `select count(*)::int n from ${table}`)).rows[0].n);

// --- Données ------------------------------------------------------------------
const tot = (await db.query("select count(*)::int n, count(*) filter (where type_latrines='a_eau')::int eau, count(*) filter (where not electricite)::int sans_elec from public.chantierci_sites")).rows[0];
verifier("387 sites importés", tot.n === 387, JSON.stringify(tot));
verifier("111 latrines à eau, 18 sans électricité", tot.eau === 111 && tot.sans_elec === 18);
const poids = (await db.query(`select (select sum(poids) from public.chantierci_lots)::bigint lots,
  (select sum(chantierci_private.montant_site(electricite, type_latrines)) from public.chantierci_sites)::bigint sites`)).rows[0];
verifier("poids des lots = montant DQE de leurs sites", Number(poids.lots) === Number(poids.sites) && Number(poids.lots) > 4e9,
  `${poids.lots} FCFA`);
const moe2 = (await db.query("select count(*)::int n from public.chantierci_sites where lot_moe_id = 2")).rows[0].n;

// --- Périmètres de lecture ---------------------------------------------------------
verifier("admin voit 387 sites", (await compte(U.admin, "public.chantierci_sites")) === 387);
verifier("UG voit 387 sites", (await compte(U.ug, "public.chantierci_sites")) === 387);
verifier(`chef MOE 2 voit ses ${moe2} sites`, (await compte(U.chef, "public.chantierci_sites")) === moe2);
verifier("contrôleur voit ses 16 sites (lot 19)", (await compte(U.ctrl, "public.chantierci_sites")) === 16);
verifier("CSTC voit 1 site", (await compte(U.cstc, "public.chantierci_sites")) === 1);
verifier("compte en attente : 0 site", (await compte(U.attente, "public.chantierci_sites")) === 0);
verifier("compte en attente : 0 lot", (await compte(U.attente, "public.chantierci_lots")) === 0);
verifier("compte en attente voit son profil", (await compte(U.attente, "public.chantierci_profiles")) === 1);
verifier("CSTC voit 33 lots", (await compte(U.cstc, "public.chantierci_lots")) === 33);
verifier("UG ne voit que son profil", (await compte(U.ug, "public.chantierci_profiles")) === 1);
verifier("admin voit les 6 profils", (await compte(U.admin, "public.chantierci_profiles")) === 6);
verifier("chef MOE voit les affectations de son lot (17)", (await compte(U.chef, "public.chantierci_affectations")) === 17);
verifier("CSTC ne voit que son affectation", (await compte(U.cstc, "public.chantierci_affectations")) === 1);

// --- Écritures interdites ------------------------------------------------------------
await doitEchouer("CSTC ne modifie pas un site", U.cstc, "update public.chantierci_sites set nom = 'X'");
await doitEchouer("UG ne modifie pas un site", U.ug, "update public.chantierci_sites set nom = 'X'");
await doitEchouer("UG ne modifie pas le poids d'un lot", U.ug, "update public.chantierci_lots set poids = 99");
await doitEchouer("CSTC ne s'auto-promeut pas admin", U.cstc, `update public.chantierci_profiles set role = 'admin' where id = '${U.cstc}'`);
await doitEchouer("compte en attente ne s'active pas", U.attente, `update public.chantierci_profiles set statut_compte = 'actif' where id = '${U.attente}'`);
const idL0101 = (await db.query("select id from public.chantierci_sites where code = 'L01-01'")).rows[0].id;
await doitEchouer("contrôleur ne s'affecte pas un site", U.ctrl, `insert into public.chantierci_affectations values ('${U.ctrl}', '${idL0101}')`);
await db.exec("set role anon;");
try {
  await db.query("select count(*) from public.chantierci_sites");
  verifier("anon ne lit rien", false, "lecture autorisée");
} catch (e) {
  verifier("anon ne lit rien", true, "refusé : " + e.message.split("\n")[0]);
} finally {
  await db.exec("reset role;");
}

// --- Règles métier ---------------------------------------------------------------------
await doitEchouer("un CSTC n'a qu'un site", U.admin, `insert into public.chantierci_affectations select '${U.cstc}', id from public.chantierci_sites where code = 'L19-02'`);
await doitEchouer("l'UG n'est pas affectée à un site", U.admin, `insert into public.chantierci_affectations select '${U.ug}', id from public.chantierci_sites where code = 'L19-02'`);

// --- Écritures autorisées ------------------------------------------------------------
const maj = await en(U.cstc, `update public.chantierci_profiles set telephone = '0700000000' where id = '${U.cstc}'`);
verifier("CSTC modifie son téléphone", maj.affectedRows === 1);
const majSite = await en(U.admin, "update public.chantierci_sites set localite = 'Séguéla' where code = 'L19-01'");
verifier("admin modifie un site", majSite.affectedRows === 1);
const majPoids = await en(U.admin, "update public.chantierci_lots set poids = 20 where id = 19");
verifier("admin modifie le poids d'un lot", majPoids.affectedRows === 1);

// Inscription : un nouvel utilisateur crée son profil en attente, pas admin.
const nouveau = "44444444-4444-4444-8444-000000000001";
await db.query(`insert into auth.users (id, email) values ('${nouveau}', 'nouveau@pateb.test')`);
await doitEchouer("inscription : profil admin refusé", nouveau,
  `insert into public.chantierci_profiles (id, role, statut_compte) values ('${nouveau}', 'admin', 'en_attente')`);
await doitEchouer("inscription : profil actif refusé", nouveau,
  `insert into public.chantierci_profiles (id, role, statut_compte) values ('${nouveau}', 'ug', 'actif')`);
await doitEchouer("inscription : profil CSTC refusé", nouveau,
  `insert into public.chantierci_profiles (id, role, statut_compte) values ('${nouveau}', 'cstc', 'en_attente')`);
const ins = await en(nouveau, `insert into public.chantierci_profiles (id, role, statut_compte) values ('${nouveau}', 'ug', 'en_attente')`);
verifier("inscription : profil UG en attente accepté", ins.affectedRows === 1);

// Rechargement du référentiel : la migration de données est rejouable.
await db.exec(readFileSync(path.join(migrations, "20261124100400_donnees_referentiel.sql"), "utf8"));
verifier("référentiel rejouable", (await db.query("select count(*)::int n from public.chantierci_sites")).rows[0].n === 387);
verifier("rejeu : affectations conservées", (await db.query("select count(*)::int n from public.chantierci_affectations")).rows[0].n === 17);
verifier("rejeu : poids modifié par l'admin conservé", Number((await db.query("select poids from public.chantierci_lots where id = 19")).rows[0].poids) === 20);

console.log(echecs ? `\n${echecs} ÉCHEC(S)` : "\nTous les tests passent.");
process.exit(echecs ? 1 : 0);
