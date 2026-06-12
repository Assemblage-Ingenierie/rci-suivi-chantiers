"use client";

import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LIBELLES_ROLES, type RoleUtilisateur } from "@/lib/constants";

/** Rôles proposés à l'inscription (le rôle admin est attribué manuellement). */
const ROLES_PROPOSES: RoleUtilisateur[] = ["coges", "regional", "national"];

function messageErreurFr(message: string): string {
  if (message.includes("already registered"))
    return "Un compte existe déjà avec cet email.";
  if (message.includes("Password should be at least"))
    return "Le mot de passe doit contenir au moins 6 caractères.";
  return "Inscription impossible : " + message;
}

export function FormulaireInscription() {
  const [nomComplet, setNomComplet] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [roleSouhaite, setRoleSouhaite] = useState<RoleUtilisateur>("coges");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [emailAConfirmer, setEmailAConfirmer] = useState(false);

  async function sInscrire(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: motDePasse,
      options: {
        // Stockées dans user_metadata : reprises à la première connexion pour
        // créer le profil (statut en_attente, validé ensuite par un admin).
        data: {
          nom_complet: nomComplet.trim(),
          telephone: telephone.trim(),
          role_souhaite: roleSouhaite,
        },
      },
    });

    if (error) {
      setErreur(messageErreurFr(error.message));
      setEnCours(false);
      return;
    }

    if (data.session) {
      // Confirmation email désactivée : session immédiate, le profil est créé
      // par la page d'accueil.
      window.location.assign("/");
      return;
    }

    // Confirmation email activée : inviter à vérifier la boîte mail.
    setEmailAConfirmer(true);
    setEnCours(false);
  }

  if (emailAConfirmer) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <MailCheck className="h-10 w-10 text-green-600" />
        <p className="font-medium">Vérifiez votre boîte mail</p>
        <p className="text-sm text-gray-600">
          Un lien de confirmation a été envoyé à <strong>{email}</strong>.
          Cliquez dessus, puis connectez-vous. Votre compte sera ensuite soumis
          à validation par un administrateur.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={sInscrire} className="space-y-4">
      <div>
        <label htmlFor="nomComplet" className="mb-1 block text-sm font-medium">
          Nom complet
        </label>
        <input
          id="nomComplet"
          type="text"
          required
          autoComplete="name"
          value={nomComplet}
          onChange={(e) => setNomComplet(e.target.value)}
          className="block w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-assemblage focus:outline-none focus:ring-1 focus:ring-assemblage"
        />
      </div>
      <div>
        <label htmlFor="telephone" className="mb-1 block text-sm font-medium">
          Téléphone
        </label>
        <input
          id="telephone"
          type="tel"
          required
          autoComplete="tel"
          placeholder="+225 07 XX XX XX XX"
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          className="block w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-assemblage focus:outline-none focus:ring-1 focus:ring-assemblage"
        />
      </div>
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
          minLength={8}
          autoComplete="new-password"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          className="block w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-assemblage focus:outline-none focus:ring-1 focus:ring-assemblage"
        />
        <p className="mt-1 text-xs text-gray-500">8 caractères minimum.</p>
      </div>
      <div>
        <label htmlFor="role" className="mb-1 block text-sm font-medium">
          Rôle demandé
        </label>
        <select
          id="role"
          value={roleSouhaite}
          onChange={(e) => setRoleSouhaite(e.target.value as RoleUtilisateur)}
          className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base focus:border-assemblage focus:outline-none focus:ring-1 focus:ring-assemblage"
        >
          {ROLES_PROPOSES.map((role) => (
            <option key={role} value={role}>
              {LIBELLES_ROLES[role]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Le rôle définitif est confirmé par l&apos;administrateur à la
          validation du compte.
        </p>
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
        Créer mon compte
      </button>
    </form>
  );
}
