import { DEFINITIONS } from "@/lib/formulaires/definitions";
import type { CorpsEtat, PosteDef, Question, SourceFormulaire } from "@/lib/formulaires/types";
import { LIBELLES_STATUTS, STATUTS } from "@/lib/formulaires/statuts";
import { corpsEtatSites } from "@/lib/formulaires/avancement";
import { QUANTITES_DQE } from "@/lib/formulaires/quantites";
import { dateLongue, pct } from "@/lib/tableau-de-bord/calculs";
import {
  avancementA,
  avancementPerimetre,
  compter,
  datesCourbe,
  dernierA,
  effectifMoyenSites,
  effectifs,
  groupeDe,
  liste,
  PERIMETRES,
  rapportsParSite,
  rep,
  SOURCES_EXPORT,
  type FormulairePeriode,
  type ParametresExport,
  type RapportMoe,
  type SiteRapport,
} from "@/lib/export/rapport";
import { CourbeEvolution } from "@/components/tableau-de-bord/CourbeEvolution";
import { BarreCorpsEtat, LegendeCorpsEtat } from "@/components/BarreCorpsEtat";

// --- Libellés des réponses -----------------------------------------------------------------
function question(source: SourceFormulaire, id: string): Question | undefined {
  for (const s of DEFINITIONS[source].sections) for (const q of s.questions) if (q.id === id) return q;
  return undefined;
}
function options(source: SourceFormulaire, id: string): { valeur: string; libelle: string }[] {
  const q = question(source, id);
  return q?.type === "choix" ? q.options : q?.type === "oui_non" || q?.type === "qualite" ? q.elements : [];
}

const nombre = (v: number | null, decimales = 1) =>
  v === null ? "—" : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: decimales }).format(v);
const dateCourteAn = (d: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(`${d}T00:00:00`));

