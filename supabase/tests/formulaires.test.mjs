// Tests des formulaires de visite : droits de saisie, de lecture, de
// modification, calcul d'avancement, photos. Usage : npm run test:db
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { creerBaseSimulee } from "./supabase-simule.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const db = await creerBaseSimulee();
const migrations = path.join(repo, "supabase/migrations");
for (const f of readdirSync(migrations).sort()) await db.exec(readFileSync(path.join(migrations, f), "utf8"));
await db.exec(readFileSync(path.join(repo, "supabase/seed/comptes_test.sql"), "utf8"));

const U = {
  admin: "33333333-3333-4333-8333-00000000000a",
  ug: "33333333-3333-4333-8333-00000000000b",
  chef: "33333333-3333-4333-8333-00000000000c",
  ctrl: "33333333-3333-4333-8333-00000000000d",
  cstc: "33333333-3333-4333-8333-00000000000e",
};
const site = async (code) => (await db.query("select id from public.chantierci_sites where code = $1", [code])).rows[0].id;
const L1901 = await site("L19-01"); // site du CSTC et du contrôleur (lot 19, MOE 2)
const L0501 = await site("L05-01"); // lot MOE 2, hors affectations du contrôleur
const L0101 = await site("L01-01"); // lot MOE 1
const L0605 = await site("L06-05"); // site sans électricité, latrines sèches

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
const nouvelle = (user, siteId, source, postes = {}) =>
  en(user,
    `insert into public.chantierci_visites (site_id, source, statut, postes, auteur_id)
     values ($1, $2, 'en_cours', $3, null) returning id, auteur_id, auteur_nom`,
    [siteId, source, JSON.stringify(postes)]);

// --- Saisie ------------------------------------------------------------------------
const vCstc = (await nouvelle(U.cstc, L1901, "cstc")).rows[0];
verifier("CSTC saisit un formulaire CSTC sur son site", !!vCstc);
verifier("auteur imposé = utilisateur connecté", vCstc.auteur_id === U.cstc && vCstc.auteur_nom === "Mariam CSTC TEST");
await doitEchouer("CSTC ne saisit pas de formulaire MOE", U.cstc,
  "insert into public.chantierci_visites (site_id, source, statut) values ($1, 'moe', 'en_cours')", [L1901]);
await doitEchouer("CSTC ne saisit pas sur un autre site", U.cstc,
  "insert into public.chantierci_visites (site_id, source, statut) values ($1, 'cstc', 'en_cours')", [L0501]);

const vCtrl = (await nouvelle(U.ctrl, L1901, "moe", { classe: { terrassements: 100 } })).rows[0];
verifier("contrôleur saisit un rapport MOE sur son site", !!vCtrl);
await doitEchouer("contrôleur ne saisit pas hors de ses sites", U.ctrl,
  "insert into public.chantierci_visites (site_id, source, statut) values ($1, 'moe', 'en_cours')", [L0501]);
await doitEchouer("contrôleur ne saisit pas de fiche UG", U.ctrl,
  "insert into public.chantierci_visites (site_id, source, statut) values ($1, 'ug', 'en_cours')", [L1901]);

const vChef = (await nouvelle(U.chef, L0501, "moe")).rows[0];
verifier("chef de mission saisit sur tout son lot MOE", !!vChef);
await doitEchouer("chef de mission ne saisit pas hors de son lot MOE", U.chef,
  "insert into public.chantierci_visites (site_id, source, statut) values ($1, 'moe', 'en_cours')", [L0101]);

const vUg = (await nouvelle(U.ug, L0101, "ug")).rows[0];
verifier("UG saisit une fiche UG sur n'importe quel site", !!vUg);
await doitEchouer("UG ne saisit pas de formulaire CSTC", U.ug,
  "insert into public.chantierci_visites (site_id, source, statut) values ($1, 'cstc', 'en_cours')", [L0101]);

for (const source of ["cstc", "moe", "ug"]) {
  const r = await nouvelle(U.admin, L0101, source);
  verifier(`admin saisit un formulaire ${source.toUpperCase()} sur n'importe quel site`, r.rows.length === 1);
}

// --- Lecture -----------------------------------------------------------------------
const lus = async (user) =>
  (await en(user, "select source, count(*)::int n from public.chantierci_visites group by source order by source")).rows
    .map((r) => `${r.source}:${r.n}`).join(" ");
verifier("CSTC ne lit que les formulaires CSTC de son site", (await lus(U.cstc)) === "cstc:1", await lus(U.cstc));
verifier("contrôleur ne lit que les rapports MOE de ses sites", (await lus(U.ctrl)) === "moe:1", await lus(U.ctrl));
verifier("chef lit les rapports MOE de son lot", (await lus(U.chef)) === "moe:2", await lus(U.chef));
verifier("UG lit tous les formulaires", (await lus(U.ug)) === "cstc:2 moe:3 ug:2", await lus(U.ug));

