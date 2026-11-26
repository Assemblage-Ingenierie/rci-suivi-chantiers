"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  emailTechniqueCstc,
  identifiantValide,
  LONGUEUR_PIN,
  normaliserIdentifiant,
  pinValide,
} from "@/lib/identifiants";

type Mode = "cstc" | "email";

function messageErreurFr(message: string, mode: Mode): string {
  if (message.includes("Invalid login credentials"))
    return mode === "cstc" ? "Identifiant ou code PIN incorrect." : "Email ou mot de passe incorrect.";
  if (message.includes("Email not confirmed"))
    return "Email non confirmé : cliquez sur le lien reçu par email avant de vous connecter.";
  if (message.toLowerCase().includes("fetch"))
    return "Pas de connexion internet. La première connexion nécessite le réseau.";
  return "Connexion impossible : " + message;
}

const CLE_MODE = "pateb.connexion.mode";

export function FormulaireConnexion() {
  const [mode, setMode] = useState<Mode>("cstc");

  // Retient le dernier onglet utilisé sur cet appareil (téléphone CSTC ou poste MOE / UG).
  useEffect(() => {
    try {
      const memorise = localStorage.getItem(CLE_MODE);
      if (memorise === "email" || memorise === "cstc") setMode(memorise);
    } catch {
      // stockage indisponible (navigation privée) : onglet CSTC par défaut
    }
  }, []);
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [identifiant, setIdentifiant] = useState("");
  const [pin, setPin] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  function changerMode(m: Mode) {
    setMode(m);
    setErreur(null);
    try {
      localStorage.setItem(CLE_MODE, m);
    } catch {
      // ignoré
    }
  }

  async function seConnecter(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);

    let identifiants: { email: string; password: string };
    if (mode === "cstc") {
      const id = normaliserIdentifiant(identifiant);
      if (id.includes("@"))
        return setErreur("Vous avez saisi un email : utilisez l'onglet « MOE · UG · Admin ».");
      if (!identifiantValide(id)) return setErreur("Identifiant invalide (lettres, chiffres et tirets).");
      if (!pinValide(pin)) return setErreur(`Le code PIN comporte ${LONGUEUR_PIN} chiffres.`);
      identifiants = { email: emailTechniqueCstc(id), password: pin };
    } else {
      identifiants = { email: email.trim(), password: motDePasse };
    }

    setEnCours(true);
    const { error } = await createClient().auth.signInWithPassword(identifiants);
    if (error) {
      setErreur(messageErreurFr(error.message, mode));
      setEnCours(false);
      return;
    }
    // Rechargement complet pour que le middleware voie les cookies de session.
    window.location.assign("/");
  }

  const onglet = (m: Mode, libelle: string, Icone: typeof Mail) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => changerMode(m)}
      className={`flex flex-1 items-center justify-center gap-2 rounded-champ px-3 py-2.5 text-sm font-semibold transition ${
        mode === m ? "bg-surface text-texte shadow-sm" : "text-texte-2 hover:text-texte"
      }`}
    >
      <Icone className="h-4 w-4" />
      {libelle}
    </button>
  );

  return (
    <div>
      <div role="tablist" className="mb-6 flex gap-1 rounded-carte bg-surface-2 p-1 ring-1 ring-bordure">
        {onglet("cstc", "CSTC", KeyRound)}
        {onglet("email", "MOE · UG · Admin", Mail)}
      </div>

      <form onSubmit={seConnecter} className="space-y-4" noValidate>
        {mode === "cstc" ? (
          <>
            <div>
              <label htmlFor="identifiant" className="etiquette">
                Identifiant
              </label>
              <input
                id="identifiant"
                type="text"
                required
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="ex. cstc-l19-01"
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                className="champ"
              />
            </div>
            <div>
              <label htmlFor="pin" className="etiquette">
                Code PIN ({LONGUEUR_PIN} chiffres)
              </label>
              <input
                id="pin"
                type="password"
                required
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={LONGUEUR_PIN}
                autoComplete="current-password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="champ tracking-[0.5em]"
              />
            </div>
            <p className="text-sm text-texte-2">
              Votre identifiant et votre code PIN vous sont remis par l&apos;équipe du projet.
            </p>
          </>
        ) : (
          <>
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
                autoComplete="current-password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                className="champ"
              />
            </div>
          </>
        )}

        {erreur && <p className="message-erreur" role="alert">{erreur}</p>}

        <button type="submit" disabled={enCours} className="bouton-principal w-full">
          {enCours && <Loader2 className="h-5 w-5 animate-spin" />}
          Se connecter
        </button>
      </form>
    </div>
  );
}
