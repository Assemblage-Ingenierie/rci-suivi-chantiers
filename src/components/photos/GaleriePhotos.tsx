"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, ImageOff, MapPin, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BUCKET_PHOTOS } from "@/lib/formulaires/photos";
import type { SourceFormulaire } from "@/lib/formulaires/types";

export type SiteGalerie = {
  id: string;
  code: string;
  nom: string;
  region: string;
  departement: string;
  localite: string;
  lot_id: number;
  lot_moe_id: number;
  a_verifier: string;
  entreprise: string;
};
export type PhotoGalerie = {
  id: string;
  chemin: string;
  legende: string;
  latitude: number | null;
  longitude: number | null;
  prise_le: string | null;
  site_id: string;
  visite_id: string;
  source: SourceFormulaire;
  /** Date de la visite (AAAA-MM-JJ). */
  date: string;
};

const SOURCES: { cle: SourceFormulaire; libelle: string; classe: string }[] = [
  { cle: "moe", libelle: "MOE", classe: "bg-source-moe text-[#2B1A00]" },
  { cle: "cstc", libelle: "CSTC", classe: "bg-source-cstc text-white" },
  { cle: "ug", libelle: "UG", classe: "bg-source-ug text-white" },
];
const classeSource = (s: SourceFormulaire) => SOURCES.find((x) => x.cle === s)?.classe ?? "";
const libelleSource = (s: SourceFormulaire) => SOURCES.find((x) => x.cle === s)?.libelle ?? s;
const dateCourte = (d: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "2-digit" }).format(new Date(`${d.slice(0, 10)}T00:00:00`));
const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const PAR_PAGE = 20;

type Tri = "code" | "recentes" | "nombre";

