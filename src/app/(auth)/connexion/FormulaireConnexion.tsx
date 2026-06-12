"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function messageErreurFr(message: string): string {
  if (message.includes("Invalid login credentials"))
    return "Email ou mot de passe incorrect.";
  if (message.includes("Email not confirmed"))
    return "Email non confirmé : cliquez sur le lien reçu par email avant de vous connecter.";
  return "Connexion impossible : " + message;
}

export function FormulaireConnexion() {
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function seConnecter(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: motDePasse,
    });

    if (error) {
      setErreur(messageErreurFr(error.message));
      setEnCours(false);
      return;
    }

    // Rechargement complet pour que le middleware voie les cookies de session.
    window.location.assign("/");
  }

  return (
    <form onSubmit={seConnecter} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="block w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-assemblage focus:outline-none focus:ring-1 focus:ring-assemblage"
        />
      </div>
      <div>
        <label htmlFor="motDePasse" className="mb-1 block text-sm font-medium">
          Mot de passe
        </label>
        <input
          id="motDePasse"
          type="password"
          required
          autoComplete="current-password"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          className="block w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-assemblage focus:outline-none focus:ring-1 focus:ring-assemblage"
        />
      </div>

      {erreur && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {erreur}
        </p>
      )}

      <button
        type="submit"
        disabled={enCours}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-assemblage px-4 py-3 text-base font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
      >
        {enCours && <Loader2 className="h-5 w-5 animate-spin" />}
        Se connecter
      </button>
    </form>
  );
}
