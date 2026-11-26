// Vérifie le script de données fictives : volume, cohérence des avancements,
// présence d'écarts MOE / UG, rejouabilité. Usage : npm run test:db
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { creerBaseSimulee } from "./supabase-simule.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const lire = (p) => readFileSync(path.join(repo, p), "utf8");
const db = await creerBaseSimulee();
for (const f of readdirSync(path.join(repo, "supabase/migrations")).sort()) await db.exec(lire(`supabase/migrations/${f}`));
await db.exec(lire("supabase/seed/comptes_test.sql"));

let echecs = 0;
const verifier = (nom, ok, detail = "") => {
  console.log(`${ok ? "OK  " : "ÉCHEC"}  ${nom}${detail ? "  (" + detail + ")" : ""}`);
  if (!ok) echecs++;
};
const q = async (sql) => (await db.query(sql)).rows;

const t0 = Date.now();
await db.exec(lire("supabase/seed/donnees_fictives.sql"));
const parSource = Object.fromEntries((await q(
  "select source, count(*)::int n from public.chantierci_visites where donnees_test group by source")).map((r) => [r.source, r.n]));
verifier("visites générées pour les 3 formulaires", parSource.moe > 0 && parSource.cstc > 0 && parSource.ug > 0,
  `${JSON.stringify(parSource)} en ${Date.now() - t0} ms`);
verifier("des rapports MOE sur les 387 sites",
  (await q("select count(distinct site_id)::int n from public.chantierci_visites where source = 'moe'"))[0].n === 387);

const av = (await q(`select min(avancement)::float mn, max(avancement)::float mx, avg(avancement)::float moy,
  count(*) filter (where avancement is null)::int nuls
  from public.chantierci_v_visites where source in ('moe', 'ug')`))[0];
verifier("avancements MOE / UG entre 0 et 100 %", av.mn >= 0 && av.mx <= 100 && av.nuls === 0,
  `min ${av.mn}, max ${av.mx}, moyenne ${Math.round(av.moy)} %`);

const statuts = (await q(`select statut, count(distinct site_id)::int n from (
  select distinct on (site_id) site_id, statut from public.chantierci_visites
  where source = 'moe' order by site_id, date_visite desc) d group by statut order by statut`))
  .map((r) => `${r.statut}:${r.n}`).join(" ");
verifier("statuts variés (dernier rapport MOE de chaque site)", statuts.includes("arrete") && statuts.includes("en_cours"), statuts);

const ecarts = (await q(`
  select count(*)::int n from (
    select distinct on (u.id) u.site_id, abs(u.avancement - m.avancement) as ecart
    from public.chantierci_v_visites u
    join public.chantierci_v_visites m on m.site_id = u.site_id and m.source = 'moe'
      and abs(m.date_visite - u.date_visite) <= 7
    where u.source = 'ug'
    order by u.id, abs(m.date_visite - u.date_visite)
  ) x where ecart > 5`))[0].n;
verifier("des écarts MOE / UG > 5 points existent", ecarts > 0, `${ecarts} fiches UG concernées`);

const cstc = (await q("select reponses from public.chantierci_visites where source = 'cstc' and donnees_test limit 1"))[0].reponses;
verifier("réponses CSTC complètes", ["ouvriers_presents", "securite", "latrines", "tensions", "mobilier"].every((k) => k in cstc));

await db.exec(lire("supabase/seed/donnees_fictives.sql"));
const total2 = (await q("select count(*)::int n from public.chantierci_visites where donnees_test"))[0].n;
verifier("rejouable sans doublon", total2 === parSource.moe + parSource.cstc + parSource.ug);

console.log(echecs ? `\n${echecs} ÉCHEC(S)` : "\nDonnées fictives : tous les tests passent.");
process.exit(echecs ? 1 : 0);
