// Tests de la migration 20261202100000_dqe_alertes.sql : postes pondérés par
// les montants du DQE, corps d'état, montant des sites, poids des lots,
// courbe d'évolution pondérée, date de début et paramètres des alertes.
// Usage : npm run test:db
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { creerBaseSimulee } from "./supabase-simule.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const lire = (p) => readFileSync(path.join(repo, p), "utf8");
const db = await creerBaseSimulee();
for (const f of readdirSync(path.join(repo, "supabase/migrations")).sort()) await db.exec(lire(`supabase/migrations/${f}`));
await db.exec(lire("supabase/seed/comptes_test.sql"));

const U = { admin: "33333333-3333-4333-8333-00000000000a", ug: "33333333-3333-4333-8333-00000000000b", ctrl: "33333333-3333-4333-8333-00000000000d" };
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

// --- Montants du DQE -------------------------------------------------------------------
let r = await un(`select
  chantierci_private.montant_site(true, 'seches')::bigint avec_seches,
  chantierci_private.montant_site(false, 'a_eau')::bigint sans_eau`);
verifier("montant d'un site électrifié avec latrines sèches = 12 701 930 FCFA", Number(r.avec_seches) === 12701930, r.avec_seches);
verifier("montant d'un site sans électricité avec latrines à eau = 13 848 335 FCFA", Number(r.sans_eau) === 13848335, r.sans_eau);
r = await un(`select count(*)::int n, count(corps_etat)::int avec from public.chantierci_postes`);
verifier("chaque poste est rattaché à un corps d'état", r.n === r.avec && r.n === 26, JSON.stringify(r));
r = await un(`select poids::int p from public.chantierci_postes where ouvrage = 'latrines_a_eau' and code = 'plafonnage'`);
verifier("poste « Plafonnage » des latrines à eau (172 500)", r?.p === 172500);
r = await un(`select count(*)::int n from public.chantierci_parametres where cle in ('part_classe', 'part_latrines')`);
verifier("répartition fixe 80 / 20 supprimée", r.n === 0);
r = await un(`select count(*)::int n from public.chantierci_parametres
              where cle in ('delai_travaux_mois', 'fraicheur_alertes_jours', 'seuil_retard_orange', 'seuil_retard_rouge')`);
verifier("paramètres du planning et des alertes", r.n === 4);
const corps = (await en(U.ctrl, "select count(*)::int n from public.chantierci_corps_etat")).rows[0].n;
verifier("corps d'état lisibles par tous les profils", corps === 10);

// --- Vue et date de début ----------------------------------------------------------------
const L1901 = (await un("select id from public.chantierci_sites where code = 'L19-01'")).id;
r = (await en(U.ug, "select montant::bigint m, date_debut from public.chantierci_v_etat_sites where id = $1", [L1901])).rows[0];
verifier("vue : montant DQE du site", Number(r.m) === 12701930, r.m);
await en(U.admin, "update public.chantierci_sites set date_debut = '2026-10-01' where id = $1", [L1901]);
r = (await en(U.ug, "select date_debut from public.chantierci_v_etat_sites where id = $1", [L1901])).rows[0];
verifier("date de début saisie par l'admin et lue dans la vue", String(r.date_debut).startsWith("Thu Oct 01 2026") || String(r.date_debut).includes("2026-10-01"), String(r.date_debut));
const refus = await en(U.ctrl, "update public.chantierci_sites set date_debut = '2026-01-01' where id = $1", [L1901]);
verifier("le contrôleur MOE ne modifie pas la date de début", refus.affectedRows === 0);

// --- Courbe d'évolution pondérée par les montants -------------------------------------------
await db.exec(lire("supabase/seed/donnees_fictives.sql"));
const evo = (await en(U.ug, "select avancement::float av from public.chantierci_evolution_avancement() order by date_ref desc limit 1")).rows[0].av;
const attendu = (
  await en(U.ug, `
    with s as (
      select v.lot_id, v.montant, coalesce(v.moe_avancement, 0) av from public.chantierci_v_etat_sites v
    ), l as (
      select lot_id, sum(av * montant) / sum(montant) av from s group by lot_id
    )
    select round(sum(l.av * lo.poids) / sum(lo.poids), 1)::float av from l join public.chantierci_lots lo on lo.id = l.lot_id`)
).rows[0].av;
verifier("dernier point de la courbe = avancement pondéré des derniers rapports", Math.abs(evo - attendu) <= 0.1, `${evo} / ${attendu}`);
const sansAv = await un(`select count(*)::int n from public.chantierci_visites v join public.chantierci_sites s on s.id = v.site_id
  where v.source in ('moe', 'ug') and v.avancement is distinct from chantierci_private.avancement_site(v.postes, s.electricite, s.type_latrines)`);
verifier("avancement enregistré cohérent avec les montants du DQE", sansAv.n === 0);

console.log(echecs ? `\n${echecs} ÉCHEC(S)` : "\nDQE et planning : tous les tests passent.");
process.exit(echecs ? 1 : 0);