/** Rapport de synthèse imprimable (aperçu = page PDF). */
export function RapportExport({
  parametres: p,
  sites,
  rapportsMoe,
  formulaires,
  postes,
  corps,
  seuilEcart,
}: {
  parametres: ParametresExport;
  sites: SiteRapport[];
  rapportsMoe: RapportMoe[];
  formulaires: FormulairePeriode[];
  postes: PosteDef[];
  corps: CorpsEtat[];
  seuilEcart: number;
}) {
  const avec = (s: SourceFormulaire) => p.sources.includes(s);
  const moeParSite = rapportsParSite(rapportsMoe);
  const parSource = (s: SourceFormulaire) => formulaires.filter((f) => f.source === s);
  const moe = parSource("moe");
  const cstc = parSource("cstc");
  const ug = parSource("ug");
  const moePeriodeParSite = new Map<string, FormulairePeriode[]>();
  for (const f of moe) moePeriodeParSite.set(f.site_id, [...(moePeriodeParSite.get(f.site_id) ?? []), f]);
  const compteSource = (source: SourceFormulaire, ids: Set<string>) => formulaires.filter((f) => f.source === source && ids.has(f.site_id)).length;

  // Groupes de la synthèse
  const groupes = new Map<string, { libelle: string; ordre: string; sites: SiteRapport[] }>();
  for (const s of sites) {
    const g = groupeDe(s, p);
    const e = groupes.get(g.cle) ?? { libelle: g.libelle, ordre: g.ordre, sites: [] };
    e.sites.push(s);
    groupes.set(g.cle, e);
  }
  const listeGroupes = [...groupes.values()].sort((a, b) => a.ordre.localeCompare(b.ordre, "fr", { numeric: true }));

  const avDebut = avancementPerimetre(sites, moeParSite, p.du);
  const avFin = avancementPerimetre(sites, moeParSite, p.au);
  const serie = datesCourbe(p.du, p.au).map((d) => ({ date_ref: d, avancement: avancementPerimetre(sites, moeParSite, d) }));
  const corpsSites = (date: string) =>
    corpsEtatSites(
      sites.map((s) => ({ electricite: s.electricite, type_latrines: s.type_latrines, postes: dernierA(moeParSite.get(s.id), date)?.postes ?? null })),
      postes,
      corps
    );
  const effectif = effectifMoyenSites(sites.map((s) => s.id), moePeriodeParSite);
  const libellePerimetre =
    p.perimetre === "tout"
      ? "Tout le programme"
      : `${PERIMETRES.find((x) => x.cle === p.perimetre)?.libelle} : ${p.valeurs.join(", ")}`;

  return (
    <article className="rapport space-y-6 bg-surface p-6 text-sm print:space-y-4 print:p-0">
      {/* En-tête */}
      <header className="border-b-2 border-accent pb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">PATEB · Construction des salles du pré-primaire</p>
        <h1 className="text-2xl font-bold">Rapport de suivi des chantiers</h1>
        <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-4 gap-y-0.5 text-sm">
          <dt className="text-texte-2">Période</dt>
          <dd>
            du {dateCourteAn(p.du)} au {dateCourteAn(p.au)}
          </dd>
          <dt className="text-texte-2">Périmètre</dt>
          <dd>
            {libellePerimetre} · {sites.length} site{sites.length > 1 ? "s" : ""}
          </dd>
          <dt className="text-texte-2">Sources</dt>
          <dd>{SOURCES_EXPORT.filter((s) => avec(s.cle)).map((s) => s.detail).join(" · ")}</dd>
          <dt className="text-texte-2">Édité le</dt>
          <dd>{dateLongue(new Date().toISOString().slice(0, 10))}</dd>
        </dl>
      </header>

      {/* Synthèse */}
      <Section titre="Synthèse">
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {avec("moe") && <Chiffre titre="Avancement en fin de période" valeur={pct(avFin, 1)} detail={`${pct(avDebut, 1)} au début (${avFin !== null && avDebut !== null ? `${avFin - avDebut >= 0 ? "+" : ""}${nombre(avFin - avDebut)} pts` : "—"})`} />}
          {avec("moe") && <Chiffre titre="Ouvriers par visite MOE" valeur={nombre(effectif.ouvriers)} detail={`dont ${nombre(effectif.qualifies)} qualifiés · ${effectif.sites} sites`} />}
          {SOURCES_EXPORT.filter((s) => avec(s.cle)).map((s) => (
            <Chiffre
              key={s.cle}
              titre={`Formulaires ${s.libelle}`}
              valeur={String(parSource(s.cle).length)}
              detail={`${new Set(parSource(s.cle).map((f) => f.site_id)).size} sites couverts`}
            />
          ))}
        </div>
        <Tableau
          entetes={[
            p.perimetre === "region" ? "Région" : p.perimetre === "lot" || p.perimetre === "site" ? "Lot" : "Lot MOE",
            "Sites",
            ...(avec("moe") ? ["Avct début", "Avct fin", "Progression", "Ouvriers / visite"] : []),
            ...SOURCES_EXPORT.filter((s) => avec(s.cle)).map((s) => s.libelle),
          ]}
          lignes={listeGroupes.map((g) => {
            const ids = new Set(g.sites.map((s) => s.id));
            const d = avancementPerimetre(g.sites, moeParSite, p.du);
            const f = avancementPerimetre(g.sites, moeParSite, p.au);
            return [
              g.libelle,
              g.sites.length,
              ...(avec("moe")
                ? [pct(d, 1), pct(f, 1), d !== null && f !== null ? `${f - d >= 0 ? "+" : ""}${nombre(f - d)} pts` : "—", nombre(effectifMoyenSites([...ids], moePeriodeParSite).ouvriers)]
                : []),
              ...SOURCES_EXPORT.filter((s) => avec(s.cle)).map((s) => compteSource(s.cle, ids)),
            ];
          })}
        />
      </Section>

      {/* MOE */}
      {avec("moe") && (
        <Section titre="Maîtrise d'œuvre (MOE)" saut>
          <SousTitre>Évolution de l&apos;avancement sur la période</SousTitre>
          <p className="mb-1 text-xs text-texte-2">
            Avancement pondéré par le montant DQE des sites, d&apos;après le dernier rapport MOE connu à chaque date.
          </p>
          <CourbeEvolution serie={serie} />
          <div className="mt-4 grid gap-4 md:grid-cols-2 print:grid-cols-2">
            <div>
              <SousTitre>Avancement par corps d&apos;état</SousTitre>
              <p className="mb-1 text-xs text-texte-2">Début de période</p>
              <BarreCorpsEtat segments={corpsSites(p.du)} hauteur="h-4" />
              <p className="mb-1 mt-2 text-xs text-texte-2">Fin de période</p>
              <BarreCorpsEtat segments={corpsSites(p.au)} hauteur="h-4" className="mb-2" />
              <LegendeCorpsEtat segments={corpsSites(p.au)} />
            </div>
            <div className="space-y-3">
              <div>
                <SousTitre>Effectifs (rapports de la période)</SousTitre>
                <Tableau
                  entetes={["", "Valeur"]}
                  lignes={[
                    ["Ouvriers présents, moyenne par site", nombre(effectif.ouvriers)],
                    ["dont qualifiés", nombre(effectif.qualifies)],
                    ["Rapports avec effectif renseigné", effectifs(moe).rapports],
                    [
                      "Chef de chantier présent",
                      (() => {
                        const r = moe.filter((f) => rep(f.reponses).chef_chantier);
                        return r.length ? pct((100 * r.filter((f) => rep(f.reponses).chef_chantier === "oui").length) / r.length) + " des visites" : "—";
                      })(),
                    ],
                  ]}
                />
              </div>
              <div>
                <SousTitre>Statut en fin de période</SousTitre>
                <Tableau
                  entetes={["Statut (dernier rapport MOE)", "Sites"]}
                  lignes={[
                    ...STATUTS.map((st): [string, number] => [
                      LIBELLES_STATUTS[st],
                      sites.filter((s) => dernierA(moeParSite.get(s.id), p.au)?.statut === st).length,
                    ]).filter(([, n]) => n > 0),
                    ["Aucun rapport MOE", sites.filter((s) => !dernierA(moeParSite.get(s.id), p.au)).length],
                  ]}
                />
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 print:grid-cols-2">
            <Comptage titre="Problèmes signalés" source="moe" question="problemes" formulaires={moe} exclure={["aucun"]} valeurs={(f) => liste(rep(f.reponses).problemes)} />
            <Comptage
              titre="Qualité : éléments non conformes au CCTP"
              source="moe"
              question="qualite"
              formulaires={moe}
              valeurs={(f) => Object.entries(rep(rep(f.reponses).qualite)).filter(([, v]) => v === "non_conforme").map(([k]) => k)}
            />
            <Comptage
              titre="Sécurité : règles non respectées"
              source="moe"
              question="securite"
              formulaires={moe}
              valeurs={(f) => Object.entries(rep(rep(f.reponses).securite)).filter(([, v]) => v === "non").map(([k]) => k)}
            />
          </div>
          <p className="mt-2 text-xs text-texte-2">
            Retard estimé moyen par la MOE :{" "}
            {nombre(
              (() => {
                const r = moe.map((f) => rep(f.reponses).retard_semaines).filter((v): v is number => typeof v === "number");
                return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null;
              })()
            )}{" "}
            semaine(s) · {moe.length} rapports sur la période.
          </p>
        </Section>
      )}

      {/* CSTC */}
      {avec("cstc") && (
        <Section titre="Comités de suivi (CSTC)" saut>
          <p className="mb-2 text-xs text-texte-2">
            {cstc.length} signalements sur {new Set(cstc.map((f) => f.site_id)).size} sites. Les tensions signalées ne figurent pas dans ce rapport.
          </p>
          <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
            <Tableau
              entetes={["Constat", "Signalements", "Sites"]}
              lignes={[
                ligneConstat("Ouvriers présents", cstc, (f) => rep(f.reponses).ouvriers_presents === "oui"),
                ligneConstat("Aucun ouvrier", cstc, (f) => rep(f.reponses).ouvriers_presents === "non"),
                ligneConstat("Dangers à portée des enfants", cstc, (f) => rep(rep(f.reponses).securite).dangers === "oui"),
                ligneConstat("Chantier non séparé de la cour", cstc, (f) => rep(rep(f.reponses).securite).separe_cour === "non"),
                ligneConstat("Ouvriers sans casque ni chaussures", cstc, (f) => rep(rep(f.reponses).securite).epi === "non"),
              ]}
            />
            <Comptage titre="Problèmes sur le bâtiment" source="cstc" question="problemes_batiment" formulaires={cstc} exclure={["aucun"]} valeurs={(f) => liste(rep(f.reponses).problemes_batiment)} />
            <DernierEtat titre="Latrines (dernier signalement)" source="cstc" question="latrines" formulaires={cstc} sites={sites} />
            <DernierEtat titre="Mobilier (dernier signalement)" source="cstc" question="mobilier" formulaires={cstc} sites={sites} />
          </div>
        </Section>
      )}

      {/* UG */}
      {avec("ug") && (
        <Section titre="Unité de gestion (UG)" saut>
          <p className="mb-2 text-xs text-texte-2">
            {ug.length} fiches sur {new Set(ug.map((f) => f.site_id)).size} sites.
          </p>
          <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
            <div>
              <SousTitre>Écart avec la MOE</SousTitre>
              {(() => {
                const ecarts = ug
                  .filter((f) => f.avancement !== null && moeParSite.get(f.site_id))
                  .map((f) => Number(f.avancement) - avancementA(moeParSite.get(f.site_id), f.date_visite));
                return (
                  <Tableau
                    entetes={["", "Valeur"]}
                    lignes={[
                      ["Fiches comparées au dernier rapport MOE", ecarts.length],
                      [`Écart de plus de ${seuilEcart} points`, ecarts.filter((e) => Math.abs(e) > seuilEcart).length],
                      ["Écart moyen (UG − MOE)", ecarts.length ? `${nombre(ecarts.reduce((a, b) => a + b, 0) / ecarts.length)} pts` : "—"],
                    ]}
                  />
                );
              })()}
            </div>
            <Comptage titre="Difficultés relevées" source="ug" question="difficultes" formulaires={ug} exclure={["aucune"]} valeurs={(f) => liste(rep(f.reponses).difficultes)} />
            <div className="md:col-span-2 print:col-span-2">
              <SousTitre>Contrôle des quantités</SousTitre>
              <Tableau
                entetes={["Élément (prévu au DQE)", "Fiches contrôlées", "Écarts constatés"]}
                lignes={QUANTITES_DQE.map((q) => {
                  const valeurs = ug.map((f) => rep(rep(f.reponses).quantites)[q.id]).filter((v): v is number => typeof v === "number");
                  return [`${q.libelle} (${nombre(q.prevu, 2)} ${q.unite})`, valeurs.length, valeurs.filter((v) => v !== q.prevu).length];
                }).filter(([, n]) => Number(n) > 0)}
                vide="Aucune quantité contrôlée sur la période."
              />
            </div>
          </div>
        </Section>
      )}

      {/* Récapitulatif par site */}
      <Section titre="Récapitulatif par site" saut>
        {listeGroupes.map((g) => (
          <div key={g.libelle} className="mb-4">
            <SousTitre>{g.libelle}</SousTitre>
            <Tableau
              petit
              entetes={[
                "Site",
                "Lot · entreprise",
                ...(avec("moe") ? ["Avct début", "Avct fin", "Statut MOE", "Ouvriers"] : []),
                ...SOURCES_EXPORT.filter((s) => avec(s.cle)).map((s) => s.libelle),
              ]}
              lignes={g.sites.map((s) => {
                const ids = new Set([s.id]);
                const dernier = dernierA(moeParSite.get(s.id), p.au);
                return [
                  `${s.code} · ${s.nom}`,
                  `${s.lot_id}${s.entreprise ? ` · ${s.entreprise}` : ""}`,
                  ...(avec("moe")
                    ? [
                        pct(avancementA(moeParSite.get(s.id), p.du)),
                        pct(avancementA(moeParSite.get(s.id), p.au)),
                        dernier ? LIBELLES_STATUTS[dernier.statut] : "Aucun rapport",
                        nombre(effectifs(moePeriodeParSite.get(s.id) ?? []).ouvriers),
                      ]
                    : []),
                  ...SOURCES_EXPORT.filter((x) => avec(x.cle)).map((x) => compteSource(x.cle, ids)),
                ];
              })}
            />
          </div>
        ))}
      </Section>
    </article>
  );
}

