"use client";

/**
 * Carte Leaflet des chantiers (CDC §5.3) — Leaflet "nu" (pas de react-leaflet)
 * dans un composant client chargé dynamiquement (ssr: false).
 * Deux modes de couleur : statut / avancement réel.
 */
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  CENTRE_CI,
  ZOOM_CI,
  couleurAvancement,
  couleurStatut,
} from "@/lib/carte";
import {
  LIBELLES_STATUTS_CHANTIER,
  type StatutChantier,
} from "@/lib/constants";

export type ModeCarte = "statut" | "avancement";

export interface PointCarte {
  id: string;
  nom: string;
  latitude: number;
  longitude: number;
  statut: StatutChantier | null;
  avancement: number | null;
  financier: number | null;
}

function htmlPopup(point: PointCarte): string {
  const statut = point.statut
    ? LIBELLES_STATUTS_CHANTIER[point.statut]
    : "—";
  const av = point.avancement !== null ? `${point.avancement} %` : "—";
  const fi = point.financier !== null ? `${point.financier} %` : "—";
  return `
    <div style="min-width:190px">
      <p style="margin:0 0 4px;font-weight:600">${point.nom}</p>
      <p style="margin:0;font-size:12px">Statut : <strong>${statut}</strong></p>
      <p style="margin:0;font-size:12px">Avancement physique : <strong>${av}</strong></p>
      <p style="margin:0;font-size:12px">Avancement financier : <strong>${fi}</strong></p>
      <p style="margin:6px 0 0"><a href="/etablissements/${point.id}" style="color:#E8201A;font-weight:600;font-size:12px">Voir la fiche →</a></p>
    </div>`;
}

export function CarteChantiers({
  points,
  mode,
  hauteur = 420,
}: {
  points: PointCarte[];
  mode: ModeCarte;
  hauteur?: number;
}) {
  const refConteneur = useRef<HTMLDivElement>(null);
  const refCarte = useRef<L.Map | null>(null);
  const refCouche = useRef<L.LayerGroup | null>(null);

  // Création de la carte (une seule fois).
  useEffect(() => {
    if (!refConteneur.current || refCarte.current) return;
    const carte = L.map(refConteneur.current).setView(CENTRE_CI, ZOOM_CI);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(carte);
    refCouche.current = L.layerGroup().addTo(carte);
    refCarte.current = carte;
    // Le conteneur vient d'être dimensionné par le layout.
    setTimeout(() => carte.invalidateSize(), 100);
    return () => {
      carte.remove();
      refCarte.current = null;
      refCouche.current = null;
    };
  }, []);

  // Marqueurs : re-dessinés quand les points ou le mode changent.
  useEffect(() => {
    const couche = refCouche.current;
    if (!couche) return;
    couche.clearLayers();
    for (const point of points) {
      const couleur =
        mode === "statut"
          ? couleurStatut(point.statut)
          : couleurAvancement(point.avancement);
      L.circleMarker([point.latitude, point.longitude], {
        radius: 8,
        color: "#ffffff",
        weight: 1.5,
        fillColor: couleur,
        fillOpacity: 0.9,
      })
        .bindPopup(htmlPopup(point))
        .addTo(couche);
    }
  }, [points, mode]);

  return <div ref={refConteneur} style={{ height: hauteur }} className="z-0 w-full rounded-lg" />;
}

export default CarteChantiers;
