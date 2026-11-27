// Assemble les migrations de supabase/migrations/ en UN script à coller dans
// le SQL Editor de Supabase : supabase/installation.sql
//
//   npm run installation
//
// Le script s'exécute dans une transaction : en cas d'erreur, rien n'est modifié.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dossier = path.join(racine, "supabase/migrations");
const fichiers = readdirSync(dossier).filter((f) => f.endsWith(".sql")).sort();

const parties = fichiers.map(
  (f) => `-- >>>>>>>>>>>>>>>>>>>> ${f}\n${readFileSync(path.join(dossier, f), "utf8").trim()}\n`
);

// Objets de la refonte : supprimés d'abord pour que le script soit rejouable.
const REINITIALISATION = `-- >>>>>>>>>>>>>>>>>>>> Réinitialisation des objets de la refonte (si déjà installés)
-- Le schéma privé d'abord : ses fonctions sont utilisées par les politiques
-- (y compris Storage), supprimées avec lui.
drop schema if exists chantierci_private cascade;
drop function if exists public.chantierci_evolution_avancement(integer);
drop function if exists public.chantierci_remplissage(integer);
drop view if exists public.chantierci_v_etat_sites;
drop view if exists public.chantierci_v_visites;
drop table if exists public.chantierci_commentaires cascade;
drop table if exists public.chantierci_departements cascade;
drop table if exists public.chantierci_photos cascade;
drop table if exists public.chantierci_visites cascade;
drop table if exists public.chantierci_postes cascade;
drop table if exists public.chantierci_parametres cascade;
drop type if exists public.chantierci_source_formulaire;
drop type if exists public.chantierci_statut_chantier cascade;
drop table if exists public.chantierci_affectations cascade;
drop table if exists public.chantierci_sites cascade;
drop table if exists public.chantierci_profiles cascade;
drop table if exists public.chantierci_lots cascade;
drop table if exists public.chantierci_entreprises cascade;
drop table if exists public.chantierci_lots_moe cascade;
drop type if exists public.chantierci_role;
drop type if exists public.chantierci_type_latrines;
drop type if exists public.chantierci_statut_compte;
delete from auth.users where email like '%@pateb.test' or email like '%@cstc.pateb.invalid';
`;

const sql = `-- ############################################################################
-- INSTALLATION / RÉINITIALISATION — refonte PATEB
-- (FICHIER GÉNÉRÉ par npm run installation — ne pas modifier à la main)
--
-- À coller en entier dans Supabase → SQL Editor → Run.
--
-- ⚠️  EFFACE TOUTES LES DONNÉES DE L'APPLICATION (v1 et refonte) puis
--     réinstalle le schéma, les droits et les 387 sites. À n'utiliser que
--     tant que la base ne contient que des données de test.
--
-- Tout s'exécute dans une transaction : en cas d'erreur, la base reste
-- inchangée. Contenu : ${fichiers.join(", ")}.
-- Comptes de test (optionnel, ensuite) : supabase/seed/comptes_test.sql
-- ############################################################################

begin;

${REINITIALISATION}
${parties.join("\n")}
commit;
`;

writeFileSync(path.join(racine, "supabase/installation.sql"), sql, "utf8");
console.log(`${fichiers.length} migrations -> supabase/installation.sql`);
