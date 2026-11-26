"use client";

import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LIBELLES_ROLES, type RoleUtilisateur } from "@/lib/constants";
import { ROLES_DEMANDABLES } from "@/lib/auth-roles";


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
  const [roleSouhaite, setRoleSouhaite] = useState<RoleUtilisateur>("moe_controleur");
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
        <MailCheck className="h-10 w-10 text-succes" />
        <p className="font-medium">Vérifiez votre boîte mail</p>
        <p className="text-sm text-texte-2">
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
        <label htmlFor="nomComplet" className="etiquette">
          Nom complet
        </label>
        <input
          id="nomComplet"
          type="text"
          required
          autoComplete="name"
          value={nomComplet}
          onChange={(e) => setNomComplet(e.target.value)}
          className="champ"
        />
      </div>
      <div>
        <label htmlFor="telephone" className="etiquette">
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
          className="champ"
        />
      </div>
      <div>
        <label htmlFor="email" className="etiquette">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="champ"
        />
      </div>
      <div>
        <label htmlFor="motDePasse" className="etiquette">
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
          className="champ"
        />
        <p className="mt-1 text-xs text-texte-3">8 caractères minimum.</p>
      </div>
      <div>
        <label htmlFor="role" className="etiquette">
          Rôle demandé
        </label>
        <select
          id="role"
          value={roleSouhaite}
          onChange={(e) => setRoleSouhaite(e.target.value as RoleUtilisateur)}
          className="champ"
        >
          {ROLES_DEMANDABLES.map((role) => (
            <option key={role} value={role}>
              {LIBELLES_ROLES[role]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-texte-3">
          Le rôle définitif est confirmé par l&apos;administrateur à la
          validation du compte.
        </p>
      </div>

      {erreur && (
        <p className="message-erreur" role="alert">
          {erreur}
        </p>
      )}

      <button
        type="submit"
        disabled={enCours}
        className="bouton-principal w-full"
      >
        {enCours && <Loader2 className="h-5 w-5 animate-spin" />}
        Créer mon compte
      </button>
    </form>
  );
}
