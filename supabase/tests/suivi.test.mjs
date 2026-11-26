// Tests du suivi du remplissage : fonction chantierci_remplissage (comptes par
// site, type de formulaire et semaine glissante ; RLS). Usage : npm run test:db
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { creerBaseSimulee } from "./supabase-simule.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const lire = (p) => readFileSync(path.join(repo, p), "utf8");
const db = await creerBaseSimulee();
for (const f of readdirSync(path.join(repo, "supabase/migrations")).sort()) await db.exec(lire(`supabase/migrations/${f}`));
await db.exec(lire("supabase/seed/comptes_test.sql"));

const U = {
  ug: "33333333-3333-4333-8333-00000000000b",
  ctrl: "33333333-3333-4333-8333-00000000000d",
};
const L1901 = (await db.query("select id from public.chantierci_sites where code = 'L19-01'")).rows[0].id;

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
// Date relative au lundi de la semaine en cours (semaines calendaires).
const visite = (source, decalage, statut = "en_cours") =>
  db.query(
    `insert into public.chantierci_visites (site_id, source, date_visite, statut, donnees_test)
     values ($1, $2, date_trunc('week', current_date)::date + $3::int, $4, true)`,
    [L1901, source, decalage, statut]
  );

// Lundi de cette semaine (×2) → semaine en cours (index 7) = 2 ; dimanche
// dernier → semaine précédente ; il y a 9 semaines → hors des 8 semaines.
await visite("moe", 0);
await visite("moe", 0);
await visite("moe", -1);
await visite("moe", -63);
await visite("cstc", -7, "arrete");   // lundi de la semaine précédente : « arrêté »
await visite("ug", -8);     // dimanche d'il y a deux semaines

const lignes = (await en(U.ug, "select * from public.chantierci_remplissage(8)")).rows;
verifier("UG : une ligne par site", lignes.length === 387, `${lignes.length}`);
const l = lignes.find((x) => x.site_id === L1901);
verifier("8 semaines par type, de la plus ancienne à la plus récente", l.moe.length === 8 && l.cstc.length === 8 && l.ug.length === 8);
verifier("MOE : 2 rapports cette semaine, 1 la semaine précédente", l.moe[7] === 2 && l.moe[6] === 1 && l.moe.slice(0, 6).every((n) => n === 0),
  JSON.stringify(l.moe));
verifier("CSTC : lundi précédent → semaine -1", l.cstc[6] === 1, JSON.stringify(l.cstc));
verifier("UG : dimanche d'il y a deux semaines → semaine -2", l.ug[5] === 1, JSON.stringify(l.ug));
const jour = (d) => new Date(d).toISOString().slice(0, 10);
verifier("date du dernier rapport MOE = lundi de la semaine", jour(l.moe_dernier) === jour(l.date_ref));
verifier("site sans formulaire : tableaux à zéro, pas de date",
  lignes.some((x) => x.site_id !== L1901 && x.moe.every((n) => n === 0) && x.moe_dernier === null));

// Statut déclaré par chaque acteur avant chaque semaine (formulaire « attendu »).
verifier("MOE : statut avant la semaine en cours = « en cours » (dimanche dernier)", l.moe_statuts[7] === "en_cours", JSON.stringify(l.moe_statuts));
verifier("MOE : statut avant la 1re semaine = rapport d'il y a 9 semaines", l.moe_statuts[0] === "en_cours");
verifier("CSTC : « arrêté » déclaré avant la semaine en cours", l.cstc_statuts[7] === "arrete", JSON.stringify(l.cstc_statuts));
verifier("CSTC : aucun formulaire antérieur → statut inconnu", l.cstc_statuts[6] === null);
verifier("dernier statut déclaré par type", l.moe_dernier_statut === "en_cours" && l.cstc_dernier_statut === "arrete" && l.ug_dernier_statut === "en_cours");
verifier("site sans formulaire : pas de statut", lignes.some((x) => x.site_id !== L1901 && x.moe_dernier_statut === null && x.moe_statuts.every((v) => v === null)));

const ctrl = (await en(U.ctrl, "select * from public.chantierci_remplissage(8)")).rows;
const lc = ctrl.find((x) => x.site_id === L1901);
verifier("contrôleur MOE : ses 16 sites seulement", ctrl.length === 16, `${ctrl.length}`);
verifier("contrôleur MOE : ne compte pas les formulaires CSTC / UG (RLS)", lc.moe[7] === 2 && lc.cstc.every((n) => n === 0) && lc.ug_dernier === null);

const quatre = (await en(U.ug, "select moe from public.chantierci_remplissage(4) limit 1")).rows[0];
verifier("nombre de semaines paramétrable", quatre.moe.length === 4);

await db.exec("set role anon");
try {
  await db.query("select * from public.chantierci_remplissage()");
  verifier("refusé aux visiteurs non connectés", false);
} catch (err) {
  verifier("refusé aux visiteurs non connectés", /permission denied/.test(err.message));
} finally {
  await db.exec("reset role");
}

// Avec les données fictives : remplissage imparfait et rapide à calculer.
await db.exec(lire("supabase/seed/donnees_fictives.sql"));
const t0 = Date.now();
const tout = (await en(U.ug, "select * from public.chantierci_remplissage(8)")).rows;
const duree = Date.now() - t0;
const semainesMoe = tout.flatMap((x) => x.moe.slice(0, 7)); // semaines complètes (hors semaine en cours)
const tauxMoe = semainesMoe.filter((n) => n > 0).length / semainesMoe.length;
const semainesCstc = tout.flatMap((x) => x.cstc.slice(0, 7));
const tauxCstc = semainesCstc.filter((n) => n > 0).length / semainesCstc.length;
verifier("données fictives : MOE presque toujours au rendez-vous", tauxMoe > 0.85 && tauxMoe < 1, `${Math.round(tauxMoe * 100)} %`);
verifier("données fictives : CSTC moins régulier", tauxCstc < tauxMoe, `${Math.round(tauxCstc * 100)} %`);
verifier("calcul rapide sur 387 sites", duree < 5000, `${duree} ms (PGlite)`);
const divergents = tout.filter((x) => x.moe_dernier_statut === "en_cours" && x.cstc_dernier_statut && x.cstc_dernier_statut !== "en_cours");
verifier("données fictives : le CSTC déclare parfois autre chose que la MOE", divergents.length > 0 && divergents.length < 120,
  `${divergents.length} sites (MOE « en cours », CSTC ${[...new Set(divergents.map((x) => x.cstc_dernier_statut))].join(" / ")})`);
const ugArrete = tout.filter((x) => x.moe_dernier_statut === "en_cours" && x.ug_dernier_statut === "arrete").length;
verifier("données fictives : l'UG déclare parfois « arrêté » un chantier en cours pour la MOE", ugArrete > 0, `${ugArrete} sites`);
const moeStatuts = (await db.query("select count(*)::int n from public.chantierci_visites where source = 'moe' and statut = 'arrete'")).rows[0].n;
verifier("statuts MOE inchangés (référence du tableau de bord)", moeStatuts > 0);

console.log(echecs ? `\n${echecs} ÉCHEC(S)` : "\nSuivi du remplissage : tous les tests passent.");
process.exit(echecs ? 1 : 0);
