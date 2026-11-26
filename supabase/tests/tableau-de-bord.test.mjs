// Tests du tableau de bord : vue chantierci_v_etat_sites (dernier rapport MOE,
// écart UG / MOE à ± 7 jours, positions), commentaires et leurs droits.
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

const U = {
  admin: "33333333-3333-4333-8333-00000000000a",
  ug: "33333333-3333-4333-8333-00000000000b",
  chef: "33333333-3333-4333-8333-00000000000c",
  ctrl: "33333333-3333-4333-8333-00000000000d",
  cstc: "33333333-3333-4333-8333-00000000000e",
};
const site = async (code) => (await db.query("select id from public.chantierci_sites where code = $1", [code])).rows[0].id;
const L1901 = await site("L19-01");
const L0101 = await site("L01-01");

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
async function doitEchouer(nom, user, sql, params = []) {
  try {
    const r = await en(user, sql, params);
    verifier(nom, (r.affectedRows ?? 0) === 0, `aucune erreur, ${r.affectedRows ?? 0} ligne(s)`);
  } catch (e) {
    verifier(nom, true, "refusé : " + e.message.split("\n")[0]);
  }
}
// Visite insérée hors application (comme le script de données fictives).
const visite = (siteId, source, date, postes, statut = "en_cours") =>
  db.query(
    `insert into public.chantierci_visites (site_id, source, date_visite, statut, postes, donnees_test)
     values ($1, $2, $3, $4, $5, true)`,
    [siteId, source, date, statut, JSON.stringify(postes)]
  );
const tout = (v) => ({
  classe: Object.fromEntries(["terrassements", "fondations", "elevation", "ouvrages_divers", "charpente", "couverture",
    "serrurerie", "electricite", "menuiserie", "faux_plafond", "peinture"].map((c) => [c, v])),
  latrines: Object.fromEntries(["terrassements", "gros_oeuvre", "charpente_couverture", "menuiserie", "plomberie",
    "revetements", "electricite", "peinture", "ventilation"].map((c) => [c, v])),
});
const etat = async (user, id) =>
  (await en(user, "select * from public.chantierci_v_etat_sites where id = $1", [id])).rows[0];

// --- Vue état des sites ------------------------------------------------------------
const n = (await en(U.ug, "select count(*)::int n from public.chantierci_v_etat_sites")).rows[0].n;
verifier("UG : une ligne par site (387)", n === 387, `${n}`);
const nCtrl = (await en(U.ctrl, "select count(*)::int n from public.chantierci_v_etat_sites")).rows[0].n;
verifier("contrôleur MOE : seulement ses sites (RLS appliquée)", nCtrl === 16, `${nCtrl}`);

let e = await etat(U.ug, L1901);
verifier("site sans visite : avancement MOE vide", e.moe_avancement === null && e.moe_date === null);
verifier("position approximative = chef-lieu du département",
  e.origine_position === "departement" && Math.abs(e.latitude - 7.96) <= 0.08 && Math.abs(e.longitude + 6.67) <= 0.08,
  `${e.latitude}, ${e.longitude}`);
const sansPosition = (await en(U.ug, "select count(*)::int n from public.chantierci_v_etat_sites where latitude is null")).rows[0].n;
verifier("tous les sites ont une position", sansPosition === 0, `${sansPosition} sans position`);

await visite(L1901, "moe", "2026-10-01", tout(20));
await visite(L1901, "moe", "2026-10-15", tout(40), "arrete");
await visite(L1901, "ug", "2026-10-20", tout(50));
e = await etat(U.ug, L1901);
verifier("dernier rapport MOE retenu", e.moe_date === "2026-10-15" || String(e.moe_date).startsWith("2026-10-15") || new Date(e.moe_date).toISOString().startsWith("2026-10-15"),
  String(e.moe_date));
verifier("avancement et statut MOE du dernier rapport", Number(e.moe_avancement) === 40 && e.moe_statut === "arrete",
  `${e.moe_avancement} / ${e.moe_statut}`);
