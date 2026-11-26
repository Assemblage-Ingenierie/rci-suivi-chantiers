"use client";

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function BoutonDeconnexion({ variante = "bouton" }: { variante?: "bouton" | "icone" }) {
  async function seDeconnecter() {
    await createClient().auth.signOut();
    window.location.assign("/connexion");
  }

  if (variante === "icone") {
    return (
      <button
        onClick={seDeconnecter}
        title="Se déconnecter"
        aria-label="Se déconnecter"
        className="rounded-champ p-2 opacity-80 transition hover:bg-black/10 hover:opacity-100"
      >
        <LogOut className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button onClick={seDeconnecter} className="bouton-secondaire">
      <LogOut className="h-4 w-4" />
      Se déconnecter
    </button>
  );
}
