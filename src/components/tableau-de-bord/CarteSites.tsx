"use client";

/**
 * Carte des sites (Leaflet, sans react-leaflet). Chargée uniquement côté
 * navigateur (import dynamique, ssr: false) et seulement quand on l'affiche.
 * Couleurs lues dans le thème (src/theme/theme.css).
 */
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Maximize2, Minimize2 } from "lucide-react";
import { LIBELLES_STATUTS } from "@/lib/formulaires/statuts";
import { dateCourte, pct, type EtatSite } from "@/lib/tableau-de-bord/calculs";
import { ORDRE_STATUTS, VARIABLE_STATUT } from "@/lib/tableau-de-bord/couleurs";

export type ModeCarte = "statut" | "avancement";

const CENTRE_CI: [number, number] = [7.6, -5.6];
const ZOOM_CI = 7;

const lireCouleur = (variable: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return v ? `rgb(${v.split(/\s+/).join(",")})` : "#888";
};

const echapper = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function popup(s: EtatSite): string {
  const statut = s.moe_statut ? LIBELLES_STATUTS[s.moe_statut] : "Pas de rapport MOE";
  const position =
    s.origine_position === "departement"
      ? `<p style="margin:4px 0 0;font-size:11px;color:#777">Position approximative (chef-lieu de ${echapper(s.departement)})</p>`
      : s.origine_position === "photos"
        ? `<p style="margin:4px 0 0;font-size:11px;color:#777">Position issue des photos géolocalisées</p>`
        : "";
  return `<div style="min-width:200px">
    <p style="margin:0;font-weight:700">${echapper(s.nom)}</p>
    <p style="margin:0 0 4px;font-size:12px;color:#555">${echapper(s.code)} · Lot ${s.lot_id} · ${echapper(s.localite)}</p>
    <p style="margin:0;font-size:12px">Statut (MOE) : <strong>${statut}</strong></p>
    <p style="margin:0;font-size:12px">Avancement (MOE) : <strong>${pct(s.moe_avancement === null ? null : Number(s.moe_avancement))}</strong>
      · ${dateCourte(s.moe_date)}</p>
    ${s.discordance ? `<p style="margin:2px 0 0;font-size:12px;color:#c2410c">Écart UG / MOE : ${Number(s.ecart_ug_moe) > 0 ? "+" : ""}${String(s.ecart_ug_moe).replace(".", ",")} pts</p>` : ""}
    ${position}
    <p style="margin:6px 0 0"><a href="/site/${encodeURIComponent(s.code)}" style="font-weight:600;font-size:12px">Voir la fiche du site →</a></p>
  </div>`;
}