verifier("nombre de rapports MOE", e.moe_nb === 2);
verifier("fiche UG comparée à la visite MOE la plus proche (5 j)", Number(e.ug_avancement_moe_compare) === 40);
verifier("écart UG − MOE = +10 points → discordance", Number(e.ecart_ug_moe) === 10 && e.discordance === true,
  `${e.ecart_ug_moe}`);

verifier("début de l'arrêt en cours", String(new Date(e.moe_arrete_depuis).toISOString()).startsWith("2026-10-14") || String(e.moe_arrete_depuis).includes("Oct 15"),
  String(e.moe_arrete_depuis));

// --- Statut « ralenti » retiré --------------------------------------------------------
try {
  await visite(L1901, "moe", "2026-10-16", tout(40), "ralenti");
  verifier("statut « ralenti » refusé", false);
} catch (err) {
  verifier("statut « ralenti » refusé", /sans_ralenti/.test(err.message), err.message.split(String.fromCharCode(10))[0]);
}

await visite(L1901, "ug", "2026-11-20", tout(60));
e = await etat(U.ug, L1901);
verifier("aucune visite MOE à ± 7 jours → pas de comparaison",
  e.ug_avancement_moe_compare === null && e.ecart_ug_moe === null && e.discordance === false);

await visite(L1901, "moe", "2026-11-24", tout(60));
e = await etat(U.ug, L1901);
verifier("écart nul → pas de discordance", Number(e.ecart_ug_moe) === 0 && e.discordance === false);

await db.query("update public.chantierci_parametres set valeur = 2 where cle = 'fenetre_comparaison_jours'");
e = await etat(U.ug, L1901);
verifier("fenêtre de comparaison paramétrable (2 j → plus de comparaison)", e.ecart_ug_moe === null);
await db.query("update public.chantierci_parametres set valeur = 7 where cle = 'fenetre_comparaison_jours'");

await db.query("update public.chantierci_sites set latitude = 8.1, longitude = -6.5 where id = $1", [L1901]);
e = await etat(U.ug, L1901);
verifier("coordonnées du site prioritaires", e.origine_position === "site" && e.latitude === 8.1);

// --- Réponses des dernières visites et évolution --------------------------------------
await db.query(
  `insert into public.chantierci_visites (site_id, source, date_visite, statut, reponses, donnees_test)
   values ($1, 'cstc', '2026-11-23', 'en_cours', '{"tensions": ["entreprise"]}', true)`, [L1901]);
e = await etat(U.ug, L1901);
verifier("réponses du dernier signalement CSTC exposées", e.cstc_reponses?.tensions?.[0] === "entreprise");
verifier("chantier reparti : plus de date d'arrêt", e.moe_statut === "en_cours" && e.moe_arrete_depuis === null);

const evo = (await en(U.ug, "select date_ref, avancement::float av from public.chantierci_evolution_avancement()")).rows;
const aujourdhui = new Date().toISOString().slice(0, 10);
verifier("évolution : une valeur par semaine jusqu'à aujourd'hui", evo.length >= 2 &&
  new Date(evo.at(-1).date_ref).toISOString().slice(0, 10) <= aujourdhui, `${evo.length} points`);
verifier("évolution : croissante pour ce site", evo.at(-1).av >= evo[0].av, `${evo[0].av} → ${evo.at(-1).av}`);
const evoMoe1 = (await en(U.ug, "select count(*)::int n, max(avancement)::float mx from public.chantierci_evolution_avancement(1)")).rows[0];
verifier("évolution filtrée par lot MOE (MOE 1 sans visite → 0 %)", evoMoe1.mx === 0, `${evoMoe1.n} points, max ${evoMoe1.mx}`);
await db.exec("set role anon");
try {
  await db.query("select * from public.chantierci_evolution_avancement()");
  verifier("évolution refusée aux visiteurs non connectés", false);
} catch (err) {
  verifier("évolution refusée aux visiteurs non connectés", /permission denied/.test(err.message), err.message.split(String.fromCharCode(10))[0]);
} finally {
  await db.exec("reset role");
}

