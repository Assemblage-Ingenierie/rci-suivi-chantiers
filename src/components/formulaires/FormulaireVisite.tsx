"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bath, Camera, ImageIcon, ImagePlus, Loader2, MapPin, School, Send, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/database.types";
import { familleProfil, LIBELLES_LATRINES, type TypeLatrines } from "@/lib/constants";
import { DEFINITIONS, QUALITE_OPTIONS } from "@/lib/formulaires/definitions";
import { statutsProposes } from "@/lib/formulaires/statuts";
import { ouvrageLatrines, postesApplicables } from "@/lib/formulaires/avancement";
import { formatNombre, quantitesDuSite } from "@/lib/formulaires/quantites";
import {
  envoyerPhotos,
  preparerPhoto,
  type OriginePhoto,
  supprimerPhoto,
  type PhotoExistante,
  type PhotoLocale,
} from "@/lib/formulaires/photos";
import type {
  PosteDef,
  Question,
  Reponses,
  SourceFormulaire,
  StatutChantier,
  ValeursPostes,
} from "@/lib/formulaires/types";
import { ChoixBoutons, Compteur, OuiNonListe, QualiteListe } from "./champs";

export type SitePourFormulaire = {
  id: string;
  code: string;
  nom: string;
  lot_id: number;
  lot_nom: string;
  entreprise: string;
  localite: string;
  electricite: boolean;
  type_latrines: TypeLatrines;
};

export type ValeursInitiales = {
  id: string;
  date_visite: string;
  statut: StatutChantier;
  postes: ValeursPostes;
  reponses: Reponses;
  commentaire: string;
  auteur_nom: string;
};

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const formatDateCourte = (d: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(d));