/** Onglet Photos : filtres de l'onglet Sites + sources, période et tri ; une ligne (carrousel) par site. */
export function GaleriePhotos({
  sites,
  lots,
  photos,
  periode,
}: {
  sites: SiteGalerie[];
  lots: { id: number; nom: string }[];
  photos: PhotoGalerie[];
  periode: { du: string; au: string };
}) {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const [lot, setLot] = useState("");
  const [entreprise, setEntreprise] = useState("");
  const [lotMoe, setLotMoe] = useState("");
  const [aVerifier, setAVerifier] = useState(false);
  const [sources, setSources] = useState<SourceFormulaire[]>(["moe", "cstc", "ug"]);
  const [tri, setTri] = useState<Tri>("recentes");
  const [sansPhoto, setSansPhoto] = useState(false);
  const [du, setDu] = useState(periode.du);
  const [au, setAu] = useState(periode.au);
  const [affiches, setAffiches] = useState(PAR_PAGE);
  const [ouverte, setOuverte] = useState<{ photos: PhotoGalerie[]; index: number } | null>(null);

  // Adresses signées des images (1 h), partagées par toutes les lignes.
  const urls = useRef(new Map<string, string>());
  const [, setVersion] = useState(0);
  const signer = useCallback(async (chemins: string[]) => {
    const manquants = chemins.filter((c) => !urls.current.has(c));
    if (!manquants.length) return;
    const { data } = await createClient().storage.from(BUCKET_PHOTOS).createSignedUrls(manquants, 3600);
    for (const u of data ?? []) if (u.path && u.signedUrl) urls.current.set(u.path, u.signedUrl);
    setVersion((v) => v + 1);
  }, []);

  const entreprises = useMemo(
    () => [...new Set(sites.map((s) => s.entreprise).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr", { numeric: true })),
    [sites]
  );

  // Photos de chaque site (sources retenues), de la plus ancienne à la plus récente.
  const parSite = useMemo(() => {
    const m = new Map<string, PhotoGalerie[]>();
    for (const p of photos) if (sources.includes(p.source)) m.set(p.site_id, [...(m.get(p.site_id) ?? []), p]);
    for (const l of m.values()) l.sort((a, b) => (a.date + (a.prise_le ?? "")).localeCompare(b.date + (b.prise_le ?? "")));
    return m;
  }, [photos, sources]);

  const lignes = useMemo(() => {
    const q = sansAccents(recherche.trim());
    const liste = sites
      .filter(
        (s) =>
          (!lot || s.lot_id === Number(lot)) &&
          (!entreprise || s.entreprise === entreprise) &&
          (!lotMoe || s.lot_moe_id === Number(lotMoe)) &&
          (!aVerifier || s.a_verifier) &&
          (!q || sansAccents(`${s.code} ${s.nom} ${s.localite} ${s.departement} ${s.region} ${s.entreprise}`).includes(q))
      )
      .map((s) => ({ site: s, photos: parSite.get(s.id) ?? [] }))
      .filter((l) => sansPhoto || l.photos.length > 0);
    const derniere = (l: { photos: PhotoGalerie[] }) => l.photos.at(-1)?.date ?? "";
    if (tri === "recentes") liste.sort((a, b) => derniere(b).localeCompare(derniere(a)) || a.site.code.localeCompare(b.site.code));
    if (tri === "nombre") liste.sort((a, b) => b.photos.length - a.photos.length || a.site.code.localeCompare(b.site.code));
    return liste;
  }, [sites, parSite, recherche, lot, entreprise, lotMoe, aVerifier, sansPhoto, tri]);

  useEffect(() => setAffiches(PAR_PAGE), [recherche, lot, entreprise, lotMoe, aVerifier, sansPhoto, tri, sources]);

  const total = lignes.reduce((a, l) => a + l.photos.length, 0);
  const changerPeriode = () => {
    if (!du || !au) return;
    router.push(`/photos?du=${du}&au=${au}`);
  };

  return (
    <div className="space-y-4">
      {/* Filtres (comme l'onglet Sites) */}
      <div className="carte flex flex-wrap items-end gap-3 p-4">
        <label className="min-w-[14rem] flex-1">
          <span className="etiquette">Recherche</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texte-3" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Nom, code, localité, entreprise…"
              className="champ py-2 pl-9"
            />
          </span>
        </label>
        <label>
          <span className="etiquette">Lot de travaux</span>
          <select value={lot} onChange={(e) => setLot(e.target.value)} className="champ py-2">
            <option value="">Tous</option>
            {lots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.id} · {l.nom}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="etiquette">Entreprise</span>
          <select value={entreprise} onChange={(e) => setEntreprise(e.target.value)} className="champ py-2">
            <option value="">Toutes</option>
            {entreprises.map((nom) => (
              <option key={nom} value={nom}>
                {nom}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="etiquette">Lot MOE</span>
          <select value={lotMoe} onChange={(e) => setLotMoe(e.target.value)} className="champ py-2">
            <option value="">Tous</option>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                MOE {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2.5 text-sm">
          <input type="checkbox" checked={aVerifier} onChange={(e) => setAVerifier(e.target.checked)} />À vérifier
        </label>
      </div>
      <div className="carte flex flex-wrap items-end gap-x-5 gap-y-3 p-4">
        <div>
          <p className="etiquette">Sources</p>
          <div className="flex gap-1.5">
            {SOURCES.map((s) => {
              const actif = sources.includes(s.cle);
              return (
                <button
                  key={s.cle}
                  type="button"
                  onClick={() => setSources(actif ? sources.filter((x) => x !== s.cle) : [...sources, s.cle])}
                  className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${actif ? `${s.classe} ring-transparent` : "bg-surface text-texte-3 ring-bordure"}`}
                  aria-pressed={actif}
                >
                  {s.libelle}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-end gap-2">
          <label>
            <span className="etiquette">Du</span>
            <input type="date" value={du} max={au} onChange={(e) => setDu(e.target.value)} className="champ py-1.5" />
          </label>
          <label>
            <span className="etiquette">Au</span>
            <input type="date" value={au} min={du} onChange={(e) => setAu(e.target.value)} className="champ py-1.5" />
          </label>
          {(du !== periode.du || au !== periode.au) && (
            <button type="button" onClick={changerPeriode} className="bouton-principal py-1.5">
              Appliquer
            </button>
          )}
        </div>
        <label>
          <span className="etiquette">Ordre des sites</span>
          <select value={tri} onChange={(e) => setTri(e.target.value as Tri)} className="champ py-2">
            <option value="recentes">Photos les plus récentes d&apos;abord</option>
            <option value="nombre">Le plus de photos d&apos;abord</option>
            <option value="code">Par code de site</option>
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2.5 text-sm">
          <input type="checkbox" checked={sansPhoto} onChange={(e) => setSansPhoto(e.target.checked)} />
          Afficher aussi les sites sans photo
        </label>
      </div>

      <p className="text-sm text-texte-2">
        {total} photo{total > 1 ? "s" : ""} · {lignes.length} site{lignes.length > 1 ? "s" : ""} · visites du {dateCourte(periode.du)} au{" "}
        {dateCourte(periode.au)}
      </p>

      <div className="space-y-3">
        {lignes.slice(0, affiches).map(({ site, photos: ps }) => (
          <LigneSite
            key={site.id}
            site={site}
            photos={ps}
            urls={urls.current}
            signer={signer}
            ouvrir={(index) => setOuverte({ photos: ps, index })}
          />
        ))}
        {lignes.length === 0 && (
          <div className="carte p-8 text-center text-texte-2">
            <ImageOff className="mx-auto mb-2 h-8 w-8 text-texte-3" />
            Aucune photo pour ces filtres et cette période.
          </div>
        )}
      </div>
      {lignes.length > affiches && (
        <button type="button" onClick={() => setAffiches((n) => n + PAR_PAGE)} className="bouton-secondaire w-full">
          Afficher {Math.min(PAR_PAGE, lignes.length - affiches)} sites de plus ({lignes.length - affiches} restants)
        </button>
      )}

      {ouverte && (
        <Agrandissement
          photos={ouverte.photos}
          index={ouverte.index}
          urls={urls.current}
          signer={signer}
          changer={(index) => setOuverte({ ...ouverte, index })}
          fermer={() => setOuverte(null)}
        />
      )}
    </div>
  );
}

/** Une ligne : le site et ses photos en carrousel ; les images ne sont chargées qu'une fois la ligne visible. */
function LigneSite({
  site,
  photos,
  urls,
  signer,
  ouvrir,
}: {
  site: SiteGalerie;
  photos: PhotoGalerie[];
  urls: Map<string, string>;
  signer: (chemins: string[]) => Promise<void>;
  ouvrir: (index: number) => void;
}) {
  const ligne = useRef<HTMLElement>(null);
  const bande = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ligne.current;
    if (!el || !photos.length) return;
    const obs = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((e) => e.isIntersecting)) {
          signer(photos.map((p) => p.chemin));
          obs.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [photos, signer]);
  // Photo la plus récente visible d'emblée (fin de la bande).
  useEffect(() => {
    if (bande.current) bande.current.scrollLeft = bande.current.scrollWidth;
  }, [photos.length]);
  const defiler = (sens: number) => bande.current?.scrollBy({ left: sens * 360, behavior: "smooth" });

  return (
    <section ref={ligne} className="carte p-3">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <Link href={`/site/${site.code}`} className="font-semibold text-accent hover:underline">
          {site.nom}
        </Link>
        <span className="text-xs text-texte-2">
          {site.code} · lot {site.lot_id}
          {site.entreprise ? ` · ${site.entreprise}` : ""} · MOE {site.lot_moe_id} · {site.localite || site.departement}
        </span>
        {site.a_verifier && (
          <span className="inline-flex items-center gap-1 text-xs text-alerte" title={site.a_verifier}>
            <AlertTriangle className="h-3.5 w-3.5" /> à vérifier
          </span>
        )}
        <span className="ml-auto text-xs text-texte-3">
          {photos.length} photo{photos.length > 1 ? "s" : ""}
        </span>
      </div>
      {photos.length === 0 ? (
        <p className="text-sm text-texte-3">Aucune photo sur la période.</p>
      ) : (
        <div className="relative">
          <div ref={bande} className="flex snap-x gap-2 overflow-x-auto pb-1">
            {photos.map((p, i) => {
              const url = urls.get(p.chemin);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => ouvrir(i)}
                  className="group relative h-32 w-44 shrink-0 snap-start overflow-hidden rounded-champ bg-surface-2 ring-1 ring-bordure"
                  title={`${libelleSource(p.source)} · visite du ${dateCourte(p.date)}${p.legende ? ` · ${p.legende}` : ""}`}
                >
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={p.legende || `Photo ${libelleSource(p.source)}`} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <span className="block h-full w-full animate-pulse bg-surface-2" />
                  )}
                  <span className={`absolute left-1 top-1 rounded px-1.5 py-0.5 text-[11px] font-bold ${classeSource(p.source)}`}>
                    {libelleSource(p.source)}
                  </span>
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/55 px-1.5 py-0.5 text-[11px] text-white">
                    {dateCourte(p.date)}
                    {p.latitude !== null && <MapPin className="h-3 w-3" aria-label="Photo géolocalisée" />}
                  </span>
                </button>
              );
            })}
          </div>
          {photos.length > 3 && (
            <>
              <button type="button" onClick={() => defiler(-1)} aria-label="Photos précédentes" className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1 shadow ring-1 ring-bordure">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => defiler(1)} aria-label="Photos suivantes" className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1 shadow ring-1 ring-bordure">
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/** Photo en grand, avec ses informations ; flèches (ou clavier) pour passer aux autres photos du site. */
function Agrandissement({
  photos,
  index,
  urls,
  signer,
  changer,
  fermer,
}: {
  photos: PhotoGalerie[];
  index: number;
  urls: Map<string, string>;
  signer: (chemins: string[]) => Promise<void>;
  changer: (index: number) => void;
  fermer: () => void;
}) {
  const p = photos[index];
  useEffect(() => {
    signer([p.chemin]);
  }, [p.chemin, signer]);
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
      if (e.key === "ArrowLeft" && index > 0) changer(index - 1);
      if (e.key === "ArrowRight" && index < photos.length - 1) changer(index + 1);
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [index, photos.length, changer, fermer]);
  const url = urls.get(p.chemin);
  const heure = p.prise_le ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(p.prise_le)) : null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90 text-white" role="dialog" aria-modal="true" onClick={fermer}>
      <div className="flex items-center gap-3 px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
        <span className={`rounded px-2 py-0.5 text-xs font-bold ${classeSource(p.source)}`}>{libelleSource(p.source)}</span>
        <span>Visite du {dateCourte(p.date)}</span>
        {heure && <span className="text-white/70">· prise le {heure}</span>}
        <span className="text-white/70">
          · {index + 1} / {photos.length}
        </span>
        <button type="button" onClick={fermer} className="ml-auto rounded-full p-1.5 hover:bg-white/15" aria-label="Fermer">
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-12" onClick={(e) => e.stopPropagation()}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={p.legende || "Photo"} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-white/60">Chargement…</span>
        )}
        {index > 0 && (
          <button type="button" onClick={() => changer(index - 1)} aria-label="Photo précédente" className="absolute left-2 rounded-full bg-white/15 p-2 hover:bg-white/25">
            <ChevronLeft className="h-7 w-7" />
          </button>
        )}
        {index < photos.length - 1 && (
          <button type="button" onClick={() => changer(index + 1)} aria-label="Photo suivante" className="absolute right-2 rounded-full bg-white/15 p-2 hover:bg-white/25">
            <ChevronRight className="h-7 w-7" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
        {p.legende && <span>{p.legende}</span>}
        {p.latitude !== null && p.longitude !== null ? (
          <a
            href={`https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=17/${p.latitude}/${p.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-white/80 underline hover:text-white"
          >
            <MapPin className="h-4 w-4" /> {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
          </a>
        ) : (
          <span className="text-white/60">Sans position GPS</span>
        )}
        <Link href={`/visite/${p.visite_id}`} className="ml-auto text-white/80 underline hover:text-white">
          Voir le formulaire
        </Link>
      </div>
    </div>
  );
}