// --- Commentaires ------------------------------------------------------------------
const ins = "insert into public.chantierci_commentaires (site_id, texte, auteur_nom) values ($1, $2, 'usurpé') returning id, auteur_id, auteur_nom";
const cUg = (await en(U.ug, ins, [L0101, "Chantier propre."])).rows[0];
verifier("UG commente un site ; auteur imposé", cUg.auteur_id === U.ug && cUg.auteur_nom === "Awa UG TEST");
const cAdmin = (await en(U.admin, ins, [L0101, "Vu en comité."])).rows[0];
verifier("admin commente un site", !!cAdmin);
await doitEchouer("contrôleur MOE ne commente pas", U.ctrl, ins, [L1901, "x"]);
await doitEchouer("CSTC ne commente pas", U.cstc, ins, [L1901, "x"]);
await doitEchouer("commentaire vide refusé", U.ug, ins, [L0101, "   "]);
const vusCtrl = (await en(U.ctrl, "select count(*)::int n from public.chantierci_commentaires")).rows[0].n;
verifier("contrôleur MOE ne lit pas les commentaires", vusCtrl === 0);
const vusUg = (await en(U.ug, "select count(*)::int n from public.chantierci_commentaires")).rows[0].n;
verifier("UG lit tous les commentaires", vusUg === 2);

await doitEchouer("UG ne modifie pas le commentaire de l'admin", U.ug,
  "update public.chantierci_commentaires set texte = 'x' where id = $1", [cAdmin.id]);
const maj = await en(U.ug, "update public.chantierci_commentaires set texte = 'Chantier très propre.', auteur_nom = 'autre' where id = $1 returning texte, auteur_nom", [cUg.id]);
verifier("UG corrige son commentaire (auteur figé)", maj.rows[0]?.texte === "Chantier très propre." && maj.rows[0]?.auteur_nom === "Awa UG TEST");
await doitEchouer("UG ne supprime pas le commentaire de l'admin", U.ug,
  "delete from public.chantierci_commentaires where id = $1", [cAdmin.id]);
const supp = await en(U.admin, "delete from public.chantierci_commentaires where id = $1", [cUg.id]);
verifier("admin supprime n'importe quel commentaire", supp.affectedRows === 1);

// --- Données fictives : commentaires générés ----------------------------------------
await db.exec(lire("supabase/seed/donnees_fictives.sql"));
const com = (await db.query("select count(*)::int n from public.chantierci_commentaires where donnees_test")).rows[0].n;
verifier("données fictives : commentaires UG générés", com > 0, `${com} commentaires`);
const disc = (await db.query("select count(*)::int n from public.chantierci_v_etat_sites where discordance")).rows[0].n;
verifier("données fictives : sites en discordance", disc > 0, `${disc} sites`);
const t0 = Date.now();
await en(U.ug, "select * from public.chantierci_v_etat_sites");
verifier("vue complète calculée rapidement", Date.now() - t0 < 5000, `${Date.now() - t0} ms (PGlite)`);
const t1 = Date.now();
const evoTout = (await en(U.ug, "select * from public.chantierci_evolution_avancement()")).rows;
verifier("évolution sur 387 sites calculée rapidement", Date.now() - t1 < 10000, `${evoTout.length} semaines en ${Date.now() - t1} ms (PGlite)`);
const ralentis = (await db.query("select count(*)::int n from public.chantierci_visites where statut::text = 'ralenti'")).rows[0].n;
verifier("données fictives : aucun statut « ralenti »", ralentis === 0);

console.log(echecs ? `\n${echecs} ÉCHEC(S)` : "\nTableau de bord : tous les tests passent.");
process.exit(echecs ? 1 : 0);