export function FormulaireVisite({
  source,
  site,
  postes,
  numeroVisite,
  precedent,
  initial,
  photosExistantes = [],
  auteurNom,
  bureau = false,
}: {
  source: SourceFormulaire;
  site: SitePourFormulaire;
  postes: PosteDef[];
  numeroVisite: number;
  /** Postes de la visite précédente (même source), pour préremplir la saisie. */
  precedent: { postes: ValeursPostes } | null;
  initial?: ValeursInitiales;
  photosExistantes?: PhotoExistante[];
  auteurNom: string;
  /** Profil de bureau (UG, admin) : pas d'en-tête fixe sur grand écran. */
  bureau?: boolean;
}) {
  const definition = DEFINITIONS[source];
  const router = useRouter();
  const modification = !!initial;

  const [dateVisite, setDateVisite] = useState(initial?.date_visite ?? aujourdhui());
  const [statut, setStatut] = useState<StatutChantier | "">(initial?.statut ?? "");
  const [valeursPostes, setValeursPostes] = useState<ValeursPostes>(
    initial?.postes ?? precedent?.postes ?? { classe: {}, latrines: {} }
  );
  const [reponses, setReponses] = useState<Reponses>(initial?.reponses ?? {});
  const [commentaire, setCommentaire] = useState(initial?.commentaire ?? "");
  const [photos, setPhotos] = useState<PhotoLocale[]>([]);
  const [photosGardees, setPhotosGardees] = useState<PhotoExistante[]>(photosExistantes);
  const [preparation, setPreparation] = useState(false);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const entreePhotos = useRef<HTMLInputElement>(null);
  const entreeGalerie = useRef<HTMLInputElement>(null);

  const reponse = (id: string) => reponses[id];
  /** La réponse indiquée contient-elle la valeur (réponse simple, liste ou grille d'éléments) ? */
  const texteAttendu = ({ question, valeur }: { question: string; valeur: string }) => {
    const r = reponses[question];
    if (Array.isArray(r)) return r.includes(valeur);
    if (r && typeof r === "object") return Object.values(r).includes(valeur);
    return r === valeur;
  };
  const repondre = (id: string, v: Json) => setReponses((r) => ({ ...r, [id]: v }));

  // ---------------------------------------------------------------- envoi
  function verifier(): string[] {
    const manquants: string[] = [];
    for (const section of definition.sections) {
      for (const q of section.questions) {
        if (q.type === "statut" && q.requis && !statut) manquants.push(`« ${section.titre} » : choisir l'état du chantier`);
        if (q.type === "choix" && q.requis) {
          const v = reponse(q.id);
          if (v === undefined || v === null || (Array.isArray(v) && v.length === 0))
            manquants.push(`« ${q.libelle} » : réponse attendue`);
        }
        if (q.type === "texte" && q.obligatoireSi && texteAttendu(q.obligatoireSi) && !String(reponse(q.id) ?? "").trim())
          manquants.push(`« ${q.libelle} » : à remplir (${section.titre.toLowerCase()} non conforme)`);
      }
    }
    if (dateVisite > aujourdhui()) manquants.push("La date de visite ne peut pas être dans le futur");
    return manquants;
  }

  async function envoyer() {
    const manquants = verifier();
    setErreurs(manquants);
    if (manquants.length) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      return;
    }
    setEnvoi(true);
    const supabase = createClient();
    const id = initial?.id ?? crypto.randomUUID();
    const contenu = {
      date_visite: dateVisite,
      statut: statut as StatutChantier,
      postes: valeursPostes as Json,
      reponses: reponses as Json,
      commentaire: commentaire.trim(),
    };
    const { error } = modification
      ? await supabase.from("chantierci_visites").update(contenu).eq("id", id)
      : await supabase.from("chantierci_visites").insert({ id, site_id: site.id, source, ...contenu });
    if (error) {
      setErreurs([
        error.message.toLowerCase().includes("fetch")
          ? "Pas de connexion internet : le formulaire n'a pas été envoyé. (L'enregistrement hors ligne arrive à la prochaine étape.)"
          : `Envoi refusé : ${error.message}`,
      ]);
      setEnvoi(false);
      return;
    }
    const retirees = photosExistantes.filter((p) => !photosGardees.some((g) => g.id === p.id));
    for (const p of retirees) await supprimerPhoto(supabase, p);
    const erreursPhotos = await envoyerPhotos(supabase, id, photos);
    if (erreursPhotos.length) {
      setErreurs(["Formulaire enregistré, mais :", ...erreursPhotos]);
      setEnvoi(false);
      return;
    }
    router.push(`/visite/${id}?enregistre=1`);
    router.refresh();
  }

  // ---------------------------------------------------------------- rendu
  return (
    <div data-profil={familleProfil(source === "moe" ? "moe_controleur" : source)} className="pb-28 lg:mx-auto lg:max-w-3xl lg:pt-8">
      {/* Bandeau façon maquettes, à la couleur du formulaire */}
      <header className="bg-accent px-4 pb-4 pt-4 text-sur-accent">
        <p className="text-sm opacity-85">{definition.surTitre}</p>
        <h1 className="mt-0.5 text-2xl font-bold">{site.nom}</h1>
        <p className="text-sm opacity-90">
          Lot {site.lot_id} · {site.entreprise || "[Entreprise titulaire]"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="rounded-champ bg-black/15 px-2.5 py-1">Visite n° {numeroVisite}</span>
          <span className="rounded-champ bg-black/15 px-2.5 py-1">{formatDateCourte(dateVisite)}</span>
          <span className="rounded-champ bg-black/15 px-2.5 py-1">{initial?.auteur_nom || auteurNom}</span>
          {modification && <span className="rounded-champ bg-black/30 px-2.5 py-1 font-semibold">Modification</span>}
        </div>
      </header>

      {definition.avecOnglets && (
        <nav className={`sticky ${bureau ? "top-14 lg:top-0" : "top-14"} z-20 flex overflow-x-auto border-b border-bordure bg-surface text-sm`}>
          {definition.sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="whitespace-nowrap border-b-2 border-transparent px-4 py-3 font-medium text-texte-2 hover:border-accent hover:text-texte"
            >
              {s.titre}
            </a>
          ))}
        </nav>
      )}

      <div className="space-y-4 p-4">
        {definition.sections.map((section) => (
          <section key={section.id} id={section.id} className="carte scroll-mt-28 p-4">
            <h2 className="mb-3 flex items-center gap-3 text-lg font-bold">
              {section.numero && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm text-sur-accent">
                  {section.numero}
                </span>
              )}
              {section.titre}
            </h2>
            <div className="space-y-4">
              {section.questions.map((q) => (
                <div key={q.id}>{rendreQuestion(q, section.questions.length > 1)}</div>
              ))}
            </div>
          </section>
        ))}

        {erreurs.length > 0 && (
          <div className="message-erreur space-y-1" role="alert">
            {erreurs.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-bordure bg-surface/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-col gap-1">
          <button type="button" onClick={envoyer} disabled={envoi || preparation} className="bouton-principal w-full text-lg">
            {envoi ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            {modification ? "Enregistrer les modifications" : source === "cstc" ? "Envoyer le signalement" : "Envoyer le rapport"}
          </button>
        </div>
      </div>
    </div>
  );

  function rendreQuestion(q: Question, avecLibelle: boolean) {
    const titre = avecLibelle ? <p className="etiquette">{q.libelle}</p> : null;
    switch (q.type) {
      case "date":
        return (
          <label className="block">
            <span className="etiquette">{q.libelle}</span>
            <input
              type="date"
              value={dateVisite}
              max={aujourdhui()}
              onChange={(e) => setDateVisite(e.target.value)}
              className="champ max-w-[12rem] py-2"
            />
          </label>
        );
      case "statut":
        return (
          <>
            {source !== "cstc" && titre}
            <ChoixBoutons
              libelleAccessible={q.libelle}
              options={statutsProposes(source)}
              valeur={statut}
              colonnes={source === "cstc" ? 2 : 3}
              onChange={(v) => setStatut(v as StatutChantier)}
            />
          </>
        );
      case "choix":
        return (
          <>
            {titre}
            <ChoixBoutons
              libelleAccessible={q.libelle}
              options={q.options}
              valeur={reponse(q.id) as string | string[] | undefined}
              multiple={q.multiple}
              exclusive={q.exclusive}
              colonnes={q.colonnes}
              onChange={(v) => repondre(q.id, v)}
            />
          </>
        );
      case "oui_non":
        return (
          <OuiNonListe
            elements={q.elements}
            valeurs={(reponse(q.id) as Record<string, string>) ?? {}}
            onChange={(v) => repondre(q.id, v)}
          />
        );
      case "qualite":
        return (
          <QualiteListe
            elements={q.elements}
            options={QUALITE_OPTIONS}
            valeurs={(reponse(q.id) as Record<string, string>) ?? {}}
            onChange={(v) => repondre(q.id, v)}
          />
        );
      case "nombre":
        return (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[0.95rem]">{q.libelle}</span>
            <Compteur
              libelle={q.libelle}
              valeur={Number(reponse(q.id) ?? 0)}
              min={q.min}
              max={q.max}
              pas={q.pas}
              alerte={q.alerteSiPositif}
              onChange={(v) => repondre(q.id, v)}
            />
          </div>
        );
      case "texte":
        if (q.obligatoireSi && !texteAttendu(q.obligatoireSi)) return null;
        return (
          <label className="block">
            <span className="etiquette">
              {q.libelle}
              {q.obligatoireSi && <span className="ml-1 font-normal text-danger">(obligatoire)</span>}
            </span>
            <textarea
              rows={3}
              placeholder={q.indication}
              value={(reponse(q.id) as string) ?? ""}
              onChange={(e) => repondre(q.id, e.target.value)}
              className="champ"
            />
          </label>
        );
      case "commentaire":
        return (
          <label className="block">
            <span className="etiquette">{q.libelle}</span>
            <textarea
              rows={3}
              placeholder={q.indication}
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              className="champ"
            />
          </label>
        );
      case "postes":
        return saisiePostes();
      case "quantites":
        return saisieQuantites();
      case "photos":
        return saisiePhotos(q.minimum);
    }
  }

  // ---------------------------------------------------------------- postes
  function saisiePostes() {
    const groupes = [
      { cle: "classe" as const, titre: "Salle de classe", defs: postesApplicables(postes, "classe", site.electricite) },
      {
        cle: "latrines" as const,
        titre: LIBELLES_LATRINES[site.type_latrines],
        defs: postesApplicables(postes, ouvrageLatrines(site.type_latrines), site.electricite),
      },
    ];
    return (
      <div className="space-y-4">
        <p className="etiquette mb-0">Avancement par poste</p>
        {groupes.map((g) => {
          const valeurs = valeursPostes[g.cle] ?? {};
          const Icone = g.cle === "classe" ? School : Bath;
          return (
            <section key={g.cle} className="overflow-hidden rounded-carte border-2 border-accent/40">
              <h3 className="flex items-center gap-2 bg-accent-clair px-3 py-2 text-base font-bold text-accent-fonce">
                <Icone className="h-5 w-5" aria-hidden />
                {g.titre}
              </h3>
              <div className="divide-y divide-bordure px-3">
                {g.defs.map((p) => (
                  <div key={p.code} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="text-[0.95rem]">{p.libelle}</span>
                    <Compteur
                      libelle={`${g.titre} — ${p.libelle}`}
                      valeur={valeurs[p.code] ?? 0}
                      pas={10}
                      suffixe=" %"
                      onChange={(v) =>
                        setValeursPostes((vp) => ({ ...vp, [g.cle]: { ...(vp[g.cle] ?? {}), [p.code]: v } }))
                      }
                    />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  // ---------------------------------------------------------------- quantités
  function saisieQuantites() {
    const valeurs = (reponse("quantites") as Record<string, number | null>) ?? {};
    return (
      <div>
        <p className="mb-2 flex justify-between">
          <span className="etiquette mb-0">Contrôle des quantités</span>
          <span className="text-sm text-texte-2">réf. : DQE type</span>
        </p>
        <table className="w-full text-[0.95rem]">
          <thead className="text-left text-sm text-texte-2">
            <tr>
              <th className="py-1 font-medium">Élément</th>
              <th className="py-1 text-right font-medium">Prévu</th>
              <th className="py-1 text-right font-medium">Constaté</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bordure">
            {quantitesDuSite(site.electricite).map((q) => {
              const v = valeurs[q.id];
              const ecart = typeof v === "number" ? v - q.prevu : null;
              return (
                <tr key={q.id}>
                  <td className="py-2 pr-2">
                    {q.libelle}
                    {ecart !== null && (
                      <span className={`ml-2 text-xs font-semibold ${ecart === 0 ? "text-succes" : "text-alerte"}`}>
                        {ecart === 0 ? "Conforme" : `${ecart > 0 ? "+" : "−"}${formatNombre(Math.abs(ecart))}`}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2 text-right text-texte-2">
                    {formatNombre(q.prevu)} {q.unite}
                  </td>
                  <td className="py-2 pl-2 text-right">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      aria-label={`${q.libelle} constaté`}
                      value={v ?? ""}
                      onChange={(e) =>
                        repondre("quantites", {
                          ...valeurs,
                          [q.id]: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      className="w-20 rounded-champ border border-bordure-forte px-2 py-1.5 text-right"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ---------------------------------------------------------------- photos
  function saisiePhotos(minimum?: number) {
    const entree = entreePhotos;
    const total = photosGardees.length + photos.length;
    async function ajouter(fichiers: FileList | null, origine: OriginePhoto) {
      if (!fichiers?.length) return;
      setPreparation(true);
      try {
        const prepares = await Promise.all([...fichiers].map((f) => preparerPhoto(f, origine)));
        setPhotos((p) => [...p, ...prepares]);
      } finally {
        setPreparation(false);
        if (entree.current) entree.current.value = "";
        if (entreeGalerie.current) entreeGalerie.current.value = "";
      }
    }
    const heure = (d: string | null) =>
      d ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(d)) : "";
    const tuile = "relative aspect-square overflow-hidden rounded-carte bg-surface-2 ring-1 ring-bordure";
    return (
      <div>
        <p className="mb-2 flex justify-between">
          <span className="etiquette mb-0">Photos géolocalisées</span>
          {minimum ? (
            <span className={`text-sm ${total >= minimum ? "text-succes" : "text-texte-2"}`}>
              {total} / {minimum} minimum
            </span>
          ) : (
            <span className="text-sm text-texte-2">{total} photo{total > 1 ? "s" : ""}</span>
          )}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {photosGardees.map((p) => (
            <div key={p.id} className={tuile}>
              {p.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt={p.legende || "Photo"} className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="m-auto h-8 w-8 text-texte-3" />
              )}
              <EtiquetteGps lat={p.latitude} heure={heure(p.prise_le)} />
              <BoutonRetirer onClick={() => setPhotosGardees((g) => g.filter((x) => x.id !== p.id))} />
            </div>
          ))}
          {photos.map((p) => (
            <div key={p.id} className={tuile}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.apercu} alt="Nouvelle photo" className="h-full w-full object-cover" />
              <EtiquetteGps lat={p.latitude} heure={heure(p.prise_le)} />
              <BoutonRetirer onClick={() => setPhotos((l) => l.filter((x) => x.id !== p.id))} />
            </div>
          ))}
          <button
            type="button"
            onClick={() => entree.current?.click()}
            disabled={preparation}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-carte border-2 border-dashed border-accent text-accent-fonce"
          >
            {preparation ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
            <span className="text-sm font-semibold">{preparation ? "Préparation…" : "Prendre une photo"}</span>
          </button>
          <button
            type="button"
            onClick={() => entreeGalerie.current?.click()}
            disabled={preparation}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-carte border-2 border-dashed border-bordure-forte text-texte-2"
          >
            <ImagePlus className="h-6 w-6" />
            <span className="px-1 text-center text-sm font-semibold">Choisir sur le téléphone</span>
          </button>
        </div>
        <p className="mt-1.5 text-xs text-texte-3">
          Photo prise sur place : position GPS du téléphone. Photo choisie sur le téléphone : position et date enregistrées
          dans la photo, si elle en contient.
        </p>
        <input
          ref={entree}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          hidden
          onChange={(e) => ajouter(e.target.files, "camera")}
        />
        <input ref={entreeGalerie} type="file" accept="image/*" multiple hidden onChange={(e) => ajouter(e.target.files, "galerie")} />
      </div>
    );
  }
}

function EtiquetteGps({ lat, heure }: { lat: number | null; heure: string }) {
  return (
    <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-black/55 px-1.5 py-0.5 text-[11px] text-white">
      <MapPin className="h-3 w-3" />
      {lat !== null ? "GPS ✓" : "sans GPS"} {heure}
    </span>
  );
}

function BoutonRetirer({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Retirer la photo"
      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
