"use client";

import { useEffect, useState } from "react";
import { compterEnAttente, EVENEMENT_FILE } from "./db";

/** Statut réseau du navigateur. */
export function useEnLigne() {
  const [enLigne, setEnLigne] = useState(true);

  useEffect(() => {
    setEnLigne(navigator.onLine);
    const allume = () => setEnLigne(true);
    const eteint = () => setEnLigne(false);
    window.addEventListener("online", allume);
    window.addEventListener("offline", eteint);
    return () => {
      window.removeEventListener("online", allume);
      window.removeEventListener("offline", eteint);
    };
  }, []);

  return enLigne;
}

/** Nombre d'entrées (visites + photos) en attente de synchronisation. */
export function useFileAttente() {
  const [nombre, setNombre] = useState(0);

  useEffect(() => {
    let actif = true;
    const rafraichir = () => {
      compterEnAttente().then((n) => {
        if (actif) setNombre(n);
      });
    };
    rafraichir();
    window.addEventListener(EVENEMENT_FILE, rafraichir);
    return () => {
      actif = false;
      window.removeEventListener(EVENEMENT_FILE, rafraichir);
    };
  }, []);

  return nombre;
}