// --- Modification ------------------------------------------------------------------
const maj = (user, id) => en(user, "update public.chantierci_visites set commentaire = 'modifié' where id = $1", [id]);
verifier("CSTC corrige son formulaire (moins de 3 jours)", (await maj(U.cstc, vCstc.id)).affectedRows === 1);
await db.query("update public.chantierci_visites set created_at = now() - interval '4 days' where id = $1", [vCstc.id]);
verifier("CSTC ne corrige plus après 3 jours", (await maj(U.cstc, vCstc.id)).affectedRows === 0);
verifier("chef corrige le rapport de son contrôleur", (await maj(U.chef, vCtrl.id)).affectedRows === 1);
verifier("UG ne modifie pas un rapport MOE", (await maj(U.ug, vCtrl.id)).affectedRows === 0);
verifier("UG modifie sa fiche", (await maj(U.ug, vUg.id)).affectedRows === 1);
await doitEchouer("contrôleur ne déplace pas son rapport vers un autre site", U.ctrl,
  "update public.chantierci_visites set site_id = $1 where id = $2", [await site("L19-02"), vCtrl.id]);
const modif = (await db.query("select modifie_par from public.chantierci_visites where id = $1", [vCtrl.id])).rows[0];
verifier("modifie_par = dernier auteur de la modification", modif.modifie_par === U.chef);
await doitEchouer("contrôleur ne supprime pas", U.ctrl, "delete from public.chantierci_visites where id = $1", [vCtrl.id]);

// --- Avancement calculé ------------------------------------------------------------------
async function avancement(siteId, postes) {
  const id = (await nouvelle(U.admin, siteId, "moe", postes)).rows[0].id;
  return Number((await db.query("select avancement from public.chantierci_v_visites where id = $1", [id])).rows[0].avancement);
}
const tout = async (ouvrage, pct) => Object.fromEntries(
  (await db.query("select code from public.chantierci_postes where ouvrage = $1", [ouvrage])).rows.map((r) => [r.code, pct]));
verifier("salle 100 % + latrines 100 % = 100 %",
  (await avancement(L1901, { classe: await tout("classe", 100), latrines: await tout("latrines_seches", 100) })) === 100);
verifier("salle 100 % + latrines 0 % = 80 %",
  (await avancement(L1901, { classe: await tout("classe", 100), latrines: {} })) === 80);
const sansElec = await tout("classe", 100);
delete sansElec.electricite;
verifier("site sans électricité : le poste électricité est ignoré",
  (await avancement(L0605, { classe: sansElec })) === 80);
verifier("fondations seules (18 %) à 100 % = 14,4 %",
  (await avancement(L1901, { classe: { fondations: 100 } })) === 14.4);
const nulle = (await db.query("select avancement from public.chantierci_v_visites where id = $1", [vCstc.id])).rows[0].avancement;
verifier("formulaire CSTC sans postes : pas d'avancement", nulle === null);
await en(U.admin, "update public.chantierci_postes set poids = 0 where ouvrage = 'classe' and code <> 'fondations'");
verifier("changer un poids recalcule l'avancement",
  (await avancement(L1901, { classe: { fondations: 50 } })) === 40);

// --- Photos ---------------------------------------------------------------------------------
const ph = await en(U.cstc,
  "insert into public.chantierci_photos (visite_id, chemin) values ($1, $2)", [vCstc.id, `${vCstc.id}/a.jpg`]).catch((e) => e);
verifier("CSTC n'ajoute plus de photo après le délai de correction", ph instanceof Error);
const vCstc2 = (await nouvelle(U.cstc, L1901, "cstc")).rows[0];
verifier("CSTC ajoute une photo à son formulaire",
  (await en(U.cstc, "insert into public.chantierci_photos (visite_id, chemin) values ($1, $2)", [vCstc2.id, `${vCstc2.id}/b.jpg`])).affectedRows === 1);
await doitEchouer("UG n'ajoute pas de photo à un formulaire CSTC", U.ug,
  "insert into public.chantierci_photos (visite_id, chemin) values ($1, $2)", [vCstc2.id, `${vCstc2.id}/c.jpg`]);
verifier("contrôleur ne voit pas les photos CSTC",
  (await en(U.ctrl, "select count(*)::int n from public.chantierci_photos")).rows[0].n === 0);
verifier("fichier Storage : CSTC peut déposer dans le dossier de son formulaire",
  (await en(U.cstc, "insert into storage.objects (bucket_id, name) values ('chantierci-photos-visites', $1)", [`${vCstc2.id}/x.jpg`])).affectedRows === 1);
await doitEchouer("fichier Storage : dépôt refusé dans le dossier d'un autre formulaire", U.cstc,
  "insert into storage.objects (bucket_id, name) values ('chantierci-photos-visites', $1)", [`${vCtrl.id}/y.jpg`]);

console.log(echecs ? `\n${echecs} ÉCHEC(S)` : "\nFormulaires : tous les tests passent.");
process.exit(echecs ? 1 : 0);
