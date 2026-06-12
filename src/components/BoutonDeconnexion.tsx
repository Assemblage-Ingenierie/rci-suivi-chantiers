"use client";

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function BoutonDeconnexion({
  variante = "bouton",
}: {
  variante?: "bouton" | "icone";
}) {
  async function seDeconnecter() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/connexion");
  }

  if (variante === "icone") {
    return (
      <button
        onClick={seDeconnecter}
        title="Se déconnecter"
        className="rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
      >
        <LogOut className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      onClick={seDeconnecter}
      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
    >
      <LogOut className="h-4 w-4" />
      Se déconnecter
    </button>
  );
}