export default function CarteSites({ sites }: { sites: EtatSite[] }) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<L.Map | null>(null);
  const couche = useRef<L.LayerGroup | null>(null);
  const emprise = useRef<L.LatLngBounds | null>(null);
  const [mode, setMode] = useState<ModeCarte>("statut");
  const [pleinEcran, setPleinEcran] = useState(false);

  useEffect(() => {
    if (!conteneur.current || carte.current) return;
    const m = L.map(conteneur.current, { preferCanvas: true }).setView(CENTRE_CI, ZOOM_CI);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(m);
    couche.current = L.layerGroup().addTo(m);
    carte.current = m;
    const observateur = new ResizeObserver(() => m.invalidateSize());
    observateur.observe(conteneur.current);
    return () => {
      observateur.disconnect();
      m.remove();
      carte.current = null;
      couche.current = null;
    };
  }, []);

  useEffect(() => {
    const c = couche.current;
    if (!c) return;
    c.clearLayers();
    const gris = lireCouleur(VARIABLE_STATUT.aucun);
    const min = getComputedStyle(document.documentElement).getPropertyValue("--c-chaleur-min").trim().split(/\s+/).map(Number);
    const max = getComputedStyle(document.documentElement).getPropertyValue("--c-chaleur-max").trim().split(/\s+/).map(Number);
    const degrade = (v: number) =>
      `rgb(${min.map((a, i) => Math.round(a + (max[i] - a) * Math.min(Math.max(v, 0), 100) / 100)).join(",")})`;
    const points: L.LatLngTuple[] = [];
    for (const s of sites) {
      if (s.latitude === null || s.longitude === null) continue;
      const couleur =
        mode === "statut"
          ? lireCouleur(VARIABLE_STATUT[s.moe_statut ?? "aucun"])
          : s.moe_avancement === null
            ? gris
            : degrade(Number(s.moe_avancement));
      L.circleMarker([s.latitude, s.longitude], {
        radius: 7,
        color: "#ffffff",
        weight: 1.5,
        fillColor: couleur,
        fillOpacity: 0.9,
      })
        .bindPopup(popup(s))
        .addTo(c);
      points.push([s.latitude, s.longitude]);
    }
    emprise.current = points.length ? L.latLngBounds(points) : null;
    if (emprise.current && carte.current) carte.current.fitBounds(emprise.current, { padding: [24, 24], maxZoom: 10 });
  }, [sites, mode]);

  // Changement de taille (plein écran) : recadrer sur les sites.
  useEffect(() => {
    const m = carte.current;
    if (!m) return;
    const t = setTimeout(() => {
      m.invalidateSize();
      if (emprise.current) m.fitBounds(emprise.current, { padding: [24, 24], maxZoom: 10 });
    }, 50);
    return () => clearTimeout(t);
  }, [pleinEcran]);

  useEffect(() => {
    if (!pleinEcran) return;
    const fermer = (e: KeyboardEvent) => e.key === "Escape" && setPleinEcran(false);
    window.addEventListener("keydown", fermer);
    return () => window.removeEventListener("keydown", fermer);
  }, [pleinEcran]);

  const approximatifs = sites.filter((s) => s.origine_position === "departement").length;

  return (
    <div className={pleinEcran ? "fixed inset-0 z-[1000] flex flex-col bg-surface p-3" : ""}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <div className="flex rounded-full bg-surface-2 p-0.5 ring-1 ring-bordure" role="radiogroup" aria-label="Couleur des points">
          {(["statut", "avancement"] as ModeCarte[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-full px-3 py-1 ${mode === m ? "bg-accent text-sur-accent" : "text-texte-2"}`}
            >
              {m === "statut" ? "Statut" : "Avancement"}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setPleinEcran((p) => !p)} className="bouton-secondaire ml-auto !px-3 !py-1">
          {pleinEcran ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {pleinEcran ? "Réduire" : "Plein écran"}
        </button>
      </div>
      {/* La div de Leaflet garde une classe fixe : React effacerait sinon les classes ajoutées par Leaflet. */}
      <div className={`relative z-0 w-full overflow-hidden rounded-carte ring-1 ring-bordure ${pleinEcran ? "flex-1" : "h-[340px]"}`}>
        <div ref={conteneur} className="absolute inset-0" />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-texte-2">
        {mode === "statut" ? (
          <>
            {ORDRE_STATUTS.map((s) => (
              <span key={s.cle} className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: `rgb(var(${VARIABLE_STATUT[s.cle]}))` }} />
                {s.libelle}
              </span>
            ))}
          </>
        ) : (
          <span className="inline-flex items-center gap-2">
            0 %
            <span
              className="h-2.5 w-24 rounded-full"
              style={{ background: "linear-gradient(to right, rgb(var(--c-chaleur-min)), rgb(var(--c-chaleur-max)))" }}
            />
            100 %
          </span>
        )}
        {approximatifs > 0 && (
          <span className="w-full text-texte-3">
            {approximatifs} site{approximatifs > 1 ? "s" : ""} placé{approximatifs > 1 ? "s" : ""} au chef-lieu de leur
            département (coordonnées GPS à venir : elles seront reprises des photos géolocalisées).
          </span>
        )}
      </div>
    </div>
  );
}