function ligneConstat(libelle: string, formulaires: FormulairePeriode[], test: (f: FormulairePeriode) => boolean): [string, number, number] {
  const ok = formulaires.filter(test);
  return [libelle, ok.length, new Set(ok.map((f) => f.site_id)).size];
}

// --- Éléments de mise en page -----------------------------------------------------------------
function Section({ titre, saut, children }: { titre: string; saut?: boolean; children: React.ReactNode }) {
  return (
    <section className={saut ? "print:break-before-page" : ""}>
      <h2 className="mb-2 border-b border-bordure pb-1 text-lg font-bold">{titre}</h2>
      {children}
    </section>
  );
}

function SousTitre({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1 text-sm font-semibold">{children}</h3>;
}

function Chiffre({ titre, valeur, detail }: { titre: string; valeur: string; detail: string }) {
  return (
    <div className="break-inside-avoid rounded-carte border border-bordure p-2">
      <p className="text-xs text-texte-2">{titre}</p>
      <p className="text-xl font-bold tabular-nums">{valeur}</p>
      <p className="text-xs text-texte-3">{detail}</p>
    </div>
  );
}

function Tableau({
  entetes,
  lignes,
  petit,
  vide = "Aucune donnée sur la période.",
}: {
  entetes: string[];
  lignes: (string | number)[][];
  petit?: boolean;
  vide?: string;
}) {
  if (!lignes.length) return <p className="text-xs text-texte-3">{vide}</p>;
  return (
    <table className={`w-full border-collapse ${petit ? "text-xs" : "text-sm"}`}>
      <thead>
        <tr className="border-b border-bordure text-left text-xs text-texte-2">
          {entetes.map((e, i) => (
            <th key={i} className={`py-1 pr-2 font-semibold ${i > 0 ? "text-right" : ""}`}>
              {e}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lignes.map((l, i) => (
          <tr key={i} className="break-inside-avoid border-b border-bordure/60">
            {l.map((c, j) => (
              <td key={j} className={`py-0.5 pr-2 ${j > 0 ? "text-right tabular-nums" : ""}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Fréquence des réponses d'une question à choix sur les formulaires de la période. */
function Comptage({
  titre,
  source,
  question: id,
  formulaires,
  valeurs,
  exclure = [],
}: {
  titre: string;
  source: SourceFormulaire;
  question: string;
  formulaires: FormulairePeriode[];
  valeurs: (f: FormulairePeriode) => string[];
  exclure?: string[];
}) {
  const c = compter(formulaires, valeurs);
  const lignes = options(source, id)
    .filter((o) => !exclure.includes(o.valeur) && c.get(o.valeur))
    .map((o) => [o.libelle, c.get(o.valeur)!.formulaires, c.get(o.valeur)!.sites.size] as [string, number, number])
    .sort((a, b) => b[1] - a[1]);
  return (
    <div className="break-inside-avoid">
      <SousTitre>{titre}</SousTitre>
      <Tableau entetes={["", "Formulaires", "Sites"]} lignes={lignes} vide="Rien de signalé sur la période." />
    </div>
  );
}

/** Réponse du dernier formulaire de chaque site (état en fin de période). */
function DernierEtat({
  titre,
  source,
  question: id,
  formulaires,
  sites,
}: {
  titre: string;
  source: SourceFormulaire;
  question: string;
  formulaires: FormulairePeriode[];
  sites: SiteRapport[];
}) {
  const dernier = new Map<string, string>();
  for (const f of formulaires) {
    const v = rep(f.reponses)[id];
    if (typeof v === "string") dernier.set(f.site_id, v);
  }
  const lignes = options(source, id)
    .map((o) => [o.libelle, sites.filter((s) => dernier.get(s.id) === o.valeur).length] as [string, number])
    .filter(([, n]) => n > 0);
  return (
    <div className="break-inside-avoid">
      <SousTitre>{titre}</SousTitre>
      <Tableau entetes={["", "Sites"]} lignes={lignes} vide="Pas de réponse sur la période." />
    </div>
  );
}
